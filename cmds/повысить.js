const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

module.exports = {
  command: '/повысить',
  description: 'Прокачать бизнес',
  aliases: ['/upgrade', '/апгрейд'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнесов. Купите через /бизнес');

      // ─── /повысить все ───
      if (parts[0] && (parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all')) {
        let upgraded = 0;
        let totalSpent = 0;

        for (const b of list) {
          const info = BUSINESSES.find(x => x.id === Number(b.business_id));
          if (!info) continue;

          let level = Math.min(Math.max(Number(b.level) || 1, 1), 10);
          if (level >= 10) continue;

          const price = info.income[level];
          const balance = await getUserBalance(userId);

          if (balance < price) continue;

          await updateUserBalance(userId, balance - price);
          await databaseQuery(
            'UPDATE user_businesses SET level = level + 1 WHERE user_id = ? AND business_id = ? AND uid = ?',
            [userId, b.business_id, b.uid]
          );

          upgraded++;
          totalSpent += price;
        }

        if (upgraded === 0) {
          return context.send('❌ Не удалось прокачать ни один бизнес (нет денег или макс. уровень).');
        }

        return context.send(`📈 Прокачано: ${upgraded} бизнесов\n💸 Потрачено: ${formatRub(totalSpent)}`);
      }

      // ─── Без аргумента — показать ───
      if (parts.length < 1) {
        let msg = `📈 Повысить уровень бизнеса\n\n📋 Ваши бизнесы:\n`;
        for (let i = 0; i < list.length; i++) {
          const info = BUSINESSES.find(x => x.id === Number(list[i].business_id));
          if (!info) continue;
          const level = Math.min(Math.max(Number(list[i].level) || 1, 1), 10);
          const nextPrice = level < 10 ? info.income[level] : null;
          msg += `${i + 1}. ${info.name} — ${level}/10`;
          if (nextPrice) msg += ` (апгрейд: ${formatRub(nextPrice)})`;
          else msg += ` (макс. уровень)`;
          msg += `\n`;
        }
        msg += `\n⬆️ /повысить <номер> — один бизнес`;
        msg += `\n⬆️ /повысить все — все бизнесы`;
        return context.send(msg);
      }

      // ─── /повысить <номер> ───
      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) return context.send('❌ Неверный номер бизнеса');

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);
      if (level >= 10) return context.send(`📈 «${info.name}» уже максимального уровня (10/10)`);

      const price = info.income[level];
      const balance = await getUserBalance(userId);

      if (balance < price) {
        return context.send(`❌ Недостаточно средств\n💰 Нужно: ${formatRub(price)}\n💵 У вас: ${formatRub(balance)}`);
      }

      await updateUserBalance(userId, balance - price);
      await databaseQuery(
        'UPDATE user_businesses SET level = level + 1 WHERE user_id = ? AND business_id = ? AND uid = ?',
        [userId, biz.business_id, biz.uid]
      );

      return context.send(`📈 «${info.name}» прокачан до ${level + 1} уровня!\n💸 Списано: ${formatRub(price)}`);

    } catch (e) {
      console.error('Ошибка в /повысить:', e);
      return context.send('❌ Ошибка при прокачке');
    }
  }
};