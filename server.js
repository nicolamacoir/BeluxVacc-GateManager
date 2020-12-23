var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
var cors = require('cors')

var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors())

var routes = require('./api/routes/beluxRoutes'); //importing route
routes(app); //register the route

app.listen(port);

console.log('belux-gate-manager-api succesfully started on: ' + port);