const database = require('../databases.js');  
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

const util = require('util');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/getwarn',
  description: 'Получить количество предупреждений пользователя',
  execute: async (context) => {
    const { peerId, text, replyMessage } = context;
    const messageText = context.text;
    const conferenceId = peerId;
    const parts = messageText.split(' ');
    if (!await checkIfTableExists(`roles_${conferenceId}`)) {
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }
     
    // Проверяем права через checkCommandPriority
    const { checkCommandPriority } = require('./editcmd.js');
    const hasAccess = await checkCommandPriority(peerId, context.senderId, '/getwarn');
    if (!hasAccess) {
      const senderUserRole = await getUserRole(peerId, context.senderId);
      const roleName = await getRoleName(peerId, senderUserRole);
      return context.send(`⛔ Доступ запрещён | Для использования команды /getwarn требуется приоритет 40 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
    }

     
    const target = parts[1];
    const userId = target

    let targetUserId = await extractNumericId(userId);

    if (replyMessage) {
      targetUserId = replyMessage.senderId;
    }

    if (!targetUserId) {
      return context.send(`❌ Вы не указали пользователя`);
    }

    try {
       
      const getWarnsQuery = `
        SELECT warns, warns_history
        FROM conference_${peerId}
        WHERE user_id = ?
      `;

      const [row] = await queryAsync(getWarnsQuery, [targetUserId]);

      if (!row) {
        const targetLink = await getlink(targetUserId);
        return context.reply(`У ${targetLink} 0/3 предупреждений.`);
      }

      const currentWarns = parseInt(row.warns) || 0;
      const warnHistory = row.warns_history || '';
      
      // Получаем информацию о пользователе
      const userInfo = await vk.api.users.get({ user_ids: targetUserId });
      const userName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
      
      const targetLink = await getlink(targetUserId);
      const warnPrefix = currentWarns === 0 ? '✅ ' : '⛔️ ';
      let message = `${warnPrefix}${targetLink} — ${currentWarns} / 3 предупреждений`;
      
      // Если есть история предупреждений, показываем с нумерацией
      if (warnHistory && warnHistory !== '[]') {
        try {
          const history = JSON.parse(warnHistory);
          if (history.length > 0) {
            message += `\n\n`;
            for (let i = 0; i < history.length; i++) {
              const warn = history[i];
              const reason = warn.Reason || 'Не указано';
              message += `${i + 1}. Причина: ${reason}\n`;
            }
          }
        } catch (e) {
          console.error('Ошибка парсинга истории предупреждений:', e);
        }
      }

      context.reply(message);
    } catch (error) {
      console.error('Ошибка при получении количества предупреждений:', error);
      context.reply('❌ Произошла ошибка при получении количества предупреждений.');
    }
  },
};
