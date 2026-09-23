const database = require('../databases.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/tickets',
  description: 'Список тикетов в системе поддержки',
  async execute(context) {
    try {
       
      const senderAccess = await checkSysAccess(context.senderId);
      if (senderAccess < 1) {
        const senderAccessName = getAccessLevelName(senderAccess);
        return context.reply(`⛔ Доступ запрещён | Для использования команды /tickets требуется уровень доступа 1 или выше\n👤 Ваш уровень: ${senderAccessName} (доступ ${senderAccess})`);
      }

       
      const args = context.text.split(' ');
      let showClosed = false;
      
      if (args.length > 1 && args[1].toLowerCase() === 'all') {
        showClosed = true;
      }

       
      // Формируем запрос
      let query;
      if (showClosed) {
        query = 'SELECT * FROM tickets ORDER BY status ASC, id DESC';
      } else {
        query = 'SELECT * FROM tickets WHERE status = ? ORDER BY id DESC';
      }
      
      const tickets = await databaseQuery(query, showClosed ? [] : [false]);
      
      // Оставляем только валидные тикеты (с полем mess)
      const validTickets = tickets.filter(ticket => ticket && typeof ticket.mess === 'string');
      
      if (!validTickets || validTickets.length === 0) {
        return context.reply(showClosed ? 'ℹ️ Информация: тикеистеме нет' : 'ℹ️ Информтов в сация: открытых тикетов на данный момент отсутствует.');
      }

       
      const userIds = validTickets.map(ticket => ticket.userid);
      let userInfos;
      try {
        userInfos = await vk.api.users.get({ user_ids: userIds });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователях:', error);
        userInfos = [];
      }

       
      const userMap = {};
      userInfos.forEach(user => {
        userMap[user.id] = user;
      });

       
      let message = 'ℹ️ Информация: тикеты в системе\n\n';
      
       
      const openTickets = validTickets.filter(ticket => !ticket.status);
      const closedTickets = validTickets.filter(ticket => ticket.status);
      
       
      // Открытые тикеты
      if (openTickets.length > 0) {
        message += 'ℹ️ Информация: открытые тикеты:\n';
        openTickets.forEach(ticket => {
          const user = userMap[ticket.userid] || { first_name: 'Пользователь', last_name: ticket.userid };
          const shortMessage = ticket.mess.length > 50 ? ticket.mess.substring(0, 50) + '...' : ticket.mess;
          const ticketId = ticket.id || 'N/A';
          message += `— #${ticketId} | [id${ticket.userid}|${user.first_name} ${user.last_name}] | ${shortMessage}\n`;
        });
        message += '\n';
      } else {
        message += 'ℹ️ Информация: открытых тикетов на данный момент отсутствует.\n\n';
      }

      // Закрытые тикеты только в /tickets all
      if (showClosed && closedTickets.length > 0) {
        message += 'ℹ️ Информация: закрытые тикеты (последние 10):\n';
        const displayedClosedTickets = closedTickets.slice(0, 10);
        displayedClosedTickets.forEach(ticket => {
          const user = userMap[ticket.userid] || { first_name: 'Пользователь', last_name: ticket.userid };
          const shortMessage = ticket.mess.length > 50 ? ticket.mess.substring(0, 50) + '...' : ticket.mess;
          const ticketId = ticket.id || 'N/A';
          message += `— #${ticketId} | [id${ticket.userid}|${user.first_name} ${user.last_name}] | ${shortMessage}\n`;
        });
        if (closedTickets.length > 10) {
          message += `\nℹ️ Информация: ещё ${closedTickets.length - 10} закрытых тикетов. Команда: /tickets all\n`;
        }
      } else if (!showClosed && closedTickets.length > 0) {
        message += `\nℹ️ Информация: ещё ${closedTickets.length} закрытых тикетов. Команда: /tickets all`;
      }

       
      context.send({ message: message, disable_mentions: true });
    } catch (error) {
      console.error('Ошибка при выполнении команды tickets:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};