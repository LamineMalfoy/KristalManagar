const util = require('util');
const database = require('../databases.js');
const { checkIfTableExists, getUserRole } = require('./roles.js');
const { getUsername, getlink } = require('../util.js');
const { extractNumericId } = require('./ban.js');

 
const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/unagent',
  aliases: ['/unagent'],
  description: 'Снятие агентских прав с пользователя',
  async execute(context) {
    const messageText = context.text;
    const parts = messageText.split(' ');
    const { peerId, senderId } = context;

    if (!await checkIfTableExists('agents')) {
      return context.reply('❌ Таблица агентов не существует.');
    }


    if (!Config.developers.includes(senderId)) {
      return;
    }
    let targetUserId;
    if (context.replyMessage) {
      targetUserId = context.replyMessage.senderId;
    } else {
      targetUserId = await extractNumericId(parts.slice(1).join(' '));
    }

    if (!targetUserId || isNaN(targetUserId)) {
      return context.reply('❌ Используйте команду в формате: /unagent [user_id]');
    }

    try {
       
      const checkAgentQuery = `
        SELECT agent_access FROM agents WHERE user_id = ?
      `;
      const checkAgentResult = await queryAsync(checkAgentQuery, [targetUserId]);

      if (checkAgentResult.length === 0) {
        return context.reply('❌ Указанный пользователь не является агентом.');
      }

       
      const deleteAgentQuery = `
        DELETE FROM agents WHERE user_id = ?
      `;
      await queryAsync(deleteAgentQuery, [targetUserId]);

       
      const userLink = await getlink(targetUserId);
      context.reply(`✅ Пользователь ${userLink} больше не является агентом.`);

    } catch (error) {
      console.error('Ошибка при выполнении команды /unagent:', error);
      context.reply('❌ Произошла ошибка.');
    }
  },
};
