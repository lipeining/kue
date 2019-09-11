'use strict';

// const Subscriber = require('./lib/subscriber');

module.exports = agent => {
  //   agent.logger.info('init subscriber');
  //   const subscriber = new Subscriber();
  //   subscriber.on('changed', () => agent.messenger.sendToApp('refresh', 'push'));
  //   subscriber.on('error', err => agent.logger.error(err));
  agent.logger.info('init agent');
  const { messenger } = agent;
  const methods = [ 'incr', 'desc' ];
  let times = 0;
  messenger.once('egg-ready', () => {
    const method = methods[Math.floor(Math.random() * 10) % 2];
    const by = Math.floor(Math.random() * 10);
    messenger.sendToApp('counter', { method, by });
    messenger.sendToApp('kue', { action: 'create' });
  });
  messenger.on('counter_result', () => {
    times++;
    if (times < 5) {
      const method = methods[Math.floor(Math.random() * 10) % 2];
      const by = Math.floor(Math.random() * 10);
      messenger.sendToApp('counter', { method, by });
    }
  });
  messenger.on('kue_result', data => {
    console.log(`kue_result: ${JSON.stringify(data, null, 2)}`);
    const { action } = data;
    if (action === 'create') {
      messenger.sendToApp('kue', { action: 'work' });
    } else if (action === 'work') {
      // messenger.sendToApp('kue', {action: 'pause'});
    } else if (action === 'pause') {
      // messenger.sendToApp('kue', {action: 'resume'});
    } else if (action === 'resume') {
      // nothing
    } else if (action === 'error') {
      // nothing
    } else if (action === 'job complete') {
      messenger.sendToApp('kue', { action: 'create' });
    } else if (action === 'shutdown') {
      // nothing
    } else {
      // nothing
    }
  });
};
