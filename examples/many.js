var kue     = require( '../' )
  , express = require( 'express' );

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

function create() {
  var name = [ 'tobi', 'loki', 'jane', 'manny' ][ Math.random() * 4 | 0 ];
  jobs.create( 'video conversion', {
    title: 'converting ' + name + '\'s to avi', user: 1, frames: 200
  } ).save();
  setTimeout( create, Math.random() * 3000 | 0 );
}

create();

function create2() {
  var name = [ 'tobi', 'loki', 'jane', 'manny' ][ Math.random() * 4 | 0 ];
  jobs.create( 'email', {
    title: 'emailing ' + name + '', body: 'hello'
  } ).save();
  setTimeout( create2, Math.random() * 1000 | 0 );
}

create2();

// process video conversion jobs, 2 at a time.

jobs.process( 'video conversion', 2, function ( job, done ) {
  console.log( 'video' );
  setTimeout( done, Math.random() * 5000 );
} );

// process 10 emails at a time

jobs.process( 'email', 10, function ( job, done ) {
  console.log( 'email' );
  setTimeout( done, Math.random() * 2000 );
} );

// start the UI
kue.app.listen( 3000 );
console.log( 'UI started on port 3000' );
