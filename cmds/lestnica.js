const { getUserBalance, updateUserBalance } = require('../filedb.js');

// ─── Активные игры: userId -> { bet, step, messageId } ───
const activeGames = new Map();

// ─── Ступени ───
const STEPS = [
  { fall: 0.05, mult: 1.05 },
  { fall: 0.08, mult: 1.15 },
  { fall: 0.12, mult: 1.30 },
  { fall: 0.17, mult: 1.55 },
  { fall: 0.23, mult: 1.90 },
  { fall: 0.30, mult: 2.40 },
  { fall: 0.38, mult: 3.10 },
  { fall: 0.47, mult: 4.10 },
  { fall: 0.57, mult: 5.60 },
  { fall: 0.68, mult: 8.00 }
];

function formatMoney(amount) {
  if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  return amount.toString();
}

function parseBet(str) {
  const s = str.toLowerCase().trim();
  if (s.includes('ккк')) return parseFloat(s.replace('ккк', '')) * 1000000000000;
  if (s.includes('млрд')) return parseFloat(s.replace('млрд', '')) * 1000000000;
  if (s.includes('кк')) return parseFloat(s.replace('кк', '')) * 1000000;
  if (s.includes('к')) return parseFloat(s.replace('к', '')) * 1000;
  return parseFloat(s) || 0;
}

// ─── Отрисовка лестницы ───
function renderLadder(game, revealed = false) {
  let out = '';
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const step = i + 1;
    const isDone = game.step > i;
    const isCurrent = game.step === step;
    const isTop = step === STEPS.length;

    let icon = '⬜';
    if (isDone) icon = '✅';
    else if (isCurrent) icon = '⬆️';
    else if (revealed && step === game.step + 1) icon = '💥';

    const marker = isCurrent ? ' 👈' : '';
    const bonus = isTop ? ' 👑' : '';

    out += `${icon} Ступень ${step}: x${STEPS[i].mult.toFixed(2)}${marker}${bonus}\n`;
  }
  return out.trim();
}

module.exports = {
  command: '/lestnica',
  description: 'Игра Лестница',
  aliases: ['/lestnisa', '/лестница'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 1) {
        return context.send(`🪜 Игра «Лестница»

Правила:
• 10 ступеней, на каждой — шанс упасть
• Чем выше — тем больше множитель
• Можешь забрать выигрыш в любой момент
• Упал — ставка сгорела

Использование:
!лестница <ставка>

Примеры:
!лестница 1000
!лестница 5к
!лестница 1кк

После старта:
• !вверх — шагнуть выше
• !вниз — забрать выигрыш`);
      }

      if (activeGames.has(userId)) {
        return context.send('❌ У вас уже есть активная игра. Завершите её: !вниз');
      }

      const bet = parseBet(parts[0]);
      if (!bet || bet <= 0) {
        return context.send('❌ Неверная ставка');
      }

      const balance = await getUserBalance(userId);
      if (balance < bet) {
        return context.send(`❌ Недостаточно средств\n💰 Ваш баланс: ${formatMoney(balance)}₽`);
      }

      await updateUserBalance(userId, balance - bet);

      const game = {
        userId,
        bet,
        step: 0,
        startedAt: Date.now()
      };
      activeGames.set(userId, game);

      const msg = `🪜 ЛЕСТНИЦА — Игра началась!

💰 Ставка: ${formatMoney(bet)}₽
🎯 Текущая ступень: 0/10

${renderLadder(game)}

🎮 !вверх — шагнуть выше
💰 !вниз — забрать выигрыш`;

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в !лестница:', error);
      return context.send('❌ Ошибка при запуске игры');
    }
  },

  // ─── Шаг вверх ───
  async up(context) {
    try {
      const userId = context.senderId;
      const game = activeGames.get(userId);

      if (!game) {
        return context.send('❌ У вас нет активной игры. Начните: !лестница <ставка>');
      }

      if (game.step >= STEPS.length) {
        return context.send('🏆 Вы уже на вершине! Забирайте: !вниз');
      }

      const nextIdx = game.step; // 0-based индекс следующей ступени
      const chance = STEPS[nextIdx].fall;

      // Ролл
      const roll = Math.random();
      if (roll < chance) {
        // Упал
        const msg = `💥 ВЫ УПАЛИ!

💰 Ставка сгорела: ${formatMoney(game.bet)}₽
🎯 Дошли до ступени: ${game.step}/10

${renderLadder(game, true)}`;

        activeGames.delete(userId);
        return context.send(msg);
      }

      // Успех
      game.step += 1;
      const mult = STEPS[game.step - 1].mult;
      const win = Math.floor(game.bet * mult);

      const msg = `✅ Успешно!

🎯 Ступень: ${game.step}/10
📊 Множитель: x${mult.toFixed(2)}
💵 Текущий выигрыш: ${formatMoney(win)}₽

${renderLadder(game)}

🎮 !вверх — дальше
💰 !вниз — забрать ${formatMoney(win)}₽`;

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в !вверх:', error);
      return context.send('❌ Ошибка');
    }
  },

  // ─── Забрать ───
  async down(context) {
    try {
      const userId = context.senderId;
      const game = activeGames.get(userId);

      if (!game) {
        return context.send('❌ У вас нет активной игры');
      }

      if (game.step === 0) {
        return context.send('⚠️ Вы ещё на нулевой ступени. Забирать нечего.\nШагните: !вверх');
      }

      const mult = STEPS[game.step - 1].mult;
      const win = Math.floor(game.bet * mult);

      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + win);

      const msg = `💰 ВЫ ЗАБРАЛИ ВЫИГРЫШ!

💵 Получено: ${formatMoney(win)}₽
📊 Множитель: x${mult.toFixed(2)}
🎯 Ступень: ${game.step}/10`;

      activeGames.delete(userId);
      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в !вниз:', error);
      return context.send('❌ Ошибка');
    }
  },

  activeGames
};