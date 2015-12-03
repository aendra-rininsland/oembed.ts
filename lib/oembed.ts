/**
 * oEmbed.ts — https://github.com/aendrew/oembed.ts
 *
 * 2015 Ændrew Rininsland (@aendrew), The Times and Sunday Times
 *
 * A TypeScript port of node-oembed by @astro (https://github.com/astro/node-oembed).
 * I mainly did this because astro/node-oembed uses request, which so doesn't work in TypeScript land.
 */
import * as request from 'superagent';
import * as querystring from 'querystring';
import * as util from 'util';
import {EventEmitter} from 'events';
import {parse as parseUrl, format as formatUrl, resolve as resolveUrl} from 'url';
/* tslint:disable */
let htmlparser = require('node-htmlparser');
/* tslint:enable */

export class OEmbed {
  public static VERSION: string = '0.0.1';

  /**
   * Set this if you want fallback for sites that don't provide oEmbed.
   */
  public EMBEDLY_KEY: string;
  public EMBEDLY_URL: string = 'http://api.embed.ly/1/oembed';
  public USER_AGENT: string = 'node-oembed/' + OEmbed.VERSION;

  private ALLOWED_PARAMETERS: Array<string> = ['url', 'format', 'key', 'maxwidth', 'maxheight'];
  private MIME_OEMBED_JSON: string = 'application/json+oembed';
  private MIME_OEMBED_XML: string = 'text/xml+oembed';
  private urlConvert: any;
  private callback: any;
  private parser: any;
  private alternates: any;
  private disco: any;
  private resolveUrl: any = resolveUrl;
  private formatUrl: any = formatUrl;

  /**
   * Main entry point
   * @param {string} url        [description]
   * @param {any}    parameters [description]
   * @param {any}    cb         [description]
   */
  public fetch(url: string, parameters: any, cb: any): void {
    this.discover(url, (error: any, alternates: any) => {
      let oembedUrl: string;

      if (alternates && alternates[this.MIME_OEMBED_JSON]) {
        oembedUrl = this.applyParameters(alternates[this.MIME_OEMBED_JSON], parameters);
        this.fetchJSON(oembedUrl, cb);
      } else if (alternates && alternates[this.MIME_OEMBED_XML]) {
        oembedUrl = this.applyParameters(alternates[this.MIME_OEMBED_XML], parameters);
        this.fetchXML(oembedUrl, cb);
      } else if (this.EMBEDLY_KEY) {
        if (!parameters) {
          parameters = {};
        }

        /* Fallback to the Embedly oEmbed API */
        parameters.key = this.EMBEDLY_KEY;
        parameters.url = url;

        /* Sanitize user-provided parameters */
        parameters.format = 'json';
        delete parameters.callback;

        oembedUrl = this.applyParameters(this.EMBEDLY_URL, parameters);
        this.fetchJSON(oembedUrl, cb);
      } else {
        cb(error || new Error('No oEmbed links discovered'));
      }
    });
  };

  /**
   * [discover description]
   * @param  {string} url [description]
   * @param  {any}    cb  [description]
   * @return {any}        [description]
   */
  public discover(url: string, cb: any): any {
    let req: any;
    try {
      req = this.httpGet(url);
    } catch (e) {
      return cb(e);
    }

    req.on('response', (res: any) => {
      if (res.statusCode === 200) {
        let disco: any = new this.Discovery((href: any): any => {
          return this.resolveUrl(url, href);
        }, cb);

        res.pipe(disco);
      } else {
        cb(new Error('HTTP status ' + res.statusCode));
      }
    });

    req.on('error', function(error: any): void {
      cb(error);
    });
  }

  public fetchXML(url: string, cb: any): void {
    let req: any = this.httpGet(url);
    req.on('response', (res: any): void => {
      if (res.statusCode === 200) {
        let parser: any = new this.OEmbedXMLParser(cb);
        res.pipe(parser);
      } else {
        cb(new Error('HTTP status ' + res.statusCode));
      }
    });

    req.on('error', function(error: Error): void {
      cb(error);
    });
  }

  public fetchJSON(url: string, cb: any): void {
    this.httpGet(url, function(error: Error, res: any, body: any): void {
      if (!error && res.statusCode === 200 && body) {
        try {
          cb(null, JSON.parse(body));
        } catch (e) {
          cb(e);
        }
      } else {
        cb(error || new Error('HTTP status ' + res.statusCode));
      }
    });
  }

