'use strict';

var price = 40;

var AWS = require('aws-sdk');
var Q = require('q');
AWS.config.setPromisesDependency(Q.Promise);
var awsRegion = process.env.AWS_REGION;

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
      materialNumber: '1.999-260.0',
      serialNumber: '000100'
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

function collectEvents(events) {
  var res = {};
  events.forEach(function (ev) {
    if (!res[ev.area]) {
      res[ev.area] = [];
    }
    res[ev.area].push({enter: ev.enter, time: ev.time});
  });
  return res;
}

function collectSessions(events) {
  var sessions = [];
  for (var index in events) {
    if (events.hasOwnProperty(index)) {
      var evs = events[index];
      var currentSession;
      evs.forEach(function (ev) {
        if (ev.enter) {
          currentSession = {id: index, start: ev.time};
        } else {
          if (currentSession) {
            currentSession.end = ev.time;
            sessions.push(currentSession);
            currentSession = undefined;
          }
        }
      });
    }
  }
  return sessions;
}

function calcBilling(sessions) {
  var res = {};
  
  sessions.forEach(function (session) {
    if (!res[session.id]) {
      res[session.id] = [];
    }
    var duration = (session.end - session.start) / 1000 / 3600;
    var cost = duration * price;
    res[session.id].push({start: session.start, end: session.end, duration: duration, cost: cost});
  });
  
  return res;
}

exports.handler = function (event, context, callback) {
  console.log("INFO: Poller triggered");
  
  getEvents([], 0)
    .then(parseEvents)
    .then(collectEvents)
    .then(collectSessions)
    .then(calcBilling)
    .then(function (events) {
      callback(null, events);
    })
    .catch(function (err) {
      callback(err);
    })
  ;
};
