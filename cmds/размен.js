const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC } = require('../filedb.js');

// Курс: 1 BTC = 320.000₽ (можешь менять)
const BTC_RATE = 320000;

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}
function formatBTC(amount) {
  return Number(amount || 0).toFixed(6);
}

module.exports = {
  command: '/размен',
  description: 'Разменять BTC на рубли',
  aliases: ['/exchange', '/обмен'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 1) {
        const btc = await getUserBTC(userId);
        return context.send(`💎 Размен BTC → RUB

📊 Курс: 1 BTC = ${formatRub(BTC_RATE)}
💎 У вас: ${formatBTC(btc)} BTC

Использование:
/размен <кол-во BTC>
/размен всё       — обменять весь BTC

Пример:
/размен 0.001
/размен всё`);
      }

      const btc = await getUserBTC(userId);
      let amount;

      if (parts[0].toLowerCase() === 'всё' || parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all') {
        amount = btc;
      } else {
        amount = parseFloat(parts[0].replace(',', '.'));
      }

      if (!amount || amount <= 0) return context.send('❌ Неверное количество BTC.');
      if (amount > btc) return context.send(`❌ Недостаточно BTC.\n💎 У вас: ${formatBTC(btc)} BTC`);

      const rub = Math.floor(amount * BTC_RATE);
      if (rub <= 0) return context.send('❌ Слишком маленькая сумма.');

      // Списываем BTC
      await updateUserBTC(userId, btc - amount);

      // Добавляем рубли
      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + rub);

      return context.send(`✅ Размен успешен!\n\n💎 Списано: ${formatBTC(amount)} BTC\n💰 Получено: ${formatRub(rub)}\n📊 Курс: 1 BTC = ${formatRub(BTC_RATE)}`);

    } catch (e) {
      console.error('Ошибка в /размен:', e);
      return context.send('❌ Ошибка при размене');
    }
  }
};