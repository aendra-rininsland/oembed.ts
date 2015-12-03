var request = require('superagent');
var querystring = require('querystring');
var util = require('util');
var events_1 = require('events');
var url_1 = require('url');
var htmlparser = require('node-htmlparser');
var OEmbed = (function () {
    function OEmbed() {
        var _this = this;
        this.EMBEDLY_URL = 'http://api.embed.ly/1/oembed';
        this.USER_AGENT = 'node-oembed/' + OEmbed.VERSION;
        this.ALLOWED_PARAMETERS = ['url', 'format', 'key', 'maxwidth', 'maxheight'];
        this.MIME_OEMBED_JSON = 'application/json+oembed';
        this.MIME_OEMBED_XML = 'text/xml+oembed';
        this.resolveUrl = url_1.resolve;
        this.formatUrl = url_1.format;
        util.inherits(this.Discovery, events_1.EventEmitter);
        this.Discovery.prototype.write = function (data) {
            _this.parser.parseChunk(data);
            return true;
        };
        this.Discovery.prototype.end = function () {
            _this.parser.done();
        };
        this.Discovery.prototype.addAlternate = function (type, href) {
            if (!_this.alternates.hasOwnProperty(type)) {
                _this.alternates[type] = _this.urlConvert(href);
            }
        };
        this.Discovery.prototype.onDone = function () {
            _this.callback(null, _this.alternates);
        };
        this.DiscoveryHandler.prototype = {
            reset: function () { },
            done: function () {
                this.disco.onDone();
            },
            writeTag: function (el) {
                var attrs = el.attribs;
                var type = attrs && this.expandEntities(attrs.type);
                var href = attrs && this.expandEntities(attrs.href);
                if (el.name === 'link' && attrs && attrs.rel === 'alternate' && type && href) {
                    this.disco.addAlternate(type, href);
                }
            },
            writeText: function () { },
            writeComment: function () { },
            writeDirective: function () { }
        };
        util.inherits(this.OEmbedXMLParser, events_1.EventEmitter);
        this.OEmbedXMLParser.prototype.write = function (data) {
            this.parser.parseChunk(data);
            return true;
        };
        this.OEmbedXMLParser.prototype.end = function () {
            this.parser.done();
        };
    }
    OEmbed.prototype.fetch = function (url, parameters, cb) {
        var _this = this;
        this.discover(url, function (error, alternates) {
            var oembedUrl;
            if (alternates && alternates[_this.MIME_OEMBED_JSON]) {
                oembedUrl = _this.applyParameters(alternates[_this.MIME_OEMBED_JSON], parameters);
                _this.fetchJSON(oembedUrl, cb);
            }
            else if (alternates && alternates[_this.MIME_OEMBED_XML]) {
                oembedUrl = _this.applyParameters(alternates[_this.MIME_OEMBED_XML], parameters);
                _this.fetchXML(oembedUrl, cb);
            }
            else if (_this.EMBEDLY_KEY) {
                if (!parameters) {
                    parameters = {};
                }
                parameters.key = _this.EMBEDLY_KEY;
                parameters.url = url;
                parameters.format = 'json';
                delete parameters.callback;
                oembedUrl = _this.applyParameters(_this.EMBEDLY_URL, parameters);
                _this.fetchJSON(oembedUrl, cb);
            }
            else {
                cb(error || new Error('No oEmbed links discovered'));
            }
        });
    };
    ;
    OEmbed.prototype.discover = function (url, cb) {
        var _this = this;
        var req;
        try {
            req = this.httpGet(url);
        }
        catch (e) {
            return cb(e);
        }
        req.on('response', function (res) {
            if (res.statusCode === 200) {
                var disco = new _this.Discovery(function (href) {
                    return _this.resolveUrl(url, href);
                }, cb);
                res.pipe(disco);
            }
            else {
                cb(new Error('HTTP status ' + res.statusCode));
            }
        });
        req.on('error', function (error) {
            cb(error);
        });
    };
    OEmbed.prototype.fetchXML = function (url, cb) {
        var _this = this;
        var req = this.httpGet(url);
        req.on('response', function (res) {
            if (res.statusCode === 200) {
                var parser = new _this.OEmbedXMLParser(cb);
                res.pipe(parser);
            }
            else {
                cb(new Error('HTTP status ' + res.statusCode));
            }
        });
        req.on('error', function (error) {
            cb(error);
        });
    };
    OEmbed.prototype.fetchJSON = function (url, cb) {
        this.httpGet(url, function (error, res, body) {
            if (!error && res.statusCode === 200 && body) {
                try {
                    cb(null, JSON.parse(body));
                }
                catch (e) {
                    cb(e);
                }
            }
            else {
                cb(error || new Error('HTTP status ' + res.statusCode));
            }
        });
    };
    OEmbed.prototype.expandEntities = function (s) {
        if (typeof s !== 'string') {
            return undefined;
        }
        return s.replace('&amp;', '&')
            .replace('&lt;', '<')
            .replace('&gt;', '>')
            .replace('&quot;', '"')
            .replace('&apos;', '\'');
    };
    OEmbed.prototype.getElementText = function (el) {
        if (el.children) {
            return this.expandEntities(el.children.map(this.getElementText).join(''));
        }
        else if (el.type === 'text') {
            return this.expandEntities(el.data);
        }
        else {
            return '';
        }
    };
    OEmbed.prototype.httpGet = function (url, cb) {
        try {
            return request.get(url).set('User-Agent', this.USER_AGENT).end(cb);
        }
        catch (e) {
            if (cb) {
                cb(e);
            }
            else {
                throw e;
            }
        }
    };
    OEmbed.prototype.Discovery = function (urlConvert, cb) {
        this.urlConvert = urlConvert;
        this.callback = cb;
        var handler = new this.DiscoveryHandler(this);
        this.parser = new htmlparser.Parser(handler);
        this.alternates = {};
    };
    OEmbed.prototype.DiscoveryHandler = function (disco) {
        this.disco = disco;
    };
    OEmbed.prototype.OEmbedXMLParser = function (cb) {
        var _this = this;
        this.callback = cb;
        var handler = new htmlparser.DefaultHandler(function (error, dom) {
            var oembedRoot = dom && dom.filter(function (el) {
                return el.name === 'oembed';
            })[0];
            if (oembedRoot && oembedRoot.children) {
                var result = {};
                oembedRoot.children.forEach(function (child) {
                    if (child.name) {
                        result[child.name] = _this.getElementText(child);
                    }
                });
                cb(null, result);
            }
            else {
                cb(error || new Error('Invalid oEmbed document'));
            }
        });
        this.parser = new htmlparser.Parser(handler);
        this.alternates = {};
    };
    OEmbed.prototype.applyParameters = function (url, parameters) {
        if (!parameters) {
            return url;
        }
        if (!url.query || typeof url.query === 'string') {
            url = url_1.parse(url, true);
        }
        for (var k in parameters) {
            if (this.ALLOWED_PARAMETERS.indexOf(k) >= 0) {
                url.query[k] = parameters[k];
            }
        }
        url.search = '?' + querystring.stringify(url.query);
        return this.formatUrl(url);
    };
    OEmbed.VERSION = '0.0.1';
    return OEmbed;
})();
exports.OEmbed = OEmbed;
//# sourceMappingURL=oembed.js.map