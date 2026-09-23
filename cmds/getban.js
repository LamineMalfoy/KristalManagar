const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/getban',
  aliases: ['/получитьбан'],
  description: 'Проверить, заблокирован ли пользователь',
  async execute(context) {
    const messageText = context.text;
    const parts = messageText.split(' ');   
    const { peerId, senderId, replyMessage, text } = context;
	console.log(text)
    const conferenceId = peerId

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('❌ Беседа не зарегистрирована!');
    }
	
    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/getban');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/getban'] || 20;
      const senderUserRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderUserRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /getban требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderUserRole})`);
    }
	
    let target;
    if (replyMessage) {
      target = replyMessage.senderId; 
    } else {
      target = await extractNumericId(parts[1]);  
    }
    if (!target) {
      context.reply('❌ Укажите пользователя для проверки.');
      return;
    }
	
    const selectBlockedUsersQuery = `
      SELECT blocked_users
      FROM conference_${conferenceId}
      WHERE user_id = ?
    `;

    database.query(selectBlockedUsersQuery, [target], async (error, results) => {
      if (error) {
        console.error('Ошибка при выборке заблокированных пользователей:', error);
        return context.send('Произошла ошибка при выборке заблокированных пользователей.');
      }

      if (results.length === 0 || !results[0].blocked_users) {
        const targetLink = await getlink(target);
        context.reply(`${targetLink} не заблокирован.`);
        return;
      }
      
      const blockedUsers = results.length > 0 ? JSON.parse(results[0].blocked_users) : [];

      const userBlock = blockedUsers.find(block => block.blocked_user_id === target);

      if (userBlock) {
        const dateObj = new Date(userBlock.block_until);
        const formattedDate = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' });
        const blocker = await getlink(userBlock.blocked_by);
        const targetLink = await getlink(userBlock.blocked_user_id);
        
        // Форматируем причину блокировки
        const reasonText = userBlock.reason && userBlock.reason.trim() !== '' ? userBlock.reason : 'не указана';
        
        context.reply(`🚷 Пользователь ${targetLink} заблокирован до ${formattedDate}.\nПричина блокировки ${reasonText}.\nРешение принял администратор ${blocker}.`);
      } else {
        const targetLink = await getlink(target);
        context.reply(`${targetLink} не заблокирован.`);
      }
    });
  }
};
