var AWS = require('aws-sdk');
var Q = require('q');
AWS.config.setPromisesDependency(Q.Promise);
var awsRegion = process.env.AWS_REGION;

var dynamo = new AWS.DynamoDB({region: awsRegion, endpoint: 'http://localhost:8000'});

var params = {
  TableName : "KehrwocheEvents",
  KeySchema: [
    { AttributeName: "area", KeyType: "HASH"}
  ],
  AttributeDefinitions: [
    { AttributeName: "area", AttributeType: "S" }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 10,
    WriteCapacityUnits: 10
  }
};

dynamo.createTable(params, function(err, data) {
  if (err) {
    console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
  } else {
    console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
  }
});
