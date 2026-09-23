const database = require('../databases.js');
const { checkIfTableExists } = require('./roles.js');

const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/правила',
  aliases: ['/rules'],
  description: 'Показать правила беседы',
  execute: async (context) => {
    const { peerId } = context;

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    try {
      // Получаем правила из файловой базы данных
      const fs = require('fs');
      const path = require('path');
      const conferenceFile = path.join(__dirname, '../data/conference', `${peerId}.json`);
      
      if (!fs.existsSync(conferenceFile)) {
        return context.send('❔ Правила не установлены, \n\n установите их командной: /новыеправила');
      }
      
      const data = JSON.parse(fs.readFileSync(conferenceFile, 'utf8'));
      const rules = data.rules;

      if (!rules || rules === null || rules === undefined || rules.trim() === '') {
        return context.send('❔ Правила не установлены, \n\n установите их командной: /новыеправила');
      }

      return context.send(`📜 Правила беседы\n\n${rules}`);
    } catch (error) {
      console.error('Ошибка при получении правил:', error);
      return context.send('❌ Ошибка системы | Не удалось получить правила беседы');
    }
  },
};
