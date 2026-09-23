const { getUserBalance, updateUserBalance } = require('../filedb');

// Функция для форматирования денег в VK-стиле
function formatMoney(amount) {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  } else {
    return amount.toString();
  }
}

// Функция для парсинга VK-форматов сумм
function parseAmount(amountStr) {
  const str = amountStr.toLowerCase().trim();
  
  // Парсим VK-форматы
  if (str.includes('ккк')) {
    return parseFloat(str.replace('ккк', '')) * 1000000000000;
  } else if (str.includes('млрд')) {
    return parseFloat(str.replace('млрд', '')) * 1000000000;
  } else if (str.includes('кк')) {
    return parseFloat(str.replace('кк', '')) * 1000000;
  } else if (str.includes('к')) {
    return parseFloat(str.replace('к', '')) * 1000;
  } else {
    return parseFloat(str) || 0;
  }
}

// Функция для получения VK-имени пользователя
async function getVKName(userId) {
  try {
    const vk = require('../vkInstance');
    const userInfo = await vk.api.users.get({
      user_ids: userId,
      fields: 'first_name,last_name'
    });
    if (userInfo && userInfo[0]) {
      const user = userInfo[0];
      return `[id${userId}|${user.first_name} ${user.last_name}]`;
    }
  } catch (error) {
    console.log('Не удалось получить имя пользователя VK:', error.message);
  }
  return `[id${userId}|@id${userId}]`;
}

module.exports = {
  name: "перевод",
  command: "/перевод",
  aliases: ["/transfer", "/send"],
  description: "Перевести деньги другому игроку",
  
  async execute(context) {
    try {
      const senderId = context.senderId;
      const { replyMessage } = context;
      const args = context.text.split(' ').slice(1); // Убираем команду
      
      let recipientId = null;
      let amountArg = null;
      
      // Проверяем, есть ли ответ на сообщение
      if (replyMessage && replyMessage.senderId) {
        // Режим ответа на сообщение: /перевод [сумма]
        recipientId = replyMessage.senderId.toString();
        if (args.length < 1) {
          return context.send(`❌ Неверный формат команды!

📝 Использование (ответ на сообщение):
• /перевод 1000
• /перевод 5к
• /перевод 10кк

💡 Примеры:
• /перевод 1к - перевести 1,000$
• /перевод 5кк - перевести 5,000,000$`);
        }
        amountArg = args[0];
      } else {
        // Обычный режим: /перевод [ID] [сумма]
        if (args.length < 2) {
          return context.send(`❌ Неверный формат команды!

📝 Использование:
• /перевод @id123456 1000
• /перевод [id123456|Имя] 5к
• /перевод https://vk.com/id123456 10кк

💡 Примеры:
• /перевод @id123456 1к - перевести 1,000$
• /перевод [id123456|Иван] 5кк - перевести 5,000,000$

🔄 Или ответьте на сообщение: /перевод [сумма]`);
        }
        
        // Парсим получателя из аргументов
        const recipientArg = args[0];
        amountArg = args[1];
        
        // Различные форматы ID получателя
        if (recipientArg.startsWith('@id')) {
          recipientId = recipientArg.replace('@id', '');
        } else if (recipientArg.startsWith('[id') && recipientArg.includes('|')) {
          const match = recipientArg.match(/\[id(\d+)\|/);
          if (match) recipientId = match[1];
        } else if (recipientArg.includes('vk.com/id')) {
          const match = recipientArg.match(/vk\.com\/id(\d+)/);
          if (match) recipientId = match[1];
        } else if (/^\d+$/.test(recipientArg)) {
          recipientId = recipientArg;
        }
      }
      
      if (!recipientId || recipientId === senderId.toString()) {
        return context.send('❌ Неверный ID получателя или попытка перевести самому себе!');
      }
      
      // Парсим сумму
      let amount = 0;
      
      // Проверяем VK-формат или обычное число
      if (/^\d+[кккмлрд]+$/i.test(amountArg)) {
        amount = parseAmount(amountArg);
      } else if (/^\d+$/.test(amountArg)) {
        amount = parseInt(amountArg);
      } else {
        return context.send('❌ Неверный формат суммы! Используйте числа или VK-формат (1к, 5кк, 10ккк)');
      }
      
      if (amount <= 0) {
        return context.send('❌ Сумма перевода должна быть больше 0!');
      }
      
      if (amount < 100) {
        return context.send('❌ Минимальная сумма перевода: 100$');
      }
      
      // Проверяем баланс отправителя
      const senderBalance = await getUserBalance(senderId);
      if (senderBalance < amount) {
        return context.send(`❌ Недостаточно средств для перевода!
💰 Ваш баланс: ${formatMoney(senderBalance)}$
💸 Требуется: ${formatMoney(amount)}$`);
      }
      
      // Получаем баланс получателя (создаем если не существует)
      const recipientBalance = await getUserBalance(parseInt(recipientId));
      
      // Выполняем перевод
      const newSenderBalance = senderBalance - amount;
      const newRecipientBalance = recipientBalance + amount;
      
      await updateUserBalance(senderId, newSenderBalance);
      await updateUserBalance(parseInt(recipientId), newRecipientBalance);
      
      // Получаем красивые имена для отображения
      const senderName = await getVKName(senderId);
      const recipientName = await getVKName(recipientId);
      
      // Красивое сообщение о переводе в стиле VK
      const message = `💸 ${senderName} перевел ${recipientName} — ${formatMoney(amount)}$

💵 Новые балансы:
• ${senderName}: ${formatMoney(newSenderBalance)}$
• ${recipientName}: ${formatMoney(newRecipientBalance)}$`;
      
      return context.send(message);
      
    } catch (error) {
      console.error('Ошибка в команде перевода:', error);
      return context.send('❌ Произошла ошибка при выполнении перевода. Попробуйте позже.');
    }
  }
};
