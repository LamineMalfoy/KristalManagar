const { checkUserRole, checkIfTableExists, getUserRole, getRoleName, getRoleNamezov } = require('./roles.js');
const database = require('../databases.js');
const { vk } = require('../index.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');

module.exports = {
  command: '/warnhistory',
  description: 'Просмотр истории предупреждений пользователя',
  async execute(context) {
    const { peerId, text, replyMessage } = context;
    
    // 1. Сначала проверяем существование таблицы
    if (!await checkIfTableExists(`conference_${peerId}`)) {
      console.error('Таблица не существует');
      return context.send('❌ Беседа не зарегистрирована!');
    }

    // 2. Затем проверяем права доступа
    const senderId = context.senderId;
    const senderRole = await getUserRole(peerId, senderId);
    const hasPermission = await checkCommandPriority(peerId, senderId, '/warnhistory');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/warnhistory'] || 20;
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /warnhistory требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    // 3. Только после проверки прав проверяем параметры
    let target;
    if (replyMessage) {
      target = replyMessage.senderId;
    } else {
      target = text.split(' ')[1];
    }

    if (!target) {
      return context.reply('❌ Укажите пользователя, историю предупреждений которого хотите посмотреть.');
    }

    const targetId = await extractNumericId(target);

    if (!targetId) {
      return context.reply('❌ Укажите корректный идентификатор пользователя.');
    }

    const selectUserInfoQuery = `
      SELECT warns_history
      FROM conference_${peerId}
      WHERE user_id = ?
    `;

    database.query(selectUserInfoQuery, [targetId], async (error, results) => {
      if (error) {
        console.error('Ошибка при запросе истории предупреждений:', error);
        return context.send('❌ Произошла ошибка.');
      }

      if (results.length === 0) {
        return context.reply('❌ Указанный пользователь не имеет истории предупреждений.');
      }

      const { warns_history } = results[0];
      
      // Robust JSON parsing with error handling
      let history;
      try {
        // Check if warns_history exists and is not null/undefined/empty
        if (!warns_history || warns_history.trim() === '') {
          return context.reply('❌ Указанный пользователь не имеет истории предупреждений.');
        }
        
        history = JSON.parse(warns_history);
        
        // Additional validation
        if (!history) {
          return context.reply('❌ Указанный пользователь не имеет истории предупреждений.');
        }
        
      } catch (jsonError) {
        console.error('JSON parsing error in warnhistory:', jsonError);
        console.error('Raw warns_history value:', warns_history);
        return context.reply('❌ Ошибка при чтении истории предупреждений. Данные повреждены.');
      }

      if (!Array.isArray(history) || history.length === 0) {
        return context.reply('❌ Указанный пользователь не имеет истории предупреждений.');
      }

	const formattedHistoryPromises = history.map(async (item, index) => {
	  const { Date: itemDate, Reason, Author } = item;
	  
	  // Robust date handling for both old (localized) and new (ISO) formats
	  let formattedDate;
	  try {
	    const dateObj = new Date(itemDate);
	    if (isNaN(dateObj.getTime())) {
	      // If parsing failed, try to handle old localized format or show raw date
	      formattedDate = itemDate || 'Неизвестная дата';
	    } else {
	      // Successfully parsed - format it nicely
	      formattedDate = dateObj.toLocaleString('ru-RU', {
	        year: 'numeric',
	        month: '2-digit',
	        day: '2-digit',
	        hour: '2-digit',
	        minute: '2-digit'
	      });
	    }
	  } catch (error) {
	    console.error('Error parsing date in warnhistory:', itemDate, error);
	    formattedDate = itemDate || 'Ошибка даты';
	  }
	  
	  const authorLink = await getlink(Author);
	  return `${index + 1}. ${Reason} | Выдал: ${authorLink} (Дата: ${formattedDate})`;
	});

	Promise.all(formattedHistoryPromises)
	  .then(async (formattedHistory) => {
		const targetLink = await getlink(targetId);
		context.reply(`📘 Список предупреждений ${targetLink}:\n\n${formattedHistory.join('\n')}`);
	  })
	  .catch((error) => {
		console.error('Ошибка при форматировании истории:', error);
		context.send('❌ Произошла ошибка при получении истории предупреждений.');
	  });
    });
  },
};