  constructor() {
    util.inherits(this.Discovery, EventEmitter);

    this.Discovery.prototype.write = (data: any): boolean => {
      this.parser.parseChunk(data);
      return true;
    };

    this.Discovery.prototype.end = (): void => {
      this.parser.done();
    };

    this.Discovery.prototype.addAlternate = (type: string, href: string): void => {
      if (!this.alternates.hasOwnProperty(type)) {
        this.alternates[type] = this.urlConvert(href);
      }
    };

    this.Discovery.prototype.onDone = (): void => {
      this.callback(null, this.alternates);
    };

    this.DiscoveryHandler.prototype = {
      reset: function(): any {},
      done: function(): void {
        this.disco.onDone();
      },
      writeTag: function(el: any): void {
        let attrs: any = el.attribs;
        let type: any = attrs && this.expandEntities(attrs.type);
        let href: any = attrs && this.expandEntities(attrs.href);

        if (el.name === 'link' && attrs && attrs.rel === 'alternate' && type && href) {
          this.disco.addAlternate(type, href);
        }
      },
      writeText: function(): any {},
      writeComment: function(): any {},
      writeDirective: function(): any {}
    };

    util.inherits(this.OEmbedXMLParser, EventEmitter);

    this.OEmbedXMLParser.prototype.write = function(data: any): boolean {
        this.parser.parseChunk(data);
        return true;
    };

    this.OEmbedXMLParser.prototype.end = function(): void {
        this.parser.done();
    };
  }

  /**
   * htmlparser is not doing that for us :-(
   */
  private expandEntities(s: string): string {
    if (typeof s !== 'string') {
      return undefined;
    }

    return s.replace('&amp;', '&')
      .replace('&lt;', '<')
      .replace('&gt;', '>')
      .replace('&quot;', '"')
      .replace('&apos;', '\'');
  }

  private getElementText(el: any): any {
    if (el.children) {
      return this.expandEntities(el.children.map(this.getElementText).join(''));
    } else if (el.type === 'text') {
      return this.expandEntities(el.data);
    } else {
      return '';
    }
  }

  /**
   * Wraps request()
   */
  private httpGet(url: string, cb?: any): request.SuperAgentRequest {
    try {
      return request.get(url).set('User-Agent', this.USER_AGENT).end(cb);
    } catch (e) {
      /* request() throws at us */
      if (cb) {
        cb(e);
      } else {
        throw e;
      }
    }
  }

  /**
   * Write stream that collects <link rel='alternate'> @href by @type
   *
   * @param {Function} urlConvert Expands relative to absolute URL
   * @param {Function} cb Final callback
   */
  private Discovery(urlConvert: any, cb: any): void {
    this.urlConvert = urlConvert;
    this.callback = cb;
    let handler: any = new this.DiscoveryHandler(this);
    this.parser = new htmlparser.Parser(handler);
    this.alternates = {};
  }

  /**
   * Methods implement htmlparser handler interface
   *
   * @param {Discovery} disco
   */
  private DiscoveryHandler(disco: any): void {
    this.disco = disco;
  }

  private OEmbedXMLParser(cb: any): void {
    this.callback = cb;

    let handler: any = new htmlparser.DefaultHandler((error: Error, dom: any) => {
      let oembedRoot: any = dom && dom.filter((el: any): any => {
        return el.name === 'oembed';
      })[0];

      if (oembedRoot && oembedRoot.children) {
        let result: any = {};
        oembedRoot.children.forEach((child: any): void => {
          if (child.name) {
            result[child.name] = this.getElementText(child);
          }
        });

        cb(null, result);
      } else {
        cb(error || new Error('Invalid oEmbed document'));
      }
    });

    this.parser = new htmlparser.Parser(handler);
    this.alternates = {};
  }

  private applyParameters(url: any, parameters: any): any {
    if (!parameters) { // Nothing to do, skip
      return url;
    }

    if (!url.query || typeof url.query === 'string') { // Parse querystring
      url = parseUrl(url, true);
    }

    for (let k in parameters) {
      if (this.ALLOWED_PARAMETERS.indexOf(k) >= 0) {
        url.query[k] = parameters[k];
      }
    }

    /* request assumes .search, not .query */
    url.search = '?' + querystring.stringify(url.query);

    /* different libraries handle the multiple data of url onjects
     * differently, we use both the node stdlib and request. let's just
     * serialize for them so our parameters are kept.
     */
    return this.formatUrl(url);
  }
}
