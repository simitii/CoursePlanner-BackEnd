var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');


// import api route
var api = require('./api/Api'); 


// create servers
var httpServer = http.createServer(app);

// for parsing application/json
app.use(bodyParser.json()); 
// for parsing application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true })); 

if(process.env.NODE_ENV=="DEBUG" || process.env.NODE_ENV=="DEV"){
	var cors = require('cors');
	app.use(cors()); 
}



// api route
app.use('/api/',api);

//opening page
app.use('/', function (req, res) {
	res.send("Server is up!");
});

var port = process.env.PORT || 3000;

// start servers
httpServer.listen(port,function(){
	console.log('HTTP SERVER listening on port ' + port);
}); 
