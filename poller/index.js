'use strict';

var price = 40;

var AWS = require('aws-sdk');
var Q = require('q');
var dateFormat = require('dateformat');
AWS.config.setPromisesDependency(Q.Promise);
var awsRegion = process.env.AWS_REGION;

var docClient = new AWS.DynamoDB.DocumentClient({region: awsRegion, endpoint: 'http://localhost:8000'});
var ses = new AWS.SES({region: awsRegion});

var soap = require('soap');
// var url = 'https://hackathon.app.kaercher.com/soap/v18/data?wsdl';
var url = 'data.wsdl';
var options = {
  ignoredNamespaces: {
    namespaces: [],
    override: true
  }
};

function getEvents(events, fromTime) {
  var deferred = Q.defer();
  var args = {
    machineIdentifiers: {
      attributes: {
        "xsi:type": "tns:kaercherMachineIdentifier"
      },
      // Koffer
      // materialNumber: '1.999-260.0',
      // serialNumber: '000100'
      
      // Kehrmaschine
      materialNumber: '1.280-150.2',
      serialNumber: '000116'
    },
    eventFilter: {
      eventCodes: 2000
    },
    fromTimestamp: fromTime || 0
  };
  soap.createClient(url, options, function (err, client) {
    if (err) {
      deferred.reject(err);
      return;
    }
    client.queryForEvents(args, function (err, result) {
      if (err) {
        deferred.reject(err);
        return;
      }
      var newEvents = events || [];
      if (result.return.machineEventQueryResponse) {
        var resEvents = result.return.machineEventQueryResponse[0].events;
        newEvents = newEvents.concat(resEvents);
        if (resEvents.length === 0) {
          deferred.resolve(newEvents);
          return;
        }
        getEvents(newEvents, result.return.timestampToken).then(function (events) {
          deferred.resolve(events);
        });
      }
      deferred.resolve(newEvents);
    });
  });
  return deferred.promise;
}

function parseEvents(events) {
  return events.map(parseEvent);
}

function parseEvent(event) {
  var res = {};
  event.eventAttributes.entry.forEach(function (att) {
    if (att.key === "GeoAreaId") {
      res.area = att.value;
    }
  });
  res.enter = !event.risingEdge;
  res.time = new Date(event.timestamp).getTime();
  console.log('Event', res, new Date(event.timestamp));
  return res;
}

function handleEvents(events) {
  var start = {events: events, sessions: []};
  return Q.resolve(start).then(handleSessionEvent);
}

function handleSessionEvent(ctx) {
  if (ctx.events.length === 0) {
    return ctx.sessions;
  }
  var event = ctx.events[0];
  ctx.events = ctx.events.slice(1);
  if (event.enter) {
    return handleStartSession(ctx, event).then(handleSessionEvent);
  }
  return handleEndSession(ctx, event).then(handleSessionEvent);
}


function handleStartSession(ctx, event) {
  var params = {
    TableName: 'KehrwocheEvents',
    Item: {
      "area": event.area,
      "start": event.time
    }
  };
  return docClient.put(params).promise().then(function (res) {
    return ctx;
  });
}

function handleEndSession(ctx, event) {
  var params = {
    TableName: 'KehrwocheEvents',
    Key: {
      "area": event.area
    }
  };
  
  return docClient.get(params).promise().then(function (data) {
    var state = data.Item;
    if (!state) {
      return ctx;
    }
    var duration = (event.time - state.start) / 1000 / 3600;
    var cost = duration * price;
    
    var session = {
      area: event.area,
      start: new Date(state.start),
      startTime: state.start,
      end: new Date(event.time),
      endTime: event.time,
      duration: duration,
      cost: cost
    };
    ctx.sessions.push(session);
    return docClient.delete(params).promise().then(function (res) {
      return ctx;
    });
  }, function (err) {
    console.log('Error or get or delete', err);
    return ctx;
  });
}

function sendBilling(sessions) {
  var text = '<html><body><h1>Ihre Abrechnung zu Kehrwoche-as-a-Service</h1>';
  text += '<table border="1" width="70%">';
  text += '<tr><th width="40%">Start</th><th width="40%">Ende</th><th width="20%">Preis</th></tr>';
  
  var sum = 0;
  sessions.forEach(function (sess) {
    var cost = sess.cost.toFixed(2);
    var start = dateFormat(sess.start, "dd.mm.yyyy hh:MM:ss");
    var end = dateFormat(sess.end, "dd.mm.yyyy hh:MM:ss");
    text += '<tr><td>' + start + '</td><td>' + end + '</td><td>' + cost + ' € </td></tr>';
    sum += sess.cost;
  });
  text += '</table>';
  text += '<br/>';
  text += '<h3>Die Gesamtkosten belaufen sich auf: ' + sum.toFixed(2) + ' €</h3>';
  text += '<p>Viele Grüße<br/>Ihr Kehrwoche-as-a-Service Team</p>';
  text += '</body></html>';
  
  var params = {
    Destination: {
      ToAddresses: [
        'thorsten.hoeger@taimos.de'
      ]
    },
    Message: {
      Body: {
        Html: {
          Data: text,
          Charset: 'UTF-8'
        }
      },
      Subject: {
        Data: 'Kehrwoche-as-a-Service Abrechnung',
        Charset: 'UTF-8'
      }
    },
    Source: 'kehrwoche@taimos.de'
  };
  return ses.sendEmail(params).promise();
}

exports.handler = function (event, context, callback) {
  console.log("INFO: Poller triggered from start " + parseInt(event.time));
  
  getEvents([], parseInt(event.time))
    .then(parseEvents)
    .then(handleEvents)
    .then(sendBilling)
    .then(function (events) {
      callback(null, events);
    })
    .catch(function (err) {
      callback(err);
    })
  ;
};
