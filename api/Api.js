var router = require('express').Router();
var request = require('request');
var iconv = require('iconv-lite');

request = request.defaults({
 	encoding: null
});

var encoding = 'iso-8859-9';

// split up route handling

//=========SEMESTER-DATA======
router.use('/getLastedSemester',function(req,res){
	request('http://registration.boun.edu.tr/schedule.htm', function (error, response, body) {
		//ENCODING FIX
		body = iconv.decode(body, encoding);

		body = body.substr(body.indexOf('option'));
		body = body.substr(body.indexOf("'")+1);
		var semester = body.substr(0,body.indexOf("'"));
		res.send({
			semester: semester
		});
	});
});

var encodeComponent = function(str){
	return str.replace(/\s/g,"+").replace(/\&/g,"%26");
}
var decodeComponent = function(str){
	return str.replace(/\+/g," ").replace(/\%26/g,"&");
}
var deleteSpaces = function(str){
	return str.replace(/\s/g, '');
}
 
//=========DEPARTMENT-DATA====
router.use('/getDepartments',function(req,res){
	request.post('http://registration.boun.edu.tr/scripts/schdepsel.asp', function (error, response, body) {
		//ENCODING FIX
		body = iconv.decode(body, encoding);
		
		var response = [];
		body = body.substr(body.indexOf('Departments'));
		var index = body.indexOf("kisaadi=");
		while(index >= 0){
			body = body.substr(index+8);
			var shortName = body.substr(0,body.indexOf("&"));
			var longName = body.substr(body.indexOf("bolum=")+6,body.indexOf('">'));
			longName = longName.split('"')[0];
			response.push({
				short: shortName,
				long: decodeComponent(longName)
			});
			index = body.indexOf("kisaadi=");
		}
		res.send(response);
	});
});

var buildDepartmentURL = function(semester,short,long){
	return "http://registration.boun.edu.tr/scripts/sch.asp?donem=" + semester + "&kisaadi=" + short + 
															"&bolum=" + encodeComponent(long);

};

var removeSpaces = function(str){
	return str.replace(" ", "");
}

router.use('/getCourses',function(req,res){
	if(req.body.semester === undefined || req.body.short === undefined || 
			req.body.long === undefined){
		console.log(req.body.semester,req.body.short,req.body.long);
		res.sendStatus(400);
		return;
	}
	var url = buildDepartmentURL(req.body.semester,req.body.short,req.body.long);
	request(url, function (error, response, body) {
		//ENCODING FIX
		body = iconv.decode(body, encoding);
		
		var response = [];
		var QuotaModActive = body.indexOf("<td width=3% align=left>Quota</td>") !== -1;
		body = body.substr(body.indexOf('<tr class="schtd'));
		var index = body.indexOf("font-size:12px'>");
		while(index>=0){
			var code = body.substr(index+16,body.indexOf("</font>")).split("</font>")[0];
			body = body.substr(body.indexOf("Desc.</a></td>")+14);
			var name = body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			var credits = body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			var ects = body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			if(QuotaModActive){
				body = body.substr(body.indexOf("&nbsp;</td>")+11);
			}
			var instructor = body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			var time = body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			time += body.substr(body.indexOf("<td>")+4,body.indexOf("&nbsp")).split("&nbsp")[0];
			body = body.substr(body.indexOf("&nbsp;</td>")+11);
			response.push({
				code: deleteSpaces(code),
				name: name,
				credits: credits,
				ects: ects,
				instructor: instructor,
				time: time
			});
			body = body.substr(body.indexOf('<tr class="schtd'));
			index = body.indexOf("font-size:12px'>");
		}
		res.send(response);
	});
});



//========INVALID_SUBPATH======
router.use('/',function(req,res){
	res.sendStatus("404");
});

// return the router
module.exports = router;
