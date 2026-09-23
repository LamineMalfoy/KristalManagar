const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority } = require('./editcmd.js');
const utils = require('../util.js');
const { extractNumericId } = require('./ban.js');

module.exports = {
  command: '/unban',
  aliases: ['/разбан', '/анбан'],
  description: 'Разблокировать пользователя',
  execute: async (context) => {
    const { peerId, text, replyMessage } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');   

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }
	
    const senderUserRole = await getUserRole(peerId, context.senderId);

    // Проверяем приоритет команды
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/unban');
    if (!hasPermission) {
      const { getCommandPriorities } = require('./editcmd.js');
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/unban'] || 40;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /unban требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
	
    let target;
    if (replyMessage) {
      target = replyMessage.senderId; 
    } else {
      target = await extractNumericId(parts[1]);  
    }
    if (!target) {
      return context.reply('❌ Укажите пользователя для разблокировки.');
    }

    try {
      // Получаем информацию о пользователе
      const userInfo = await vk.api.users.get({ user_ids: target });
      const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
      
      // Получаем информацию об администраторе
      const adminInfo = await vk.api.users.get({ user_ids: context.senderId });
      const adminName = adminInfo[0] ? `${adminInfo[0].first_name} ${adminInfo[0].last_name}` : 'Администратор';
      
      // Сначала проверяем, есть ли пользователь в списке заблокированных
      const selectQuery = `
        SELECT blocked_users
        FROM conference_${peerId}
        WHERE user_id = ?
      `;
      
      database.query(selectQuery, [target], async (error, results) => {
        if (error) {
          console.error('Ошибка при проверке бана пользователя:', error);
          return context.send('❌ Ошибка системы | Не удалось проверить статус пользователя');
        }

        if (!results || results.length === 0) {
          const targetLink = await utils.getlink(target);
          return context.send(`⚠️ Пользователь не заблокирован | ${targetLink} не находится в списке заблокированных`);
        }

        const userData = results[0];
        let blockedUsers = [];
        
        if (userData.blocked_users) {
          try {
            blockedUsers = JSON.parse(userData.blocked_users);
          } catch (e) {
            console.error('Ошибка парсинга blocked_users:', e);
            blockedUsers = [];
          }
        }

        // Удаляем пользователя из списка заблокированных
        const updatedBlockedUsers = blockedUsers.filter(block => 
          parseInt(block.blocked_user_id) !== parseInt(target)
        );

        // Обновляем запись пользователя
        const updateQuery = `
          UPDATE conference_${peerId}
          SET blocked_users = ?
          WHERE user_id = ?
        `;

        database.query(updateQuery, [JSON.stringify(updatedBlockedUsers), target], async (updateError) => {
          if (updateError) {
            console.error('Ошибка при разблокировке пользователя:', updateError);
            return context.send('❌ Ошибка системы | Не удалось разблокировать пользователя');
          }

          // Добавляем запись в журнал действий
          addLog(peerId, context.senderId, target, 'unban', `Снятие блокировки пользователя в беседе`)
            .catch(err => console.error('Ошибка при логировании разблокировки:', err));

          const targetLink = await utils.getlink(target);
          const senderLink = await utils.getlink(context.senderId);
          context.reply(`✅️ ${targetLink} разблокирован ${senderLink}.`);
        });
      });

    } catch (error) {
      console.error('Ошибка при обработке команды /unban:', error);
      context.send('❌ Ошибка системы | Не удалось выполнить команду разблокировки');
    }
  },
};
