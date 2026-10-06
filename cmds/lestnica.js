const { getUserBalance, updateUserBalance } = require('../filedb.js');
const { isDevRigged } = require('../utils/rig.js');

const activeGames = new Map();

const STEPS = [
  { fall: 0.05, mult: 1.05 }, { fall: 0.08, mult: 1.15 }, { fall: 0.12, mult: 1.30 },
  { fall: 0.17, mult: 1.55 }, { fall: 0.23, mult: 1.90 }, { fall: 0.30, mult: 2.40 },
  { fall: 0.38, mult: 3.10 }, { fall: 0.47, mult: 4.10 }, { fall: 0.57, mult: 5.60 },
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

function renderLadder(game, revealed = false) {
  let out = '';
  for (let i = STEPS.length - 1; i >= 0; i--) {
    const step = i + 1;
    const isDone = game.step > i;
    const isCurrent = game.step === step;
    let icon = '⬜';
    if (isDone) icon = '✅';
    else if (isCurrent) icon = '⬆️';
    else if (revealed && step === game.step + 1) icon = '💥';
    const marker = isCurrent ? ' 👈' : '';
    const bonus = step === STEPS.length ? ' 👑' : '';
    out += `${icon} Ступень ${step}: x${STEPS[i].mult.toFixed(2)}${marker}${bonus}\n`;
  }
  return out.trim();
}

module.exports = {
  command: '/лестница',
  description: 'Игра Лестница',
  aliases: ['/ladder'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 1) {
        return context.send(`🪜 Игра «Лестница»\n\nПравила:\n• 10 ступеней, на каждой — шанс упасть\n• Чем выше — тем больше множитель\n• Можешь забрать выигрыш в любой момент\n• Упал — ставка сгорела\n\nИспользование:\n/лестница <ставка>\n/лестница вб`);
      }

      if (activeGames.has(userId)) return context.send('❌ У вас уже есть активная игра. Завершите: /вниз');

      let bet;
      if (parts[0].toLowerCase() === 'вб' || parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all') {
        const balance = await getUserBalance(userId);
        bet = Math.floor(balance);
        if (bet <= 0) return context.send('❌ У вас нет денег на балансе.');
      } else {
        bet = parseBet(parts[0]);
      }

      if (!bet || bet <= 0) return context.send('❌ Неверная ставка');

      const balance = await getUserBalance(userId);
      if (balance < bet) return context.send(`❌ Недостаточно средств\n💰 Ваш баланс: ${formatMoney(balance)}₽`);

      await updateUserBalance(userId, balance - bet);

      const game = { userId, bet, step: 0, startedAt: Date.now() };
      activeGames.set(userId, game);

      return context.send(`🪜 ЛЕСТНИЦА — Игра началась!\n\n💰 Ставка: ${formatMoney(bet)}₽\n🎯 Текущая ступень: 0/10\n\n${renderLadder(game)}\n\n🎮 /вверх — шагнуть выше\n💰 /вниз — забрать выигрыш`);

    } catch (error) {
      console.error('Ошибка в /лестница:', error);
      return context.send('❌ Ошибка при запуске игры');
    }
  },

  async up(context) {
    try {
      const userId = context.senderId;
      const game = activeGames.get(userId);
      if (!game) return context.send('❌ У вас нет активной игры. Начните: /лестница <ставка>');
      if (game.step >= STEPS.length) return context.send('🏆 Вы уже на вершине! Забирайте: /вниз');

      const nextIdx = game.step;
      const chance = STEPS[nextIdx].fall;

      const isDev = await isDevRigged(userId);

      const roll = Math.random();
      if (roll < chance && !isDev) {
        const msg = `💥 ВЫ УПАЛИ!\n\n💰 Ставка сгорела: ${formatMoney(game.bet)}₽\n🎯 Дошли до ступени: ${game.step}/10\n\n${renderLadder(game, true)}`;
        activeGames.delete(userId);
        return context.send(msg);
      }

      game.step += 1;
      const mult = STEPS[game.step - 1].mult;
      const win = Math.floor(game.bet * mult);

      return context.send(`✅ Успешно!\n\n🎯 Ступень: ${game.step}/10\n📊 Множитель: x${mult.toFixed(2)}\n💵 Текущий выигрыш: ${formatMoney(win)}₽\n\n${renderLadder(game)}\n\n🎮 /вверх — дальше\n💰 /вниз — забрать ${formatMoney(win)}₽`);

    } catch (error) {
      console.error('Ошибка в /вверх:', error);
      return context.send('❌ Ошибка');
    }
  },

  async down(context) {
    try {
      const userId = context.senderId;
      const game = activeGames.get(userId);
      if (!game) return context.send('❌ У вас нет активной игры');
      if (game.step === 0) return context.send('⚠️ Вы ещё на нулевой ступени. Шагните: /вверх');

      const mult = STEPS[game.step - 1].mult;

      // ─── ПОДКРУТКА: x1000 для разраба ───
      const isDev = await isDevRigged(userId);
      const devMultiplier = isDev ? 1000 : 1;

      const win = Math.floor(game.bet * mult * devMultiplier);

      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance + win);

      const msg = `💰 ВЫ ЗАБРАЛИ ВЫИГРЫШ!\n\n💵 Получено: ${formatMoney(win)}₽\n📊 Множитель: x${mult.toFixed(2)}${isDev ? ' × 1000 (DEV)' : ''}\n🎯 Ступень: ${game.step}/10`;

      activeGames.delete(userId);
      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в /вниз:', error);
      return context.send('❌ Ошибка');
    }
  },

  activeGames
};