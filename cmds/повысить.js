const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance, formatRub } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

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
      if (!list || !list.length) {
        return context.send('🏢 У вас нет бизнесов. Купите через /business');
      }

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
        msg += `\nИспользование: /повысить <номер>`;
        return context.send(msg);
      }

      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) {
        return context.send('❌ Неверный номер бизнеса');
      }

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const level = Math.min(Math.max(Number(biz.level) || 1, 1), 10);
      if (level >= 10) {
        return context.send(`📈 «${info.name}» уже максимального уровня (10/10)`);
      }

      const price = info.income[level];
      const balance = await getUserBalance(userId);

      if (balance < price) {
        return context.send(`❌ Недостаточно средств\n💰 Нужно: ${formatRub(price)}\n💵 У вас: ${formatRub(balance)}`);
      }

      await updateUserBalance(userId, balance - price);
      await databaseQuery(
        'UPDATE user_businesses SET level = level + 1 WHERE user_id = ? AND business_id = ?',
        [userId, biz.business_id]
      );

      return context.send(`📈 «${info.name}» прокачан до ${level + 1} уровня!\n💸 Списано: ${formatRub(price)}`);

    } catch (e) {
      console.error('Ошибка в /повысить:', e);
      return context.send('❌ Ошибка при прокачке');
    }
  }
};