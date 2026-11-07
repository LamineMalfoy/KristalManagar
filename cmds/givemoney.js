const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC } = require('../filedb');
const { hasCommandAccess } = require('../utils/commandAccess.js');

// ── Блокировка по получателю, чтобы параллельные выдаче не ломали баланс ──
const locks = new Map();

async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise(r => { release = r; });
  locks.set(key, prev.then(() => current));
  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000000000) return `${sign}${(abs / 1000000000000).toFixed(1).replace('.0', '')}ккк`;
  if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1).replace('.0', '')}кк`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace('.0', '')}к`;
  return n.toString();
}

function parseAmount(amountStr) {
  const s = String(amountStr).toLowerCase().trim();
  if (s.includes('ккк')) return Math.round(parseFloat(s.replace('ккк', '')) * 1e12);
  if (s.includes('млрд')) return Math.round(parseFloat(s.replace('млрд', '')) * 1e9);
  if (s.includes('кк')) return Math.round(parseFloat(s.replace('кк', '')) * 1e6);
  if (s.includes('к')) return Math.round(parseFloat(s.replace('к', '')) * 1e3);
  return Math.round(parseFloat(s)) || 0;
}

async function getVKName(userId) {
  try {
    const vk = require('../vkInstance');
    const userInfo = await vk.api.users.get({ user_ids: userId, fields: 'first_name,last_name' });
    if (userInfo && userInfo[0]) {
      return `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
    }
  } catch (error) {
    console.log('Не удалось получить имя VK:', error.message);
  }
  return `[id${userId}|@id${userId}]`;
}

function extractRecipientId(arg) {
  if (!arg) return null;
  if (arg.startsWith('@id')) {
    const m = arg.match(/@id(\d+)/);
    return m ? m[1] : null;
  }
  if (arg.startsWith('[id') && arg.includes('|')) {
    const m = arg.match(/\[id(\d+)\|/);
    return m ? m[1] : null;
  }
  if (arg.includes('vk.com/id')) {
    const m = arg.match(/vk\.com\/id(\d+)/);
    return m ? m[1] : null;
  }
  if (/^\d+$/.test(arg)) return arg;
  return null;
}

module.exports = {
  name: "givemoney",
  command: "/givemoney",
  aliases: ["/пополнить", "/выдатьденьги", "/topup"],
  description: "Выдать деньги пользователю (только для агентов поддержки и выше)",

  async execute(context) {
    try {
      const { senderId, replyMessage } = context;

      const hasAccess = await hasCommandAccess(senderId, 'givemoney');
      if (!hasAccess) {
        return context.send('❌ У вас недостаточно прав для использования этой команды!\n🔒 Требуется: доступ к команде выдачи денег');
      }

      const args = (context.text || '').split(/\s+/).slice(1).filter(Boolean);

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
        recipientId = extractRecipientId(args[0]);
        currency = args[1];
        amountArg = args[2];
      }

      if (!recipientId) {
        return context.send('❌ Неверный ID получателя!');
      }

      const recipientIdNum = Number(recipientId);
      if (!Number.isFinite(recipientIdNum) || recipientIdNum <= 0) {
        return context.send('❌ Неверный ID получателя!');
      }

      // ── Валюта ──
      currency = String(currency).toLowerCase();
      const isRub = ['rub', 'ruble', 'rubles', 'r', '₽', 'руб', 'рубли'].includes(currency);
      const isBtc = ['btc', 'bitcoin'].includes(currency);

      if (!isRub && !isBtc) {
        return context.send('❌ Неверная валюта! Используйте: RUB или BTC');
      }

      // ── Сумма ──
      let isNegative = false;
      if (amountArg.startsWith('-')) {
        isNegative = true;
        amountArg = amountArg.substring(1);
      }

      let amount;
      if (/^\d+(\.\d+)?(ккк|млрд|кк|к)$/i.test(amountArg)) {
        amount = parseAmount(amountArg);
      } else if (/^\d+(\.\d+)?$/.test(amountArg)) {
        amount = isBtc ? parseFloat(amountArg) : Math.round(parseFloat(amountArg));
      } else {
        return context.send('❌ Неверный формат суммы! Используйте числа или VK-формат (1к, 5кк, 10ккк)\n💸 Для списания используйте минус: -145к');
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return context.send('❌ Сумма должна быть больше 0!');
      }

      // Для рублей сумма всегда целая
      if (isRub) amount = Math.round(amount);
      if (isNegative) amount = -amount;

      const adminName = await getVKName(senderId);
      const recipientName = await getVKName(recipientIdNum);

      // ── RUB ──
      if (isRub) {
        return await withLock(`rub:${recipientIdNum}`, async () => {
          const currentBalance = Number(await getUserBalance(recipientIdNum)) || 0;
          const newBalance = currentBalance + amount;

          if (newBalance < 0) {
            return context.send(`❌ Недостаточно средств у получателя для списания\n💵 Баланс: ${formatMoney(currentBalance)}₽\n💸 Списать: ${formatMoney(-amount)}₽`);
          }

          await updateUserBalance(recipientIdNum, newBalance);

          const isDeduction = amount < 0;
          const operation = isDeduction ? 'Списание с баланса' : 'Пополнение баланса';
          const emoji = isDeduction ? '💸' : '💰';
          const action = isDeduction ? 'списано' : 'получил';
          const displayAmount = formatMoney(Math.abs(amount));

          return context.send(`💙 BLACK KRISTAL — ${operation}

${emoji} ${recipientName} ${action} ${displayAmount}₽ от ${adminName}
💵 Новый баланс: ${formatMoney(newBalance)}₽`);
        });
      }

      // ── BTC ──
      if (isBtc) {
        return await withLock(`btc:${recipientIdNum}`, async () => {
          const currentBTC = Number(await getUserBTC(recipientIdNum)) || 0;

          if (currentBTC + amount < 0) {
            return context.send(`❌ Недостаточно BTC у получателя для списания\n₿ Баланс: ${currentBTC} BTC\n💸 Списать: ${-amount} BTC`);
          }

          const newBTC = await updateUserBTC(recipientIdNum, amount);

          const isDeduction = amount < 0;
          const operation = isDeduction ? 'Списание BTC' : 'Пополнение BTC';
          const emoji = isDeduction ? '💸' : '₿';
          const action = isDeduction ? 'списано' : 'получил';
          const displayAmount = Math.abs(amount);

          return context.send(`💙 BLACK KRISTAL — ${operation}

${emoji} ${recipientName} ${action} ${displayAmount} BTC от ${adminName}
💎 Новый BTC баланс: ${newBTC} BTC`);
        });
      }

    } catch (error) {
      console.error('Ошибка в /givemoney:', error);
      return context.send('❌ Произошла ошибка при выполнении. Попробуйте позже.');
    }
  }
};