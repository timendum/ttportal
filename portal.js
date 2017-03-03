/* global ttRss, Mustache, $ */
/*
 * @requires jQuery($), jQuery UI & sortable/draggable UI modules
 */
var ttPortal = {
    jQuery: $,
    rss: ttRss,
    settings: {
        storage: localStorage,
        feedIdRe: /^feed-/i,
        columns: '.column',
        widgetSelector: '.widget',
        handleSelector: '.widget-head',
        settingSelector: '.widget-config',
        contentSelector: '.widget-content',
        footerSelector: '.widget-footer',
        colorClasses: ['color-yellow', 'color-red', 'color-blue', 'color-white', 'color-orange', 'color-green'],
        defaultSize: 10,
        defaultWidgetClass: 'small'
    },
    init: function () {
        this.resume();
        this.addWidgetControls();
        this.initPanel();
        this.initLogin();
        this.initHeader();
        this.initNewWidget();
    },
    initPanel: function () {
        var t = this,
            rss = this.rss;

        rss.isLoggedIn(function (d, r) {
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
    /* ************* STORAGE *************** */
    persistSession: function () {
        var settings = this.settings,
            storage = settings.storage,
            rss = this.rss;

        storage.setItem("session", rss.session);
        storage.setItem("host", rss.base);
    },
    persistWidget: function () {
        var settings = this.settings,
            storage = settings.storage;

        var widgets = this.getWidgets();
        storage.setItem("widgets", JSON.stringify(widgets));

        var pWidth = $('#columns').width();
        var widths = $(settings.columns).map(function () {
            return $(this).width() * 100 / pWidth;
        });
        storage.setItem("widths", JSON.stringify([widths[0], widths[1], widths[2]]));
    },
    resume: function () {
        var settings = this.settings,
            storage = settings.storage,
            rss = this.rss;
        rss.session = storage.getItem("session");
        rss.base = storage.getItem("host");
    },
    resumeWidgets: function () {
        var settings = this.settings,
            storage = settings.storage;

        return JSON.parse(storage.getItem("widgets")) || [];
    },
    resumeWidths: function () {
        var settings = this.settings,
            storage = settings.storage;

        return JSON.parse(storage.getItem("widths")) || [33, 33, 33];
    },
    storageToString: function () {
        var storage = this.settings.storage,
            r = {},
            length = storage.length,
            key = null,
            i = 0;

        for (i = 0; i < length; i++) {
            key = storage.key(i);
            r[key] = storage.getItem(key);
        }
        return JSON.stringify(r);
    },
    resumeString: function (s) {
        var storage = this.settings.storage,
            data = JSON.parse(s);

        Object.keys(data).forEach(function (key) {
            storage.setItem(key, data[key]);
        });
    },
    /* ************* WIDGET *************** */
    getWidgets: function () {
        var settings = this.settings,
            widgets = [],
            w = [];

        $(settings.columns).each(function (c) {
            w = [];
            $(this).find(settings.widgetSelector).each(function (r) {
                var widget = $(this),
                    widgetData = widget.data();

                w[r] = {
                    id: widgetData.id,
                    size: widgetData.size,
                    position: widgetData.position,
                    type: widgetData.type,
                    color: widgetData.color
                };
            });
            widgets[c] = w;
        });
        return widgets;
    },
    getWidgetsFlat: function () {
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
        return (id && settings.widgetIndividual[id]) ? $.extend({}, settings.widgetDefault, settings.widgetIndividual[id]) : settings.widgetDefault;
    },
    addWidgetControls: function () {
        var t = this,
            $ = this.jQuery,
            rss = this.rss,
            settings = this.settings;

        // remove
        $(settings.columns).on("click", settings.handleSelector + " a.remove", function () {
            if (confirm('This widget will be removed, ok?')) {
                $(this).closest(settings.widgetSelector).animate({
                    opacity: 0
                },
                function () {
                    $(this).wrap('<div/>').parent().slideUp(function () {
                        $(this).remove();
                        t.persistWidget();
                    });
                });
            }
            return false;
        });
        // refresh
        $(settings.columns).on("click", settings.handleSelector + " a.refresh", function () {
            var widget = $(this).closest(settings.widgetSelector);
            t.refreshFeed(widget.attr('id'), true);
            return false;
        });

        // collapse
        $(settings.columns).on("click", settings.handleSelector + " a.collapse", function () {
           var widget = $(this).closest(settings.widgetSelector).addClass('collapsed');
           widget.find(settings.contentSelector).hide();
           widget.find(settings.footerSelector).hide();
            return false;
        });
        $(settings.columns).on("click", settings.handleSelector + " a.expand", function () {
            var widget = $(this).closest(settings.widgetSelector).removeClass('collapsed');
            widget.find(settings.contentSelector).show();
            widget.find(settings.footerSelector).show();
            return false;
        });

        // click count
        $(settings.columns).on("click", settings.handleSelector + ' .count', function () {
            var count = $(this),
                widget = count.closest(settings.widgetSelector),
                id = widget.attr('id'),
                counter = widget.find('.counter'),
                feedId = id.replace(settings.feedIdRe, "");

            rss.markReadFeed(feedId, function () {
                    counter.text('0');
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
                if (e.which > 2) {
                    // not left nor middle
                    return;
                }
                var link = $(this),
                widget = link.closest(settings.widgetSelector),
                count = widget.find('.counter');

                rss.markReadItem(
                    this.id.replace(/^article-/, ""),
                    function (/* data */) {
                        var li = link.closest('li');
                        if (li.hasClass('unread')) {
                            li.removeClass('unread').addClass('read');
                            count.text(Math.max(parseInt(count.text(), 10) - 1), 0);
                            t.refreshCount();
                        }
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
                    widget = count.closest(settings.widgetSelector),
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
            settings.footerSelector + ' .prev',
            function () {
                var count = $(this),
                    widget = count.closest(settings.widgetSelector),
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
            settings.handleSelector + ' .config',
            function () {
                var widget = $(this).closest(settings.widgetSelector),
                    widgetData = widget.data();

                widget.find(settings.settingSelector + ' [name=number]').val(widgetData.size);
                widget.find(settings.settingSelector + '  [name=type]').val(widgetData.type);

                widget.toggleClass('config');
                return false;
            }
        );
        // config color
        $(settings.columns).on(
            "click",
            settings.settingSelector + ' .color',
            function () {
                var link = $(this),
                    widget = link.closest(settings.widgetSelector),
                    color = link.attr('class').split(' ')[1];

                widget.removeClass(widget.data('color'))
                    .addClass(color)
                    .data('color', color);
                t.persistWidget();
                return false;
            }
        );
        // config save
        $(settings.columns).on(
            "click",
            settings.settingSelector + ' .save',
            function () {
                var widget = $(this).closest(settings.widgetSelector),
                    size = widget.find(settings.settingSelector + ' [name=number]').val(),
                    wClass = widget.find(settings.settingSelector + '  [name=type]').val();

                size = parseInt(size, 10) || settings.defaultSize;

                widget.data({size: size, position: 0, type: wClass});

                widget.find('.news').attr('class', 'news').addClass('t-' + wClass);

                widget.toggleClass('config');

                t.persistWidget();
                t.refreshFeed(widget.attr('id'));
                return false;
            }
        );
    },
    makeResizable: function () {
        var t = this,
            eNextOW = 0,
            settings = this.settings,
            resizableItems = $(settings.columns + ':not(:last-child)'),
            resumedWidths = this.resumeWidths();

        resizableItems.resizable({
            handles: "e",
            start: function (event, ui) {
                eNextOW = ui.element.next().width();
            },
            resize: function (event, ui) {
                ui.element.next().width(eNextOW + ui.originalSize.width - ui.size.width);
            },
            stop: function (/* event, ui */) {
                t.persistWidget();
            }
        });

        $(settings.columns).each(function (index) {
            $(this).width(resumedWidths[index] + '%');
        });
    },
    makeSortable: function () {
        var t = this,
            $ = this.jQuery,
            settings = this.settings,
            $sortableItems = $('> ' + settings.widgetSelector, settings.columns);

        $sortableItems.find(settings.handleSelector).css({
            cursor: 'move'
        }).mousedown(function () {
            $sortableItems.css({width: ''});
            $(this).parent().css({
                width: $(this).parent().width() + 'px'
            });
        }).mouseup(function () {
            if (!$(this).parent().hasClass('dragging')) {
                $(this).parent().css({width: ''});
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
                $(ui.item).css({width: ''}).removeClass('dragging');
                $(settings.columns).sortable('enable');
                t.persistWidget();
            }
        });
    },
    /* ************* HEADER ************** */
    initHeader: function () {
        var t = this,
            rss = t.rss,
            $ = t.jQuery;

        /* Export */
        $('#export').click(function () {
            $('#textsettings textarea').val('');
            $('#textsettings').show();
            return false;
        });

        $('#ts-close').click(function () {
            $('#textsettings').hide();
            return false;
        });

        $('#ts-export').click(function () {
            $('#textsettings textarea').val(t.storageToString());
            return false;
        });

        $('#ts-import').click(function () {
            var txt = $('#textsettings textarea').val();
            if (!txt) {
                return false;
            }

            try {
                JSON.parse(txt);
            } catch (e) {
                alert('Input not valid');
                return false;
            }

            var c = window.confirm('This will overwrite your current settings');
            if (!c) {
                return false;
            }
            t.resumeString(txt);
            alert('Settings imported');
            document.location.reload();
            return false;
        });

        /* Logout */
        $('#logout').click(function () {
            rss.logout(function () {
                document.location.reload();
            });
        });
    },
    /* ************* LOGIN *************** */
    initLogin: function () {
        var t = this,
            $ = t.jQuery,
            rss = t.rss,
            clickLogin = function (event) {
                event.preventDefault();

                rss.base = $('#login-host').val().replace(/\/$/, '') + '/api/';

                rss.login(
                    $('#login-username').val(),
                    $('#login-password').val(),
                    function (r) {
                        t.updateState(r);
                        if (r) {
                            t.initLogged();
                            t.persistSession();
                        }
                    }
                );
                return false;
            };
        $('#login-host').val(location.protocol + "//" + location.hostname + ":" + location.port + '/tt-rss');
        $('#login-button').click(clickLogin);
        $('#login-adv').click(function () {
            $('#login .row.noadv').hide();
            $('#login .row.adv').show();
            return false;
        });
        $('#login-form').submit(clickLogin);
    },
    newsTemplate: {},
    initLogged: function () {
        var t = this,
            $ = this.jQuery,
            rss = this.rss;

        this.newsTemplate.small = $('#template > .news.t-small').html();
        Mustache.parse(this.newsTemplate.small);
        this.newsTemplate.excerpt = $('#template > .news.t-excerpt').html();
        Mustache.parse(this.newsTemplate.excerpt);

        rss.getCategories(function (portalCategory) {
            if (portalCategory === 0) {
                alert('Please, create a "Portal" category and fill with feed');
                return;
            }

            rss.getFeeds(function (data) {
                var widgets = t.resumeWidgets();

                for (var c = 0; c < widgets.length; c++) {
                    for (var r = 0; r < widgets[c].length; r++) {
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].id === widgets[c][r].id) {
                                t.addWidget(
                                    data[i],
                                    {
                                        column: c,
                                        type: widgets[c][r].type,
                                        size: widgets[c][r].size,
                                        color: widgets[c][r].color
                                    }
                                );
                                break;
                            }
                        }
                    }
                }
                t.makeSortable();
            });
        });

        setInterval(
            function () {
                t.refreshFeeds();
            },
            1000 * 60 * 10
        );
    },
    refreshFeeds: function (force) {
        var t = this,
            settings = this.settings,
            $ = this.jQuery;

        $('> ' + settings.widgetSelector, settings.columns).each(function () {
            t.refreshFeed(this.id, force);
        });
    },
    refreshFeed: function (id, force, refreshCount) {
        var t = this,
            settings = this.settings,
            rss = t.rss,
            $ = this.jQuery,
            feedId = id.replace(settings.feedIdRe, ""),
            widget = $('#' + id),
            widgetData = widget.data(),
            count = widget.find('.counter'),
            ul = widget.find('.news'),
            wClass = settings.defaultWidgetClass,
            refresh = null;

        refresh = force ? 'getUpdatedContent' : 'getContent';
        if (typeof refreshCount !== 'undefined') {
            refreshCount = refreshCount;
        } else {
            refreshCount = true;
        }

        $.each(
            ul.attr('class').split(' '),
            function (index, value) {
                if (value.indexOf('t-') === 0) {
                    wClass = value.substring(2);
                    return false;
                }
                return false;
            }
        );

        rss[refresh](feedId, widgetData.size, widgetData.position, function (data) {
            var templateData = {};

            feedId = parseInt(feedId, 10);

            ul.find('li').remove();
            templateData.news = [];
            for (let i = 0; i < data.length; i++) {
                templateData.news.push({
                    read: data[i].unread ? "unread" : "read",
                    link: data[i].link,
                    id: data[i].id,
                    excerpt: (data[i].excerpt.trim() || "&nbsp;"),
                    title: data[i].title
                });
            }
            ul.append(Mustache.render(t.newsTemplate[wClass], templateData));

            if (widgetData.position > 0) {
                widget.find(settings.footerSelector).find('.disabled').removeClass('disabled');
            } else {
                widget.find(settings.footerSelector).find('.prev').addClass('disabled');
            }

            if (refreshCount) {
                rss.getFeeds(function (feedData) {
                    for (var i = 0; i < feedData.length; i++) {
                        if (parseInt(feedData[i].id, 10) === feedId) {
                            count.text(feedData[i].unread);
                            t.refreshCount();
                            break;
                        }
                    }
                });
            }
        });
    },
    refreshCount: function () {
        var c = 0,
            $ = this.jQuery,
            settings = this.settings;

        $(settings.columns + ' ' + settings.handleSelector + ' .counter').each(
            function () {
                c += parseInt(this.textContent, 10);
            }
        );
        document.title = 'Tiny Tiny Portal (' + c + ')';
    },
    /* *********** ADD NEW WIDGET *************** */
    initNewWidget: function () {
        var t = this,
            $ = this.jQuery;

        $('#new-widget').click(function () {
            t.loadNewFeeds();
            $('#addwidget').show();
            $('#addwidget .step').hide();
            $('#addwidget .step.a').show();
            return false;
        });
        $('.add-cancel').click(function () {
            $('#addwidget').hide();
        });
        $('#add-submit').click(function () {
            t.addWidget(
                $('#add-feed option:selected').data()
            );
            $('#addwidget').hide();
        });
    },
    addWidget: function (data, options, replace) {
        var t = this,
            $ = this.jQuery,
            id = 'feed-' + data.id,
            settings = this.settings,
            widget = $('#template .widget')
                .clone(true)
                .attr('id', id),
            size = 0,
            column = 0,
            color = '',
            widgetClass = '';

        options = options || {};
        column = options.column || column;
        size = options.size || settings.defaultSize;
        color = options.color || settings.colorClasses[Math.floor(Math.random() * settings.colorClasses.length)];
        widgetClass = options.type || settings.defaultWidgetClass;

        if ($('#' + id).length > 0) {
            return;
        }
        widget.data({id: data.id, size: size, position: 0, color: color, type: widgetClass});

        widget.find('.title').text(data.title);
        widget.find('.counter').text(data.unread);
        widget.find('.news').addClass('t-' + widgetClass);
        widget.addClass(color);
        if (!replace) {
            $(settings.columns).eq(column).append(widget);
        } else {
            $(replace).replaceWith(widget);
        }
        t.refreshFeed(id);
        t.refreshCount();
        t.makeSortable();
        t.makeResizable();
        t.persistWidget();
    },
    loadNewFeeds: function () {
        var t = this,
            $ = this.jQuery,
            rss = t.rss,
            widgets = this.getWidgetsFlat();

        rss.getFeeds(function (data) {
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
