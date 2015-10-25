(function (define) {
'use strict';
define(function(require) {
    var _ = require('lodash');

    /**
     * Try to determine whether we're running under node.
     * This logic is taken from
     *
     *   https://github.com/iliakan/detect-node
     *
     * @return {Boolean} Probably true if we're running under node.
     */
    function isNode() {
        try {
            return ('object' === typeof process &&
                Object.prototype.toString.call(process) === '[object process]');
        } catch(e) {
            return false;
        }
    }

    /**
     * Helper to create an Error from a http error response.
     *
     * @param  {String}    prefix  Message prefix.
     * @param  {Response}  err     Error response.
     *
     * @return {Error} Error object.
     */
    function errResp(prefix, err) {
        var message;
        if (err.entity && err.entity.constructor === String) {
            message = err.entity.trim();
        } else if (err.error) {
            if (err.error instanceof Error) {
                message = err.error.message;
            } else {
                message = err.error;
            }
        } else {
            message = JSON.stringify(err);
        }
        return new Error(prefix+": "+message);
    }

    // WARNING: The following depends on the node-specific Buffer builtin.
    // To support browsers we'll need to use something like:
    //   https://github.com/feross/buffer

    /**
     * Encode a JSON object into a form suitable for setting as a HTTP request
     * header.
     *
     * @param  {Object} header JSON structure.
     *
     * @return {String} Encoded string suitable for setting as a request header.
     */
    function encodeHeader(header) {
        return new Buffer(JSON.stringify(header)).toString('base64');
    }

    /**
     * Decode a JSON object from the header data.
     * See encodeHeader above for details.
     *
     * @param  {String} headerData The header value to decode.
     *
     * @return {Object}      JSON object.
     */
    function decodeHeader(headerData) {
        return JSON.parse(new Buffer(headerData, 'base64').toString());
    }

    return {
        isNode: isNode,
        errResp: errResp,
        encodeHeader: encodeHeader,
        decodeHeader: decodeHeader,
    };
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
