const database = require('../databases.js');
const { getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/snick',
  aliases: ['/snick', '/setnick'],
  description: 'snick',
  async execute(context) {
    const messageText = context.text;
    const { peerId } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const target = context.replyMessage ? context.replyMessage.senderId : parts[1];
    const nickname = parts.slice(2).join(' ');
    const maybe1 = parts.slice(1).join(' ')
    const userId = target || (context.replyMessage ? context.replyMessage.senderId : context.senderId);
    
    const { checkIfTableExists } = require('../util.js');
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }
    
    // Проверяем приоритет команды
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/snick');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/snick'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /snick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    let previousNickname = '';  
    
     
    const nicknamesTableQuery = `
      CREATE TABLE IF NOT EXISTS nicknames_${conferenceId} (
        user_id INT PRIMARY KEY,
        nickname VARCHAR(255)
      )
    `;

    database.query(nicknamesTableQuery, async (error) => {
      if (error) {
        console.error('Ошибка при создании таблицы никнеймов:', error);
        return context.send('❌ Произошла ошибка.');
      }
      const numericId = await extractNumericId(userId);
      const usernameLink = await getlink(numericId);

      const forbiddenWords = ['Россия', 'Украина', 'война', 'ракета', 'Ракета', 'Бомба'];  

      if (forbiddenWords.some(word => nickname.includes(word))) {
        context.reply('❌ Нельзя использовать запрещенные слова в никнейме.');
        return;
      }

      if (context.replyMessage) {
        if (usernameLink !== null) {
          if (maybe1 === '') {
            context.reply(`Никнейм не может быть пустым.`);
          } else {
             
            const selectNicknameQuery = `
              SELECT nickname FROM nicknames_${conferenceId}
              WHERE user_id = ?
            `;
		const selectResults = await databaseQuery(selectNicknameQuery, context.senderId);
		const sendernick = 'Пользователь'
            database.query(selectNicknameQuery, [userId], (error, results) => {
              if (error) {
                console.error('Ошибка при поиске никнейма:', error);
                return context.send('❌ Произошла ошибка.');
              }

              if (results.length > 0) {
                previousNickname = results[0].nickname;  
                 
                const updateNicknameQuery = `
                  UPDATE nicknames_${conferenceId}
                  SET nickname = ?
                  WHERE user_id = ?
                `;
                database.query(updateNicknameQuery, [maybe1, userId], async (error, result) => {
                  if (error) {
                    console.error('Ошибка при обновлении никнейма:', error);
                    return context.send('❌ Произошла ошибка.');
                  }
                  try {
                    const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                    const adminRole = await getUserRole(conferenceId, context.senderId);
                    const roleName = await getRoleName(conferenceId, adminRole);
                    
                    const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                    
                    // Получаем информацию о пользователе, которому изменили ник
                    const targetUserInfo = await vk.api.users.get({ user_ids: userId });
                    const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                    
                    context.reply(`✅️ [id${context.senderId}|${adminName}] | [id${context.senderId}|${roleName}] изменил ник пользователю: [id${userId}|${targetUserName}] » ${previousNickname} » ${maybe1}.`);
                  } catch (error) {
                    context.reply(`✅️ [id${context.senderId}|Пользователь] установил ник пользователю: ${maybe1}.`);
                  }
                });
              } else {
                 
                const insertNicknameQuery = `
                  INSERT INTO nicknames_${conferenceId} (user_id, nickname)
                  VALUES (?, ?)
                `;
                database.query(insertNicknameQuery, [userId, maybe1], async (error, result) => {
                  if (error) {
                    console.error('Ошибка при сохранении никнейма:', error);
                    return context.send('❌ Произошла ошибка.');
                  }
                  try {
                      const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                      const adminRole = await getUserRole(conferenceId, context.senderId);
                      const roleName = await getRoleName(conferenceId, adminRole);
                      
                      const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                      
                      // Получаем информацию о пользователе, которому изменили ник
                      const targetUserInfo = await vk.api.users.get({ user_ids: userId });
                      const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                      
                      context.reply(`✅️ [id${context.senderId}|${adminName}] | [id${context.senderId}|${roleName}] установил ник пользователю: [id${userId}|${targetUserName}] - ${maybe1}.`);
                  } catch (error) {
                      context.reply(`✅️ [id${context.senderId}|Пользователь] установил ник пользователю: ${maybe1}.`);
                  }
                });
              }
            });
          }
        } else {
          context.reply('❌ Кажется вы не упомянули пользователя :(');
        }
      } else {
        if (usernameLink !== null) {
          if (nickname === '') {
            context.reply(`❌ Никнейм не может быть пустым.`);
          } else {
             
            const selectNicknameQuery = `
              SELECT nickname FROM nicknames_${conferenceId}
              WHERE user_id = ?
            `;
		const selectResults = await databaseQuery(selectNicknameQuery, context.senderId);
		const sendernick = 'Пользователь'
            database.query(selectNicknameQuery, [numericId], (error, results) => {
              if (error) {
                console.error('Ошибка при поиске никнейма:', error);
                return context.send('❌ Произошла ошибка.');
              }

              /*const forbiddenWords = ['Россия', 'Украина', 'война', 'ракета', 'Ракета', 'Бомба'];  

              if (forbiddenWords.some(word => nickname.includes(word))) {
                context.reply('❌ Нельзя использовать запрещенные слова в никнейме.');
                return;
              }*/

              if (results.length > 0) {
                previousNickname = results[0].nickname;  
                 
                const updateNicknameQuery = `
                  UPDATE nicknames_${conferenceId}
                  SET nickname = ?
                  WHERE user_id = ?
                `;
                database.query(updateNicknameQuery, [nickname, numericId], async (error, result) => {
                  if (error) {
                    console.error('Ошибка при обновлении никнейма:', error);
                    return context.send('❌ Произошла ошибка.');
                  }
				  
				try {
                    const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                    const adminRole = await getUserRole(conferenceId, context.senderId);
                    const roleName = await getRoleName(conferenceId, adminRole);
                    
                    const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                    
                    // Получаем информацию о пользователе, которому изменили ник
                    const targetUserInfo = await vk.api.users.get({ user_ids: numericId });
                    const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                    
                    const adminLink = await getlink(context.senderId);
                    const targetLink = await getlink(numericId);
                    context.reply(`✅️ ${adminLink} | ${roleName} изменил ник пользователю: ${targetLink} » ${previousNickname} » ${nickname}.`);
                } catch (error) {
                    const adminLink = await getlink(context.senderId);
                    context.reply(`✅️ ${adminLink} установил ник пользователю: ${nickname}.`);
                }
                });
              } else {
                 
                const insertNicknameQuery = `
                  INSERT INTO nicknames_${conferenceId} (user_id, nickname)
                  VALUES (?, ?)
                `;
                database.query(insertNicknameQuery, [numericId, nickname], async (error, result) => {
                  if (error) {
                    console.error('Ошибка при сохранении никнейма:', error);
                    return context.send('❌ Произошла ошибка.');
                  }
                  try {
                      const userInfo = await vk.api.users.get({ user_ids: context.senderId });
                      const adminRole = await getUserRole(conferenceId, context.senderId);
                      const roleName = await getRoleName(conferenceId, adminRole);
                      
                      const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
                      
                      // Получаем информацию о пользователе, которому изменили ник
                      const targetUserInfo = await vk.api.users.get({ user_ids: numericId });
                      const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
                      
                      const adminLink = await getlink(context.senderId);
                      const targetLink = await getlink(numericId);
                      context.reply(`✅️ ${adminLink} | ${roleName} установил ник пользователю: ${targetLink} - ${nickname}.`);
                  } catch (error) {
                      const adminLink = await getlink(context.senderId);
                      context.reply(`✅️ ${adminLink} установил ник пользователю: ${nickname}.`);
                  }
                });
              }
            });
          }
        } else {
          context.reply('Кажется вы не упомянули пользователя :(');
        }
      }
    });
  }
};
