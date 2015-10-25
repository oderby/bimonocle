(function (define) {
'use strict';
define(function(require) {
    return function datatableModule(project) {

        var defaultRequest = require('rest/interceptor/defaultRequest');
        var pathPrefix = require('rest/interceptor/pathPrefix');

        var util = require('./util');

        var OPT_HEADER = 'Flux-Options';
        var AUX_HEADER = 'Flux-Auxiliary-Return';

        // The following types are currently only used by the
        // Notification capability.
        // TODO(daishi): Looking at this here together I realize
        // that the capitalization style of the Messsage and
        // Notification types aren't consistent at all, but
        // let it be for now (addressing this requires coordinating
        // with the backend).
        var MessageType = {
            Notification: 'notification',
            Error: 'error',
        };

        var NotificationType = {
            // Special types.
            ALL: '__ALL__',
            NONE: '__NONE__',
            // Base API.
            CellUpdated: 'CELL_UPDATED',
            CellCreated: 'CELL_CREATED',
            CellDeleted: 'CELL_DELETED',
            // Client Metadata capability.
            CellClientMetadataUpdated: 'CELL_CLIENT_METADATA_UPDATED',
        };

        var clientInfo = {
            ClientId: project.clientId,
            ClientVersion: project.opt.clientVersion,
            AdditionalClientData: project.opt.additionalClientData,
            SDK: project.sdkName,
            SDKVersion: project.sdkVersion,
            OS: project.os,
        };

        function DataTable() {
            // Datatable objects have a reference to the notification types.
            // These arguably belong at the module-scope and should be attached
            // to the datatableModule function, but leave it here for now.
            // TODO(daishi): Think more on this.
            this.MessageType = MessageType;
            this.NotificationType = NotificationType;

            this.client = project.client.wrap(pathPrefix, {
                prefix: '/api/datatable/v1',
            });

            return this;
        }
        DataTable.prototype = project;
        DataTable.prototype.constructor = DataTable;

        // ============================================================
        // Base API.

        DataTable.prototype.clientInfo = function clientInfo() {
            return clientInfo;
        };

        DataTable.prototype.capability = function capability() {
            return this.client({
                path: '/capability'
            }).then(function(response) {
                return response.entity;
            }).catch(function(err) {
                throw util.errResp('Failed to get capability', err);
            });
        };

        DataTable.prototype.cells = function cells(opt) {
            return clientWithOpt(this.client, opt)({
                path: '/cells',
            }).then(function(response) {
                return makeReturnValue(response, "cellIds");
            }).catch(function(err) {
                throw util.errResp('Failed to get cells', err);
            });
        };

        DataTable.prototype.get = function get(cellId, opt) {
            return clientWithOpt(this.client, opt)({
                path: '/cells/' + cellId,
            }).then(function(response) {
                return makeReturnValue(response, "value");
            }).catch(function(err) {
                throw util.errResp('Failed to get cell ' +
                    cellId + ' value', err);
            });
        };

        DataTable.prototype.set = function set(cellId, value, opt) {
            return clientWithOpt(this.client, opt)({
                method: 'POST',
                path: '/cells/' + cellId,
                entity: value,
                headers: {
                    'Content-Type': 'application/json',
                }
            }).then(function(response) {
                return makeReturnValue(response, "cellInfo");
            }).catch(function(err) {
                throw util.errResp('Failed to set cell ' +
                    cellId + ' value', err);
            });
        };

        DataTable.prototype.delete = function delete_(cellId, opt) {
            return clientWithOpt(this.client, opt)({
                method: 'DELETE',
                path: '/cells/' + cellId,
            }).then(function(response) {
                return makeReturnValue(response, "cellInfo");
            }).catch(function(err) {
                throw util.errResp('Failed to delete cell ' +
                    cellId, err);
            });
        };

        DataTable.prototype.create = function create(value, opt) {
            return this.set("", value, opt);
        };

        // ============================================================
        // NOTIFICATION capability.
        //
        // We still use the legacy FEE websocket message format, but
        // This format is likely to change in the future.

        DataTable.prototype.subscribe = function subscribe(opt, handler, errorHandler) {
            this.ws.send(JSON.stringify({
                CommandType: 'datatable',
                Message: {
                    Type: 'subscribe',
                    Data: opt,
                }
            }));
            if (handler || errorHandler) {
                this.wsHandlers.datatable = function(feeMsgStr) {
                    var feeMsg = JSON.parse(feeMsgStr);
                    // We need to unwrap parts of the message to
                    // get to the actual Notification.
                    if (feeMsg.Type !== 'datatable') {
                        return;
                    }
                    var dtMsg = feeMsg.Payload.Message;
                    if (!dtMsg) {
                        return;
                    }
                    switch (dtMsg.Type) {
                        case MessageType.Notification: {
                            if (handler) {
                                handler(dtMsg.Data);
                            }
                            break;
                        }
                        case MessageType.Error: {
                            if (errorHandler) {
                                errorHandler(dtMsg.Data);
                            }
                            break;
                        }
                    }
                };
            } else {
                delete this.wsHandlers.datatable;
            }
        };

        DataTable.prototype.unsubscribe = function unsubscribe() {
            this.subscribe({ Types: [ NotificationType.NONE ] });
        };

        // ============================================================
        // Local utilities

        // Create a client with the given opt set in the request header.
        // Note that we auto-populate the clientInfo field.
        function clientWithOpt(client, opt) {
            opt = opt || {};
            opt.ClientInfo = clientInfo;
            var headers = {};
            headers[OPT_HEADER] = util.encodeHeader(opt);
            return client.wrap(defaultRequest, {
                headers: headers,
            });
        }

        function extractAux(response) {
            var aux = response.headers[AUX_HEADER];
            if (aux) {
                return util.decodeHeader(aux);
            }
            return;
        }

        /**
         * Create a datatable return value.
         * Datatable return value contains a primary return value
         * and an auxiliary ("aux") field. All return values will
         * contain these two fields. This function is a helper to
         * create this object.
         *
         * @param  {http.Response} response  The response.
         * @param  {String} entityKey The key for the response entity.
         *
         * @return {Object}
         * @return {Object[entityKey]} The response entity.
         * @return {Object.aux} The auxiliary response, if any.
         */
        function makeReturnValue(response, entityKey) {
            var ret = {};
            ret[entityKey] = response.entity;
            var aux = extractAux(response);
            if (aux !== undefined) {
                ret.aux = aux;
            }
            return ret;
        }

        return DataTable;
    };
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
