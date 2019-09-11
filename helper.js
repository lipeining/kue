
// 1.计数器位置，操作，应用
// 在每一个Job的save方法里面，会使用Incr q:ids进行唯一Id的分配，一般保持顺序Id
// 2.redis定制zset操作，如何保持数据统一不出错。
// 因为实际的数据都是存储在job:${id}的hash结构中，zset里面管理的是排序信息，使用优先级作为score。然后，固定使用
// 自定义的createFIFO,stripFIFO方法包裹id。在定时器里面，堆任务和job的管理没有出错，及时得处理掉各个状态的job.避免
// 一个job两种状态.清理的方法也重要。无论是key,hash,zset，相关的资源需要清理完毕。
// 3.如何管理queue,job的状态
// 4.如何链式调用方法
// 因为是状态事件，每一个方法是用于设置对应的值，保存在对象内部，不需要返回参数表示设置是否成功，使用抛出错误的方式
// 终止错误的函数调用，所以每个方法都可以返回this对象，用于链式调用。
// 5.是否有默认的事件监听方法或者机制。
// 有，内部管理的queue,job.worker会抛出对应的错误或者对应的事件，由kue统一监听处理，适当地暴露对应的监听方法
// 6.注意事项
// 7.错误退出和数据恢复部分
// 只能保证清除掉定时器，对于未完成的，并不会等待完成，而是将状态标记更改，然后结束之。

// job:ids number, 存储id生成器 incr

// job:${id}:log list
// this.client.rpush(this.client.getKey('job:' + this.id + ':log'), formatted, noop);

// stats:work-time number 全部的work的工作时间 

// 之后可以通过score等方式通过_priority取得对应的job
// multi
// .hset(client.getKey('job:' + this.id), 'state', state)
// .zadd(client.getKey('jobs:' + state), this._priority, this.zid)
// .zadd(client.getKey('jobs:' + this.type + ':' + state), this._priority, this.zid);

// job:${state} zset   state:active,delayed,complete,inactive,failed
// value     score
// 长度|id    0

// job:${type}:${state} zset 多了自定义的type

// job:${id}  hash结构，存储一个job的信息
// job.type              = hash.type;
// job._ttl              = hash.ttl;
// job._delay            = hash.delay;
// job.priority(Number(hash.priority));
// job._progress         = hash.progress;
// job._attempts         = Number(hash.attempts);
// job._max_attempts     = Number(hash.max_attempts);
// job._state            = hash.state;
// job._error            = hash.error;
// job.created_at        = hash.created_at;
// job.promote_at        = hash.promote_at;
// job.updated_at        = hash.updated_at;
// job.failed_at         = hash.failed_at;
// job.started_at        = hash.started_at;
// job.duration          = hash.duration;
// job.workerId          = hash.workerId;
// job._removeOnComplete = hash.removeOnComplete;
// if( hash.data ) job.data = JSON.parse(hash.data);
// if( hash.result ) job.result = JSON.parse(hash.result);
// if( hash.progress_data ) job.progress_data = JSON.parse(hash.progress_data);
// if( hash.backoff ) {
//   var source = 'job._backoff = ' + hash.backoff + ';';
// //                require('vm').runInContext( source );
//   eval(source);
// }

