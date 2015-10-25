var express = require('express');
var app = express();
var _ = require('lodash');
var bodyParser = require('body-parser');
var SDK = require('./deps/flux-sdk-js/index');
//var expressWs = require('express-ws')(app);
//var multer = require('multer'); // v1.0.5
//var upload = multer(); // for parsing multipart/form-data

// Client id for testing.
var clientId = "4bfc709f31a25d9a239223a391cd2f1077fe5253";

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use(express.static(__dirname + '/'));

var sdk = new SDK(
    clientId,
    {
        requestOptions: {
            mixin: {
                rejectUnauthorized: false,
            }
        }
    }
);
var user, modelKey;

app.post('/api/login', function (req, res) {
    var email = req.body.user;
    var password = req.body.password;
    sdk.loginUser(email, password).then(function(u){
        user = u;
        console.log(JSON.stringify(user));
        res.status(200).end();
    });
});

app.get('/api/projects', function (req, res) {
    user.listProjects().then(function(projects) {
        res.status(200).send(projects);
    })
});

function getDT(user, pid) {
    return user.listProjects().then(function(projects) {
        return user.getProject(_.findWhere(projects, {id: pid})).datatable;
    });
}

app.get('/api/keys', function(req, res) {
    var pid = req.query.project || "aj3AR4nP1EV87DBJQ";
    getDT(user, pid).then(function(dt) {
        console.log(dt);
        dt.cells().then(function(cells) {
            console.log(JSON.stringify(cells));
            var cellData = _.map(cells.cellIds,function(cell) {
                var data = {};
                console.log(cell);
                data.id = cell["CellId"];
                data.label = cell.ClientMetadata.Label;
                data.description = cell.ClientMetadata.Description;
                return data;
            });
            res.status(200).send(cellData);
        });
    })
});
//app.get('/', function (req, res) {
//    res.send('Hello World!');
//});
//

app.get("/api/view.json", function(req, res) {
    res.sendFile(__dirname + "/static/sample.json");
});

app.get("/api/data", function(req, res) {
    var pid = req.query.project || "aj3AR4nP1EV87DBJQ";
    var kid = req.query.key || "40b465ba6569ab888f0379f5a461aa19";
    console.log(pid, kid);
    getDT(user, pid).then(function(dt) {
        dt.get(kid).then(function(value) {
            res.status(200).send(value);
        });
    });
});


//app.ws('/api/status', function(ws, req) {
//    ws.on('message', function(msg) {
//        console.log(msg);
//    });
//    console.log('socket', req.testing);
//});

app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});