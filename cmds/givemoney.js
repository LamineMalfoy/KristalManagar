const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC } = require('../filedb');
const { checkSysAccess } = require('./sysadmin.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');

// Форматирование денег в VK-стиле
function formatMoney(amount) {
  if (amount >= 1000000000000) {
    return `${(amount / 1000000000000).toFixed(1).replace('.0', '')}ккк`;
  } else if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  }
  return amount.toString();
}

function parseAmount(amountStr) {
  const str = amountStr.toLowerCase().trim();
  if (str.includes('ккк')) return parseFloat(str.replace('ккк', '')) * 1000000000000;
  if (str.includes('млрд')) return parseFloat(str.replace('млрд', '')) * 1000000000;
  if (str.includes('кк')) return parseFloat(str.replace('кк', '')) * 1000000;
  if (str.includes('к')) return parseFloat(str.replace('к', '')) * 1000;
  return parseFloat(str) || 0;
}

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
  name: "givemoney",
  command: "/givemoney",
  aliases: ["/пополнить", "/выдатьденьги", "/topup"],
  description: "Выдать деньги пользователю (только для агентов поддержки и выше)",

  async execute(context) {
    try {
      const { peerId, senderId, replyMessage } = context;
      const conferenceId = peerId;

      const hasAccess = await hasCommandAccess(senderId, 'givemoney');
      if (!hasAccess) {
        return context.send('❌ У вас недостаточно прав для использования этой команды!\n🔒 Требуется: доступ к команде выдачи денег');
      }

      const args = context.text.split(' ').slice(1);

      let recipientId = null;
      let currency = null;
      let amountArg = null;

      // Режим ответа на сообщение: /givemoney <валюта> <сумма>
      if (replyMessage && replyMessage.senderId) {
        recipientId = replyMessage.senderId.toString();
        if (args.length < 2) {
          return context.send(`❓ Аргументы указаны неверно.

❓ Примеры (ответ на сообщение):
/givemoney RUB 1000
/givemoney BTC 2
/givemoney RUB 5кк`);
        }
        currency = args[0];
        amountArg = args[1];
      } else {
        // Обычный режим: /givemoney <ID> <валюта> <сумма>
        if (args.length < 3) {
          return context.send(`❓ Аргументы указаны неверно.

❓ Примеры:
/givemoney @user RUB 1000
/givemoney @user BTC 2
/givemoney 123456 RUB 5кк
/givemoney — ответом на сообщение: /givemoney RUB 1000`);
        }

        const recipientArg = args[0];
        currency = args[1];
        amountArg = args[2];

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

      if (!recipientId) {
        return context.send('❌ Неверный ID получателя!');
      }

      // Принимаем и rub, и rubles, и rub, и r, и ₽
      currency = currency.toLowerCase();
      if (!['rub', 'ruble', 'rubles', 'r', '₽', 'руб', 'рубли'].includes(currency)) {
        return context.send('❌ Неверная валюта! Используйте: RUB или BTC');
      }

      let amount = 0;
      let isNegative = false;

      if (amountArg.startsWith('-')) {
        isNegative = true;
        amountArg = amountArg.substring(1);
      }

      if (/^\d+[кккмлрд]+$/i.test(amountArg)) {
        amount = parseAmount(amountArg);
      } else if (/^\d+(\.\d+)?$/.test(amountArg)) {
        amount = parseFloat(amountArg);
      } else {
        return context.send('❌ Неверный формат суммы! Используйте числа или VK-формат (1к, 5кк, 10ккк)\n💸 Для списания используйте минус: -145к');
      }

      if (amount <= 0) {
        return context.send('❌ Сумма должна быть больше 0!');
      }

      if (isNegative) amount = -amount;

      const adminName = await getVKName(senderId);
      const recipientName = await getVKName(recipientId);

      // RUB (бывшие dollars)
      if (['rub', 'ruble', 'rubles', 'r', '₽', 'руб', 'рубли'].includes(currency)) {
        const currentBalance = await getUserBalance(parseInt(recipientId));
        const newBalance = currentBalance + amount;
        await updateUserBalance(parseInt(recipientId), newBalance);

        const isDeduction = amount < 0;
        const operation = isDeduction ? 'Списание с баланса' : 'Пополнение баланса';
        const emoji = isDeduction ? '💸' : '💰';
        const action = isDeduction ? 'списано' : 'получил';
        const displayAmount = isDeduction ? formatMoney(-amount) : formatMoney(amount);

        const message = `💙 BLACK KRISTAL — ${operation}

${emoji} ${recipientName} ${action} ${displayAmount}₽ от ${adminName}
💵 Новый баланс: ${formatMoney(newBalance)}₽`;

        return context.send(message);
      }

      // BTC
      if (['btc', 'bitcoin'].includes(currency)) {
        const currentBTC = await getUserBTC(parseInt(recipientId));
        const newBTC = await updateUserBTC(parseInt(recipientId), amount);

        const isDeduction = amount < 0;
        const operation = isDeduction ? 'Списание BTC' : 'Пополнение BTC';
        const emoji = isDeduction ? '💸' : '₿';
        const action = isDeduction ? 'списано' : 'получил';
        const displayAmount = isDeduction ? -amount : amount;

        const message = `💙 BLACK KRISTAL — ${operation}

${emoji} ${recipientName} ${action} ${displayAmount} BTC от ${adminName}
💎 Новый BTC баланс: ${newBTC} BTC`;

        return context.send(message);
      }

    } catch (error) {
      console.error('Ошибка в /givemoney:', error);
      return context.send('❌ Произошла ошибка при выполнении. Попробуйте позже.');
    }
  }
};