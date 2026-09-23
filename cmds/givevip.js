const { setUserVipStatus, getUserVipStatus } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/givevip',
  aliases: ['/gvip'],
  description: 'Выдача VIP статуса пользователю',
  async execute(context) {
    try {
      // Проверка системного уровня доступа (только owner и выше)
      const senderAccess = await checkSysAccess(context.senderId);
      if (senderAccess < 4) {
        return context.reply('⛔ Доступ запрещен | Требуется уровень доступа "Основатель" или выше для выдачи VIP статуса');
      }

      // Проверка прав доступа к команде
      const hasAccess = await hasCommandAccess(context.senderId, 'givevip');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для выдачи VIP статуса');
      }

      const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;
      let duration = '30d'; // По умолчанию 30 дней

      // Определение целевого пользователя
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
        // Длительность из аргументов при ответе на сообщение
        if (args.length >= 2) {
          duration = args[1];
        }
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте:\n/givevip [ID] [время] - выдать VIP\n/givevip [время] - ответом на сообщение\n\nВремя: 1d, 7d, 30d, 365d или permanent');
        }
        userId = await extractNumericId(args[1]);
        if (args.length >= 3) {
          duration = args[2];
        }
      }

      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный ID пользователя');
      }

      // Проверка защиты от самовыдачи (можно убрать если нужно)
      if (global.botId && Number(userId) === Number(global.botId)) {
        return context.reply('🤖 Нельзя выдать VIP статус боту!');
      }

      // Парсинг времени
      let expiryDate = null;
      if (duration.toLowerCase() !== 'permanent' && duration.toLowerCase() !== 'perm' && duration.toLowerCase() !== 'навсегда') {
        const timeMatch = duration.match(/^(\d+)([dhmy])$/i);
        if (!timeMatch) {
          return context.reply('❌ Ошибка формата времени | Используйте: 1d (день), 7d (дни), 30d (дни), 365d (год) или permanent');
        }

        const amount = parseInt(timeMatch[1]);
        const unit = timeMatch[2].toLowerCase();
        
        const now = new Date();
        switch (unit) {
          case 'd':
            expiryDate = new Date(now.getTime() + amount * 24 * 60 * 60 * 1000);
            break;
          case 'h':
            expiryDate = new Date(now.getTime() + amount * 60 * 60 * 1000);
            break;
          case 'm':
            expiryDate = new Date(now.getTime() + amount * 30 * 24 * 60 * 60 * 1000); // месяцы
            break;
          case 'y':
            expiryDate = new Date(now.getTime() + amount * 365 * 24 * 60 * 60 * 1000); // годы
            break;
          default:
            return context.reply('❌ Неподдерживаемая единица времени | Используйте: d (дни), h (часы), m (месяцы), y (годы)');
        }
      }

      // Проверяем, есть ли уже VIP статус у пользователя
      const existingVip = await getUserVipStatus(userId);

      // Устанавливаем VIP статус (обновляет существующий или создает новый)
      const success = await setUserVipStatus(
        userId,
        expiryDate,
        context.senderId,
        expiryDate === null
      );

      if (!success) {
        return context.reply('❌ Произошла ошибка при установке VIP статуса');
      }

      // Получение информации о пользователе для уведомления
      const userLink = await getlink(userId);
      
      // Формирование сообщения о времени
      let timeText;
      if (expiryDate === null) {
        timeText = 'навсегда';
      } else {
        const options = {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Moscow'
        };
        timeText = `до ${expiryDate.toLocaleDateString('ru-RU', options)}`;
      }

      // Получение информации о выдавшем и его роли
      const grantedByLink = await getlink(context.senderId);
      const grantedByAccess = await checkSysAccess(context.senderId);
      const grantedByRole = getAccessLevelName(grantedByAccess);

      // Отправка подтверждения
      context.send({
        message: `✅ Пользователю ${userLink} был выдан VIP статус\n⏰ Действовать он будет ${timeText}\n❓ Выдал: ${grantedByLink} | ${grantedByRole}`,
        disable_mentions: true
      });

      // Уведомление пользователя
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ Вам был выдан VIP статус\n⏰ Действовать он будет ${timeText}\n❓ Выдал: ${grantedByLink} | ${grantedByRole}`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
      
    } catch (error) {
      console.error('Ошибка при выполнении команды givevip:', error);
      context.reply('❌ Произошла ошибка при выдаче VIP статуса');
    }
  },
};
