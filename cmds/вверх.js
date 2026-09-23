const lestnica = require('./lestnica.js');
module.exports = {
  command: '/вверх',
  description: 'Шаг вверх по лестнице',
  aliases: ['/up'],
  async execute(context) { return await lestnica.up(context); }
};