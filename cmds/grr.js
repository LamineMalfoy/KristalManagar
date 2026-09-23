const { getUserRole, checkIfTableExists, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const queryPromise = util.promisify(database.query);
const { extractNumericId } = require('./ban.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { getlink } = require('../util.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

 
async function getCustomOrDefaultRoleName(conferenceId, roleId) {
   
  if (!roleId) return 'Пользователь';
  
  try {
     
    const customRolesTable = `custom_roles_${conferenceId}`;
    if (await checkIfTableExists(customRolesTable)) {
      const getCustomRoleQuery = `
        SELECT role_name 
        FROM ${customRolesTable} 
        WHERE role_id = ?
      `;
      const results = await queryPromise(getCustomRoleQuery, [roleId]);
      if (results && results.length > 0) {
        return results[0].role_name;
      }
    }
    
     
    const standardRoles = {
      0: 'Пользователь',
      20: 'Модератор',
      40: 'Администратор',
      60: 'Спец. Администратор',
      80: 'Руководитель',
      100: 'Владелец'
    };
    
    return standardRoles[roleId] || `Роль ${roleId}`;
  } catch (error) {
    console.error('Ошибка при получении имени роли:', error);
    return `Роль ${roleId}`;
  }
}

module.exports = {
  command: '/grr',
  description: 'Удаление роли пользователя во всех беседах пулла',
  async execute(context) {
    const { peerId, senderId, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/grr');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/grr'] || 50;
      const senderRoleId = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /grr требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }

    const target = replyMessage ? replyMessage.senderId : parts[1];
    if (!target) {
      return context.reply('❌ Укажите ID пользователя или ответьте на его сообщение');
    }

    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = await extractNumericId(userId);

    if (replyMessage) {
      label = replyMessage.senderId;
    }
    
    if (!label) {
      return context.reply('❌ Не удалось определить пользователя');
    }

    // Проверяем роль цели в текущей беседе
    const targetRole = await getUserRole(peerId, label);
    const senderRole = await getUserRole(peerId, context.senderId);
    
    // Нельзя удалять роль у пользователя с приоритетом 0 (он уже участник)
    if (targetRole === 0) {
      const targetLink = await getlink(label);
      return context.reply(`❌ У ${targetLink} уже нет роли (приоритет 0 - Участник)`);
    }
    
    // Нельзя удалять роль у пользователя с равным или выше приоритетом
    if (senderRole <= targetRole) {
      return context.reply(`❌ Вы не можете удалить роль у пользователя с равным или выше приоритетом`);
    }

     
    // Поиск всех пуллов, где состоит этот peerId
    const fs = require('fs');
    const path = require('path');
    const poolsDir = path.join(__dirname, '../data/pools');
    const poolFiles = fs.readdirSync(poolsDir);
    let pools = [];
    for (const file of poolFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
      if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
        pools.push(data);
      }
    }
    if (!pools.length) {
      return context.reply('❌ Пуллы не найдены.');
    }
    let totalRemoveCount = 0;
    let failReasons = [];
    let targetRoleName = '';
    for (const pool of pools) {
      const creatorId = pool.creator_id;
      if (parseInt(label) === parseInt(creatorId)) {
        failReasons.push(`В пулле ${pool.pool_name}: нельзя удалить роль создателя.`);
        continue;
      }
      const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
      if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
        failReasons.push(`В пулле ${pool.pool_name}: нет ни одной беседы.`);
        continue;
      }
      for (const poolPeerId of poolPeerIds) {
        try {
          const senderRoleInChat = await getUserRole(poolPeerId, senderId);
          const targetRoleInChat = await getUserRole(poolPeerId, label);
          if (totalRemoveCount === 0 && targetRoleInChat > 0) {
            targetRoleName = await getCustomOrDefaultRoleName(poolPeerId, targetRoleInChat);
          }
          if (senderRoleInChat < 40 || senderRoleInChat <= targetRoleInChat) {
            continue;
          }
          const conversationMembers = await vk.api.messages.getConversationMembers({ peer_id: poolPeerId });
          const targetProfile = conversationMembers.profiles.find(profile => profile.id === parseInt(label));
          if (!targetProfile) continue;
          const rolesTable = `roles_${poolPeerId}`;
          const deleteRoleQuery = `DELETE FROM ${rolesTable} WHERE user_id = ?`;
          await queryPromise(deleteRoleQuery, [label]);
          totalRemoveCount++;
        } catch (error) {
          failReasons.push(`В беседе ${poolPeerId}: ошибка при удалении роли (${error.message || error})`);
        }
      }
    }
    if (totalRemoveCount > 0) {
      try {
        // Используем getlink для корректного отображения пользователей и сообществ
        const targetLink = await getlink(label);
        context.reply(`✅ Роль «${targetRoleName || 'Пользователь'}» была удалена у ${targetLink} в ${totalRemoveCount} беседах всех пуллов.`);
      } catch (linkError) {
        console.error('Ошибка при получении ссылки:', linkError);
        // Fallback с правильным форматом для сообществ
        const targetFallback = label < 0 ? `[club${Math.abs(label)}|Сообщество]` : `[id${label}|Пользователь]`;
        context.reply(`✅ Роль «${targetRoleName || 'Пользователь'}» была удалена у ${targetFallback} в ${totalRemoveCount} беседах всех пуллов.`);
      }
    }
    if (failReasons.length > 0) {
      context.reply(`⚠️ Не удалось удалить роль или возникли частичные ошибки:\n${failReasons.join('\n')}`);
    }
    return;
  }
};
