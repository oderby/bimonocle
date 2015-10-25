// This file was copied from:
//
//   GENIE/client/components/flux-pipe/flux-ws-factory.js
//
// The edits that have been made are:
//
// 1. Hardcode clientVersion to 'dev'.
// 2. Hardcode the channel as 'events'.
// 3. Add WebSocket require for node usage.
// 4. Remove custom analytics events.
// 5. Wrap in a function to accept an external client argument.
// 6. Remove window references.
// 7. Comment out console.debug/change to console.log.
// 8. Update the event handler to be explicit.
//
(function (define) { 'use strict'; define(function(require) {
    return function(client) {
    var _ = require('lodash');
    var rest = require('rest');
    var mime = require('rest/interceptor/mime');
    var errorCode = require('rest/interceptor/errorCode');
    var defaultRequest = require('rest/interceptor/defaultRequest');
    var pathPrefix = require('rest/interceptor/pathPrefix');

    var WebSocket = require('ws');

    var websockets = {};

    // wrapper function allows us to stub it out for tests.
    var reload = function() {
    };

    /**
     * Create a self monitoring/buffering/reconnecting websocket
     *
     * @param {string} projectId  The project's id
     * @param {Object} [opts]  Object with optional callback methods
     * @param {function(data)} [opts.onMessage]  Message callback, receives revived messages
     * @param {function(connection)} [opts.onOpen]  Connection open callback, invoked on initial
     * connection and reconnects
     * @param {function(connection)} [opts.onClose]  Connection closed callback, invoked when the
     * connection is dropped
     * @param {Number} [opts.pingTimeout]  Time (in ms) to wait for server pings before giving up.
     * [Used for testing]
     * @param {Number} [opts.reconnectDelay]  Time (in ms) to wait before trying to reconnect
     * after an error. [Used for testing]
     * @param {Object} [opts.clientOpts]  clientOptions
     * @returns {Promise<Object>} the connection object, may not be fully initialized
     *
     * TODO(daishi): Passing in all of clientOpts into this is too much.
     * Should think about restricting this, but leave for now.
     * (I think we're going to want to non-trivially refactor how we handle
     * websockets usage anyways, in particular to support better service
     * multi/demulti-plexing over a single websocket).
     */
    function socketFactory(projectId, opts) {
        if (projectId === null || projectId === undefined || projectId === "") {
            throw new Error("Can't create a websocket for projectid of " + projectId);
        }
        var channel = 'events';
        opts = opts || {};
        var socketId = projectId + ':' + channel;
        var connecting = false;
        var pingMonitor, retry;
        var pingTimeout = opts.pingTimeout || 30000; // 30 seconds
        var reconnectDelay = opts.reconnectDelay || 1000; // 1 second

        // TODO(daishi): We need to resolve how we handle client version
        // for SDK clients.
        var clientVersion = 'dev';

        // We run a ping monitor to watch for pings from the server. In an ideal world, the
        // underlying websocket would tell us when we lose connection to the server. Unfortunately, we
        // don't live in an ideal world and so we need to do this monitoring ourselves.
        // The server should send a ping every 10 s, so we wait 30 before deciding we've lost touch
        // with the server.
        function restartTimeout() {
            clearTimeout(pingMonitor);
            pingMonitor = setTimeout(function() {
                console.warn("server stopped talking to us? Disconnecting!");
                connection.reconnect();
            }, pingTimeout);
        }

        function stopTimeout() {
            clearTimeout(pingMonitor);
            pingMonitor = undefined;
        }

        // reuse existing connections
        var connection = websockets[socketId] = websockets[socketId] || {
            socket: undefined,
            buffer: [],
            isOpen: false,

            // This returns whether or not _notifyIsOpen should subsequently be
            // called to send the notifications to the client.
            _updateIsOpen: function() {
                // We need to manage this property ourselves, to enable databinding to it, because
                // apparently you can't databind to readyState property in chrome?
                var isOpen = !!this.socket && this.socket.readyState === WebSocket.OPEN;
                var shouldNotify = (isOpen !== this.isOpen);
                this.isOpen = isOpen;
                return shouldNotify;
            },

            // This calls onOpen or onClose of listeners.  This should only be
            // called if _updateIsOpen() returns true.
            _notifyIsOpen: function() {
                if (this.isOpen && opts.onOpen) {
                    opts.onOpen(this);
                } else if (!this.isOpen && opts.onClose) {
                    opts.onClose(this);
                }
            },

            /**
             * Send the message (as is), to the socket, buffering if the socket is not open
             */
            send: function(message) {
                if (this.isOpen) {
                    this.socket.send(message);
                } else {
                    //console.debug('Websocket not yet connected. Buffering message', message);
                    // TODO cap this buffer size.
                    if (this.buffer.length > 0){
                        if (this.buffer[this.buffer.length -1] === message){
                            //console.debug('Ignoring duplicate '+ message +' message.');
                            return;
                        }
                    }
                    this.buffer.push(message);
                }
            },

            /**
             * Close the socket, do not attempt to reconnect
             */
            close: function() {
                stopTimeout();
                clearTimeout(retry);
                if (this._updateIsOpen())
                    this._notifyIsOpen();

                if (this.socket) {
                    // IMPORTANT: remove all previously registered event listeners so we don't
                    // muck with any future reconnection attempts when we close this current socket
                    // next.
                    this.socket.removeEventListener('open', this);
                    this.socket.removeEventListener('message', this);
                    // Remove the close and error event handlers before closing the websocket so
                    // we don't attempt to reconnect.
                    this.socket.removeEventListener('close', this);
                    this.socket.removeEventListener('error', this);
                    this.socket.close();
                    this.socket = undefined;
                }
            },

            handleEvent: function(event) {
                var reconnect = this.reconnect.bind(this);
                // NOTE(aroman): Don't send the is open notification yet,
                // because if we have just re-connected we need to first send
                // the buffered messages.
                var shouldNotify = this._updateIsOpen();
                // When leaving this function, we make the call to notify if
                // necessary.
                switch(event.type) {
                    case 'open':
                        // signal done with connecting, allow future reconnects to go through.
                        connecting = false;
                        //console.debug("Established %s WebSocket", channel);

                        // flush message buffer
                        for (var i = 0; i < this.buffer.length; i++) {
                            this.socket.send(this.buffer[i]);
                        }
                        this.buffer.length = 0;

                        break;
                    case 'message':
                        // handle and forward messages
                        restartTimeout(projectId);

                        if (event.data === 'PING') {
                            this.send('PONG');
                            break;
                        }

                        if (opts.onMessage) {
                            opts.onMessage(event.data);
                        }
                        break;
                    case 'close':
                    // TODO(owen): Determine if we should really treat all errors as catastrophic
                    // and burn the ws down and reconnect.
                    case 'error':
                        if (event.type === 'close') {
                            console.log('%s Websocket closed, reporting code=%d and reason=%s.',
                                channel, event.code, event.reason);
                        } else {
                            console.error('%s WebSocket error, reconnecting:', channel, event);
                        }
                        // In the case that we transition from opening -> closed (never call 'open'
                        // listener, we need to clear the connecting flag so we can potentially
                        // reconnect.
                        connecting = false;
                        this.close();
                        retry = setTimeout(function() {
                            console.log("Trying to reconnect...");
                            reconnect();
                        }, reconnectDelay);
                        break;
                }
                if (shouldNotify)
                    this._notifyIsOpen();
            },

            /**
             * Establish a new connection, closing the current connection if open
             */
            reconnect: function() {
                if (connecting) {
                    return;
                }
                this.close();
                connecting = true;
                var request = {
                    path: '/wsurl',
                    params: {
                        projectId: projectId,
                        reason: channel
                    }
                };

                var retryConnection = function() {
                    if (this._updateIsOpen())
                        this._notifyIsOpen();
                    // signal done with connecting, allow future reconnects to go through.
                    connecting = false;
                    retry = setTimeout(function() {
                        console.log("Trying to reconnect...");
                        this.reconnect();
                    }.bind(this), reconnectDelay);
                }.bind(this);

                client(request).then(function(response) {
                    var wsAddr = response.entity.wsAddr;

                    var headers = _.cloneDeep(opts.clientOpts.requestOptions.headers);
                    // Set the origin for CORS.
                    headers.Origin = opts.clientOpts.baseUrl;
                    this.socket = new WebSocket(wsAddr + '?version=' + clientVersion,
                        {
                            headers: headers,
                            rejectUnauthorized: opts.clientOpts.requestOptions.mixin.rejectUnauthorized,
                        });

                    // delegate all events to this.handleEvent method.
                    var handler = this.handleEvent.bind(this);
                    this.socket.addEventListener('open', handler);
                    this.socket.addEventListener('message', handler);
                    this.socket.addEventListener('close', handler);
                    this.socket.addEventListener('error', handler);
                    if (this._updateIsOpen())
                        this._notifyIsOpen();

                    return this;
                }.bind(this), function(err) {
                    switch(err.status.code){
                        case 401:
                            console.error("Authentication revoked. User must relogin.");
                            break;
                        case 403:
                            console.error("Project access revoked. Redirecting to inventory.");
                            break;
                        case 418:
                            console.error("Failed to send CSRF headers. Updating to latest tools.");
                            reload();
                            break;
                        default:
                            // Unit tests expect this error so it can not be disabled
                            console.error("Error retrieving WebSocket url:", err);
                            retryConnection();
                            break;
                    }
                }).catch(function(err) {
                    // Unit tests expect this error so it can not be disabled
                    console.error("Error initializing WebSocket:", err);
                    retryConnection();
                }).done();
            }
        };
        if (!connection.isOpen) {
            connection.reconnect();
        }
        return connection;
    }

    return {
        makeWebSocket: socketFactory
    };
};
});}(typeof define==='function'&&define.amd?define:function(factory){module.exports=factory(require);}));
