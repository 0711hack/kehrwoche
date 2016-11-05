'use strict';

// imports
var soap = require('soap');
var xmlbuilder = require('xmlbuilder');

// xml configuration
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

    // create soap client
    soap.createClient(url, options, function(err, client) {
        if(err) { console.log(err); }

        // mock / default geofence
        var req = {
            "id": "12345",
            "points": [
                {"long":9.2123441607132,"lat":48.815351118168124},
                {"long":9.212093469905994,"lat":48.815351118168124},
                {"long":9.212093469905994,"lat":48.815174078606056},
                {"long":9.2123441607132,"lat":48.815174078606056}
            ]
        };

        // check if geofence coordinates supplied
        if(event && event.body) {
            req = JSON.parse(event.body);
        }

        // build xml
        var geofence = xmlbuilder.begin().ele('GeoArea', { 'GeoAreaId': '1337' });    
        req.points.forEach(function (point, i) {
            geofence.ele('GeoLocation', { 'SequenceNr': i+1 }).ele('Longitude', Math.round(point.long*1000000)).up().ele('Latitude', Math.round(point.lat*1000000));
        });

        // debug
        console.log(geofence.end({ pretty: true}));

        // xml attributes
        var args = {
            domain: "GEOFENCECONF",
            machineIdentifiers: {
                attributes: {
                    "xsi:type": "tns:kaercherMachineIdentifier"
                },
                materialNumber: '1.280-150.2',
                serialNumber: '000116'
            },
            replacements: {
                placeholder: "GeoFences",
                xml: geofence.end({ pretty: false})
            }
        };

        // set geofence
        client.setConfigurationReplacements(args, function(err, result, raw, soapHeader) {
            if(err) { console.log(err); }
            console.log(result.return);

            // build response
            const response = {
                statusCode: 200,
                headers: {'Access-Control-Allow-Origin': '*'},
                body: JSON.stringify({
                    message: 'successful',
                    input: event
                })
            };
            callback(null, response);

        });
    });

};
