const { getUserRole, checkIfTableExists, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { extractNumericId } = require('./ban.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { getlink } = require('../util.js');
const cacheManager = require('../cacheManager.js');

module.exports = {
  command: '/grole',
  description: 'Глобальная выдача роли пользователю во всех беседах пулла',
  async execute(context) {
    try {
      const { peerId, senderId, replyMessage } = context;
      const messageText = context.text;
      const parts = messageText.split(' ');
      const senderRoleId = await getUserRole(peerId, context.senderId);
      
      if (!(await checkIfTableExists(`roles_${peerId}`))) {
        return context.reply('❌ Таблица ролей не существует');
      }

      if (senderRoleId < 60) {
        return context.reply(`❌ У вас нет прав на глобальную выдачу ролей`);
      }

      const target = replyMessage ? replyMessage.senderId : parts[1];
      if (!target) {
        return context.reply('❌ Укажите ID пользователя или ответьте на его сообщение');
      }

       
      const roleIdentifier = parts[replyMessage ? 1 : 2];
      if (!roleIdentifier) {
        return context.reply('❌ Укажите приоритет или название роли');
      }

       
      const isNumeric = /^\d+$/.test(roleIdentifier);
      let roleId;

      if (isNumeric) {
        roleId = parseInt(roleIdentifier);
        
         
        if (roleId >= senderRoleId) {
          return context.reply('❌ Вы не можете выдать роль с приоритетом равным или выше вашего');
        }
      } else {
       
        const customRolesTable = `custom_roles_${peerId}`;
      
        if (!(await checkIfTableExists(customRolesTable))) {
          return context.reply('❌ Таблица кастомных ролей не существует');
        }
      
        const getCustomRoleQuery = `
          SELECT priority
          FROM ${customRolesTable}
          WHERE name = ?
        `;
      
        const customRoleResults = await databaseQuery(getCustomRoleQuery, [roleIdentifier]);
        if (customRoleResults.length === 0) {
          return context.reply(`❌ Роль с названием "${roleIdentifier}" не найдена`);
        }
        
        roleId = customRoleResults[0].priority;
        
         
        if (roleId >= senderRoleId) {
          return context.reply('❌ Вы не можете выдать роль с приоритетом равным или выше вашего');
        }
      }

      const userId = target || (replyMessage ? replyMessage.senderId : senderId);
      let label = await extractNumericId(userId);

      if (replyMessage) {
        label = replyMessage.senderId;
      }

     
      // --- Новый файловый поиск пуллов ---
      const fs = require('fs');
      const path = require('path');
      const poolsDir = path.join(__dirname, '../data/pools');
      let foundPools = [];
      for (const file of fs.readdirSync(poolsDir)) {
        if (!file.endsWith('.json')) continue;
        let data;
        try { data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8')); } catch { continue; }
        const ids = Array.isArray(data.pool_peerids) ? data.pool_peerids : [];
        if (ids.includes(String(peerId))) foundPools.push(data);
      }
      if (foundPools.length === 0) {
        return context.reply('❌ Пуллы с этой беседой не найдены.');
      }
      let totalRoleCount = 0;
      let chatsTouched = 0;
      let roleNamesByPeer = [];
      for (const pool of foundPools) {
        const poolPeerIds = Array.isArray(pool.pool_peerids) ? pool.pool_peerids : [];
        if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) continue;
        for (const poolPeerId of poolPeerIds) {
          const senderRoleInChat = await getUserRole(poolPeerId, senderId);
          const targetRoleInChat = await getUserRole(poolPeerId, label);
          if (senderRoleInChat < 60 || senderRoleInChat <= targetRoleInChat || senderRoleInChat <= roleId) {
            continue;
          }
          try {
            const conversationMembers = await vk.api.messages.getConversationMembers({
              peer_id: poolPeerId,
            });
            const targetProfile = conversationMembers.profiles.find(profile => profile.id === parseInt(label));
            if (!targetProfile) continue;
            const rolesTable = `roles_${poolPeerId}`;
            const insertRoleQuery = `
              INSERT INTO ${rolesTable} (user_id, role_id)
              VALUES (?, ?)
              ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
            `;
            await databaseQuery(insertRoleQuery, [label, roleId]);
            
            // Очищаем кэш роли пользователя и кастомных ролей для этой беседы
            const userCacheKey = cacheManager.generateKey(poolPeerId, label);
            cacheManager.invalidate('userRoles', userCacheKey);
            const customRolesCacheKey = `custom_roles_${poolPeerId}`;
            cacheManager.invalidate('customRoles', customRolesCacheKey);
            
            let roleName = await getRoleName(poolPeerId, roleId);
            roleNamesByPeer.push({ peerId: poolPeerId, roleName });
            chatsTouched++;
            totalRoleCount++;
          } catch (error) {
            console.error(`Ошибка при выдаче роли пользователю в беседе ${poolPeerId}:`, error);
          }
        }
      }
      if (totalRoleCount > 0) {
        try {
          // Используем getlink для корректного отображения пользователей и сообществ
          const targetLink = await getlink(label);
          
          // Проверяем, одинаковы ли все имена ролей во всех чатах
          const uniqueNames = [...new Set(roleNamesByPeer.map(r => r.roleName))];
          if (uniqueNames.length === 1) {
            context.reply(`✅ ${targetLink} получил роль «${uniqueNames[0]}» в ${chatsTouched} беседах всех пуллов, где состоит эта беседа.`);
          } else {
            let reply = `✅ ${targetLink} получил роли:\n`;
            for (const r of roleNamesByPeer) {
              reply += `• «${r.roleName}» в беседе ${r.peerId}\n`;
            }
            context.reply(reply);
          }
        } catch (linkError) {
          console.error('Ошибка при получении ссылки:', linkError);
          // Fallback с правильным форматом для сообществ
          const targetFallback = label < 0 ? `[club${Math.abs(label)}|Сообщество]` : `[id${label}|Пользователь]`;
          const uniqueNames = [...new Set(roleNamesByPeer.map(r => r.roleName))];
          if (uniqueNames.length === 1) {
            context.reply(`✅ ${targetFallback} получил роль «${uniqueNames[0]}» в ${chatsTouched} беседах всех пуллов.`);
          } else {
            let reply = `✅ ${targetFallback} получил роли:\n`;
            for (const r of roleNamesByPeer) {
              reply += `• «${r.roleName}» в беседе ${r.peerId}\n`;
            }
            context.reply(reply);
          }
        }
      } else {
        try {
          const targetLink = await getlink(label);
          context.reply(`⚠️ Не удалось выдать роль ${targetLink} ни в одной беседе пуллов. Проверьте права и наличие пользователя в чатах.`);
        } catch (linkError) {
          console.error('Ошибка при получении ссылки:', linkError);
          const targetFallback = label < 0 ? `[club${Math.abs(label)}|Сообщество]` : `[id${label}|Пользователь]`;
          context.reply(`⚠️ Не удалось выдать роль ${targetFallback} ни в одной беседе пуллов.`);
        }
      }
    } catch (error) {
      console.error('Ошибка при глобальной выдаче роли:', error);
      return context.send('❌ Произошла ошибка.');
    }
  }
};