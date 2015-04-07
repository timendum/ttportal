/* jshint curly: true, eqeqeq: true, forin: true, freeze: true, immed: true, indent: 4, latedef: true, undef: true, unused: true, sub: true, trailing: true  */
/* jshint browser: true, jquery: true */
var ttRss = {
    base: null,
    session: null,
    categoryId: null,
    errorHandler: function() {alert('Error during request');},
    sessionErrorHandler: function() {alert('Error for session');},
    _errorHandler: function(c, e, s) {
        var t = this,
            errorHandler = e || t.errorHandler,
            sessionErrorHandler = s || t.sessionErrorHandler;
        if (c.noWrap) {
            return c;
        } else {
            return function(d, r) {
                if (r === "success") {
                    if (d.content) {
                        if (!d.content.error) {
                            c(d.content);
                            return;
                        }
                        if (d.content.error && d.content.error === "NOT_LOGGED_IN") {
                            t.session = null;
                            sessionErrorHandler(d);
                            return;
                        }
                    }
                }
                errorHandler(d);
                return;
            };
        }
    },
    _is_cat: function(id) {
        return parseInt(id) < 100;
    },
    _request: function(op, c, data, e, s) {
        var base = this.base;
        data = data || {};
        data['op'] = op;
        if (this.session) {
            data['sid'] = this.session;
        }
        jQuery.post(
            base,
            JSON.stringify(data),
            'json'
        ).always(this._errorHandler(c, e, s));
    },
    isLoggedIn: function(c) {
        if (this.base === null) {
            c({content: {status: false}}, "success");
            return;
        }
        c.noWrap = true;
        this._request('isLoggedIn', c);
    },
    _loginHandler: function(c, t) {
        return function(data) {
            if (data && data.session_id) {
                t.session = data.session_id;
                c(true);
            } else {
                t.session = false;
                c(false);
            }
        };
    },
    login: function(user, pass, c) {
        var lh = this._loginHandler;
        var t = this;
        var loginError = function () {
            if (t.session) {
            t.session = null;
                alert('Error for session, retry');
            } else {
                t.sessionErrorHandler();
            }
        };
        this._request('login', lh(c, this), {user: user, password: pass}, loginError);
    },
    logout: function(c) {
        this._request('logout', c);
    },
    getCategories: function(c) {
        var t = this,
            w = function(data) {
            for (var i = 0; i < data.length; i++) {
                if (data[i].title.toUpperCase() === "PORTAL") {
                    t.categoryId = data[i].id;
                    c(data[i].id);
                    return;
                }
            }
            c(0);
            return;
        };
        t._request('getCategories', w);
    },
    getFeeds: function(c) {
        var t = this,
            w = {
                cat_id: t.categoryId,
                include_nested: true
            };
        t._request('getFeeds', c, w);
    },
    getUpdatedContent: function(id, limit, skip, c) {
        var t = this;
        this._request(
            'updateFeed',
            function() {
                t.getContent(id, limit, skip, c);
            },
            {feed_id: id}
        );
    },
    getContent: function(id, limit, skip, c, onlyUnread) {
        var is_cat = this._is_cat(id);
        onlyUnread = onlyUnread || false;
        this._request('getHeadlines', c,
            {
                feed_id: id,
                is_cat: is_cat,
                limit: limit,
                skip: skip,
                show_excerpt: true,
                excerpt_length: 100,
                //show_content: true,
                view_mode: (onlyUnread ? 'unread' :'all_articles'), //all_articles, unread, adaptive, marked, updated)
                order_by: 'feed_dates'// date_reverse, feed_dates, (nothing)

            }
        );
    },
    markReadItem: function(id, c) {
        this._request('updateArticle', c, {
            article_ids: id,
            mode: 0,    //0 - set to false, 1 - set to true, 2 - toggle
            field: 2 // 0 - starred, 1 - published, 2 - unread, 3 - article note since api level 1)
        });
    },
    markReadFeed: function(id, c) {
        var is_cat = this._is_cat(id);
        this._request('catchupFeed', c,
            {
                feed_id: id,
                is_cat: is_cat
            }
        );
    }
};