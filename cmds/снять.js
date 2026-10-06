const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

module.exports = {
  command: '/снять',
  description: 'Снять доход с бизнеса',
  aliases: ['/collect', '/собрать'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнесов. Купите через /бизнес');

      // ─── /снять все ───
      if (parts[0] && (parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all')) {
        let total = 0;
        let count = 0;

        for (const b of list) {
          const accum = Number(b.accum) || 0;
          if (accum > 0) {
            total += accum;
            count++;

            await databaseQuery(
              'UPDATE user_businesses SET accum = 0 WHERE user_id = ? AND business_id = ? AND uid = ?',
              [userId, b.business_id, b.uid]
            );
          }
        }

        if (total <= 0) {
          return context.send('⏳ Пока нечего снимать.');
        }

        const balance = await getUserBalance(userId);
        await updateUserBalance(userId, balance + total);

        return context.send(`💰 Вы сняли ${formatRub(total)} с ${count} бизнесов!`);
      }

      // ─── Без аргумента — показать ───
      if (parts.length < 1) {
        let msg = `💰 Снять доход\n\n📋 Ваши бизнесы:\n`;
        let total = 0;
        for (let i = 0; i < list.length; i++) {
          const info = BUSINESSES.find(x => x.id === Number(list[i].business_id));
          if (!info) continue;
          const accum = Number(list[i].accum) || 0;
          total += accum;
          msg += `${i + 1}. ${info.name} — накоплено: ${formatRub(accum)}\n`;
        }
        msg += `\n💎 Всего: ${formatRub(total)}`;
        msg += `\n\n📥 /снять <номер> — один бизнес`;
        msg += `\n📥 /снять все — все бизнесы`;
        return context.send(msg);
      }

      // ─── /снять <номер> ───
      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) return context.send('❌ Неверный номер бизнеса');

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const accum = Number(biz.accum) || 0;
      if (accum <= 0) return context.send('⏳ Пока нечего снимать.');

      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + accum);

      await databaseQuery(
        'UPDATE user_businesses SET accum = 0 WHERE user_id = ? AND business_id = ? AND uid = ?',
        [userId, biz.business_id, biz.uid]
      );

      return context.send(`💰 Вы сняли ${formatRub(accum)} с «${info.name}»`);

    } catch (e) {
      console.error('Ошибка в /снять:', e);
      return context.send('❌ Ошибка при снятии дохода');
    }
  }
};