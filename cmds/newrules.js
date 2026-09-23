const database = require('../databases.js');
const util = require('util');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/новыеправила',
  aliases: ['/newrules'],
  description: 'Установка правил для беседы',
  async execute(context) {
    const messageText = context.text.trim();
    const command = messageText.split(' ')[0].toLowerCase();  
    const args = messageText.slice(command.length).trim();  

    const { peerId, senderId, replyMessage } = context;
    const conferenceId = peerId;

    // Сначала проверяем таблицу
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      console.log(`nicknames_${conferenceId}`);
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }

    // Затем проверяем права через checkCommandPriority
    const hasPermission = await checkCommandPriority(conferenceId, context.senderId, '/newrules');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(conferenceId);
      const requiredRole = priorities['/newrules'] || 80;
      const senderRole = await getUserRole(conferenceId, context.senderId);
      const senderRoleName = await getRoleName(conferenceId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /newrules требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    if (!args) {
      return context.send('Пример установки правил: /новыеправила [текст правил]\nПример удаления правил: /новыеправила 0');
    }

    if (args === '0') {
       
      try {
        // Удаляем правила через файловую базу данных
        const fs = require('fs');
        const path = require('path');
        const conferenceFile = path.join(__dirname, '../data/conference', `${conferenceId}.json`);
        
        if (fs.existsSync(conferenceFile)) {
          const data = JSON.parse(fs.readFileSync(conferenceFile, 'utf8'));
          delete data.rules;
          fs.writeFileSync(conferenceFile, JSON.stringify(data, null, 2));
        }
        
        await context.send('✅ Правила успешно удалены!');
      } catch (error) {
        console.error('Ошибка при удалении правил:', error);
        await context.send('❌ Произошла ошибка при удалении правил.');
      }
    } else {
       
      const rules = args

      try {
        // Устанавливаем правила через файловую базу данных
        const fs = require('fs');
        const path = require('path');
        const conferenceFile = path.join(__dirname, '../data/conference', `${conferenceId}.json`);
        
        let data = {};
        if (fs.existsSync(conferenceFile)) {
          data = JSON.parse(fs.readFileSync(conferenceFile, 'utf8'));
        }
        
        data.conference_id = conferenceId;
        data.rules = rules;
        
        fs.writeFileSync(conferenceFile, JSON.stringify(data, null, 2));
        
        await context.send('✅ Правила успешно установлены!');
      } catch (error) {
        console.error('Ошибка при установке правил:', error);
        await context.send('❌ Произошла ошибка при установке правил.');
      }
    }
  },
};