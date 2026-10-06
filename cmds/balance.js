const fs = require('fs');
const path = require('path');
const { getUserBalance, getUserBTC } = require('../filedb.js');

// Формат: работает с любыми числами, включая 10^40+
function formatRub(amount) {
  if (amount === undefined || amount === null) return '0₽';

  // Если число — превращаем в строку целиком (без экспоненты)
  let str;
  if (typeof amount === 'number') {
    // Number не может > 2^53, но getUserBalance обычно возвращает число
    // Проверяем, не потерялось ли что-то
    if (!isFinite(amount)) return '∞₽';
    if (amount >= 1e21) {
      // Для очень больших — используем BigInt-подобный подход
      str = BigInt(Math.floor(amount)).toString();
    } else {
      str = Math.floor(amount).toString();
    }
  } else {
    str = String(amount).split('.')[0];
  }

  // Убираем минус, если есть (потом вернём)
  const negative = str.startsWith('-');
  if (negative) str = str.slice(1);

  // Разбиваем по три цифры
  const withDots = str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negative ? '-' : '') + withDots + '₽';
}

function getDepositSum(userId) {
  try {
    const file = path.join(__dirname, '..', 'data', 'deposits.json');
    if (!fs.existsSync(file)) return 0;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = data[userId];
    if (!d || !d.amount) return 0;
    return d.amount;
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

      let userName = `[id${userId}|Пользователь]`;
      try {
        const vk = require('../vkInstance');
        const userInfo = await vk.api.users.get({ user_ids: userId, fields: 'first_name,last_name' });
        if (userInfo && userInfo[0]) {
          userName = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
        }
      } catch (error) {}

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