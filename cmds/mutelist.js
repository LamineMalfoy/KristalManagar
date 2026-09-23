const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority } = require('./editcmd.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/mlist',
  aliases: ['/mutelist', '!mutelist', '!mlist'],
  description: 'Список заглушенных пользователей',
  async execute(context) {
    const { peerId, senderId } = context;

    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('❓ Беседа не активирована! Для активации беседы, введите /start');
    }

    // Проверяем права через checkCommandPriority
    const hasAccess = await checkCommandPriority(peerId, senderId, '/mutelist');
    if (!hasAccess) {
      const senderUserRole = await getUserRole(peerId, context.senderId);
      const roleName = await getRoleName(peerId, senderUserRole);
      return context.send(`⛔ Доступ запрещён | Для использования команды /mutelist требуется приоритет 20 или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderUserRole})`);
    }

    const mutedUsersForConference = mutedUsersInfo[peerId];

    if (!mutedUsersForConference || Object.keys(mutedUsersForConference).length === 0) {
      return context.reply('✅ Заглушения отсутствуют. Все участники имеют доступ к чату.');
    }

    let replyMessage = '🔇 В списке заглушенных:\n\n';
    let index = 1;

    for (const numericId in mutedUsersForConference) {
      const muteInfo = mutedUsersForConference[numericId];
      const muteUntil = new Date(muteInfo.mute_until);
      const formattedDate = formatDate(muteUntil);
      const userLink = await getlink(muteInfo.muted_user_id);
      const reason = muteInfo.reason || 'Нарушение правил чата';
      const mutedUser = `${index}) ${userLink}\n   Окончание: ${formattedDate}\n   Причина: ${reason}\n\n`;
      replyMessage += mutedUser;
      index++;
    }

    context.reply(replyMessage.trim());
  },
};

function formatDate(date) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  let minutes = date.getMinutes();
  
   
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  
  return `${day} ${month} ${year} г. ${hours}:${minutes} МСК`;
}
