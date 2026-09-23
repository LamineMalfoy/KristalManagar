const database = require('../databases.js');
const { checkUserRole, checkIfTableExists } = require('../util.js');

module.exports = {
  command: '/nlist',
  aliases: ['/nlist'],
  description: 'Отображение списка никнеймов',
  async execute(context) {
    const conferenceId = context.peerId;

    if (!await checkIfTableExists(`nicknames_${conferenceId}`)) {
      console.error('Таблица никнеймов не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    const selectNicknamesQuery = `
      SELECT user_id, nickname FROM nicknames_${conferenceId}
    `;

    database.query(selectNicknamesQuery, async (error, results) => {
      if (error) {
        console.error('Ошибка при выводе списка никнеймов:', error);
        return context.send('❌ Ошибка системы | Не удалось получить список никнеймов');
      }

      if (results.length === 0) {
        return context.send('📋 Список никнеймов пуст | В беседе нет пользователей с установленными никами');
      }

      const userIds = results.map(nickInfo => nickInfo.user_id);

      try {
        const userInfos = await vk.api.users.get({ user_ids: userIds });
		
		console.log(userInfos)
		
        const userMap = userInfos.reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {});

        let message = '';
        message += `👥 Список пользователей с никами:\n\n`;
        for (let i = 0; i < results.length; i++) {
          const nickInfo = results[i];
          const userInfo = userMap[nickInfo.user_id];
          if (userInfo) {
            message += `${i + 1}. [id${userInfo.id}|${userInfo.first_name} ${userInfo.last_name}] - ${nickInfo.nickname}\n`;
          }
        }
        context.reply(message);
      } catch (error) {
        console.error('Ошибка при получении информации о пользователях:', error);
        return context.send('❌ Ошибка системы | Не удалось получить информацию о пользователях');
      }
    });
  },
};
