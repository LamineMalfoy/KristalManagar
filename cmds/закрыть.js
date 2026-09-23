const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);
const { getUserBalance, updateUserBalance, formatRub } = require('../filedb.js');
const { BUSINESSES } = require('./business.js');

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
      if (!list || !list.length) {
        return context.send('🏢 У вас нет бизнесов.');
      }

      if (parts.length < 1) {
        let msg = `❌ Закрыть бизнес (возврат 50%)\n\n📋 Ваши бизнесы:\n`;
        for (let i = 0; i < list.length; i++) {
          const info = BUSINESSES.find(x => x.id === Number(list[i].business_id));
          if (!info) continue;
          const refund = Math.floor(info.price * 0.5);
          msg += `${i + 1}. ${info.name} — возврат: ${formatRub(refund)}\n`;
        }
        msg += `\nИспользование: /закрыть <номер>`;
        return context.send(msg);
      }

      const idx = parseInt(parts[0]) - 1;
      if (isNaN(idx) || !list[idx]) {
        return context.send('❌ Неверный номер бизнеса');
      }

      const biz = list[idx];
      const info = BUSINESSES.find(x => x.id === Number(biz.business_id));
      if (!info) return context.send('❌ Бизнес не найден');

      const refund = Math.floor(info.price * 0.5);
      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + refund);

      await databaseQuery(
        'DELETE FROM user_businesses WHERE user_id = ? AND business_id = ?',
        [userId, biz.business_id]
      );

      return context.send(`❌ «${info.name}» закрыт.\n💵 Возврат: ${formatRub(refund)}`);

    } catch (e) {
      console.error('Ошибка в /закрыть:', e);
      return context.send('❌ Ошибка при закрытии');
    }
  }
};