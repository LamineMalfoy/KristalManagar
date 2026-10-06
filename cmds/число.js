const { getUserBalance, updateUserBalance } = require('../filedb.js');
const vk = require('../vkInstance.js');
const { isDevRigged } = require('../utils/rig.js');

const activeChallenges = new Map();

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

function parseBet(str) {
  const s = str.toLowerCase().trim();
  if (s.includes('ккк')) return parseFloat(s.replace('ккк', '')) * 1000000000000;
  if (s.includes('млрд')) return parseFloat(s.replace('млрд', '')) * 1000000000;
  if (s.includes('кк')) return parseFloat(s.replace('кк', '')) * 1000000;
  if (s.includes('к')) return parseFloat(s.replace('к', '')) * 1000;
  return parseFloat(s) || 0;
}

async function getUserLink(userId) {
  try {
    const res = await vk.api.users.get({ user_ids: [userId] });
    if (res && res[0]) return `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]`;
  } catch (e) {}
  return `[id${userId}|Игрок]`;
}

function parseMention(str) {
  const m1 = str.match(/^\[id(\d+)\|/);
  if (m1) return { id: Number(m1[1]) };
  const m2 = str.match(/^@?(.+)$/);
  if (!m2) return null;
  let clean = m2[1].replace(/^@/, '');
  if (/^\d+$/.test(clean)) return { id: Number(clean) };
  if (/^id\d+$/i.test(clean)) return { id: Number(clean.replace(/^id/i, '')) };
  return { username: clean };
}

async function resolveUser(raw) {
  const parsed = parseMention(raw);
  if (!parsed) return null;
  try {
    const q = parsed.id ? String(parsed.id) : parsed.username;
    const res = await vk.api.users.get({ user_ids: [q] });
    if (res && res[0]) return { id: res[0].id, name: `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]` };
  } catch (e) {}
  return null;
}

function botChooseNumber() {
  const center = 50;
  const spread = 12;
  let n = Math.round(center + (Math.random() * 2 - 1) * spread);
  if (n < 1) n = 1;
  if (n > 100) n = 100;
  return n;
}

module.exports = {
  command: '/число',
  description: 'Дуэль чисел',
  aliases: ['/number'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);
      const peerId = context.peerId;

      if (parts[0] && (parts[0].toLowerCase() === 'принять' || parts[0].toLowerCase() === 'accept')) {
        return await this.accept(context, parts);
      }
      if (parts[0] && (parts[0].toLowerCase() === 'отмена' || parts[0].toLowerCase() === 'cancel')) {
        return await this.cancel(context);
      }

      if (parts.length < 2) {
        return context.send(`🎲 Игра «Дуэль чисел»\n\nИспользование:\n/число <ставка> <моё число>\n/число <ставка> <моё число> @user\n/число принять <моё число>\n/число отмена\n\nПример:\n/число 1000 42\n/число вб 50\n/число 1000 42 @durov`);
      }

      let bet;
      if (parts[0].toLowerCase() === 'вб' || parts[0].toLowerCase() === 'все' || parts[0].toLowerCase() === 'all') {
        const balance = await getUserBalance(userId);
        bet = Math.floor(balance);
        if (bet <= 0) return context.send('❌ У вас нет денег на балансе.');
      } else {
        bet = parseBet(parts[0]);
      }
      const myNumber = parseInt(parts[1]);

      if (!bet || bet <= 0) return context.send('❌ Неверная ставка');
      if (!myNumber || myNumber < 1 || myNumber > 100) return context.send('❌ Число должно быть от 1 до 100');

      const balance = await getUserBalance(userId);
      if (balance < bet) return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatRub(balance)}`);

      const targetRaw = parts.slice(2).join(' ');
      let targetUser = null;
      if (targetRaw && targetRaw.length > 0) {
        targetUser = await resolveUser(targetRaw);
        if (!targetUser) return context.send(`❌ Не удалось найти игрока «${targetRaw}»`);
        if (targetUser.id === userId) return context.send('❌ Нельзя вызвать самого себя');
        if (activeChallenges.has(targetUser.id)) return context.send(`❌ У ${targetUser.name} уже есть активный вызов`);

        await updateUserBalance(userId, balance - bet);
        const meName = await getUserLink(userId);
        activeChallenges.set(userId, { challengerId: userId, bet, myNumber, targetUserId: targetUser.id, peerId, createdAt: Date.now() });
        return context.send(`⚔️ ВЫЗОВ НА ДУЭЛЬ!\n\n👤 ${meName} вызывает ${targetUser.name}\n💰 Ставка: ${formatRub(bet)}\n🎲 Загаданное число: ${myNumber}\n\n📥 ${targetUser.name}, принять? Напиши:\n/число принять <твоё число>`);
      }

      await updateUserBalance(userId, balance - bet);

      const isDev = await isDevRigged(userId);
      const botNumber = botChooseNumber();
      let target = Math.floor(Math.random() * 100) + 1;

      if (isDev) target = myNumber;

      const distPlayer = Math.abs(target - myNumber);
      const distBot = Math.abs(target - botNumber);
      const meName = await getUserLink(userId);

      let resultMsg = `🎲 ДУЭЛЬ ЧИСЕЛ\n\n🎯 Выпало число: ${target}\n\n👤 ${meName}: число ${myNumber} (расстояние ${distPlayer})\n🤖 Бот: число ${botNumber} (расстояние ${distBot})\n\n`;

      const devMultiplier = isDev ? 1000 : 1;

      if (distPlayer < distBot) {
        const win = Math.floor(bet * 2 * (1 - 0.027) * devMultiplier);
        const newBalance = await getUserBalance(userId);
        await updateUserBalance(userId, newBalance + win);
        return context.send(resultMsg + `🏆 ПОБЕДА!\n💰 Выигрыш: ${formatRub(win)}${isDev ? ' 👑 DEV x1000!' : ''}`);
      } else if (distPlayer === distBot) {
        const newBalance = await getUserBalance(userId);
        await updateUserBalance(userId, newBalance + bet);
        return context.send(resultMsg + `🤝 НИЧЬЯ!\n💰 Ставка возвращена: ${formatRub(bet)}`);
      } else {
        return context.send(resultMsg + `❌ ПРОИГРЫШ!\n💰 Потеряно: ${formatRub(bet)}`);
      }

    } catch (error) {
      console.error('Ошибка в /число:', error);
      return context.send('❌ Ошибка');
    }
  },

  async accept(context, parts) {
    const userId = context.senderId;
    let challenge = null;
    let challengerId = null;
    for (const [cid, ch] of activeChallenges.entries()) {
      if (ch.targetUserId === userId) { challenge = ch; challengerId = cid; break; }
    }
    if (!challenge) return context.send('❌ У вас нет активных вызовов');
    if (parts.length < 2) return context.send('❌ Укажи своё число: /число принять <1-100>');

    const myNumber = parseInt(parts[1]);
    if (!myNumber || myNumber < 1 || myNumber > 100) return context.send('❌ Число от 1 до 100');

    const myBalance = await getUserBalance(userId);
    if (myBalance < challenge.bet) return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatRub(myBalance)}`);

    await updateUserBalance(userId, myBalance - challenge.bet);

    let target = Math.floor(Math.random() * 100) + 1;

    const challengerIsDev = await isDevRigged(challengerId);
    if (challengerIsDev) target = challenge.myNumber;

    const dist1 = Math.abs(target - challenge.myNumber);
    const dist2 = Math.abs(target - myNumber);
    const challengerName = await getUserLink(challengerId);
    const acceptorName = await getUserLink(userId);

    let resultMsg = `⚔️ ДУЭЛЬ ЧИСЕЛ — РЕЗУЛЬТАТ\n\n🎯 Выпало число: ${target}\n\n👤 ${challengerName}: ${challenge.myNumber} (расстояние ${dist1})\n👤 ${acceptorName}: ${myNumber} (расстояние ${dist2})\n\n`;

    const bank = challenge.bet * 2;
    const rake = Math.floor(bank * 0.05);
    const prize = bank - rake;

    if (dist1 < dist2) {
      const devMultiplier = challengerIsDev ? 1000 : 1;
      const finalPrize = prize * devMultiplier;
      const newBal = await getUserBalance(challengerId);
      await updateUserBalance(challengerId, newBal + finalPrize);
      resultMsg += `🏆 ПОБЕДА: ${challengerName}!\n💰 Получено: ${formatRub(finalPrize)}${challengerIsDev ? ' 👑 DEV x1000!' : ''}`;
    } else if (dist2 < dist1) {
      const newBal = await getUserBalance(userId);
      await updateUserBalance(userId, newBal + prize);
      resultMsg += `🏆 ПОБЕДА: ${acceptorName}!\n💰 Получено: ${formatRub(prize)}`;
    } else {
      const newBal1 = await getUserBalance(challengerId);
      const newBal2 = await getUserBalance(userId);
      await updateUserBalance(challengerId, newBal1 + challenge.bet);
      await updateUserBalance(userId, newBal2 + challenge.bet);
      resultMsg += `🤝 НИЧЬЯ!\n💰 Ставки возвращены`;
    }

    activeChallenges.delete(challengerId);
    return context.send(resultMsg);
  },

  async cancel(context) {
    const userId = context.senderId;
    const challenge = activeChallenges.get(userId);
    if (!challenge) return context.send('❌ У вас нет активного вызова');
    const balance = await getUserBalance(userId);
    await updateUserBalance(userId, balance + challenge.bet);
    activeChallenges.delete(userId);
    return context.send(`✅ Вызов отменён.\n💰 Ставка возвращена: ${formatRub(challenge.bet)}`);
  },

  activeChallenges
};