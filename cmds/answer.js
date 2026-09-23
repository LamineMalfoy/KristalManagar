const database = require('../databases.js');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);

module.exports = {
  command: '/answer',
  description: 'Ответ на тикет в системе поддержки',
  async execute(context) {
    try {
      // Проверяем права доступа
      const hasAccess = await hasCommandAccess(context.senderId, 'answer');
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('answer'));
      }

      // Парсим аргументы
      const args = context.text.split(' ');
      if (args.length < 3) {
        return context.reply('❌ Ошибка синтаксиса | Используйте: /answer [ID тикета] [ответ]');
      }

      // Получаем ID тикета и ответ
      const ticketId = parseInt(args[1]);
      if (isNaN(ticketId)) {
        return context.reply('❌ Ошибка | Некорректный ID тикета');
      }

      const answer = args.slice(2).join(' ');

      // Получаем информацию о тикете
      const ticketQuery = 'SELECT * FROM tickets WHERE id = ?';
      const tickets = await databaseQuery(ticketQuery, [ticketId]);
      
      if (!tickets || tickets.length === 0) {
        return context.reply('❌ Ошибка | Тикет с указанным ID не найден');
      }

      const ticket = tickets[0];

      // Проверяем, что тикет не закрыт
      if (ticket.status) {
        return context.reply('❌ Ошибка | Этот тикет уже закрыт');
      }

      // Получаем информацию о пользователе, создавшем тикет
      let userInfo;
      try {
        userInfo = await vk.api.users.get({ user_ids: ticket.userid });
      } catch (error) {
        console.error('Ошибка при получении информации о пользователе:', error);
        userInfo = [{ first_name: 'Пользователь', last_name: ticket.userid }];
      }

      // Получаем информацию об администраторе
      let adminInfo;
      try {
        adminInfo = await vk.api.users.get({ user_ids: context.senderId });
      } catch (error) {
        console.error('Ошибка при получении информации об администраторе:', error);
        adminInfo = [{ first_name: 'Администратор', last_name: context.senderId }];
      }

      // Получаем текущее время
      const now = new Date();
      const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
      const day = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${day} ${month} ${year} г., ${hours}:${minutes} МСК`;

      // Отправляем ответ в peer_id тикета (в беседу, откуда был репорт)
      const responseMessage = `🛠 Тикет #${ticketId} обработан\n\n` +
                             `👤 Ответ отправлен пользователю: [id${ticket.userid}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n` +
                             `📨 Содержимое: ${answer}\n` +
                             `📅 Время отправки: ${formattedTime}`;

      let sent = false;
      // Пробуем отправить в беседу (peer_id)
      if (ticket.peer_id) {
        try {
          await vk.api.messages.send({
            peer_id: ticket.peer_id,
            message: responseMessage,
            disable_mentions: true,
            random_id: Math.floor(Math.random() * 1000000)
          });
          sent = true;
        } catch (error) {
          console.error(`Ошибка при отправке ответа в беседу ${ticket.peer_id}:`, error);
        }
      }
      // Если не получилось — пробуем в личку
      if (!sent) {
        try {
          await vk.api.messages.send({
            peer_id: ticket.userid,
            message: responseMessage,
            disable_mentions: true,
            random_id: Math.floor(Math.random() * 1000000)
          });
        } catch (error) {
          console.error(`Ошибка при отправке ответа пользователю ${ticket.userid}:`, error);
          return context.reply('❌ Ошибка | Не удалось отправить ответ пользователю');
        }
      }

      // Закрываем тикет и сохраняем информацию о рассмотрении
      const updateQuery = 'UPDATE tickets SET status = ?, closed_by = ?, answer_text = ?, closed_at = NOW() WHERE id = ?';
      await databaseQuery(updateQuery, [true, context.senderId, answer, ticketId]);

      // Получаем текущее время для подтверждения
      const confirmNow = new Date();
      const confirmDay = confirmNow.getDate();
      const confirmMonth = months[confirmNow.getMonth()];
      const confirmYear = confirmNow.getFullYear();
      const confirmHours = confirmNow.getHours();
      const confirmMinutes = confirmNow.getMinutes().toString().padStart(2, '0');
      const confirmTime = `${confirmDay} ${confirmMonth} ${confirmYear} г., ${confirmHours}:${confirmMinutes} МСК`;

      // Отправляем подтверждение администратору
      context.reply(`🛠 Тикет #${ticketId} обработан\n\n` +
                   `👤 Ответ отправлен пользователю: [id${ticket.userid}|${userInfo[0].first_name} ${userInfo[0].last_name}]\n` +
                   `📨 Содержимое: ${answer}\n` +
                   `📅 Время отправки: ${confirmTime}`);

    } catch (error) {
      console.error('Ошибка при выполнении команды answer:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
};



