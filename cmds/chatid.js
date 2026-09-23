const database = require('../databases.js');

module.exports = {
  command: '/chatid',
  aliases: ['/чатид', '/идчата'],
  description: 'Показать ID текущего чата',
  async execute(context) {
    const { peerId } = context;
    
    await context.reply(`🔍 ID этого чата: ${peerId}`);
  }
}; 