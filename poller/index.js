'use strict';

var AWS = require('aws-sdk');
var awsRegion = process.env.AWS_REGION;

var soap = require('soap');
// var url = 'https://hackathon.app.kaercher.com/soap/v18/data?wsdl';
var url = 'data.wsdl';
var options = {
  ignoredNamespaces: {
    namespaces: [],
    override: true
  }
}

exports.handler = function (event, context, callback) {
  console.log("INFO: Poller triggered");
  
  var args = {
    machineIdentifiers: {
      attributes: {
        "xsi:type": "tns:kaercherMachineIdentifier"
      },
      materialNumber: '4.683-023.0',
      serialNumber: '010367'
    }
  };
  soap.createClient(url, options, function (err, client) {
    if (err) {
      callback(err);
      return;
    }
    // console.log(client);
    client.queryForLastData(args, function (err, result) {
      if (err) {
        callback(err);
        return;
      }
      callback(null, result);
    });
  });
};
