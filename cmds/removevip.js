const { removeUserVipStatus, getUserVipStatus } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/removevip',
  aliases: ['/rvip', '/unvip'],
  description: 'Снятие VIP статуса с пользователя',
  async execute(context) {
    try {
      // Проверка системного уровня доступа (только owner и выше)
      const senderAccess = await checkSysAccess(context.senderId);
      if (senderAccess < 4) {
        return context.reply('⛔ Доступ запрещен | Требуется уровень доступа "Основатель" или выше для снятия VIP статуса');
      }

      // Проверка прав доступа к команде
      const hasAccess = await hasCommandAccess(context.senderId, 'removevip');
      if (!hasAccess) {
        return context.reply('⛔ Доступ запрещен | У вас недостаточно прав для снятия VIP статуса');
      }

      const args = context.text.split(' ');
      const replyMessage = context.replyMessage;
      let userId;

      // Определение целевого пользователя
      if (replyMessage && replyMessage.senderId) {
        userId = Number(replyMessage.senderId);
      } else {
        if (args.length < 2) {
          return context.reply('❌ Ошибка синтаксиса | Используйте:\n/removevip [ID] - снять VIP\n/removevip - ответом на сообщение');
        }
        userId = await extractNumericId(args[1]);
      }

      if (!Number.isFinite(userId) || userId === 0) {
        return context.reply('❌ Ошибка | Некорректный ID пользователя');
      }

      // Проверяем, есть ли VIP статус у пользователя
      const vipData = await getUserVipStatus(userId);

      if (!vipData || !vipData.isVip) {
        const userLink = await getlink(userId);
        return context.reply(`❌ Пользователь ${userLink} не имеет VIP статуса`, { disable_mentions: true });
      }

      // Удаляем VIP статус
      const success = await removeUserVipStatus(userId);
      
      if (!success) {
        return context.reply('❌ Произошла ошибка при снятии VIP статуса');
      }

      // Получение информации о пользователе для уведомления
      const userLink = await getlink(userId);
      
      // Получение информации о снимающем и его роли
      const removedByLink = await getlink(context.senderId);
      const removedByAccess = await checkSysAccess(context.senderId);
      const removedByRole = getAccessLevelName(removedByAccess);

      // Отправка подтверждения
      context.send({
        message: `✅ С пользователя ${userLink} был снят VIP статус\n❓ Снял: ${removedByLink} | ${removedByRole}`,
        disable_mentions: true
      });

      // Уведомление пользователя
      try {
        await vk.api.messages.send({
          peer_id: userId,
          message: `✅ С вас был снят VIP статус\n❓ Снял: ${removedByLink} | ${removedByRole}`,
          disable_mentions: true,
          random_id: Math.floor(Math.random() * 1000000)
        });
      } catch (error) {
        console.error(`Ошибка при отправке уведомления пользователю ${userId}:`, error);
      }
      
    } catch (error) {
      console.error('Ошибка при выполнении команды removevip:', error);
      context.reply('❌ Произошла ошибка при снятии VIP статуса');
    }
  },
};
