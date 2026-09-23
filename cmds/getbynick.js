const { getUserRole, getRoleName } = require('./roles.js');
const { vk } = require('../index.js');
const filedb = require('../filedb.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/getbynick',
  aliases: ['/getbynick'],
  description: 'Поиск пользователя по нику',
  async execute(context) {
    const messageText = context.text;
    const parts = messageText.split(' ');
    const searchTerm = parts.slice(1).join(' '); // Поддерживаем поиск по фразам с пробелами
    const { peerId, senderId } = context;
    
    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/getbynick');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/getbynick'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /getbynick требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    if (!searchTerm) {
      return context.reply('❓ Укажите часть никнейма для поиска.\n\n❓ Пример использования:\n/getbynick Руководитель');
    }

    // Используем filedb через SQL-запросы
    const util = require('util');
    const queryAsync = util.promisify(filedb.query);
    
    try {
      // Получаем все никнеймы из таблицы nicknames
      const selectQuery = `SELECT user_id, nickname FROM nicknames_${peerId}`;
      const allNicknames = await queryAsync(selectQuery, []);
      
      if (!allNicknames || allNicknames.length === 0) {
        return context.reply('❌ В этой беседе нет установленных никнеймов.');
      }

      // Ищем пользователей с никнеймами, содержащими искомую фразу
      const matchingUsers = [];
      const searchTermLower = searchTerm.toLowerCase();
      
      for (const row of allNicknames) {
        const { user_id: userId, nickname } = row;
        if (nickname && nickname.toLowerCase().includes(searchTermLower)) {
          try {
            // Получаем информацию о пользователе из VK API
            const userInfo = await vk.api.users.get({ user_ids: userId });
            const userName = userInfo && userInfo[0] 
              ? `${userInfo[0].first_name} ${userInfo[0].last_name}`
              : 'Пользователь';
            
            matchingUsers.push({
              userId: userId,
              nickname: nickname,
              userName: userName
            });
          } catch (error) {
            console.error(`Ошибка при получении информации о пользователе ${userId}:`, error);
            // Добавляем пользователя даже если не удалось получить его имя
            matchingUsers.push({
              userId: userId,
              nickname: nickname,
              userName: 'Пользователь'
            });
          }
        }
      }

      if (matchingUsers.length > 0) {
        // Сортируем по никнейму для удобства
        matchingUsers.sort((a, b) => a.nickname.localeCompare(b.nickname));
        
        const userList = matchingUsers.map((user, index) =>
          `${index + 1}. [id${user.userId}|${user.userName}] — «${user.nickname}»`
        );

        const message = `⭐ Найдено ${matchingUsers.length} пользователей с никнеймом, содержащим «${searchTerm}»:\n\n${userList.join('\n')}`;
        
        context.reply({ 
          message: message, 
          disable_mentions: true 
        });
      } else {
        context.reply(`❌ Пользователи с никнеймом, содержащим «${searchTerm}», не найдены.`);
      }
      
    } catch (error) {
      console.error('Ошибка при поиске никнеймов:', error);
      context.reply('❌ Произошла ошибка при поиске никнеймов.');
    }
  },
};
