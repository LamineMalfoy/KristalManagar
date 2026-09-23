const database = require('../databases.js');
const { getUserRole, checkIfTableExists } = require('./roles.js');
const util = require('util');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/setpublic',
  aliases: ['/установитьгруппу'],
  description: 'Установить проверку подписки на паблик',
  async execute(context) {
    const { peerId, senderId, text } = context;
    const conferenceId = peerId;
    const parts = text.split(' ');
    const groupId = parts[1];
    
    // Проверяем, зарегистрирована ли беседа
    if (!await checkIfTableExists(`conference_${conferenceId}`)) {
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }
    
    // Проверяем права пользователя
    const senderUserRole = await getUserRole(conferenceId, senderId);
    if (senderUserRole < 60) {
      return context.send('❌ У вас недостаточно прав для установки проверки подписки на группу. Требуемая роль: Спец. Администратор или выше.');
    }
    
    // Проверяем, указан ли ID группы
    if (!groupId) {
      return context.send('❌ Вы не указали ID группы. Использование: /setpublic [ID группы]');
    }
    
    // Проверяем, является ли ID группы числом
    const numericGroupId = parseInt(groupId);
    if (isNaN(numericGroupId)) {
      return context.send('❌ ID группы должен быть числом.');
    }
    
    try {
      // Проверяем существование группы через VK API
      const groupInfo = await vk.api.groups.getById({ group_id: numericGroupId });
      
      if (!groupInfo || groupInfo.length === 0) {
        return context.send('❌ Группа с указанным ID не найдена.');
      }
      
      const groupName = groupInfo[0].name;
      const groupScreenName = groupInfo[0].screen_name;
      
      // Устанавливаем ID группы в настройках беседы
      const updatePublicQuery = `
        UPDATE conference
        SET public = ?
        WHERE conference_id = ?
      `;
      
      await queryAsync(updatePublicQuery, [`club${numericGroupId}`, conferenceId]);
      
      return context.send(`✅ Установлена проверка подписки на группу: [club${numericGroupId}|${groupName}].\n\nТеперь при вступлении в беседу будет проверяться подписка на данную группу. Если пользователь не подписан, он будет автоматически исключен.`);
    } catch (error) {
      console.error('Ошибка при установке проверки подписки:', error);
      return context.send('❌ Произошла ошибка при установке проверки подписки. Проверьте корректность ID группы.');
    }
  }
}; 