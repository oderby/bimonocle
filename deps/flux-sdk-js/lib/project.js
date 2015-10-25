(function (define) {
'use strict';
define(function(require) {
    return function projectModule(user) {

        var pathPrefix = require('rest/interceptor/pathPrefix');

        var wsFactory = require('./flux-ws-factory');

        function Project(projectInfo) {
            this.projectInfo = projectInfo;

            this.client = user.client.wrap(pathPrefix, {
                prefix: '/p/' + projectInfo.id
            });

            // Note that we pass in the project object reference here but
            // that it is not fully initialized.
            var DataTable = require('./datatable')(this);
            this.datatable = new DataTable();

            // wsHandlers contains an map of websocket event handers.
            // These are keyed by the 'owner' of the handler.
            // Currently the only owner is the datatable, but this will
            // be expanded once we support more features in the SDK.
            // TODO(daishi): Think about whether we could/should be just
            // supporting this within the websocket abstraction.
            this.wsHandlers = {};

            // The actual websocket. Currently connect to it immediately.
            // TODO(daishi): We should connect laziliy, and after confirming
            // that the backing service supports websocket connections, so
            // that we can create more robust clients.
            var self = this;
            this.ws = wsFactory(this.client).makeWebSocket(
                    projectInfo.id,
                    {
                        onMessage: function(message) {
                            var handler;
                            for (var key in self.wsHandlers) {
                                handler = self.wsHandlers[key];
                                handler(message);
                            }
                        },
                        clientOpts: this.opt,
                    });

            return this;
        }
        Project.prototype = user;

        return Project;
    };
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
