const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

// Начисление дохода с учётом времени (как в /бизнес и /снять)
function accrueIncome(biz, info, now) {
  now = now || Date.now();
  const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);
  const hourlyIncome = info.income[level - 1];
  const perMs = hourlyIncome / (60 * 60 * 1000);

  const lastCollect = Number(biz.last_collect) || now;
  const elapsed = Math.max(0, now - lastCollect);

  const accrued = Math.floor(elapsed * perMs);
  const accum = Number(biz.accum) || 0;

  return {
    level: level,
    hourlyIncome: hourlyIncome,
    accrued: accrued,
    newAccum: accum + accrued,
  };
}

module.exports = {
  command: '/закрыть',
  description: 'Закрыть бизнес',
  aliases: ['/closebusiness', '/закрытьбизнес'],

  async execute(context) {
    try {
      const userId = context.senderId;

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнеса.');

      const biz = list[0]; // у игрока только 1 бизнес
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден в базе');

      const now = Date.now();
      const acc = accrueIncome(biz, info, now);

      // ── Возврат 50% от цены + всё накопленное ──
      const refund = Math.floor(info.price * 0.5);
      const totalPayout = refund + acc.newAccum;

      // 1. Начисляем деньги
      const balance = Number(await getUserBalance(userId)) || 0;
      await updateUserBalance(userId, balance + totalPayout);

      // 2. Удаляем бизнес (по user_id, так как он один)
      const delResult = await databaseQuery('DELETE FROM user_businesses WHERE user_id = ?', [userId]);
      
      // Проверка: если удалилось 0 строк (на случай если поле называется иначе)
      if (delResult && delResult.affectedRows === 0) {
        // Пробуем удалить по id, если оно есть
        if (biz.id) {
          await databaseQuery('DELETE FROM user_businesses WHERE id = ?', [biz.id]);
        } else if (biz.uid) {
          await databaseQuery('DELETE FROM user_businesses WHERE uid = ?', [biz.uid]);
        } else {
           // Если совсем ничего не вышло — удаляем по связке user_id + business_id
           await databaseQuery('DELETE FROM user_businesses WHERE user_id = ? AND business_id = ?', [userId, biz.business_id]);
        }
      }

      let msg = '❌ «' + info.name + '» закрыт.\n\n';
      msg += '💵 Возврат за бизнес (50%): ' + formatRub(refund) + '\n';
      if (acc.newAccum > 0) {
        msg += '💰 Накопленный доход: ' + formatRub(acc.newAccum) + '\n';
      }
      msg += '━━━━━━━━━━━━━━━\n';
      msg += '💎 Итого получено: ' + formatRub(totalPayout);

      return context.send(msg);

    } catch (e) {
      console.error('Ошибка в /закрыть:', e);
      return context.send('❌ Ошибка при закрытии');
    }
  }
};