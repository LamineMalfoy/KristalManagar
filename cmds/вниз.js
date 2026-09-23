const lestnica = require('./lestnica.js');
module.exports = {
  command: '/вниз',
  description: 'Забрать выигрыш',
  aliases: ['/down', '/забрать'],
  async execute(context) { return await lestnica.down(context); }
};