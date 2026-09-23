const { getUserRole, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { extractNumericId } = require('./ban.js');
const { safeParsePeerIds } = require('../utils/pool.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getRoleName } = require('./roles.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/gunban',
  description: 'Снятие бана пользователя во всех беседах пулла',
  async execute(context) {
    const { peerId, senderId, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    const senderRoleId = await getUserRole(peerId, context.senderId);
    
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gunban');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gunban'] || 100;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gunban требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    const target = replyMessage ? replyMessage.senderId : parts[1];
    if (!target) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя для разблокировки во всех беседах пулла.
      
❓ Примеры использования:
/gunban @user
/gunban - ответом на сообщение`);
    }

    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = await extractNumericId(userId);

    if (replyMessage) {
      label = replyMessage.senderId;
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
    let totalUnbanCount = 0;
    let failReasons = [];
    for (const pool of pools) {
      const poolPeerIds = safeParsePeerIds(pool.pool_peerids);
      if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
        failReasons.push(`В пулле ${pool.pool_name}: нет ни одной беседы.`);
        continue;
      }
      for (const poolPeerId of poolPeerIds) {
        try {
          const senderRoleInChat = await getUserRole(poolPeerId, senderId);
          if (senderRoleInChat < 60) {
            failReasons.push(`В беседе ${poolPeerId}: недостаточно прав (ваша роль < 60)`);
            continue;
          }
          const conferenceTable = `conference_${poolPeerId}`;
          if (!(await checkIfTableExists(conferenceTable))) {
            failReasons.push(`В беседе ${poolPeerId}: не найдена таблица конференции`);
            continue;
          }
          // Пробуем снять бан с пользователя
          let unbanned = false;
          let labelToTry = [label, -Math.abs(label)];
          for (const idToTry of labelToTry) {
          const selectBlockedUsersQuery = `SELECT blocked_users FROM ${conferenceTable} WHERE user_id = ?`;
            const blockedUsersResult = await databaseQuery(selectBlockedUsersQuery, [idToTry]);
          if (!blockedUsersResult.length) {
            continue;
          }
          const blockedUsers = JSON.parse(blockedUsersResult[0].blocked_users || '[]');
            const existingBlockIndex = blockedUsers.findIndex(block => parseInt(block.blocked_user_id) === parseInt(idToTry));
          if (existingBlockIndex === -1) {
            continue;
          }
          blockedUsers.splice(existingBlockIndex, 1);
          const updateBlockedUsersQuery = `UPDATE ${conferenceTable} SET blocked_users = ? WHERE user_id = ?`;
            await databaseQuery(updateBlockedUsersQuery, [JSON.stringify(blockedUsers), idToTry]);
            unbanned = true;
          }
          if (unbanned) totalUnbanCount++;
        } catch (error) {
          failReasons.push(`В беседе ${poolPeerId}: ошибка при снятии бана (${error.message || error})`);
        }
      }
    }
    if (totalUnbanCount > 0) {
      const userLink = await getlink(label);
      context.reply(`✅ Бан снят с ${userLink} в ${totalUnbanCount} беседах всех пуллов.`);
    }
    if (failReasons.length > 0) {
      context.reply(`⚠️ Не удалось снять бан или возникли частичные ошибки:\n${failReasons.join('\n')}`);
    }
  }
};