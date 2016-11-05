'use strict';

var price = 40;

var AWS = require('aws-sdk');
var Q = require('q');
AWS.config.setPromisesDependency(Q.Promise);
var awsRegion = process.env.AWS_REGION;

var dynamo = {};

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
  res.time = new Date(event.timestamp);
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
  dynamo[event.area] = {start: event.time};
  console.log('Handle start', event);
  return Q.resolve(ctx);
}

function handleEndSession(ctx, event) {
  if (dynamo[event.area]) {
    var state = dynamo[event.area];
    var duration = (event.time - state.start) / 1000 / 3600;
    var cost = duration * price;
    ctx.sessions.push({area: event.area, start: state.start, end: event.time, duration: duration, cost: cost});
    delete dynamo[event.area];
  }
  return Q.resolve(ctx);
}

function sendBilling(sessions) {
  return sessions;
}

exports.handler = function (event, context, callback) {
  console.log("INFO: Poller triggered");
  
  getEvents([], 0)
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
