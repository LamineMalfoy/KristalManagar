const database = require('../databases.js');
const { getUserRole, checkIfTableExists } = require('./roles.js');
const util = require('util');

const queryAsync = util.promisify(database.query).bind(database);

module.exports = {
  command: '/checkpublic',
  aliases: ['/проверитьподписку'],
  description: 'Запустить проверку подписки на паблик',
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
      return context.send('❌ У вас недостаточно прав для проверки подписки на группу. Требуемая роль: Спец. Администратор или выше.');
    }
    
    try {
      // Получаем ID группы из настроек беседы
      const getPublicQuery = `
        SELECT public
        FROM conference
        WHERE conference_id = ?
      `;
      
      const results = await queryAsync(getPublicQuery, [conferenceId]);
      
      if (!results || results.length === 0 || !results[0].public) {
        return context.send('❌ В этой беседе не установлена проверка подписки на группу. Используйте команду /setpublic [ID группы] для установки.');
      }
      
      // Получаем ID группы
      const groupLink = results[0].public;
      const groupId = parseInt(groupLink.substring(groupLink.lastIndexOf("club") + 4), 10);
      
      if (isNaN(groupId)) {
        return context.send('❌ Ошибка при определении ID группы. Пожалуйста, переустановите группу с помощью команды /setpublic [ID группы].');
      }
      
      // Получаем список участников беседы
      const statusMessage = await context.send('⏳ Идет проверка подписки всех участников на группу...');
      
      const conversationMembers = await vk.api.messages.getConversationMembers({
        peer_id: conferenceId,
      });
      
      if (!conversationMembers || !conversationMembers.items) {
        return context.send('❌ Не удалось получить список участников беседы.');
      }
      
      // Исключаем ботов и администраторов
      const memberIds = conversationMembers.items
        .filter(item => item.member_id > 0 && item.member_id !== senderId && !item.is_admin)
        .map(item => item.member_id);
      
      if (memberIds.length === 0) {
        return context.send('✅ В беседе нет обычных пользователей для проверки.');
      }
      
      // Проверяем подписку каждого участника и формируем список не подписанных
      let notSubscribed = [];
      let kickedCount = 0;
      
      for (const memberId of memberIds) {
        try {
          const isMember = await vk.api.groups.isMember({
            group_id: groupId,
            user_id: memberId
          });
          
          if (!isMember) {
            notSubscribed.push(memberId);
            
            // Исключаем пользователя
            try {
              await vk.api.messages.removeChatUser({
                chat_id: conferenceId - 2000000000,
                member_id: memberId
              });
              kickedCount++;
            } catch (kickError) {
              console.error(`Ошибка при исключении пользователя ${memberId}:`, kickError);
            }
          }
        } catch (error) {
          console.error(`Ошибка при проверке подписки пользователя ${memberId}:`, error);
        }
      }
      
      // Формируем сообщение о результатах проверки
      if (notSubscribed.length === 0) {
        return context.send('✅ Все участники беседы подписаны на группу.');
      } else {
        const notSubscribedText = notSubscribed.map(id => `[id${id}|Пользователь]`).join(', ');
        return context.send(`⚠️ Проверка завершена!\n\nНе подписаны на группу: ${notSubscribedText}\n\nИсключено пользователей: ${kickedCount}`);
      }
      
    } catch (error) {
      console.error('Ошибка при проверке подписки:', error);
      return context.send('❌ Произошла ошибка при проверке подписки на группу.');
    }
  }
}; 