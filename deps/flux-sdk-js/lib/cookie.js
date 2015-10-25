(function (define) {
'use strict';
define(function(require) {
    // The following is taken from flux-xhr.js.

    /**
     * For CSRF protection, client needs to set Flux-Request-Marker and Flux-Request-Token
     * headers on all authenticated requests.
     *
     * Flux-Request-Marker: 1
     * Flux-Request-Token: <token>
     *
     * where <token> echoes the value of the flux_token cookie (set by the head proxy at auth).
     *
     * This pulls out that token value and stores it on Flux.fluxToken (for
     * use by other request senders) and sets headers on jquery ajax requests.
     *
     * Cookie parsing taken from https://github.com/jshttp/cookie
     */

    /**
     * Parses the form of document.cookies into an object.
     *
     * There is a copy of this function in genie/static/admin_assets/; update that
     * copy when changing this code.
     *
     * @param {string} str A string having the form of document.cookies.
     * @param {{decode:((function(string):string)|undefined)}} options
     *     Provider of a decode function that behaves like decodeURIComponent.
     *     If options.decode is not provided, decodeURIComponent is used.
     * @return {Object.<string, string>}
     */
    function parseCookies(str, options) {
      var obj = {};
      var opt = options || {};
      var pairs = str.split(/; */);
      var dec = opt.decode || decodeURIComponent;

      pairs.forEach(function(pair) {
        var eq_idx = pair.indexOf('=');

        // skip things that don't look like key=value
        if (eq_idx < 0) {
          return;
        }

        var key = pair.substr(0, eq_idx).trim();
        var val = pair.substr(++eq_idx, pair.length).trim();

        // quoted values
        if ('"' == val[0]) {
          val = val.slice(1, -1);
        }

        // only assign once
        if (undefined === obj[key]) {
          obj[key] = tryDecode(val, dec);
        }
      });

      return obj;
    }

    function tryDecode(str, decode) {
      try {
        return decode(str);
      } catch (e) {
        return str;
      }
    }

    return {
        parseCookies: parseCookies,
    };
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
