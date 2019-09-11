'use strict';
const Service = require('egg').Service;
let number = 0;
class Counter extends Service {
  async incr(input) {
    console.log(`${number} + ${input}`);
    number += input;
    return number;
  }
  async desc(input) {
    console.log(`${number} - ${input}`);
    number -= input;
    return number;
  }
}

module.exports = Counter;
