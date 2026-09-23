const { getUserRole, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { extractNumericId } = require('./ban.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getRoleName } = require('./roles.js');
const { getlink } = require('../util.js');

function generateRandom32BitNumber() {
  return Math.floor(Math.random() * 2147483647);
}

module.exports = {
  command: '/gkick',
  description: 'Глобальное исключение пользователя из всех бесед пулла',
  async execute(context) {
    const { peerId, senderId, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    const senderRoleId = await getUserRole(peerId, context.senderId);
    
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gkick');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gkick'] || 40;
      const requiredRoleName = await getRoleName(peerId, requiredRole);
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gkick требуется приоритет ${requiredRole} или выше
👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const target = replyMessage ? replyMessage.senderId : parts[1];
    if (!target) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя для исключения из всех бесед пулла.
      
❓ Примеры использования:
/gkick @user причина
/gkick @user
/gkick - ответом на сообщение`);
    }

    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = await extractNumericId(userId);

    if (replyMessage) {
      label = replyMessage.senderId;
    }

    const reason = parts.slice(replyMessage ? 1 : 2).join(' ') || 'Нарушение правил';

     
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
    let totalKickCount = 0;
    let failReasons = [];
    for (const pool of pools) {
      const creatorId = pool.creator_id;
      if (parseInt(label) === parseInt(creatorId)) {
        failReasons.push(`В пулле ${pool.pool_name}: нельзя исключить создателя.`);
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
          if (senderRoleInChat < 40) {
            failReasons.push(`В беседе ${poolPeerId}: недостаточно прав (ваша роль < 40)`);
            continue;
          }
          if (senderRoleInChat <= targetRoleInChat) {
            failReasons.push(`В беседе ${poolPeerId}: ваша роль не выше роли цели`);
            continue;
          }
          const conversationMembers = await vk.api.messages.getConversationMembers({ peer_id: poolPeerId });
          const targetProfile = conversationMembers.profiles.find(profile => profile.id === parseInt(label));
          if (!targetProfile) {
            failReasons.push(`В беседе ${poolPeerId}: пользователь не найден среди участников`);
            continue;
          }
          try {
            await vk.api.messages.removeChatUser({ chat_id: poolPeerId - 2000000000, member_id: label });
          } catch (kickError) {
            // Если не удалось кикнуть пользователя, пробуем кикнуть как группу
            try {
              await vk.api.messages.removeChatUser({ chat_id: poolPeerId - 2000000000, member_id: -Math.abs(label) });
            } catch (groupKickError) {
              failReasons.push(`В беседе ${poolPeerId}: не удалось исключить пользователя или сообщество (${groupKickError.message || groupKickError})`);
            continue;
            }
          }
          const userLink = await getlink(label);
          await vk.api.messages.send({ peer_id: poolPeerId, message: `✅ ${userLink} был исключён из беседы.\nПричина: ${reason}`, random_id: generateRandom32BitNumber() });
          totalKickCount++;
        } catch (error) {
          failReasons.push(`В беседе ${poolPeerId}: ошибка при исключении (${error.message || error})`);
        }
      }
    }
    if (totalKickCount > 0) {
      const userLink = await getlink(label);
      context.reply(`✅ ${userLink} был исключён из ${totalKickCount} бесед всех пуллов.\nПричина: ${reason}`);
    }
    if (failReasons.length > 0) {
      const userLink = await getlink(label);
      context.reply(`⚠️ Не удалось исключить ${userLink} или возникли частичные ошибки:\n${failReasons.join('\n')}`);
    }
    return;
  }
};
