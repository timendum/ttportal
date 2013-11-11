/* jshint curly: true, eqeqeq: true, forin: true, freeze: true, immed: true, indent: 4, latedef: true, undef: true, unused: true, trailing: true  */
/* jshint browser: true, jquery: true */
/* global ttRss, Mustache */
/*
 * '{"host":"https://www.emetello.com/tt-rss/api/","widgets":"[[109,108],[105],[107,106]]","session":"thsoc5tmh236t3ik86voasc5q0"}'
 * @requires jQuery($), jQuery UI & sortable/draggable UI modules
 */
var ttPortal = {
	jQuery : $,
	rss: ttRss,
	settings: {
		storage: localStorage,
		feedIdRe: /^feed-/i,
		columns: '.column',
		widgetSelector: '.widget',
		handleSelector: '.widget-head',
		contentSelector: '.widget-content',
		footerSelector: '.widget-footer',
		colorClasses: ['color-yellow', 'color-red', 'color-blue', 'color-white', 'color-orange', 'color-green'],
		defaultSize: 10
	},
	init: function () {
		this.resume();
		this.addWidgetControls();
		this.initPanel();
		this.initLogin();
		this.initNewWidget();
	},
	initPanel: function() {
		var t = this,
			rss = this.rss;
		
		rss.isLoggedIn(function(d, r){
			if (r === "success") {
				t.updateState(d.content.status);
			}
		});
	},
	updateState: function (r) {
		var t = this,
			$ = this.jQuery;
		if (r) {
			t.initLogged();
			$('#login').hide();
			$('#columns').show();
			$('#header').show();
		} else {
			$('#login').show();
			$('#columns').hide();
			$('#header').hide();
		}
	},
	/************** STORAGE ****************/
	persist: function() {
		var settings = this.settings,
			storage = settings.storage,
			rss = this.rss;
		
		storage.setItem("session", rss.session);
		storage.setItem("host", rss.base);
		
		var widgets = this.getWidgets();
		storage.setItem("widgets", JSON.stringify(widgets));
		
	},
	resume: function() {
		var settings = this.settings,
			storage = settings.storage,
			rss = this.rss;
		rss.session = storage.getItem("session");
		rss.base = storage.getItem("host");
	},
	resumeWidgets: function() {
		var settings = this.settings,
			storage = settings.storage;
			
		return JSON.parse(storage.getItem("widgets")) || [];
	},
	storageToString: function() {
		var storage = this.settings.storage,
			r = {},
			length = storage.length,
			key = null,
			i = 0;
		
		for (i=0; i < length; i++) {
			key = storage.key(i);
			r[key] = storage.getItem(key);
		}
		return JSON.stringify(r);
	},
	resumeString: function(s) {
		var storage = this.settings.storage,
			data = JSON.parse(s);
		
		Object.keys(data).forEach(function (key) {
			storage.setItem(key, data[key]);
		});
	},
	/************** WIDGET ****************/
	getWidgets: function() {
		var settings = this.settings,
			widgets = [],
			w = [];
			
		$(settings.columns).each(function(c){
			w = [];
			$(this).find(settings.widgetSelector).each(function(r){
				var widgetData = $(this).data();
				w[r] = {
					id: widgetData.id,
					size: widgetData.size,
					position: widgetData.position,
					color: widgetData.color
				};
			});
			widgets[c] = w;
		});
		return widgets;
	},
	getWidgetsFlat: function() {
		var widgets = this.getWidgets(),
			w = [];
		
		for (var c = 0; c < widgets.length; c++) {
			for (var r = 0; r < widgets[c].length; r++) {
				w.push(widgets[c][r].id);
			}
		}
		return w;
	},
	getWidgetSettings: function (id) {
		var $ = this.jQuery,
			settings = this.settings;
		return (id&&settings.widgetIndividual[id]) ? $.extend({}, settings.widgetDefault, settings.widgetIndividual[id]) : settings.widgetDefault;
	},
	addWidgetControls: function () {
		var t = this,
			$ = this.jQuery,
			rss = this.rss,
			settings = this.settings;
		
		// remove
		$(settings.columns).on("click", ".widget-head a.remove", function () {
			if (confirm('This widget will be removed, ok?')) {
				$(this).closest(settings.widgetSelector).animate({
					opacity: 0
				},
				function () {
					$(this).wrap('<div/>').parent().slideUp(function () {
						$(this).remove();
						t.persist();
					});
				});
			}
			return false;
		});
		
		// collapse
		$(settings.columns).on("click", ".widget-head a.collapse", function () {
			$(this).closest(settings.widgetSelector).addClass('collapsed')
				.find(settings.contentSelector).hide();
			return false;
		});
		$(settings.columns).on("click", ".widget-head a.expand", function () {
			$(this).closest(settings.widgetSelector).removeClass('collapsed')
				.find(settings.contentSelector).show();
			return false;
		});
		
		// click count
		$(settings.columns).on("click", settings.widgetSelector + ' ' + settings.handleSelector + ' .count', function () {
			var count = $(this),
				widget = count.closest('.widget'),
				id = widget.attr('id'),
				feedId = id.replace(settings.feedIdRe, "");
				
			rss.markReadFeed(feedId, function() {
					count.text('(0)');
					t.refreshCount();
					widget.find('li.unread').toggleClass('unread').toggleClass('read');
				});
			return false;
		});
		
		// click article
		$(settings.columns).on(
			"mousedown",
			settings.widgetSelector + ' ' + settings.contentSelector + ' .news .unread a',
			function (e) {
				if (e.which > 2)  {
					// not left nor middle
					return;
				}
				var link = $(this),
				widget = link.closest('.widget'),
				count = widget.find('.counter');
				
				rss.markReadItem(
					this.id.replace(/^article-/, ""),
					function (/*data*/) {
						link.closest('li.unread').toggleClass('unread').toggleClass('read');
						count.text(parseInt(count.text()) - 1);
						t.refreshCount();
					}
				);
			}
		);
		
		// next 
		$(settings.columns).on(
			"click",
			settings.widgetSelector + ' ' + settings.footerSelector + ' .next',
			function () {
				var count = $(this),
					widget = count.closest('.widget'),
					id = widget.attr('id'),
					widgetData = widget.data(),
					position = widgetData.size + widgetData.position;

				widget.data('position', position);
				t.refreshFeed(id, false, false);
				return false;
			}
		);
		
		// prev 
		$(settings.columns).on(
			"click",
			settings.widgetSelector + ' ' + settings.footerSelector + ' .prev',
			function () {
				var count = $(this),
					widget = count.closest('.widget'),
					id = widget.attr('id'),
					widgetData = widget.data(),
					position = widgetData.position - widgetData.size;

				if (position > -1) {
					widget.data('position', position);
					t.refreshFeed(id, false, false);
				}
				return false;
			}
		);
		
		// config button
		$(settings.columns).on(
			"click",
			settings.widgetSelector + ' .widget-head .config',
			function () {
				var widget = $(this).closest('.widget');
				
				widget.toggleClass('config');
				return false;
			}
		);
		// config color
		$(settings.columns).on(
			"click",
			settings.widgetSelector + ' .widget-config .color',
			function () {
				var link = $(this),
					widget = link.closest('.widget'),
					color = link.attr('class').split(' ')[1];
				
				widget.removeClass(widget.data('color'))
					.addClass(color)
					.data('color', color);
				t.persist();
				return false;
			}
		);
		// config save
		$(settings.columns).on(
			"click",
			settings.widgetSelector + ' .widget-config .save',
			function () {
				var widget = $(this).closest('.widget');
				widget.toggleClass('config');
				return false;
			}
		);
			
	},
	makeSortable : function () {
		var t = this,
			$ = this.jQuery,
			settings = this.settings,
			$sortableItems = $('> ' + settings.widgetSelector, settings.columns);
		
		$sortableItems.find(settings.handleSelector).css({
			cursor: 'move'
		}).mousedown(function () {
			$sortableItems.css({width:''});
			$(this).parent().css({
				width: $(this).parent().width() + 'px'
			});
		}).mouseup(function () {
			if(!$(this).parent().hasClass('dragging')) {
				$(this).parent().css({width:''});
			} else {
				$(settings.columns).sortable('disable');
			}
		});

		$(settings.columns).sortable({
			items: $sortableItems,
			connectWith: $(settings.columns),
			handle: settings.handleSelector,
			placeholder: 'widget-placeholder',
			forcePlaceholderSize: true,
			revert: 300,
			delay: 100,
			opacity: 0.8,
			containment: 'document',
			start: function (e, ui) {
				$(ui.helper).addClass('dragging');
			},
			stop: function (e, ui) {
				$(ui.item).css({width:''}).removeClass('dragging');
				$(settings.columns).sortable('enable');
				t.persist();
			}
		});
	},
	/************** LOGIN ****************/
	initLogin: function() {
		var t = this,
			$ = t.jQuery,
			rss = t.rss,
			base = location.toString(),
			clickLogin = function(event) {
				event.preventDefault();
				
				rss.base = $('#loginpasshost').val();
				
				rss.login(
					$('#loginlogin').val(),
					$('#loginpassword').val(),
					function(r) {
						t.updateState(r);
						if (r) {
							t.initLogged();
							t.persist();
						}
					}
				);
				return false;
			};
		$('#loginpasshost').val(base.substring(0, base.lastIndexOf('/') + 1) + 'api/');
		$('#loginbutton').click(clickLogin);
		$('#loginadv').click(function() {
			$('#login .row.noadv').hide();
			$('#login .row.adv').show();
			return false;
		});
		$('#loginform').submit(clickLogin);
	},
	newsTemplate: null,
	initLogged: function() {
		var t = this,
			$ = this.jQuery,
			rss = this.rss;
		
		this.newsTemplate = Mustache.compile($('#template > .news').html());
		
		rss.getCategories(function(c) {
			if (c === 0) {
				alert('Please, create a "Portal" category and fill with feed');
				return;
			}
			
			rss.getFeeds(function (data){
				var widgets = t.resumeWidgets();
				
				for (var c = 0; c < widgets.length; c++) {
					for (var r = 0; r < widgets[c].length; r++) {
						for (var i = 0; i < data.length; i++) {
							if (data[i].id === widgets[c][r].id) {
								t.addWidget(data[i], c, widgets[c][r].size, widgets[c][r].color);
								break;
							}
						}
					}
				}
				t.makeSortable();
			});
		});
		
		setInterval(
			function() {
				t.refreshFeeds();
			},
			1000*60*10
		);
	},
	refreshFeeds: function(force) {
		var t = this,
			settings = this.settings,
			$ = this.jQuery;
			
			
		$('> ' + settings.widgetSelector, settings.columns).each(function () {
			t.refreshFeed(this.id, force);
		});
	},
	refreshFeed: function(id, force, refreshCount) {
		var t = this,
			settings = this.settings,
			rss = t.rss,
			$ = this.jQuery,
			feedId = id.replace(settings.feedIdRe, ""),
			widget =  $('#' + id),
			widgetData = widget.data(),
			count =  widget.find('.counter'),
			ul =  widget.find('.news'),
			refresh = null;
		
		refresh = force ? 'getUpdatedContent' : 'getContent';
		if (typeof refreshCount !== 'undefined') {
			refreshCount = refreshCount;
		} else {
			refreshCount = true;
		}
		
		rss[refresh](feedId, widgetData.size, widgetData.position, function(data) {
			var templateData = {};
			
			ul.find('li').remove();
			templateData.news = [];
			for (var i=0; i < data.length; i++) {
				templateData.news.push({
					read: data[i].unread ? "unread" : "read",
					link: data[i].link,
					id: data[i].id,
					title: data[i].title
				});
			}
			ul.append(t.newsTemplate(templateData));
			
			if (widgetData.position > 0) {
				widget.find(settings.footerSelector).find('.disabled').removeClass('disabled');
			} else {
				widget.find(settings.footerSelector).find('.prev').addClass('disabled');
			}
			
			if (refreshCount) {
				rss.getFeeds(function (data){
					feedId = parseInt(feedId);
					for (var i = 0; i < data.length; i++) {
						if (data[i].id === feedId) {
							count.text(data[i].unread);
							t.refreshCount();
							break;
						}
					}
				});
			}
		});
	},
	refreshCount: function() {
		var c = 0,
			$ = this.jQuery,
			settings = this.settings;
			
		$(settings.columns + ' ' + settings.handleSelector + ' .counter').each(
			function() {
				c += parseInt(this.textContent);
			}
		);
		document.title = 'Tiny Tiny Portal (' + c + ')';
	},
	/************** ADD NEW WIDGET ****************/
	initNewWidget: function() {
		var t = this,
			$ = this.jQuery;
		
		$('#newwidget').click(function() {
			t.loadNewFeeds();
			$('#addwidget').show();
			$('#addwidget .step').hide();
			$('#addwidget .step.a').show();
			return false;
		});
		$('.add-cancel').click(function() {
			$('#addwidget').hide();
		});
		$('#add-submit').click(function() {
			t.addWidget(
				$('#add-feed option:selected').data()
			);
			$('#addwidget').hide();
		});
	},
	addWidget: function(data, column, size, color) {
		var t = this,
			$ = this.jQuery,
			id = 'feed-' + data.id,
			settings = this.settings,
			widget = $('#template .widget')
				.clone(true)
				.attr('id', id);
				
		column = column || 0;
		size = size || settings.defaultSize;
		color = color || settings.colorClasses[Math.floor(Math.random() * settings.colorClasses.length)];
		
		widget.data({id: data.id, size: size, position: 0, color: color});
		
		widget.find('.title').text(data.title);
		widget.find('.counter').text(data.unread);
		widget.addClass(color);
		$(settings.columns).eq(column).append(widget);
		t.refreshFeed(id);
		t.refreshCount();
		t.makeSortable();
		t.persist();
	},
	loadNewFeeds: function() {
		var t = this,
			$ = this.jQuery,
			rss = t.rss,
			widgets = this.getWidgetsFlat();
		
		rss.getFeeds(function (data){
			var es = [];
			
			$('#add-feed option').remove();
			
			for (var i = 0; i < data.length; i++) {
				if (widgets.indexOf(data[i].id) === -1) {
					es.push($("<option value='" + data[i].id + "'> " + data[i].title + " </option>").data(data[i]));
				}
			}
			
			$('#add-feed').append(es);
			
			if ($('#add-feed option').length < 1) {
				$('#addwidget .step.a').hide();
				$('#addwidget .step.e').show();
				return;
			}
			
			$('#addwidget .step.z').show();
		});
	}
};


ttPortal.init();