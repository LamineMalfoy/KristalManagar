const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const { addLog } = require('../utils/logs.js');
const { extractNumericId } = require('./ban.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/unmute',
  aliases: ['/размут', '/анмут'],
  description: 'Снять мут с пользователя',
  async execute(context) {
    const { peerId, senderId, text, replyMessage } = context;

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/unmute');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/unmute'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /unmute требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }

    let target;
    let numericId;

    if (replyMessage) {
      target = replyMessage.senderId;
      numericId = replyMessage.senderId;
    } else {
      const parts = text.split(' ');
      target = parts[1];
      numericId = await extractNumericId(parts[1]);
    }

    if (!target) {
      return context.reply('⚠️ Не указан пользователь | Укажите пользователя для снятия ограничений');
    }

    if (!numericId) {
      return context.reply('❌ Не удалось определить ID пользователя. Проверьте правильность указания пользователя.');
    }

    // Проверка, что numericId является числом
    if (isNaN(parseInt(numericId))) {
      return context.reply('❌ Указан некорректный ID пользователя.');
    }

    /*const mutedUser = mutedUsersInfo[peerId] && mutedUsersInfo[peerId][numericId];
    if (!mutedUser) {
      return context.reply('❌ У пользователя нет мута в данной беседе.');
    }

     
    delete mutedUsersInfo[peerId][numericId];*/

    /*if(numericId == 828085713) {
      vk.api.messages.changeConversationMemberRestrictions({ peer_id: context.peerId, member_ids: numericId, action: "ro" })
      return context.reply(`❌ Запрещено снимать муты долбаебам, мут продлен до: навсегда`)
    }*/

    try {
      await vk.api.messages.changeConversationMemberRestrictions({ 
        peer_id: context.peerId, 
        member_ids: [parseInt(numericId)], // Передаем как массив с числовым значением
        action: "rw" 
      });
      
      const userInfo = await vk.api.users.get({ user_ids: numericId });
      const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
      
      // Добавляем запись в журнал действий
      addLog(peerId, senderId, numericId, 'unmute', `Снятие блокировки чата`)
        .catch(err => console.error('Ошибка при логировании снятия мута:', err));
      
      // Получаем красивую ссылку на пользователя
      const userLink = await getlink(numericId);
      context.reply(`✅️ Вы сняли блокировку чата у ${userLink}.`);
    } catch (error) {
      console.error('Ошибка при снятии мута:', error);
      
      // Добавляем запись в журнал действий даже при ошибке
      addLog(peerId, senderId, numericId, 'unmute', `Попытка снятия блокировки чата (ошибка)`)
        .catch(err => console.error('Ошибка при логировании снятия мута:', err));
      
      context.reply(`❌ Ошибка при снятии блокировки чата: ${error.message || 'Неизвестная ошибка'}`);
    }
  },
};
