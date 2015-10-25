var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var SDK = require('../js-sdk/index');
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
    var user = req.body.user;
    var password = req.body.password;
    user = sdk.loginUser(user, password);
    console.log(JSON.stringify(user));
    res.status(200).end();
});

app.get('/api/projects', function (req, res) {
    user.listProjects().then(function(projects) {
        res.status(200).send(projects);
    })
});

//app.get('/', function (req, res) {
//    res.send('Hello World!');
//});
//

app.get("/api/view.json", function(req, res) {
//    var data = require("../../spectacles/examples/2/js/Spectacles.json");
//    res.status(200).send(data);
    res.sendFile(__dirname + "/static/sample.json");
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});