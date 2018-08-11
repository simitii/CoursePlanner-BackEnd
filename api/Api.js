
var router = require('express').Router();
var request = require('request');
var iconv = require('iconv-lite');
var ms_viewstate = require('ms-viewstate');

request = request.defaults({
 	encoding: null
});

var encoding = 'iso-8859-9';

var hiddenDepartments = {};

var form_data = {};

//=========SEMESTER-DATA======
var getLastedSemester = function(callback){
	request.get('http://registration.boun.edu.tr/BUIS/General/schedule.aspx',{jar: true}, function(error, req_res, body){
		//ENCODING FIX
		body = iconv.decode(body, encoding);

		form_data['__VIEWSTATE'] = ms_viewstate.extractVs(body);
		form_data['__EVENTVALIDATION'] = ms_viewstate.extractEv(body);
		form_data['ctl00$cphMainContent$txtSearch'] = "";
		form_data['ctl00$cphMainContent$btnSearch'] = "Go";

		var str_before = '<option selected="selected" value="';
		body =  body.substr(body.indexOf(str_before)+str_before.length);
		var str_after = '">';
		var semester =body.substr(0,body.indexOf(str_after));
	
		form_data['ctl00$cphMainContent$ddlSemester'] = semester;
		callback(semester);
	});
};

router.use('/getLastedSemester',function(req,res){
	getLastedSemester(function(semester){
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
var getDepartments = function(callback){
	var continue_department_search = function(){
		request.post('http://registration.boun.edu.tr/BUIS/General/schedule.aspx',{form: form_data, jar: true}, function (error, req_res, body) {
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
	
			for(var propertyName in hiddenDepartments) {
				if(hiddenDepartments.hasOwnProperty(propertyName)){
					var depInfo = hiddenDepartments[propertyName];
					response.push({
						short: depInfo.short,
						long : null
					});
				}
			 }
			callback(response);
		});
	};
	if(!form_data['__EVENTVALIDATION']){
		getLastedSemester(continue_department_search);
	}else{
		continue_department_search();
	}
};

router.use('/getDepartments',function(req,res){
	getDepartments(function(departments){
		res.send(departments);
	});
});

var buildDepartmentURL = function(semester,short,long){
	return "http://registration.boun.edu.tr/scripts/sch.asp?donem=" + semester + "&kisaadi=" + short + 
															"&bolum=" + encodeComponent(long);

};

var removeSpaces = function(str){
	return str.replace(" ", "");
}

var getDepartmentCode = function(courseCode){
	var isNumber = function(ch){
		var charCode = ch.charCodeAt(0);
		return charCode>=48 && charCode<=57; 
	}
	var dep = "";
	for(var i = 0;i<courseCode.length;i++){
		var ch = courseCode.charAt(i);
		if(isNumber(ch) || ch == '.'){
			return dep; 
		}
		dep += ch;
	}
}

var getCourses = function(semester,short,long,callback){
	if(semester === undefined || short === undefined || long === undefined){
		return;
	}
	if(hiddenDepartments[short]!==undefined && long==null){
		var hiddenDep = hiddenDepartments[short];
		short = hiddenDep.parentShort;
		long = hiddenDep.parentLong;
	}
	if(long == null){
		console.log("long == null ", short);
		return;
	}
	var url = buildDepartmentURL(semester,short,long);
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
			var courseCode = deleteSpaces(code);
			var depCode = getDepartmentCode(courseCode);
			if(depCode != short && hiddenDepartments[depCode]===undefined){
				console.log(depCode);
				hiddenDepartments[depCode] = {
					short: depCode,
					parentShort: short,
					parentLong: long
				};
			}
			response.push({
				code: courseCode,
				name: name,
				credits: credits,
				ects: ects,
				instructor: instructor,
				time: time
			});
			body = body.substr(body.indexOf('<tr class="schtd'));
			index = body.indexOf("font-size:12px'>");
		}
		callback(response);
	});
};


var findHiddenDepartments = function(){
	console.log("Hidden Department Search Started!");
	getLastedSemester(function(semester){
		getDepartments(function(departments){
			for(let i = 0;i<departments.length;i++){
				let department = departments[i];
				setTimeout(function(){
					console.log(department);
					getCourses(semester,department.short,department.long,function(){
						if(i===(departments.length-1)){
							console.log("Hidden Department Search Completed!");
						}
					});
				},i*5000); //5sn = 5000ms
			}
		});
	});
};

if(process.env.NODE_ENV=="PRODUCTION"){
	findHiddenDepartments();
	setInterval(findHiddenDepartments,25920000); // 72hours = 25920000ms
}

router.use('/getCourses',function(req,res){
	if(req.body.semester === undefined || req.body.short === undefined || req.body.long === undefined){
		console.log(req.body.semester,req.body.short,req.body.long);
		res.sendStatus(400);
		return;
	}
	getCourses(req.body.semester,req.body.short,req.body.long,function(result){
		res.send(result);
	});
});



//========INVALID_SUBPATH======
router.use('/',function(req,res){
	res.sendStatus("404");
});

// return the router
module.exports = router;
