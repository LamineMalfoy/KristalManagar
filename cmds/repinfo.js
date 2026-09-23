const { getUserReputation, getAllUsersWithReputation } = require('../filedb.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/repinfo',
  aliases: ['/репинфо', '/репутация', '/reputation'],
  description: 'Посмотреть репутацию пользователя',
  async execute(context) {
    try {
      const { senderId, text, replyMessage, forwardMessages } = context;
      const args = text.split(' ');
      
      let targetId = senderId; // По умолчанию показываем репутацию отправителя
      
      // Проверяем способы указания пользователя
      if (replyMessage) {
        // Ответ на сообщение
        targetId = replyMessage.senderId;
      } else if (forwardMessages && forwardMessages.length > 0) {
        // Пересланное сообщение
        targetId = forwardMessages[0].senderId;
      } else if (args[1]) {
        // Указан ID или ссылка
        targetId = await extractNumericId(args[1]);
      }
      
      if (!targetId) {
        targetId = senderId;
      }
      
      // Получаем репутацию пользователя
      const reputation = await getUserReputation(targetId);
      
      // Получаем позицию в глобальном топе
      const allUsers = await getAllUsersWithReputation();
      const position = allUsers.findIndex(user => user.userId === targetId) + 1;
      
      // Получаем ссылку на пользователя
      const userLink = await getlink(targetId);
      
      // Формируем сообщение
      let message = `🏆 Репутация пользователя ${userLink}\n\n`;
      message += `📊 Репутация: ${reputation}\n`;
      
      if (position > 0) {
        message += `🥇 Место в топе: #${position}`;
      } else {
        message += `📍 Не в топе (репутация = 0)`;
      }
      
      // Добавляем мотивационное сообщение
      if (reputation === 0) {
        message += `\n\n💡 Начните получать репутацию от других пользователей!`;
      } else if (reputation < 10) {
        message += `\n\n⭐ Неплохое начало! Продолжайте в том же духе!`;
      } else if (reputation < 50) {
        message += `\n\n🌟 Отличная репутация! Вы на правильном пути!`;
      } else {
        message += `\n\n👑 Превосходная репутация! Вы - образец для подражания!`;
      }
      
      return context.send(message);
      
    } catch (error) {
      console.error('Ошибка в команде /repinfo:', error);
      return context.send('❌ Произошла ошибка при получении информации о репутации');
    }
  }
};
