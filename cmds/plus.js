const { getUserReputation, updateUserReputation, getAllUsersWithReputation, checkReputationLimit, recordReputationGive } = require('../filedb.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '+',
  aliases: [],
  description: 'Повысить репутацию пользователя (короткий алиас)',
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
        // Указан ID или ссылка после "+"
        targetId = await extractNumericId(args[1]);
      }
      
      if (!targetId) {
        return context.send('❌ Укажите пользователя: ответьте на сообщение, перешлите сообщение или укажите ID/ссылку\n\n💡 Пример: + @username или ответить на сообщение и написать +');
      }
      
      // Проверяем, что пользователь не пытается дать реп самому себе
      if (targetId === senderId) {
        return context.send('❌ Нельзя давать репутацию самому себе!');
      }
      
      // Проверяем, что это не бот
      if (global.botId && Number(targetId) === Number(global.botId)) {
        return context.send('🤖 Спасибо за признание, но мне репутация не нужна! 😊');
      }
      
      // Проверяем лимит выдачи репутации
      const limitCheck = await checkReputationLimit(senderId);
      if (!limitCheck.canGive) {
        const resetTime = limitCheck.resetTime;
        const now = new Date();
        const hoursLeft = Math.ceil((resetTime - now) / (1000 * 60 * 60));
        const minutesLeft = Math.ceil((resetTime - now) / (1000 * 60)) % 60;
        
        let timeText = '';
        if (hoursLeft > 0) {
          timeText = `${hoursLeft} ч.`;
          if (minutesLeft > 0) timeText += ` ${minutesLeft} мин.`;
        } else {
          timeText = `${minutesLeft} мин.`;
        }
        
        return context.send(`⏰ Отказано! Вы уже повышали репутацию двум пользователям.\n\n🕐 Ограничение будет снято через ${timeText}`);
      }
      
      // Получаем текущую репутацию цели
      const currentRep = await getUserReputation(targetId);
      
      // Обновляем репутацию (+1)
      const newRep = await updateUserReputation(targetId, 1, senderId);
      
      if (newRep === null) {
        return context.send('❌ Ошибка при обновлении репутации');
      }
      
      // Записываем выдачу в лимиты
      await recordReputationGive(senderId, targetId);
      
      // Получаем позицию в глобальном топе
      const allUsers = await getAllUsersWithReputation();
      const position = allUsers.findIndex(user => user.userId === targetId) + 1;
      
      // Получаем ссылки на пользователей
      const giverLink = await getlink(senderId);
      const targetLink = await getlink(targetId);
      
      // Формируем красивое сообщение
      const positionText = position > 0 ? `#${position} место в топе` : 'не в топе';
      
      const message = `✅ ${giverLink} повысил репутацию пользователю ${targetLink} на 1
      
🏆 Репутация: ${newRep} (${positionText})`;
      
      return context.send(message);
      
    } catch (error) {
      console.error('Ошибка в команде +:', error);
      return context.send('❌ Произошла ошибка при выдаче репутации');
    }
  }
};
