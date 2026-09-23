const { checkIfTableExists, getRoleNamezov, getRoleName, getUserRole, getpoolkey } = require('./roles.js');
const database = require('../databases.js');  
const util = require('util');
const databaseQuery = util.promisify(database.query);
const { safeParsePeerIds } = require('../utils/pool.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/gzov',
  aliases: ['/гзов', '/групповойзов'],
  description: 'Массовое упоминание всех пользователей в пулле',
  async execute(context) {
    const messageText = context.text;
    const { peerId, senderId, replyMessage } = context;
    const parts = messageText.split(' ');
    const senderUserRole = await getUserRole(peerId, context.senderId);
    const reason = messageText.slice('/gzov'.length).trim();

    if (!(await checkIfTableExists(`nicknames_${peerId}`))) {
      console.error('Таблица никнеймов не существует');
      return context.send('Ваша беседа не зарегистрирована!');
    }

    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gzov');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gzov'] || 40;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gzov требуется приоритет ${requiredRole} или выше
👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    if (!reason) {
      return context.reply('❌ Вы не указали причину вызова');
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
    let totalZovCount = 0;
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
          if (senderRoleInChat < 40) {
            failReasons.push(`В беседе ${poolPeerId}: недостаточно прав (ваша роль < 40)`);
            continue;
          }
          const conversationMembers = await vk.api.messages.getConversationMembers({ peer_id: poolPeerId });
          const memberProfiles = conversationMembers.profiles;
          let message = '';
          for (const member of memberProfiles) {
            const name = `[id${member.id}|☑️]`;
            message += `${name} `;
          }
          const senderLink = await getlink(senderId);
          const editedMessage = `\n🔊 Вы были вызваны ${senderLink} беседы.\n\n${message}\n\nПричина: ${reason}!`;
          await vk.api.messages.send({ peer_id: poolPeerId, message: editedMessage, random_id: Math.floor(Math.random() * 2147483647) });
          totalZovCount++;
        } catch (error) {
          failReasons.push(`В беседе ${poolPeerId}: ошибка при массовом вызове (${error.message || error})`);
        }
      }
    }
    if (totalZovCount > 0) {
      context.reply(`✅ Массовой вызов отправлен в ${totalZovCount} бесед всех пуллов.`);
    }
    if (failReasons.length > 0) {
      context.reply(`⚠️ Не удалось вызвать или возникли частичные ошибки:\n${failReasons.join('\n')}`);
    }
    return;
  }
};
