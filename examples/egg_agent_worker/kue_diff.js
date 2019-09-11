'use strict';
// const _ = require('lodash');

const kue = require('kue');
// create our job queue

const queue = kue.createQueue({
  prefix: 'q',
  redis: {
    port: 6379,
    host: '127.0.0.1',
    auth: 'password',
    db: 5, // if provided select a non-default redis db
    options: {
      // see https://github.com/mranney/node_redis#rediscreateclient
    },
  },
});

// start redis with $ redis-server

// create some jobs at random,
// usually you would create these
// in your http processes upon
// user input etc.

function create() {
  //   var name = [ 'tobi', 'loki', 'jane', 'manny' ][ Math.random() * 4 | 0 ];
  //   console.log( '- creating job for %s', name );
  //   jobs.create( 'video conversion', {
  //     title: 'converting ' + name + '\'s to avi', user: 1, frames: 200
  //   } ).save();
  //   setTimeout( create, Math.random() * 3000 | 0 );
}
// create();
setInterval(create, 2000);

// process video conversion jobs, 3 at a time.

queue.process('doddiff', 3, function(job, done) {
  // const { before, after } = job.data;
  setTimeout(done, 700);
});

queue.process('dddiff', 3, function(job, done) {
  // const { before, after } = job.data;
  setTimeout(done, 700);
});

queue.on('error', function(err) {
  console.log('Oops... ', err);
});
// queue.inactive( function( err, ids ) { // others are active, complete, failed, delayed
//   // you may want to fetch each id to get the Job object out of it...
//   ids.forEach( function( id ) {
//       console.log(`remove inactive ${id}`);
//       kue.Job.get( id, function( err, job ) {
//         // Your application should check if job is a stuck one
//         job.remove();
//       });
//     });
// });
// // start the UI
// var app = express();
// app.use( kue.app );
// app.listen( 3000 );
// console.log( 'UI started on port 3000' );
