'use strict';

var soap = require('soap');
var url = 'https://hackathon.app.kaercher.com/soap/v18/data?wsdl';
var args = {name: 'value'};

module.exports.addGeofence = (event, context, callback) => {

    console.log(JSON.stringify(event));
    const req = JSON.parse(event.body);

    const response = {
        statusCode: 200,
        headers: {'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify({
            message: 'Go Serverless v1.0! Your function executed successfully!',
            input: req,
        }),
    };

    callback(null, response);
};
