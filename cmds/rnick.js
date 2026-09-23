const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getlink } = require('../util.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getUserRole, getRoleName } = require('./roles.js');
const { extractNumericId } = require('./ban.js');

const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/rnick',
  aliases: ['/rnick', '/removenick'],
  description: 'rnick',
  async execute(context) {
    const messageText = context.text;
    const { peerId } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const target = context.replyMessage ? context.replyMessage.senderId : parts[1];
    const userId = target || (context.replyMessage ? context.replyMessage.senderId : context.senderId);
    const label = parts.slice(1).join(' ')
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }
    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(context.peerId, context.senderId, '/rnick');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(context.peerId);
      const requiredRole = priorities['/rnick'] || 0;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /rnick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    if (context.replyMessage) {
      if (!userId) {
        context.reply('❌ Укажите пользователя для удаления никнейма.');
        return;
      }

       
      const selectNicknameQuery = `
        SELECT nickname FROM nicknames_${conferenceId}
        WHERE user_id = ?
      `;
		const selectResults = await databaseQuery(selectNicknameQuery, context.senderId);
		const sendernick = (selectResults[0] && selectResults[0].nickname) || 'Пользователь';

      database.query(selectNicknameQuery, [userId], (error, results) => {
        if (error) {
          console.error('Ошибка при поиске никнейма:', error);
          return context.send('Произошла ошибка.');
        }

        if (results.length > 0) {
          const userNickname = results[0].nickname;

           
          const deleteNicknameQuery = `
            DELETE FROM nicknames_${conferenceId}
            WHERE user_id = ?
          `;
          database.query(deleteNicknameQuery, [userId], async (error, result) => {
            if (error) {
              console.error('Ошибка при удалении никнейма:', error);
              return context.send('Произошла ошибка.');
            }
            try {
                const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                const adminRole = await getUserRole(conferenceId, context.senderId);
                const roleName = await getRoleName(conferenceId, adminRole);
                const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                // Получаем информацию о пользователе, которому удалили никнейм
                const targetUserInfo = await vk.api.users.get({ user_ids: userId });
                const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                const adminLink = await getlink(context.senderId);
                const targetLink = await getlink(userId);
                context.reply(`✅️ ${adminLink} | ${roleName} удалил никнейм ${targetLink}.`);
            } catch (error) {
                const adminLink = await getlink(context.senderId);
                context.reply(`✅️ ${adminLink} удалил никнейм пользователя.`);
            }
          });
        } else {
          context.reply('❌ У данного пользователя нет никнейма для удаления.');
        }
      });
    } else {
      if (!label) {
        context.reply('❌ Укажите пользователя для удаления никнейма.');
        return;
      }

      const label2 = await extractNumericId(label);
       
      const selectNicknameQuery = `
        SELECT nickname FROM nicknames_${conferenceId}
        WHERE user_id = ?
      `;
	  
  	const selectResults = await databaseQuery(selectNicknameQuery, context.senderId);
	const sendernick = (selectResults[0] && selectResults[0].nickname) || 'Пользователь';

      database.query(selectNicknameQuery, [label2], (error, results) => {
        if (error) {
          console.error('Ошибка при поиске никнейма:', error);
          return context.send('❌ Произошла ошибка.');
        }
  
        if (results.length > 0) {
  
           
          const deleteNicknameQuery = `
            DELETE FROM nicknames_${conferenceId}
            WHERE user_id = ?
          `;
  
          database.query(deleteNicknameQuery, [label2], async (error, result) => {
            if (error) {
              console.error('Ошибка при удалении никнейма:', error);
              return context.send('❌ Произошла ошибка.');
            }
            try {
                const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                const adminRole = await getUserRole(conferenceId, context.senderId);
                const roleName = await getRoleName(conferenceId, adminRole);
                const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                // Получаем информацию о пользователе, которому удалили никнейм
                const targetUserInfo = await vk.api.users.get({ user_ids: label2 });
                const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                const adminLink = await getlink(context.senderId);
                const targetLink = await getlink(label2);
                context.reply(`✅️ ${adminLink} | ${roleName} удалил никнейм ${targetLink}.`);
            } catch (error) {
                context.reply(`✅️ ${adminName} удалил никнейм пользователя`);
            }
          });
        } else {
          context.reply('❌ У данного пользователя нет никнейма для удаления.');
        }
      });
    }
  }
};
