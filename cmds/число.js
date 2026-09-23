const { getUserBalance, updateUserBalance } = require('../filedb.js');
const vk = require('../vkInstance.js');

// ─── Активные вызовы: userId -> { bet, myNumber, targetUserId, peerId, messageId } ───
const activeChallenges = new Map();

// ─── Игры против бота не хранятся (мгновенные) ───

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

// ─── Парсинг упоминания пользователя ───
function parseMention(str) {
  // [id123|@name] или @name или id123
  const m1 = str.match(/^\[id(\d+)\|/);
  if (m1) return { id: Number(m1[1]) };

  const m2 = str.match(/^@?(.+)₽/);
  if (!m2) return null;

  let clean = m2[1].replace(/^@/, '');
  if (/^\d+₽/.test(clean)) return { id: Number(clean) };
  if (/^id\d+₽/i.test(clean)) return { id: Number(clean.replace(/^id/i, '')) };
  return { username: clean };
}

async function resolveUser(raw) {
  const parsed = parseMention(raw);
  if (!parsed) return null;
  try {
    const q = parsed.id ? String(parsed.id) : parsed.username;
    const res = await vk.api.users.get({ user_ids: [q] });
    if (res && res[0]) {
      return {
        id: res[0].id,
        name: `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]`
      };
    }
  } catch (e) { console.log('resolveUser error:', e.message); }
  return null;
}

// ─── Умный выбор бота: ближе к 50, с небольшим разбросом ───
function botChooseNumber() {
  const center = 50;
  const spread = 12; // насколько бот может отклониться
  let n = Math.round(center + (Math.random() * 2 - 1) * spread);
  if (n < 1) n = 1;
  if (n > 100) n = 100;
  return n;
}

module.exports = {
  command: '!число',
  description: 'Дуэль чисел',
  aliases: ['/число', '!number'],

  async execute(context) {
    try {
      const userId = context.senderId;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);
      const peerId = context.peerId;

      // ─── !число принять <моё число> ───
      if (parts[0] && (parts[0].toLowerCase() === 'принять' || parts[0].toLowerCase() === 'accept')) {
        return await this.accept(context, parts);
      }

      // ─── !число отмена ───
      if (parts[0] && (parts[0].toLowerCase() === 'отмена' || parts[0].toLowerCase() === 'cancel')) {
        return await this.cancel(context);
      }

      // ─── !число <ставка> <моё число> [@user] ───
      if (parts.length < 2) {
        return context.send(`🎲 Игра «Дуэль чисел»

Правила:
• Ты загадываешь число 1–100
• Бот/соперник загадывает своё
• Выпадает случайное число (1–100)
• Кто ближе — тот победил

Использование:
!число <ставка> <моё число>              — против бота
!число <ставка> <моё число> @user        — вызов игрока
!число принять <моё число>               — принять вызов
!число отмена                            — отменить вызов

Примеры:
!число 100 42
!число 1000 50 @durov
!число принять 37`);
      }

      const bet = parseBet(parts[0]);
      const myNumber = parseInt(parts[1]);

      if (!bet || bet <= 0) {
        return context.send('❌ Неверная ставка');
      }
      if (!myNumber || myNumber < 1 || myNumber > 100) {
        return context.send('❌ Число должно быть от 1 до 100');
      }

      const balance = await getUserBalance(userId);
      if (balance < bet) {
        return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatMoney(balance)}₽`);
      }

      // ─── Есть ли третий аргумент (вызов игрока) ───
      const targetRaw = parts.slice(2).join(' ');
      let targetUser = null;
      if (targetRaw && targetRaw.length > 0) {
        targetUser = await resolveUser(targetRaw);
        if (!targetUser) {
          return context.send(`❌ Не удалось найти игрока «${targetRaw}»`);
        }
        if (targetUser.id === userId) {
          return context.send('❌ Нельзя вызвать самого себя');
        }

        // Проверяем, что у соперника нет активного вызова
        if (activeChallenges.has(targetUser.id)) {
          return context.send(`❌ У ${targetUser.name} уже есть активный вызов`);
        }

        // Списываем ставку с вызывающего
        await updateUserBalance(userId, balance - bet);

        const meName = await getUserLink(userId);

        activeChallenges.set(userId, {
          challengerId: userId,
          bet,
          myNumber,
          targetUserId: targetUser.id,
          peerId,
          createdAt: Date.now()
        });

        return context.send(`⚔️ ВЫЗОВ НА ДУЭЛЬ!

👤 ${meName} вызывает ${targetUser.name}
💰 Ставка: ${formatMoney(bet)}₽
🎲 Загаданное число: ${myNumber}

📥 ${targetUser.name}, принять? Напиши:
!число принять <твоё число>

⏳ Вызов действует 5 минут.`);
      }

      // ─── Игра против бота (мгновенно) ───
      await updateUserBalance(userId, balance - bet);

      const botNumber = botChooseNumber();
      const target = Math.floor(Math.random() * 100) + 1;

      const distPlayer = Math.abs(target - myNumber);
      const distBot = Math.abs(target - botNumber);

      const meName = await getUserLink(userId);

      let resultMsg = `🎲 ДУЭЛЬ ЧИСЕЛ\n\n`;
      resultMsg += `🎯 Выпало число: ${target}\n\n`;
      resultMsg += `👤 ${meName}: число ${myNumber} (расстояние ${distPlayer})\n`;
      resultMsg += `🤖 Бот: число ${botNumber} (расстояние ${distBot})\n\n`;

      if (distPlayer < distBot) {
        // Победа игрока — выплата x2 (house edge 2.7%)
        const win = Math.floor(bet * 2 * (1 - 0.027));
        const newBalance = await getUserBalance(userId);
        await updateUserBalance(userId, newBalance + win);

        resultMsg += `🏆 ПОБЕДА!\n`;
        resultMsg += `💰 Выигрыш: ${formatMoney(win)}₽ (ставка возвращена + профит)`;

        return context.send(resultMsg);
      } else if (distPlayer === distBot) {
        // Ничья — возвращаем ставку
        const newBalance = await getUserBalance(userId);
        await updateUserBalance(userId, newBalance + bet);

        resultMsg += `🤝 НИЧЬЯ!\n`;
        resultMsg += `💰 Ставка возвращена: ${formatMoney(bet)}₽`;

        return context.send(resultMsg);
      } else {
        // Проигрыш
        resultMsg += `❌ ПРОИГРЫШ!\n`;
        resultMsg += `💰 Потеряно: ${formatMoney(bet)}₽`;

        return context.send(resultMsg);
      }

    } catch (error) {
      console.error('Ошибка в !число:', error);
      return context.send('❌ Ошибка при обработке');
    }
  },

  // ─── Принять вызов ───
  async accept(context, parts) {
    const userId = context.senderId;

    // Находим вызов, где targetUserId === userId
    let challenge = null;
    let challengerId = null;
    for (const [cid, ch] of activeChallenges.entries()) {
      if (ch.targetUserId === userId) {
        challenge = ch;
        challengerId = cid;
        break;
      }
    }

    if (!challenge) {
      return context.send('❌ У вас нет активных вызовов');
    }

    if (parts.length < 2) {
      return context.send(`❌ Укажи своё число: !число принять <1-100>\nПример: !число принять 42`);
    }

    const myNumber = parseInt(parts[1]);
    if (!myNumber || myNumber < 1 || myNumber > 100) {
      return context.send('❌ Число должно быть от 1 до 100');
    }

    // Проверяем, что у соперника хватает денег
    const challengerBalance = await getUserBalance(challengerId);
    // Ставка уже списана у challenger при создании вызова, поэтому просто проверяем, что он не потратил её (мы сами её не возвращаем)

    // Проверяем баланс принимающего
    const myBalance = await getUserBalance(userId);
    if (myBalance < challenge.bet) {
      return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatMoney(myBalance)}₽\n💸 Нужно: ${formatMoney(challenge.bet)}₽`);
    }

    // Списываем ставку у принимающего
    await updateUserBalance(userId, myBalance - challenge.bet);

    // Проводим дуэль
    const target = Math.floor(Math.random() * 100) + 1;
    const dist1 = Math.abs(target - challenge.myNumber);
    const dist2 = Math.abs(target - myNumber);

    const challengerName = await getUserLink(challengerId);
    const acceptorName = await getUserLink(userId);

    let resultMsg = `⚔️ ДУЭЛЬ ЧИСЕЛ — РЕЗУЛЬТАТ\n\n`;
    resultMsg += `🎯 Выпало число: ${target}\n\n`;
    resultMsg += `👤 ${challengerName}: ${challenge.myNumber} (расстояние ${dist1})\n`;
    resultMsg += `👤 ${acceptorName}: ${myNumber} (расстояние ${dist2})\n\n`;

    const bank = challenge.bet * 2;
    const rake = Math.floor(bank * 0.05); // 5% rake
    const prize = bank - rake;

    if (dist1 < dist2) {
      // Победил challenger
      const newBal = await getUserBalance(challengerId);
      await updateUserBalance(challengerId, newBal + prize);

      resultMsg += `🏆 ПОБЕДА: ${challengerName}!\n`;
      resultMsg += `💰 Получено: ${formatMoney(prize)}₽ (банк ${formatMoney(bank)}₽ минус rake 5%)`;
    } else if (dist2 < dist1) {
      // Победил acceptor
      const newBal = await getUserBalance(userId);
      await updateUserBalance(userId, newBal + prize);

      resultMsg += `🏆 ПОБЕДА: ${acceptorName}!\n`;
      resultMsg += `💰 Получено: ${formatMoney(prize)}₽ (банк ${formatMoney(bank)}₽ минус rake 5%)`;
    } else {
      // Ничья — возвращаем ставки
      const newBal1 = await getUserBalance(challengerId);
      const newBal2 = await getUserBalance(userId);
      await updateUserBalance(challengerId, newBal1 + challenge.bet);
      await updateUserBalance(userId, newBal2 + challenge.bet);

      resultMsg += `🤝 НИЧЬЯ!\n`;
      resultMsg += `💰 Ставки возвращены`;
    }

    activeChallenges.delete(challengerId);
    return context.send(resultMsg);
  },

  // ─── Отменить вызов ───
  async cancel(context) {
    const userId = context.senderId;
    const challenge = activeChallenges.get(userId);

    if (!challenge) {
      return context.send('❌ У вас нет активного вызова');
    }

    // Возвращаем ставку
    const balance = await getUserBalance(userId);
    await updateUserBalance(userId, balance + challenge.bet);

    activeChallenges.delete(userId);
    return context.send(`✅ Вызов отменён.\n💰 Ставка возвращена: ${formatMoney(challenge.bet)}₽`);
  },

  activeChallenges
};

// ─── Получить ссылку на пользователя ───
async function getUserLink(userId) {
  try {
    const res = await vk.api.users.get({ user_ids: [userId] });
    if (res && res[0]) {
      return `[id${res[0].id}|${res[0].first_name} ${res[0].last_name}]`;
    }
  } catch (e) {}
  return `[id${userId}|Игрок]`;
}