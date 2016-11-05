var index = require('./index');

index.handler(undefined, undefined, function (err, data) {
  console.log(err);
  console.log(data);
});