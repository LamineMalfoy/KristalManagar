const database = require('../databases.js');
const { getUserRole } = require('../cmds/roles.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);
const logger = require('../logger.js');

/**
 * Middleware для проверки обязательных подписок на сообщества
 * @param {Object} context - Контекст сообщения от VK
 * @returns {Promise<boolean>} - true если проверка пройдена, false если нужно заблокировать сообщение
 */
async function checkGroupSubscription(context) {
  try {
    // Проверяем только для сообщений в беседах от реальных пользователей
    if (!context.peerId || context.peerId < 2000000000 || context.senderId <= 0) {
      return true;
    }
    
    // Пропускаем, если это команда (начинается с /)
    if (context.text && context.text.startsWith('/')) {
      return true;
    }
    
    // Получаем роль пользователя
    const userRole = await getUserRole(context.peerId, context.senderId);
    
    // Не проверяем модераторов и выше (роль 20+)
    if (userRole >= 20) {
      return true;
    }
    
    // Получаем список обязательных подписок для этого чата из файла конференции
    const query = `SELECT * FROM conference_${context.peerId} WHERE conference_id = ? LIMIT 1`;
    const result = await queryAsync(query, [context.peerId]);
    
    let requiredGroups = [];
    if (result.length > 0 && result[0].required_groups) {
      try {
        requiredGroups = JSON.parse(result[0].required_groups);
      } catch (e) {
        logger.error('Ошибка парсинга required_groups:', e);
        return true; // Если ошибка парсинга, пропускаем проверку
      }
    }
    
    // Если нет обязательных подписок, пропускаем
    if (!requiredGroups || requiredGroups.length === 0) {
      return true;
    }
    
    // Проверяем подписки пользователя на каждую группу
    const unsubscribedGroups = [];
    
    for (const groupId of requiredGroups) {
      try {
        const isMember = await global.vk.api.groups.isMember({
          group_id: groupId,
          user_id: context.senderId
        });
        
        if (isMember === 0) {
          // Получаем информацию о группе
          try {
            const groupInfo = await global.vk.api.groups.getById({ group_id: groupId });
            // VK API возвращает объект с полем groups
            const groups = groupInfo.groups || groupInfo;
            const groupName = groups && groups[0] ? groups[0].name : `Группа ${groupId}`;
            unsubscribedGroups.push({
              id: groupId,
              name: groupName
            });
          } catch (e) {
            // Если не удалось получить информацию о группе, добавляем без названия
            unsubscribedGroups.push({
              id: groupId,
              name: `Группа ${groupId}`
            });
          }
        }
      } catch (error) {
        logger.error(`Ошибка проверки подписки на группу ${groupId}:`, error);
        // При ошибке проверки считаем, что пользователь не подписан
        unsubscribedGroups.push({
          id: groupId,
          name: `Группа ${groupId}`
        });
      }
    }
    
    // Если пользователь не подписан на какие-то группы
    if (unsubscribedGroups.length > 0) {
      // Формируем сообщение с группами
      const userInfo = await global.vk.api.users.get({ user_ids: [context.senderId] });
      const userName = userInfo && userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'пользователь';
      
      let message = `⛔ [id${context.senderId}|${userName}], подпишитесь на все эти группы для того, чтобы писать в беседе:\n\n`;
      
      for (const group of unsubscribedGroups) {
        message += `➖ [club${group.id}|${group.name}]\n`;
      }
      
      message += `\n🔱 После подписки можете писать сообщения в беседе!`;
      
      // Удаляем сообщение пользователя
      try {
        await global.vk.api.messages.delete({
          delete_for_all: 1,
          peer_id: context.peerId,
          cmids: context.conversationMessageId
        });
      } catch (deleteError) {
        logger.error('Ошибка при удалении сообщения:', deleteError);
      }
      
      // Отправляем предупреждение
      try {
        await context.send(message);
      } catch (sendError) {
        logger.error('Ошибка при отправке предупреждения:', sendError);
      }
      
      logger.log(`[GROUP CHECK] Заблокировано сообщение от ${context.senderId} в чате ${context.peerId} (нет подписок на ${unsubscribedGroups.length} групп)`);
      
      return false; // Блокируем дальнейшую обработку
    }
    
    return true; // Все проверки пройдены
    
  } catch (error) {
    logger.error('Ошибка в checkGroupSubscription:', error);
    return true; // При ошибке пропускаем проверку
  }
}

module.exports = { checkGroupSubscription };
