const fs = require('fs');
const path = require('path');
const { getUserBalance, getUserBTC } = require('../filedb.js');

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('ru-RU') + '₽';
}

// Сумма депозита
function getDepositSum(userId) {
  try {
    const file = path.join(__dirname, '..', 'data', 'deposits.json');
    if (!fs.existsSync(file)) return 0;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = data[userId];
    if (!d || !d.amount) return 0;
    return Number(d.amount) || 0;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  command: '/баланс',
  description: 'Показать ваш игровой баланс',
  aliases: ['/balance', '/bal'],

  async execute(context) {
    try {
      const userId = context.senderId;

      const balance = await getUserBalance(userId);
      const btcBalance = await getUserBTC(userId);
      const deposit = getDepositSum(userId);

      // Имя пользователя
      let userName = `[id${userId}|Пользователь]`;
      try {
        const vk = require('../vkInstance');
        const userInfo = await vk.api.users.get({
          user_ids: userId,
          fields: 'first_name,last_name'
        });
        if (userInfo && userInfo[0]) {
          userName = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (error) {
        console.log('Не удалось получить имя пользователя');
      }

      const message =
        `💎 Пользователь: ${userName}\n` +
        `💰 В депозите: ${formatRub(deposit)}\n` +
        `🇷🇺 В RUB: ${formatRub(balance)}\n` +
        `💸 В BTC: ${btcBalance} BTC`;

      return context.send(message);

    } catch (error) {
      console.error('Ошибка в команде баланс:', error);
      return context.send('❌ Произошла ошибка при получении баланса');
    }
  }
};