const database = require('../databases.js');
const { getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { checkIfTableExists, getlink } = require('../util.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { extractNumericId } = require('./ban.js');
const fs = require('fs');
const path = require('path');

const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/gsnick',
  aliases: ['/gsnick', '/gsetnick'],
  description: 'Глобальное установление никнейма во всех беседах',
  async execute(context) {
    const messageText = context.text;
    const { peerId } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const target = context.replyMessage ? context.replyMessage.senderId : parts[1];
    const nickname = parts.slice(2).join(' ');
    const maybe1 = parts.slice(1).join(' ');
    const userId = target || (context.replyMessage ? context.replyMessage.senderId : context.senderId);
    
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }
    
    // Проверяем приоритет команды
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/gsnick');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gsnick'] || 100;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gsnick требуется приоритет ${requiredRole} или выше
👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    // Извлекаем числовой ID
    const numericId = await extractNumericId(userId);
    const usernameLink = await getlink(numericId);
    
    // Проверяем запрещенные слова
    const forbiddenWords = ['Россия', 'Украина', 'война', 'ракета', 'Ракета', 'Бомба'];
    const nicknameToCheck = context.replyMessage ? maybe1 : nickname;
    
    if (forbiddenWords.some(word => nicknameToCheck.includes(word))) {
      return context.reply('❌ Нельзя использовать запрещенные слова в никнейме.');
    }
    
    // Проверяем, что никнейм не пустой
    if (!nicknameToCheck || nicknameToCheck.trim() === '') {
      return context.reply('❌ Никнейм не может быть пустым.');
    }
    
    if (context.replyMessage) {
      if (usernameLink === null) {
        return context.reply('❌ Кажется вы не упомянули пользователя :(');
      }
      
      try {
        // Получаем пулы, которые содержат текущую беседу
        const poolsDir = path.join(__dirname, '../data/pools');
        if (!fs.existsSync(poolsDir)) {
          return context.reply('❌ Пулы не найдены.');
        }
        
        const poolFiles = fs.readdirSync(poolsDir);
        let pools = [];
        for (const file of poolFiles) {
          const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
          if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
            pools.push(data);
          }
        }
        
        if (!pools.length) {
          return context.reply('❌ Ваша беседа не состоит ни в одном пулле.');
        }
        
        let successCount = 0;
        let errorCount = 0;
        let totalChats = 0;
        
        for (const pool of pools) {
          const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
          if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
            continue;
          }
          
          totalChats += poolPeerIds.length;
          
          for (const poolPeerId of poolPeerIds) {
            const tableName = `nicknames_${poolPeerId}`;
            
            try {
              // Проверяем, есть ли таблица для этой беседы
              if (!await checkIfTableExists(tableName)) {
                continue;
              }
              
              // Проверяем, есть ли уже никнейм
              const selectQuery = `SELECT nickname FROM ${tableName} WHERE user_id = ?`;
              const existingNick = await databaseQuery(selectQuery, [numericId]);
              
              if (existingNick.length > 0) {
                // Обновляем существующий никнейм
                const updateQuery = `UPDATE ${tableName} SET nickname = ? WHERE user_id = ?`;
                await databaseQuery(updateQuery, [maybe1, numericId]);
              } else {
                // Создаем новый никнейм
                const insertQuery = `INSERT INTO ${tableName} (user_id, nickname) VALUES (?, ?)`;
                await databaseQuery(insertQuery, [numericId, maybe1]);
              }
              
              successCount++;
            } catch (error) {
              console.error(`Ошибка при установке никнейма в беседе ${poolPeerId}:`, error);
              errorCount++;
            }
          }
        }
        
        // Получаем информацию о пользователях
        try {
          const userInfo = await vk.api.users.get({ user_ids: context.senderId });
          const adminRole = await getUserRole(conferenceId, context.senderId);
          const roleName = await getRoleName(conferenceId, adminRole);
          const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
          
          const targetUserInfo = await vk.api.users.get({ user_ids: numericId });
          const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
          
          context.reply(`✅️ [id${context.senderId}|${adminName}] | [id${context.senderId}|${roleName}] установил ник пользователю: [id${numericId}|${targetUserName}] » ${maybe1} (в связанных чатах: ${successCount}/${totalChats}).`);
        } catch (error) {
          context.reply(`✅️ [id${context.senderId}|Пользователь] установил ник пользователю: ${maybe1} (в связанных чатах: ${successCount}/${totalChats}).`);
        }
        
      } catch (error) {
        console.error('Ошибка при глобальном изменении никнейма:', error);
        return context.send('❌ Произошла ошибка при глобальном изменении никнейма.');
      }
      
    } else {
      if (!target || !nickname) {
        return context.reply('❓ Использование: /gsnick [пользователь] [никнейм]\n💡 Или ответьте на сообщение: /gsnick [никнейм]');
      }
      
      if (usernameLink === null) {
        return context.reply('❌ Кажется вы не упомянули пользователя :(');
      }
      
      try {
        // Получаем пулы, которые содержат текущую беседу
        const poolsDir = path.join(__dirname, '../data/pools');
        if (!fs.existsSync(poolsDir)) {
          return context.reply('❌ Пулы не найдены.');
        }
        
        const poolFiles = fs.readdirSync(poolsDir);
        let pools = [];
        for (const file of poolFiles) {
          const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
          if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
            pools.push(data);
          }
        }
        
        if (!pools.length) {
          return context.reply('❌ Ваша беседа не состоит ни в одном пулле.');
        }
        
        let successCount = 0;
        let errorCount = 0;
        let totalChats = 0;
        
        for (const pool of pools) {
          const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
          if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
            continue;
          }
          
          totalChats += poolPeerIds.length;
          
          for (const poolPeerId of poolPeerIds) {
            const tableName = `nicknames_${poolPeerId}`;
            
            try {
              // Проверяем, есть ли таблица для этой беседы
              if (!await checkIfTableExists(tableName)) {
                continue;
              }
              
              // Проверяем, есть ли уже никнейм
              const selectQuery = `SELECT nickname FROM ${tableName} WHERE user_id = ?`;
              const existingNick = await databaseQuery(selectQuery, [numericId]);
              
              if (existingNick.length > 0) {
                // Обновляем существующий никнейм
                const updateQuery = `UPDATE ${tableName} SET nickname = ? WHERE user_id = ?`;
                await databaseQuery(updateQuery, [nickname, numericId]);
              } else {
                // Создаем новый никнейм
                const insertQuery = `INSERT INTO ${tableName} (user_id, nickname) VALUES (?, ?)`;
                await databaseQuery(insertQuery, [numericId, nickname]);
              }
              
              successCount++;
            } catch (error) {
              console.error(`Ошибка при установке никнейма в беседе ${poolPeerId}:`, error);
              errorCount++;
            }
          }
        }
        
        // Получаем информацию о пользователях
        try {
          const userInfo = await vk.api.users.get({ user_ids: context.senderId });
          const adminRole = await getUserRole(conferenceId, context.senderId);
          const roleName = await getRoleName(conferenceId, adminRole);
          const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
          
          const targetUserInfo = await vk.api.users.get({ user_ids: numericId });
          const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
          
          const adminLink = await getlink(context.senderId);
          const targetLink = await getlink(numericId);
          context.reply(`✅️ ${adminLink} | ${roleName} установил ник пользователю: ${targetLink} » ${nickname} (в связанных чатах: ${successCount}/${totalChats}).`);
        } catch (error) {
          const adminLink = await getlink(context.senderId);
          context.reply(`✅️ ${adminLink} установил ник пользователю: ${nickname} (в связанных чатах: ${successCount}/${totalChats}).`);
        }
        
      } catch (error) {
        console.error('Ошибка при глобальном изменении никнейма:', error);
        return context.send('❌ Произошла ошибка при глобальном изменении никнейма.');
      }
    }
  }
};
