const { VK } = require('vk-io');
require('dotenv').config();

const vk = new VK({
  token: process.env.VK_TOKEN,
  apiLimit: 20,
});

module.exports = vk;