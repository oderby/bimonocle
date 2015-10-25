(function (define) {
define(function(require) {
    'use strict';

    var _ = require('lodash');

    // For reasons that are unclear to me we do need to require('rest') here
    // even if we don't use the reference. Presumably there is some side-effect
    // of loading this which is important for the use of the interceptors.
    require('rest');
    var defaultRequest = require('rest/interceptor/defaultRequest');
    var pathPrefix = require('rest/interceptor/pathPrefix');
    var mime = require('rest/interceptor/mime');
    var errorCode = require('rest/interceptor/errorCode');

    var UNKNOWN = 'unknown';
    var DEFAULTS = {
        baseUrl: 'https://flux.io',

        // Conceptually, the Flux-Request-Marker default doesn't belong in the
        // options, but having requestOptions be configurable by the SDK user
        // is useful (for example, when testing against a local server which
        // uses a self-signed cert and we want to allow that to pass).
        requestOptions: {
            headers: {
                'Flux-Request-Marker': '1',
            }
        },

        clientVersion: UNKNOWN,
        additionalClientData: {
            HostProgramVersion: UNKNOWN,
            HostProgramMainFile: UNKNOWN,
        },
    };

    var proto = {
        sdkName: 'Flux Javascript SDK',
        sdkVersion: '0.0.0',
        // TODO(daishi): This needs to show the platform, and should support
        // both browser and node usage. For browsers, it's currently supposed
        // to be the User-Agent.
        os: 'browser/*',
    };

    function SDK(clientId, opt) {
        this.clientId = clientId;
        this.opt = _.defaultsDeep(opt || {}, DEFAULTS);

        this.client = defaultRequest(this.opt.requestOptions)
            .wrap(pathPrefix, { prefix: this.opt.baseUrl })
            .wrap(mime)
            .wrap(errorCode);

        // Note we pass a reference to the sdk to the user module.
        this.loginUser = require('./user')(this);

        return this;
    }
    SDK.prototype = proto;

    return SDK;
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
