'use strict';
// const _ = require('lodash');
const EventEmitter = require('events');

const kue = require('kue');
// create our job queue

// var queue = kue.createQueue({
//   prefix: 'q',
//   redis: {
//     port: 6379,
//     host: '127.0.0.1',
//     auth: 'password',
//     db: 5, // if provided select a non-default redis db
//     options: {
//       // see https://github.com/mranney/node_redis#rediscreateclient
//     }
//   }
// });
let queue;
// const isDoneCounter = 0;

class KueHelper extends EventEmitter {
  init() {
    queue = kue.createQueue({
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
    queue.on('error', err => {
      console.log('Oops... ', err);
      this.emit('error', err);
    });
    queue.on('job complete', id => {
      // kue.Job.get(id, (err, job)=>{
      //   if (err) return;
      //   job.remove((err)=>{
      //     if (err) throw err;
      //     console.log('removed completed job #%d', job.id);
      //   });
      // });
      this.emit('job complete', id);
    });
  }
  create() {
    const job = queue
      .create('diff', {
        before: 1,
        after: 2,
      })
      .save();
    job
      .on('complete', function(result) {
        console.log('Job completed with data ', result);
      })
      .on('failed attempt', function(errorMessage, doneAttempts) {
        console.log('Job failed');
        console.log('reason++++---->', errorMessage);
        console.log(doneAttempts);
      })
      .on('failed', function(errorMessage) {
        console.log('Job failed');
        console.log('reason++++---->', errorMessage);
      })
      .on('progress', function(progress, data) {
        console.log(
          '\r  job #' + job.id + ' ' + progress + '% complete with data ',
          data
        );
      });
  }
  work() {
    queue.process('diff', function(job, ctx, done) {
      const { before, after } = job.data;
      console.log(`before: ${before} after: ${after}`);
      // setTimeout(done, 2000);
      job.data.before++;
      job.data.after++;
      // isDoneCounter++;
      // if(isDoneCounter > 10) {
      //     done();
      // }
      setTimeout(done, 5000);
    });
  }
  pause() {
    queue.process('diff', function(job, ctx, done) {
      ctx.pause(2000, function(err) {
        console.log('Worker is paused... ');
      });
    });
  }
  resume() {
    queue.process('diff', function(job, ctx, done) {
      ctx.resume();
    });
  }
  clear() {
    queue.inactive(function(err, ids) {
      // others are active, complete, failed, delayed
      // you may want to fetch each id to get the Job object out of it...
      ids.forEach(function(id) {
        console.log(`remove inactive ${id}`);
        kue.Job.get(id, function(err, job) {
          // Your application should check if job is a stuck one
          job.remove();
        });
      });
    });
  }
  shutdown() {
    queue.shutdown(5000, function(err) {
      console.log('Kue shutdown: ', err || '');
    });
  }
}

module.exports = KueHelper;

// start redis with $ redis-server

// create some jobs at random,
// usually you would create these
// in your http processes upon
// user input etc.

// function create() {
//   var name = [ 'tobi', 'loki', 'jane', 'manny' ][ Math.random() * 4 | 0 ];
//   console.log( '- creating job for %s', name );
//   jobs.create( 'video conversion', {
//     title: 'converting ' + name + '\'s to avi', user: 1, frames: 200
//   } ).save();
//   setTimeout( create, Math.random() * 3000 | 0 );

// }
// create();
// setInterval(create, 2000);

// process video conversion jobs, 3 at a time.

// queue.on( 'error', function( err ) {
//     console.log( 'Oops... ', err );
// });
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
