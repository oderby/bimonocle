var common = (function() {
    var https = require('https');
    var SDK = require('../../index');

    // The default server options are meant for local dev testing.
    function serverOptions() {
        return {
            hostname: 'localhost',
            port: 8443,
            path: '/status/unauthed',
            rejectUnauthorized: false,
        };
    }

    // Client id for testing.
    var clientId = "0f823656-da5e-4c8e-a704-91ab524aac42";

    function checkServer() {
        var opts = serverOptions();
        function error() {
            console.log('Unable to connect to server: '+JSON.stringify(opts));
            process.exit(1);
        }
        https.get(serverOptions(), function(res) {
            if (res.statusCode !== 200) {
                error();
            }
        }).on('error', function(e) {
            error();
        });
    }

    function getTestSDK() {
        var opts = serverOptions();
        return new SDK(
            clientId,
            {
                baseUrl: "https://"+opts.hostname+":"+opts.port,
                requestOptions: {
                    mixin: {
                        rejectUnauthorized: opts.rejectUnauthorized,
                    },
                }
            }
        );
    }

    function loginUser(sdk) {
        var dev = process.env.USER;
        return sdk.loginUser(dev+'@flux.io', dev);
    }

    // TODO(daishi): This is a HACK. Fix this.
    // getFirstProject returns the first project accessible to the user.
    // In the future when the SDK grows actual project management features
    // the testing should actually create and control the project it wants
    // to use instead of assuming that there is a project available for
    // testing to the user.
    function getFirstProject(user) {
        return user.then(function(user) {
            return user.listProjects();
        }).then(function(projectIds) {
            return user.then(function(u) {
                return u.getProject(projectIds[0]);
            });
        });
    }

    return {
        serverOptions: serverOptions,
        checkServer: checkServer,
        getTestSDK: getTestSDK,
        loginUser: loginUser,
        getFirstProject: getFirstProject,
    };
})();

// Always check server availability.
common.checkServer();

module.exports = common;