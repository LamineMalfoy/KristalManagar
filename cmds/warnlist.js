const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');

const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/warnlist',
  description: 'Список пользователей с предупреждениями',
  async execute(context) {
    const { peerId } = context;
    const senderUserRole = await getUserRole(peerId, context.senderId);

     
    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
	
    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/warnlist');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/warnlist'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /warnlist требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const selectUsersInfoQuery = `
      SELECT user_id, warns
      FROM conference_${peerId}
      WHERE warns IS NOT NULL AND warns > 0
    `;
	
    try {
      const results = await databaseQuery(selectUsersInfoQuery);
      
      // Дополнительная фильтрация в коде
      const filteredResults = results.filter(user => {
        const warns = parseInt(user.warns) || 0;
        return warns > 0;
      });
      
      if (filteredResults.length === 0) {
        return context.reply('✅ Нет предупреждений | В беседе нет пользователей с активными предупреждениями');
      }

      const userIds = filteredResults.map(nickInfo => nickInfo.user_id);
      const userInfos = await vk.api.users.get({ user_ids: userIds });

      const userMap = userInfos.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      let message = `⚠️ Пользователи с предупреждениями:\n\n`;

      let index = 1;
      for (const user of filteredResults) {
        const warns = parseInt(user.warns) || 0;
        const userLink = await getlink(user.user_id);
        message += `${index}. ${userLink} — ${warns} / 3\n\n`;
        index++;
      }

      context.send({ message: message, disable_mentions: true });
    } catch (error) {
      console.error('Ошибка при запросе информации о пользователях:', error);
      context.send('❌ Ошибка системы | Не удалось получить список предупреждений');
    }
  },
};
