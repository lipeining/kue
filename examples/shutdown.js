var kue = require( '../' )

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
})


function generateJobs() {
  for ( var i = 0; i < 12; i++ ) {
    console.log( 'Creating Job #' + i );
    jobs.create( 'long render', {
      title: 'rendering frame #' + i
    } ).save();
  }
}


jobs.process( 'long render', 4, function ( job, done ) {
  console.log( 'Starting ' + job.data.title );
  setTimeout( function () {
    console.log( 'Finished ' + job.data.title );
    done();
  }, 3000 );
} )


generateJobs();

setTimeout( function () {
  console.log( '[ Shutting down when all jobs finish... ]' );
  jobs.shutdown( function ( err ) {
    console.log( '[ All jobs finished. Kue is shut down. ]' );
    process.exit( 0 );
  } )
}, 4200 )

