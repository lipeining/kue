'use strict';

const KueHelper = require('./lib/kue_helper');
const Queue = new KueHelper();
module.exports = app => {
  app.beforeStart(async () => {
    // ensure memory cache exists before app ready
    // await app.runSchedule('force_refresh');
    Queue.init();
  });

  const { messenger } = app;
  // 这里是每一个worker都会监听的事件
  // const methods = [ 'incr', 'desc' ];
  messenger.on('counter', data => {
    const { method, by } = data;
    app.logger.info(`start ${method} by ${by}`);
    // create an anonymous context to access service
    const ctx = app.createAnonymousContext();
    // a convenient way to excute with generator function
    // can replaced by `co`
    ctx.runInBackground(async () => {
      const result = await ctx.service.counter[method](Number(by));
      app.number = result;
      console.log(`app.number: ${app.number}`);
      messenger.sendToAgent('counter_result', app.number);
    });
  });
  messenger.on('kue', data => {
    console.log(data);
    Queue[data.action]();
    messenger.sendToAgent('kue_result', data);
  });
  Queue.on('error', err => {
    messenger.sendToAgent('kue_result', { action: 'error', err });
  });
  Queue.on('job complete', id => {
    messenger.sendToAgent('kue_result', { action: 'job complete', id });
  });
};
