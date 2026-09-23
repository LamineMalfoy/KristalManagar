const database = require('../databases.js');
const util = require('util');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/приветствие',
  aliases: ['/приветствие'],
  description: 'Приветствие для беседы',
  async execute(context) {
    const messageText = context.text;
    const { peerId, senderId, replyMessage } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const senderUserRole = await getUserRole(conferenceId, senderId);
      if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
        console.error('Таблица никнеймов не существует');
        console.log(`nicknames_${conferenceId}`);
        return context.send('❌ Ваша беседа не зарегистрирована!');
      }
    if (senderUserRole < 60) {
      return context.send('У вас нет прав на изменение приветствия');
    }

    if (!parts[1]) {
      return context.send('Пример установки приветствия: /приветствие [текст приветствия]\nПример удаления приветствия: /приветствие 0');
    }

    if (parts[1] === '0') {
       
      try {
        // Удаляем приветствие через файловую базу данных
        const fs = require('fs');
        const path = require('path');
        const conferenceFile = path.join(__dirname, '../data/conference', `${conferenceId}.json`);
        
        if (fs.existsSync(conferenceFile)) {
          const data = JSON.parse(fs.readFileSync(conferenceFile, 'utf8'));
          delete data.hello_text;
          fs.writeFileSync(conferenceFile, JSON.stringify(data, null, 2));
        }
        
        await context.send('✅ Приветствие успешно удалено!');
      } catch (error) {
        console.error('Ошибка при удалении приветствия:', error);
        await context.send('❌ Произошла ошибка при удалении приветствия.');
      }
    } else {
       
      const helloText = messageText.slice('/приветствие '.length);

      try {
        // Устанавливаем приветствие через файловую базу данных
        const fs = require('fs');
        const path = require('path');
        const conferenceFile = path.join(__dirname, '../data/conference', `${conferenceId}.json`);
        
        let data = {};
        if (fs.existsSync(conferenceFile)) {
          data = JSON.parse(fs.readFileSync(conferenceFile, 'utf8'));
        }
        
        data.conference_id = conferenceId;
        data.hello_text = helloText;
        
        fs.writeFileSync(conferenceFile, JSON.stringify(data, null, 2));
        
        await context.send('✅️ Приветствие успешно установлено!');
      } catch (error) {
        console.error('Ошибка при установке приветствия:', error);
        await context.send('❌ Произошла ошибка при установке приветствия.');
      }
    }
  },
};
