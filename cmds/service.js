const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getAgentInfo, getAllCustomRoles } = require('./roles.js');
const { getUserTech } = require('../util.js')	

module.exports = {
  command: '/service',
  aliases: ['/сервис'],
  description: 'null',
  async execute(context) {
    let kaka = await getUserTech(context.senderId);
    if (kaka < 2) return;
    
    const messageText = context.text;
    const { peerId, senderId, replyMessage } = context;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    const roleNumber = parts[1]
	
    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      console.log(`nicknames_${conferenceId}`);
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }

    const roleNumberFix = parseInt(roleNumber);

    if (isNaN(roleNumberFix)) {
      return context.reply('❌ Приоритет роли должен быть числом');
    }

     
    const roles = await getAllCustomRoles(conferenceId);
    const roleExists = roles.some(role => role.role_id === roleNumberFix);
    
     
    if (roleNumberFix !== 0 && !roleExists) {
      let rolesText = '';
      roles.forEach(role => {
        rolesText += `${role.role_id} - ${role.role_name}\n`;
      });
      
      return context.reply(`❌ Роль с приоритетом ${roleNumberFix} не существует. Список доступных ролей:\n${rolesText}`);
    }

     
    const roleName = roleNumberFix === 0 ? 'Участник' : await getRoleName(conferenceId, roleNumberFix);

    if (roleNumberFix === 0) {
       
      const deleteUserQuery = `
        DELETE FROM roles_${conferenceId}
        WHERE user_id = ?
      `;

      database.query(deleteUserQuery, [senderId], async (error, result) => {
        if (error) {
          console.error('Ошибка при удалении пользователя:', error);
          return context.send('❌ Произошла ошибка при удалении пользователя.');
        }

        context.reply(`</> ✅️ Ваша роль принудительно изменена ➜ «${roleName}»`);
      });
    } else {
       
      const insertRoleQuery = `
        INSERT INTO roles_${conferenceId} (user_id, role_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)
      `;

      database.query(insertRoleQuery, [senderId, roleNumberFix], async (error, result) => {
        if (error) {
          console.error('Ошибка при добавлении роли:', error);
          return context.send('❌ Произошла ошибка при изменении роли.');
        }

        context.reply(`</> ✅️ Ваша роль принудительно изменена ➜ «${roleName}»`);
      });
    }
  },
};
