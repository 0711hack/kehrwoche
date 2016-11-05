'use strict';

var soap = require('soap');
var xmlbuilder = require('xmlbuilder');


var url = 'configuration.wsdl';
var options = {
    ignoredNamespaces: {
        namespaces: [],
        override: true
    },
    overrideRootElement: {
        namespace: 'ns1'
    }
};

module.exports.addGeofence = (event, context, callback) => {

    console.log(JSON.stringify(event));
    //const req = JSON.parse(event.body);
    
    
    soap.createClient(url, options, function(err, client) {

        // mock
        var req = {
            "id": "12345",
            "points": [
                {"long":9.2123441607132,"lat":48.815351118168124},
                {"long":9.212093469905994,"lat":48.815351118168124},
                {"long":9.212093469905994,"lat":48.815174078606056},
                {"long":9.2123441607132,"lat":48.815174078606056}
            ]
        };
        
        if(event && event.body) {
            req = JSON.parse(event.body);
        }

        // build xml
        var geofence = xmlbuilder.begin().ele('GeoArea', { 'GeoAreaId': '1337' });    
        req.points.forEach(function (point, i) {
            geofence.ele('GeoLocation', { 'SequenceNr': i+1 }).ele('Latitude', point.lat).up().ele('Longtitude', point.long);
        });
        
        
        console.log(geofence.end({ pretty: true}));

        var args = {
            domain: "GEOFENCECONF",
            machineIdentifiers: {
                attributes: {
                    "xsi:type": "tns:kaercherMachineIdentifier"
                },
                materialNumber: '1.999-260.0',
                serialNumber: '000100'
            },
            replacements: {
                placeholder: "GeoFences",
                xml: geofence.end({ pretty: false})
            }
        };

        client.setConfigurationReplacements(args, function(err, result, raw, soapHeader) {
            if(err) { console.log(err); }
            console.log(result.return);
        
        
            delete args.replacements
        
            client.getConfigurationReplacements(args, function(err, result, raw, soapHeader) {
                if(err) { console.log(err); }
                console.log(result.return);
                
                const response = {
                    statusCode: 200,
                    headers: {'Access-Control-Allow-Origin': '*'},
                    body: JSON.stringify({
                        message: 'Go Serverless v1.0! Your function executed successfully!',
                        input: req,
                    }),
                };
                
                
                callback(null, response);
            });
        });

    });

    // const response = {
    //     statusCode: 200,
    //     headers: {'Access-Control-Allow-Origin': '*'},
    //     body: JSON.stringify({
    //         message: 'Go Serverless v1.0! Your function executed successfully!',
    //         input: req,
    //     }),
    // };
    // 
    // callback(null, response);
};