// redis里面会管理一个_client,一个_pubsub
// 每一个client的特点是这样的:
// zset 
// key    score 
// 02|99  high,low,-10,-5,0,5,10
exports.createClient = function() {
    var clientFactoryMethod = options.redis.createClientFactory || exports.createClientFactory;
    var client              = clientFactoryMethod(options);

    client.on('error', function( err ) {
      queue.emit('error', err);
    });

    client.prefix           = options.prefix;

    // redefine getKey to use the configured prefix
    client.getKey = function( key ) {
      if( client.constructor.name == 'Redis'  || client.constructor.name == 'Cluster') {
        // {prefix}:jobs format is needed in using ioredis cluster to keep they keys in same node
        // otherwise multi commands fail, since they use ioredis's pipeline.
        return '{' + this.prefix + '}:' + key;
      }
      return this.prefix + ':' + key;
    };

    client.createFIFO = function( id ) {
      //Create an id for the zset to preserve FIFO order
      var idLen = '' + id.toString().length; // 此时的idLen = String(1)||String(2) || String(3)
      var len = 2 - idLen.length; // 一般情况下len = 2-1 = 1,除非id>10了，那么就是0,-1
      while (len--) idLen = '0' + idLen; // 这里是为了堆id长度小于10的进行补充零位，一般只补一位0
      return idLen + '|' + id;// 使用|分割
    };

    // Parse out original ID from zid
    client.stripFIFO = function( zid ) {
      if ( typeof zid === 'string' ) {
        return +zid.substr(zid.indexOf('|')+1);
      } else {
        // Sometimes this gets called with an undefined
        // it seems to be OK to have that not resolve to an id
        return zid;
      }
    };

    return client;
  };


// Queue(Worker(Job), Job)
// Queue依赖Worker,Job,Worker依赖Job


// kue.js的魔法之处
// 1.将事件监听方法拦截，对于自定义的job类型事件，一律使用redis的pubsub机制。
Queue.prototype.on = function( event ) {
  if( 0 == event.indexOf('job') ) events.subscribe();
  return on.apply(this, arguments);
};

// 使用一个专门的lockClient用于抢锁操作。只有拿到锁的才可以检查delayed的队列和active的队列
/**
 * sets up promotion & ttl timers
 */

Queue.prototype.setupTimers = function() {
  if( this.warlock === undefined ) {
    this.lockClient = redis.createClient();
    this.warlock    = new Warlock(this.lockClient);
  }
  this.checkJobPromotion(this._options.promotion);
  this.checkActiveJobTtl(this._options.promotion);
};

// 使用分数将符合当前的激活时间的delayed任务取出，进行inactive
// 具体操作为：publish一个promotion事件，然后Job的inactive会
// 将当前的job的state改变，
// 将旧的state删除，确定新的state的合法性，然后multi的事务写入redis中
if( typeof unlock === 'function' ) {
  // If the lock is set successfully by this process, an unlock function is passed to our callback.
  client.zrangebyscore(client.getKey('jobs:delayed'), 0, Date.now(), 'LIMIT', 0, limit, function( err, ids ) {
    if( err || !ids.length ) return unlock();
    //TODO do a ZREMRANGEBYRANK jobs:delayed 0 ids.length-1
    var doUnlock = _.after(ids.length, unlock);
    ids.forEach(function( id ) {
      id = client.stripFIFO(id);
      Job.get(id, function( err, job ) {
        if( err ) return doUnlock();
        events.emit(id, 'promotion');
        job.inactive(doUnlock);
      });
    });
  });
} else {
  // The lock was not established by us, be silent
}

// 获取激活的队列，依次 events.emit(id, 'ttl exceeded'); 执行时间完毕了
// 也就是发送publish事件，另外的一个sub该事件，在处理之后，
// 如果成功，会返回job ttl exceeded ack 是worker进行pub job ttl exceeded ack
// 同时也会设置过期时间1000,对没有完成的job job.failedAttempt( { error: true, message: 'TTL exceeded' }, doUnlock );

