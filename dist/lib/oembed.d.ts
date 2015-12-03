export declare class OEmbed {
    static VERSION: string;
    EMBEDLY_KEY: string;
    EMBEDLY_URL: string;
    MIME_OEMBED_JSON: string;
    MIME_OEMBED_XML: string;
    private allowed_parameters;
    private urlConvert;
    private callback;
    private parser;
    private alternates;
    private disco;
    private resolveUrl;
    private formatUrl;
    USER_AGENT: string;
    constructor();
    private expandEntities(s);
    private getElementText(el);
    private httpGet(url, cb?);
    Discovery(urlConvert: any, cb: any): void;
    private DiscoveryHandler(disco);
    discover(url: any, cb: any): any;
    private OEmbedXMLParser(cb);
    fetchXML(url: any, cb: any): void;
    fetchJSON(url: any, cb: any): void;
    private applyParameters(url, parameters);
    fetch(url: any, parameters: any, cb: any): void;
}
