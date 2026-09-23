const { getUserRole, checkIfTableExists, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');  

module.exports = {
  command: '/editowner',
  aliases: ['/editowner'],
  description: 'Добавление роли Владельца пользователю',
  async execute(context) {
    const { peerId, senderId, replyMessage, text } = context;
    
    // 1. Сначала проверяем существование таблицы
    if (!await checkIfTableExists(`roles_${peerId}`)) {
      return context.reply('❌ Таблица ролей не существует');
    }
    
    // 2. Затем проверяем права доступа
    const senderRoleId = await getUserRole(peerId, context.senderId);
    if (senderRoleId < 100) {
      const senderRoleName = await getRoleName(peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /editowner требуется приоритет 100 или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }
    
    // 3. Только после проверки прав проверяем параметры
    const parts = text.split(' ');
    const target = replyMessage ? replyMessage.senderId : parts[1];
    let label = null;

    if (replyMessage) {
      label = replyMessage.senderId;
    } else if (target) {
      label = await extractNumericId(target);
    }
	
    if (!label) {
      return context.reply('❌ Укажите пользователя для передачи прав владельца.\n\nИспользование:\n/editowner [ID пользователя]\n/editowner [ссылка на пользователя]\nОтветьте на сообщение пользователя командой /editowner');
    }

     
    const prevOwnerQuery = `
      SELECT user_id
      FROM roles_${peerId}
      WHERE role_id = 100
    `;

    database.query(prevOwnerQuery, async (error, rows) => {
      if (error) {
        console.error('Ошибка при получении предыдущего владельца:', error);
        return context.send('❌ Произошла ошибка.');
      }

      if (rows.length > 0) {
        const prevOwnerId = rows[0].user_id;

         
        const deletePrevOwnerQuery = `
          DELETE FROM roles_${peerId}
          WHERE user_id = ?
        `;

        database.query(deletePrevOwnerQuery, [prevOwnerId], async (error, result) => {
          if (error) {
            console.error('Ошибка при удалении предыдущего владельца:', error);
            return context.send('❌ Произошла ошибка.');
          }

          console.log(`Предыдущий владелец (ID ${prevOwnerId}) успешно удален из базы данных.`);
        });
      }
    });

    const chelikRoleId = await getUserRole(peerId, label);

    if (senderRoleId < chelikRoleId) {
      return context.reply('❌ Роль пользователя выше или равна вашей');
    }

    const roleId = 100;
    const rolesTable = `roles_${peerId}`;

    const insertRoleQuery = `
      INSERT INTO ${rolesTable} (user_id, role_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
    `;

    database.query(insertRoleQuery, [label, roleId], async (error, result) => {
      if (error) {
        console.error('Ошибка при добавлении роли:', error);
        return context.send('❌ Произошла ошибка.');
      }

      const targetLink = await getlink(label);
      context.reply(`✅️ Права владельца беседы были успешно переданы ${targetLink}`);
    });
  }
};
