const { getUserReputation, updateUserReputation, getAllUsersWithReputation, checkReputationTakeLimit, recordReputationTake } = require('../filedb.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '-реп',
  aliases: ['-rep', '/unrep', '/минусреп'],
  description: 'Понизить репутацию пользователя',
  async execute(context) {
    try {
      const { senderId, text, replyMessage, forwardMessages } = context;
      const args = text.split(' ');
      
      let targetId = null;
      
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
        return context.send('❌ Укажите пользователя: ответьте на сообщение, перешлите сообщение или укажите ID/ссылку');
      }
      
      // Проверяем, что пользователь не пытается снять реп самому себе
      if (targetId === senderId) {
        return context.send('❌ Нельзя снимать репутацию самому себе!');
      }
      
      // Проверяем, что это не бот
      if (global.botId && Number(targetId) === Number(global.botId)) {
        return context.send('🤖 У меня и так репутация на нуле! 😅');
      }
      
      // Проверяем лимит снятия репутации (1 раз в 24 часа)
      const limitCheck = await checkReputationTakeLimit(senderId);
      if (!limitCheck.canTake) {
        const resetTime = limitCheck.resetTime;
        const now = new Date();
        const hoursLeft = Math.ceil((resetTime - now) / (1000 * 60 * 60));
        
        let timeText = '';
        if (hoursLeft > 1) {
          timeText = `${hoursLeft} часов`;
        } else if (hoursLeft === 1) {
          timeText = '1 час';
        } else {
          const minutesLeft = Math.ceil((resetTime - now) / (1000 * 60));
          timeText = `${minutesLeft} минут`;
        }
        
        return context.send(`⏰ Отказано! Вы уже понижали репутацию в последние 24 часа.\n\n🕐 Ограничение будет снято через ${timeText}`);
      }
      
      // Получаем текущую репутацию цели
      const currentRep = await getUserReputation(targetId);
      
      // Обновляем репутацию (-1)
      const newRep = await updateUserReputation(targetId, -1, senderId);
      
      if (newRep === null) {
        return context.send('❌ Ошибка при обновлении репутации');
      }
      
      // Записываем снятие в лимиты
      await recordReputationTake(senderId, targetId);
      
      // Получаем позицию в глобальном топе
      const allUsers = await getAllUsersWithReputation();
      const position = allUsers.findIndex(user => user.userId === targetId) + 1;
      
      // Получаем ссылки на пользователей
      const giverLink = await getlink(senderId);
      const targetLink = await getlink(targetId);
      
      // Формируем красивое сообщение
      const positionText = position > 0 ? `#${position} место в топе` : 'не в топе';
      
      const message = `⬇️ ${giverLink} понизил репутацию пользователю ${targetLink} на 1
      
🏆 Репутация: ${newRep} (${positionText})`;
      
      return context.send(message);
      
    } catch (error) {
      console.error('Ошибка в команде -реп:', error);
      return context.send('❌ Произошла ошибка при снятии репутации');
    }
  }
};
