var index = require('./index');

index.handler({time: process.argv[2]}, undefined, function (err, data) {
  console.log(err);
  console.log(data);
});