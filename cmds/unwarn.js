const database = require('../databases.js');  
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { extractNumericId } = require('./ban.js');
const util = require('util');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/unwarn',
  description: 'Снять варн у пользователя',
  execute: async (context) => {
    const { peerId, text, senderId, replyMessage } = context;
    const messageText = context.text;
    const conferenceId = peerId;
    const parts = messageText.split(' ');

    if (!await checkIfTableExists(`roles_${conferenceId}`)) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
     
    // Новая проверка приоритета
    const hasPermission = await checkCommandPriority(peerId, senderId, '/unwarn');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/unwarn'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /unwarn требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
	
    const target = replyMessage ? replyMessage.senderId : parts[1];
    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let targetUserId = await extractNumericId(userId)

	if(replyMessage) {
		targetUserId = replyMessage.senderId
	}

    if (!targetUserId) {
      return context.reply('⚠️ Не указан пользователь | Укажите пользователя для снятия предупреждения');
    }

    try {
       
      const getWarnsQuery = `
        SELECT warns
        FROM conference_${peerId}
        WHERE user_id = ?
      `;

      const [rows] = await queryAsync(getWarnsQuery, [targetUserId]);
	  console.log('Данные пользователя в unwarn:', { peerId, targetUserId, rows });

      const currentWarns = parseInt(rows.warns) || 0;

      if (currentWarns === 0) {
        return context.reply('✅ Нет предупреждений | У пользователя нет активных предупреждений');
      }

      // Вычисляем новое количество предупреждений
      const newWarns = Math.max(0, currentWarns - 1);
      console.log('Обновление предупреждений:', { currentWarns, newWarns });
       
      const updateWarnsQuery = `
        UPDATE conference_${peerId}
        SET warns = ?
        WHERE user_id = ?
      `;

      await queryAsync(updateWarnsQuery, [newWarns, targetUserId]);

       
      const userInfo = await vk.api.users.get({ user_ids: targetUserId });
      const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
      
       
      const adminInfo = await vk.api.users.get({ user_ids: senderId });
      const adminName = adminInfo[0] ? `${adminInfo[0].first_name} ${adminInfo[0].last_name}` : 'Администратор';
      
       
      const warnEmoji = newWarns === 0 ? '✅' : (newWarns === 1 ? '🟡' : '🟠');
      
      try {
        const adminRole = await getUserRole(peerId, context.senderId);
        const roleName = await getRoleName(peerId, adminRole);
        
        // Добавляем запись в журнал действий
        addLog(peerId, senderId, targetUserId, 'unwarn', `Снято предупреждение. Осталось: ${newWarns}/3`)
          .catch(err => console.error('Ошибка при логировании снятия предупреждения:', err));
        
        const adminLink = await getlink(senderId);
        const targetLink = await getlink(targetUserId);
        context.reply(`✅️ ${adminLink} | ${roleName} снял предупреждение с ${targetLink}`);
      } catch (error) {
        // Добавляем запись в журнал действий
        addLog(peerId, senderId, targetUserId, 'unwarn', `Снято предупреждение. Осталось: ${newWarns}/3`)
          .catch(err => console.error('Ошибка при логировании снятия предупреждения:', err));
        
        const targetLink = await getlink(targetUserId);
        context.reply(`✅️ Вы сняли предупреждение с ${targetLink}\nОсталось предупреждений: [${newWarns}/3]`);
      }
    } catch (error) {
      console.error('Ошибка при снятии варна:', error);
      context.reply('❌ Ошибка системы | Не удалось снять предупреждение');
    }
  },
};