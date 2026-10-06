const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

module.exports = {
  command: '/закрыть',
  description: 'Закрыть бизнес',
  aliases: ['/closebusiness', '/закрытьбизнес'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      const list = await databaseQuery('SELECT * FROM user_businesses WHERE user_id = ?', [userId]);
      if (!list || !list.length) return context.send('🏢 У вас нет бизнесов.');

      // ─── /закрыть все ───
      if (parts[0] && (parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all')) {
        let totalRefund = 0;
        let closed = 0;

        for (const b of list) {
          const info = BUSINESSES.find(x => x.id === Number(b.business_id));
          if (!info) continue;

          const refund = Math.floor(info.price * 0.5);
          totalRefund += refund;

          await databaseQuery(
            'DELETE FROM user_businesses WHERE user_id = ? AND business_id = ? AND uid = ?',
            [userId, b.business_id, b.uid]
          );

          closed++;
        }

        if (closed === 0) return context.send('❌ Не удалось закрыть ни одного бизнеса.');

        const balance = await getUserBalance(userId);
        await updateUserBalance(userId, balance + totalRefund);

        return context.send(`❌ Закрыто ${closed} бизнесов.\n💵 Возврат: ${formatRub(totalRefund)}`);
      }

      // ─── Без аргумента — показать ───
      if (parts.length < 1) {
        let msg = `❌ Закрыть бизнес (возврат 50%)\n\n📋 Ваши бизнесы:\n`;
        for (let i = 0; i < list.length; i++) {
          const info = BUSINESSES.find(x => x.id === Number(list[i].business_id));
          if (!info) continue;
          const refund = Math.floor(info.price * 0.5);
          msg += `${i + 1}. ${info.name} — возврат: ${formatRub(refund)}\n`;
        }
        msg += `\n❌ /закрыть <номер> — один бизнес`;
        msg += `\n❌ /закрыть все — все бизнесы`;
        return context.send(msg);
      }

      // ─── /закрыть <номер> ───
      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) return context.send('❌ Неверный номер бизнеса');

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const refund = Math.floor(info.price * 0.5);
      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + refund);

      await databaseQuery(
        'DELETE FROM user_businesses WHERE user_id = ? AND business_id = ? AND uid = ?',
        [userId, biz.business_id, biz.uid]
      );

      return context.send(`❌ «${info.name}» закрыт.\n💵 Возврат: ${formatRub(refund)}`);

    } catch (e) {
      console.error('Ошибка в /закрыть:', e);
      return context.send('❌ Ошибка при закрытии');
    }
  }
};