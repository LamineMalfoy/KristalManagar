const { Keyboard } = require('vk-io');
const { getlink } = require('../util.js');

module.exports = {
  command: '/работы',
  aliases: ['/work', '/job', '/jobs'],
  description: 'Меню работ',
  async execute(context) {
    try {
      const { senderId } = context;
      
      // Получаем кликабельное имя пользователя
      const userName = await getlink(senderId);
      
      // Создаем клавиатуру с кнопкой "Шахта"
      const keyboard = Keyboard.builder()
        .callbackButton({
          label: '⛏️ Шахта',
          payload: {
            command: 'work_mine',
            event_id: 9001
          },
          color: Keyboard.POSITIVE_COLOR
        })
        .callbackButton({
          label: '✈️ Лётчик',
          payload: {
            command: 'work_pilot',
            event_id: 9007
          },
          color: Keyboard.PRIMARY_COLOR
        })
        .inline();
      
      const message = `💼 Меню работ`;
      
      await context.send({
        message: message,
        keyboard: keyboard
      });
      
    } catch (error) {
      console.error('Ошибка в команде работы:', error);
      await context.send('❌ Произошла ошибка при загрузке меню работ.');
    }
  }
};
