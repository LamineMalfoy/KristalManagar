const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

// Стоимость следующих слотов (начиная со 2-го слота)
const SLOT_PRICES = [
  1000000,      // 2-й слот
  5000000,      // 3-й
  25000000,     // 4-й
  100000000,    // 5-й
  500000000,    // 6-й
  2000000000,   // 7-й
  10000000000,  // 8-й
  50000000000,  // 9-й
  250000000000, // 10-й
];

// Возвращает макс. слотов для юзера
async function getMaxSlots(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    if (res && res[0] && Number(res[0].access) === 5) return 1000;

    const res2 = await databaseQuery('SELECT slots FROM user_slots WHERE user_id = ?', [userId]);
    if (res2 && res2[0]) return Math.max(1, Number(res2[0].slots));
  } catch (e) {}
  return 1;
}

module.exports = {
  command: '/купитьслот',
  description: 'Купить слот для бизнеса',
  aliases: ['/buyslot'],
  getMaxSlots,

  async execute(context) {
    try {
      const userId = context.senderId;

      const isDev = await (async () => {
        try {
          const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
          return res && res[0] && Number(res[0].access) === 5;
        } catch (e) { return false; }
      })();

      if (isDev) {
        return context.send('✨ Вам как разработчику доступно 1000 слотов — покупать не нужно.');
      }

      const cur = await getMaxSlots(userId);

      if (cur >= 10) {
        return context.send('🏪 У вас уже максимум — 10 слотов.');
      }

      const price = SLOT_PRICES[cur - 1];
      if (!price) return context.send('❌ Ошибка: цена слота не найдена.');

      const balance = await getUserBalance(userId);
      if (balance < price) {
        return context.send(`❌ Недостаточно средств.\n💰 Нужно: ${formatRub(price)}\n💵 У вас: ${formatRub(balance)}`);
      }

      await updateUserBalance(userId, balance - price);
      await databaseQuery(
        'INSERT INTO user_slots (user_id, slots) VALUES (?, ?) ON DUPLICATE KEY UPDATE slots = ?',
        [userId, cur + 1, cur + 1]
      );

      return context.send(`✅ Слот куплен!\n\n🏪 Теперь у вас ${cur + 1} слотов.\n💰 Списано: ${formatRub(price)}`);

    } catch (e) {
      console.error('Ошибка в /купитьслот:', e);
      return context.send('❌ Ошибка при покупке слота');
    }
  }
};