// ttl exceeded 的话，worker通过queue监听到了之后，会将job failed掉，然后，返回一个job ttl exceeded ack消息。
// 所以下面的waitForAcks是因为对应的job没有及时关闭后的一个保证措施。大概1000
if( typeof unlock === 'function' ) {
  // If the lock is set successfully by this process, an unlock function is passed to our callback.
  // filter only jobs set with a ttl (timestamped) between a large number and current time
  client.zrangebyscore(client.getKey('jobs:active'), 100000, Date.now(), 'LIMIT', 0, limit, function( err, ids ) {
    if( err || !ids.length ) return unlock();

    var idsRemaining = ids.slice();
    var doUnlock = _.after(ids.length, function(){
      self.removeAllListeners( 'job ttl exceeded ack' );
      waitForAcks && clearTimeout( waitForAcks );
      unlock && unlock();
    });

    self.on( 'job ttl exceeded ack', function( id ) {
      idsRemaining.splice( idsRemaining.indexOf( id ), 1 );
      doUnlock();
    });

    var waitForAcks = setTimeout( function(){
      idsRemaining.forEach( function( id ){
        id = client.stripFIFO(id);
        Job.get(id, function( err, job ) {
          if( err ) return doUnlock();
          job.failedAttempt( { error: true, message: 'TTL exceeded' }, doUnlock );
        });
      });
    }, 1000 );

    ids.forEach(function( id ) {
      id = client.stripFIFO(id);
      events.emit(id, 'ttl exceeded');
    });
  });
} else {
  // The lock was not established by us, be silent
}

// 使用worker来启动每一个type的job的具体工作。
/**
 * Process jobs with the given `type`, invoking `fn(job)`.
 *
 * @param {String} type
 * @param {Number|Function} n
 * @param {Function} fn
 * @api public
 */

Queue.prototype.process = function( type, n, fn ) {
  var self = this;

  if( 'function' == typeof n ) fn = n, n = 1;

  while( n-- ) {
    var worker = new Worker(this, type).start(fn);
    worker.id  = [ self.id, type, self.workers.length + 1 ].join(':');
    worker.on('error', function( err ) {
      self.emit('error', err);
    });
    worker.on('job complete', function( job ) {
      // guard against emit after shutdown
      if( self.client ) {
        self.client.incrby(self.client.getKey('stats:work-time'), job.duration, noop);
      }
    });
    // Save worker so we can access it later
    self.workers.push(worker);
  }
  this.setupTimers();
};



// ${type}:jobs是一个单纯的List，用于队列排序，保证不多取，不少拿
// 然后取jobs:${type}:inactive取实际的不活跃的jobId

// BLPOP indicates we have a new inactive job to process
client.blpop(client.getKey(self.type + ':jobs'), 0, function( err ) {
  if( err || !self.running ) {
    if( self.client && self.client.connected && !self.client.closing ) {
      self.client.lpush(self.client.getKey(self.type + ':jobs'), 1, noop);
    }
    return fn(err);		// SAE: Added to avoid crashing redis on zpop
  }
  // Set job to a temp value so shutdown() knows to wait
  self.job = true;
  self.zpop(self.client.getKey('jobs:' + self.type + ':inactive'), function( err, id ) {
    if( err || !id ) {
      self.idle();
      return fn(err /*|| "No job to pop!"*/);
    }
    Job.get(id, fn);
  });
});



// queue.process传入的fn传递到worker.start，再传到worker.process，在
job.active(function() {
  self.emitJobEvent('start', job, job.type);
  if( fn.length === 2 ) { // user provided a two argument function, doesn't need workerCtx
    fn(job, doneCallback);
  } else { // user wants workerCtx parameter, make done callback the last
    fn(job, workerCtx, doneCallback);
  }
}.bind(this));
// 进行调用fn // 这里是一个hook形式的回调。
// 有可能这里的fn占用时间比较长，不过done调用之后，回到worker里面的话
// 会job.complete将job的状态改变
// 这里可以使用ctx控制pause,resume。其实是改变 worker.running。先shutdown，之后会再次running
// ### Pause Processing

// Workers can temporarily pause and resume their activity. 
// That is, after calling `pause` they will receive no jobs in their process callback until `resume` is called.
//  The `pause` function gracefully shutdowns this worker, and uses the same internal functionality as the `shutdown` 
//  method in [Graceful Shutdown]
//  (#graceful-shutdown).

// ```js
// queue.process('email', function(job, ctx, done){
//   ctx.pause( 5000, function(err){
//     console.log("Worker is paused... ");
//     setTimeout( function(){ ctx.resume(); }, 10000 );
//   });
// });
// ```

