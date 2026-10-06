const vk = require('../vkInstance.js');

module.exports = {
  command: '/id',
  description: 'Показать ваш VK и ID',
  aliases: ['/мойid'],

  async execute(context) {
    try {
      const userId = context.senderId;

      let userName = `[id${userId}|Пользователь]`;
      try {
        const users = await vk.api.users.get({ user_ids: [userId] });
        if (users && users[0]) {
          userName = `[id${userId}|${users[0].first_name} ${users[0].last_name}]`;
        }
      } catch (e) {}

      const msg =
        `📣 Ваш VK: ${userName}\n` +
        `🆔 Ваш ID: ${userId}`;

      return context.send(msg);

    } catch (e) {
      console.error('Ошибка в /id:', e);
      return context.send('❌ Ошибка');
    }
  }
};