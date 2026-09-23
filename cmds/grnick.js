const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getlink } = require('../util.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getUserRole, getRoleName } = require('./roles.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { extractNumericId } = require('./ban.js');
const fs = require('fs');
const path = require('path');

const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/grnick',
  aliases: ['/grnick', '/gremovenick'],
  description: 'Глобальное удаление никнейма во всех беседах',
  async execute(context) {
    const messageText = context.text;
    const { peerId } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const target = context.replyMessage ? context.replyMessage.senderId : parts[1];
    const userId = target || (context.replyMessage ? context.replyMessage.senderId : context.senderId);
    const label = parts.slice(1).join(' ');
    
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }
    
    // Проверяем приоритет команды
    const hasPermission = await checkCommandPriority(context.peerId, context.senderId, '/grnick');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(context.peerId);
      const requiredRole = priorities['/grnick'] || 100;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /grnick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    if (context.replyMessage) {
      if (!userId) {
        return context.reply('❌ Укажите пользователя для удаления никнейма.');
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
        let foundNickname = '';
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
              
              // Проверяем, есть ли никнейм у пользователя
              const selectQuery = `SELECT nickname FROM ${tableName} WHERE user_id = ?`;
              const existingNick = await databaseQuery(selectQuery, [userId]);
              
              if (existingNick.length > 0) {
                if (!foundNickname) {
                  foundNickname = existingNick[0].nickname;
                }
                
                // Удаляем никнейм
                const deleteQuery = `DELETE FROM ${tableName} WHERE user_id = ?`;
                await databaseQuery(deleteQuery, [userId]);
                successCount++;
              }
            } catch (error) {
              console.error(`Ошибка при удалении никнейма в беседе ${poolPeerId}:`, error);
              errorCount++;
            }
          }
        }
        
        if (successCount === 0) {
          return context.reply('❌ У данного пользователя нет никнеймов для удаления.');
        }
        
        // Получаем информацию о пользователях
        try {
          const userInfo = await vk.api.users.get({ user_ids: context.senderId });
          const adminRole = await getUserRole(conferenceId, context.senderId);
          const roleName = await getRoleName(conferenceId, adminRole);
          const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
          
          const targetUserInfo = await vk.api.users.get({ user_ids: userId });
          const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
          
          context.reply(`✅️ [id${context.senderId}|${adminName}] | [id${context.senderId}|${roleName}] удалил никнейм [id${userId}|${targetUserName}] (в связанных чатах: ${successCount}/${totalChats}).`);
        } catch (error) {
          context.reply(`✅️ [id${context.senderId}|Пользователь] удалил никнейм пользователя (в связанных чатах: ${successCount}/${totalChats}).`);
        }
        
      } catch (error) {
        console.error('Ошибка при глобальном удалении никнейма:', error);
        return context.send('❌ Произошла ошибка при глобальном удалении никнейма.');
      }
      
    } else {
      if (!label) {
        return context.reply('❓ Использование: /grnick [пользователь]\n💡 Или ответьте на сообщение: /grnick');
      }

      const label2 = await extractNumericId(label);
      
      if (!label2) {
        return context.reply('❌ Не удалось определить пользователя.');
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
        let foundNickname = '';
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
              
              // Проверяем, есть ли никнейм у пользователя
              const selectQuery = `SELECT nickname FROM ${tableName} WHERE user_id = ?`;
              const existingNick = await databaseQuery(selectQuery, [label2]);
              
              if (existingNick.length > 0) {
                if (!foundNickname) {
                  foundNickname = existingNick[0].nickname;
                }
                
                // Удаляем никнейм
                const deleteQuery = `DELETE FROM ${tableName} WHERE user_id = ?`;
                await databaseQuery(deleteQuery, [label2]);
                successCount++;
              }
            } catch (error) {
              console.error(`Ошибка при удалении никнейма в беседе ${poolPeerId}:`, error);
              errorCount++;
            }
          }
        }
        
        if (successCount === 0) {
          return context.reply('❌ У данного пользователя нет никнеймов для удаления.');
        }
        
        // Получаем информацию о пользователях
        try {
          const userInfo = await vk.api.users.get({ user_ids: context.senderId });
          const adminRole = await getUserRole(conferenceId, context.senderId);
          const roleName = await getRoleName(conferenceId, adminRole);
          const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
          
          const targetUserInfo = await vk.api.users.get({ user_ids: label2 });
          const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
          
          const adminLink = await getlink(context.senderId);
          const targetLink = await getlink(label2);
          context.reply(`✅️ ${adminLink} | ${roleName} удалил никнейм ${targetLink} (в связанных чатах: ${successCount}/${totalChats}).`);
        } catch (error) {
          context.reply(`✅️ ${adminName} удалил никнейм пользователя (в связанных чатах: ${successCount}/${totalChats}).`);
        }
        
      } catch (error) {
        console.error('Ошибка при глобальном удалении никнейма:', error);
        return context.send('❌ Произошла ошибка при глобальном удалении никнейма.');
      }
    }
  }
};
