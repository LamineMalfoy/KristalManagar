const database = require('../databases.js');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/ticket',
  description: 'Просмотр информации о конкретном тикете',
  async execute(context) {
    try {
       
      const hasAccess = await hasCommandAccess(context.senderId, 'ticket');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('ticket'));
      }

       
      const args = context.text.split(' ');
      if (args.length < 2) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /ticket [ID тикета]');
      }

       
      const ticketId = parseInt(args[1]);
      if (isNaN(ticketId)) {
        return context.reply('❌ Ошибка | Некорректный ID тикета');
      }

       
      const query = 'SELECT * FROM tickets WHERE id = ?';
      const tickets = await databaseQuery(query, [ticketId]);
      
      if (!tickets || tickets.length === 0) {
        return context.reply('❌ Ошибка | Тикет с указанным ID не найден');
      }

      const ticket = tickets[0];

       
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: ticket.userid });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: ticket.userid }];
      }

       
      // Обработка даты создания
      let dateStr = 'Неизвестно';
      
      if (ticket.created_at) {
        let date;
        
        // Если это число (вероятно Unix timestamp), сначала пробуем умножить на 1000
        if (typeof ticket.created_at === 'number') {
          date = new Date(ticket.created_at * 1000);
        } else {
          date = new Date(ticket.created_at);
        }
        
        // Попробуем также парсинг как строки MySQL datetime
        if (isNaN(date.getTime()) && typeof ticket.created_at === 'string') {
          // MySQL datetime формат: 'YYYY-MM-DD HH:MM:SS'
          date = new Date(ticket.created_at.replace(' ', 'T') + 'Z');
        }
        
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow'
          });
        }
      } else {
        // Для старых тикетов без created_at показываем более информативное сообщение
        dateStr = 'Дата не сохранена (старый тикет)';
      }
      
      let message = `[Тикет #${ticket.id}] — Статус: ${ticket.status ? '✅ Закрыт' : '⏳ Открыт'}\n\n`;
      message += `👤 От: [id${ticket.userid}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n`;
      message += `🕒 Создан: ${dateStr}\n\n`;
      message += `➤ Сообщение: "${ticket.mess}"\n`;
      
      if (ticket.status && ticket.closed_by) {
        try {
          // Получаем информацию об агенте, который закрыл тикет
          const agentInfo = await vk.api.users.get({ user_ids: ticket.closed_by });
          const agentName = agentInfo[0] ? `${agentInfo[0].first_name} ${agentInfo[0].last_name}` : `ID${ticket.closed_by}`;
          
          if (ticket.answer_text) {
            message += `\n🗨 Ответ от [id${ticket.closed_by}|${agentName}]:\n`;
            message += `"${ticket.answer_text}"\n`;
          }
        } catch (error) {
          console.error('Ошибка при получении информации об агенте:', error);
          if (ticket.answer_text) {
            message += `\n🗨 Ответ от агента поддержки:\n`;
            message += `"${ticket.answer_text}"\n`;
          }
        }
      }
      
      message += `\n🏠 ID беседы: ${ticket.peer_id}`;
      
      message += '\n';
      
      if (!ticket.status) {
        message += `Для ответа используйте: /answer ${ticket.id} [ответ]`;
      }

       
      context.send({ message: message, disable_mentions: true });
    } catch (error) {
      console.error('Ошибка при выполнении команды ticket:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
};