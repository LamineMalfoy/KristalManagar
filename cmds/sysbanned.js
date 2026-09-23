const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const vk = require('../vkInstance.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/sysbanned',
  description: 'Список заблокированных пользователей в системе бота',
  async execute(context) {
    try {
       
      const senderAccess = await checkSysAccess(context.senderId);
      if (senderAccess < 1) {
        const senderAccessName = getAccessLevelName(senderAccess);
        return context.reply(`⛔ Доступ запрещён | Для использования команды /sysbanned требуется уровень доступа 1 или выше\n👤 Ваш уровень: ${senderAccessName} (доступ ${senderAccess})`);
      }

       
      const currentTime = Math.floor(Date.now() / 1000);

       
      const query = 'SELECT * FROM sysbanned';
      const bannedUsers = await databaseQuery(query);
      
       
      const activeBans = bannedUsers.filter(ban => ban.time === 0 || ban.time > currentTime);
      
      if (!activeBans || activeBans.length === 0) {
        return context.reply('📋 Нет заблокированных пользователей в системе');
      }

       
      // Исправляем дублированные ID перед запросом к VK API
      const fixDuplicatedId = (idStr) => {
        const str = String(idStr);
        if (str.length > 10) {
          const halfLength = Math.floor(str.length / 2);
          const firstHalf = str.substring(0, halfLength);
          const secondHalf = str.substring(halfLength);
          if (firstHalf === secondHalf) {
            console.log('DEBUG: Fixed duplicated ID:', str, '->', firstHalf);
            return parseInt(firstHalf);
          }
        }
        return parseInt(str);
      };
      
      const userIds = [
        ...activeBans.map(ban => fixDuplicatedId(ban.userid)), 
        ...activeBans.map(ban => fixDuplicatedId(ban.who))
      ];
      console.log('DEBUG: Requesting user info for IDs:', userIds);
      
      let userInfos;
      try {
        userInfos = await vk.api.users.get({ user_ids: userIds });
        console.log('DEBUG: VK API response:', JSON.stringify(userInfos, null, 2));
      } catch (error) {
        console.error('Ошибка при получении информации о пользователях:', error);
        userInfos = [];
      }

       
      const userMap = {};
      userInfos.forEach(user => {
        userMap[user.id] = user;
      });
      console.log('DEBUG: Created userMap:', JSON.stringify(userMap, null, 2));

       
      let message = '⛔ Заблокированные пользователи в системе бота\n\n';
      
       
      activeBans.sort((a, b) => {
        if (a.time === 0 && b.time !== 0) return -1;
        if (a.time !== 0 && b.time === 0) return 1;
        return a.time - b.time;
      });
      
       
      activeBans.forEach(ban => {
        const user = userMap[ban.userid] || { first_name: 'Пользователь', last_name: ban.userid };
        const admin = userMap[ban.who] || { first_name: 'Администратор', last_name: ban.who };
        
         
        let timeInfo;
        if (ban.time === 0) {
          timeInfo = 'навсегда';
        } else {
          const timeLeft = ban.time - currentTime;
          const days = Math.floor(timeLeft / 86400);
          const hours = Math.floor((timeLeft % 86400) / 3600);
          const minutes = Math.floor((timeLeft % 3600) / 60);
          
          if (days > 0) {
            timeInfo = `${days} д. ${hours} ч.`;
          } else if (hours > 0) {
            timeInfo = `${hours} ч. ${minutes} мин.`;
          } else {
            timeInfo = `${minutes} мин.`;
          }
        }
        
        // Отображаем информацию о заблокированном пользователе
        const userName = user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : `Пользователь ${ban.userid}`;
        
        // Отображаем администратора как кликабельную ссылку
        console.log('DEBUG: Admin object for ban.who', ban.who, ':', JSON.stringify(admin, null, 2));
        
        let adminDisplay;
        if (admin.first_name && admin.last_name) {
          adminDisplay = `[id${ban.who}|${admin.first_name} ${admin.last_name}]`;
          console.log('DEBUG: Using clickable admin name:', adminDisplay);
        } else {
          adminDisplay = `@id${ban.who} (Администратор ${ban.who})`;
          console.log('DEBUG: Using fallback admin display:', adminDisplay);
        }
        
        message += `[id${ban.userid}|${userName}]\n`;
        message += `🕒 Срок: ${timeInfo}\n`;
        message += `📝 Причина: ${ban.reason}\n`;
        message += `👤 Заблокировал: ${adminDisplay}\n\n`;
      });

       
      context.send({ message: message, disable_mentions: true });
    } catch (error) {
      console.error('Ошибка при выполнении команды sysbanned:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 