const database = require('../databases.js');
const { getUserRole, checkIfTableExists } = require('./roles.js');
const util = require('util');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/removepublic',
  aliases: ['/удалитьгруппу'],
  description: 'Удалить проверку подписки на паблик',
  async execute(context) {
    const { peerId, senderId } = context;
    const conferenceId = peerId;
    
    // Проверяем, зарегистрирована ли беседа
    if (!await checkIfTableExists(`conference_${conferenceId}`)) {
      return context.send('❌ Ваша беседа не зарегистрирована!');
    }
    
    // Проверяем права пользователя
    const senderUserRole = await getUserRole(conferenceId, senderId);
    if (senderUserRole < 60) {
      return context.send('❌ У вас недостаточно прав для удаления проверки подписки на группу. Требуемая роль: Спец. Администратор или выше.');
    }
    
    try {
      // Проверяем, установлена ли проверка на группу
      const getPublicQuery = `
        SELECT public
        FROM conference
        WHERE conference_id = ?
      `;
      
      const results = await queryAsync(getPublicQuery, [conferenceId]);
      
      if (!results || results.length === 0 || !results[0].public) {
        return context.send('❌ В этой беседе не установлена проверка подписки на группу.');
      }
      
      // Удаляем проверку на группу
      const updatePublicQuery = `
        UPDATE conference
        SET public = NULL
        WHERE conference_id = ?
      `;
      
      await queryAsync(updatePublicQuery, [conferenceId]);
      
      return context.send('✅ Проверка подписки на группу успешно удалена.\n\nТеперь при вступлении в беседу не будет проверяться подписка на группу.');
    } catch (error) {
      console.error('Ошибка при удалении проверки подписки:', error);
      return context.send('❌ Произошла ошибка при удалении проверки подписки.');
    }
  }
}; 