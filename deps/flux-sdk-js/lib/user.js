(function (define) {
'use strict';
define(function(require) {
    // This module expects to be initialized within an SDK object,
    // with a reference to the SDK being passed in.
    return function userModule(sdk) {
        // Flux SDK user object.
        // This is a refactoring/port from flux-api/flux-user-service.js.

        var _ = require('lodash');
        var cookie = require('./cookie');

        var defaultRequest = require('rest/interceptor/defaultRequest');

        var util = require('./util');

        // Extract auth data from request for user.
        // This is factored out because it's not clear exactly how this
        // is going to work, and whether it will behave the same between
        // node and the browser.
        function extractToken(response) {
            // We expect a response header setting cookies.
            var sc = (response && response.headers &&
                response.headers['Set-Cookie']);
            if (!sc) {
                return;
            }
            // We expect one of those to be the flux token.
            var x = _(response.headers['Set-Cookie'])
                .map(function(c) { return cookie.parseCookies(c); })
                .filter(function(c) { return c.flux_token !== undefined; })
                .value();
            if (x.length !== 1) {
                return;
            }
            // Return the flux token.
            return x[0].flux_token;
        }

        function User(response) {
            // Update client header to include Flux Token.
            var token = extractToken(response);
            if (token === undefined) {
                throw new Error('No Flux token found. Unable to create user.');
            }
            var headers = { 'Flux-Request-Token': token };
            this.fluxToken = token;

            // Theoretically the following block only needs to be executed when
            // in a non-browser environment, which for our purposes means Node.
            if (util.isNode()) {
                var sc = (response && response.headers &&
                    response.headers['Set-Cookie']);
                headers.Cookie = sc;
            }
            this.client = sdk.client.wrap(defaultRequest, { headers: headers });

            // Update the user opt.
            this.opt = _.defaultsDeep({
                requestOptions: {
                    headers: headers,
                }
            }, sdk.opt);


            // Note that we pass in the user object reference here but
            // that it is not fully initialized.
            this.getProject = require('./project')(this);

            return this;
        }
        User.prototype = sdk;
        User.prototype.constructor = User;

        // For now, we expose these whoami methods on the user object, but
        // it's not clear that that's necessary or useful to the SDK client.
        // We should consider whether these should just be hidden in the
        // local module closure.
        User.prototype.getWhoami = function whoami() {
            return this.client({
                path: '/api/whoami',
            }).then(function(response) {
                return response.entity;
            }).catch(function(err) {
                throw util.errResp('Failed to determine whoami', err);
            });
        };
        // In principle we could set the field above, but keep separate
        // for cleanliness.
        User.prototype.setWhoami = function setWhoami() {
            var self = this;
            return this.getWhoami().then(function(whoami) {
                self.whoami = whoami;
                return self;
            });
        };

        /**
         * List projects that this user has access to.
         *
         * @return {Promise} Promise which resolves to an array of project
         *     info objects.
         */
        User.prototype.listProjects = function listProjects() {
            return this.client({
                path: '/api/projects',
            }).then(function(response) {
                return response.entity;
            }).catch(function(err) {
                throw new util.errResp('Failed to list projects', err);
            });
        };

        /**
         * Log in an existing user.
         *
         * @param {String} Email address of the user.
         * @param {String} Password of the user.
         *
         * @return {Promise} A promise which resolves to a user object.
         */
        return function loginUser(email, password) {
            return sdk.client({
                method: 'POST',
                path: '/api/login',
                entity: {
                    email: email,
                    password: password,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            }).then(function(response) {
                var user = new User(response);
                return user.setWhoami();
            }).catch(function(err) {
                console.log(err);
                throw util.errResp('Failed to login', err);
            });
        };
    };
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
