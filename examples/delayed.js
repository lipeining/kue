var kue = require( '../' );

// create our job queue

var jobs = kue.createQueue({
  prefix: 'q',
  redis: {
    port: 6379,
    host: '127.0.0.1',
    auth: 'password',
    db: 3, // if provided select a non-default redis db
    options: {
      // see https://github.com/mranney/node_redis#rediscreateclient
    }
  }
});

// one minute

var minute = 60000;

var email = jobs.create( 'email', {
  title: 'Account renewal required', to: 'tj@learnboost.com', template: 'renewal-email'
} ).delay( minute )
  .priority( 'high' )
  .save();


email.on( 'promotion', function () {
  console.log( 'renewal job promoted' );
} );

email.on( 'complete', function () {
  console.log( 'renewal job completed' );
} );

jobs.create( 'email', {
  title: 'Account expired', to: 'tj@learnboost.com', template: 'expired-email'
} ).delay( minute * 10 )
  .priority( 'high' )
  .save();

jobs.promote();

jobs.process( 'email', 10, function ( job, done ) {
  setTimeout( function () {
    done();
  }, Math.random() * 5000 );
} );

// start the UI
kue.app.listen( 3000 );
console.log( 'UI started on port 3000' );
console.log(kue);