const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC, getUserVipStatus } = require('../filedb');
const vk = require('../vkInstance');
const { updateGameStats } = require('./top.js');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);

async function isDev(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    return res && res[0] && Number(res[0].access) === 5;
  } catch (e) { return false; }
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}трлн`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}млрд`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}кк`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}к`;
  return n.toString();
}

function parseAmount(str) {
  const s = String(str).toLowerCase().trim();
  if (s.includes('ккк')) return parseFloat(s.replace('ккк', '')) * 1e12;
  if (s.includes('млрд')) return parseFloat(s.replace('млрд', '')) * 1e9;
  if (s.includes('кк')) return parseFloat(s.replace('кк', '')) * 1e6;
  if (s.includes('к')) return parseFloat(s.replace('к', '')) * 1e3;
  return parseFloat(s) || 0;
}

const numberPhotos = {
  0: 'photo-230511380_457239020', 1: 'photo-230511380_457239021', 2: 'photo-230511380_457239022',
  3: 'photo-230511380_457239023', 4: 'photo-230511380_457239024', 5: 'photo-230511380_457239025',
  6: 'photo-230511380_457239026', 7: 'photo-230511380_457239027', 8: 'photo-230511380_457239028',
  9: 'photo-230511380_457239029', 10: 'photo-230511380_457239030', 11: 'photo-230511380_457239031',
  12: 'photo-230511380_457239032', 13: 'photo-230511380_457239033', 14: 'photo-230511380_457239034',
  15: 'photo-230511380_457239035', 16: 'photo-230511380_457239036', 17: 'photo-230511380_457239037',
  18: 'photo-230511380_457239038', 19: 'photo-230511380_457239039', 20: 'photo-230511380_457239040',
  21: 'photo-230511380_457239041', 22: 'photo-230511380_457239042', 23: 'photo-230511380_457239043',
  24: 'photo-230511380_457239044', 25: 'photo-230511380_457239045', 26: 'photo-230511380_457239046',
  27: 'photo-230511380_457239047', 28: 'photo-230511380_457239048', 29: 'photo-230511380_457239049',
  30: 'photo-230511380_457239050', 31: 'photo-230511380_457239051', 32: 'photo-230511380_457239052',
  33: 'photo-230511380_457239053', 34: 'photo-230511380_457239054', 35: 'photo-230511380_457239055',
  36: 'photo-230511380_457239056'
};

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// Счётчик подряд-проигрышей для разраба
const devLossStreak = new Map();
const DEV_MAX_LOSS_STREAK = 2; // максимум 2 проигрыша подряд, потом подкрутка

function getBetLabel(type) {
  const t = type.toLowerCase();
  if (t === 'к' || t === 'красное') return 'красное';
  if (t === 'ч' || t === 'черное' || t === 'чёрное') return 'чёрное';
  if (t === 'чет' || t === 'чёт') return 'чёт';
  if (t === 'нечет' || t === 'нечёт') return 'нечёт';
  if (t === '1-12') return '1-12';
  if (t === '13-24') return '13-24';
  if (t === '19-36') return '19-36';
  if (t === 'ряд1') return 'ряд 1';
  if (t === 'ряд2') return 'ряд 2';
  if (t === 'ряд3') return 'ряд 3';
  if (/^\d+$/.test(t)) return `число ${t}`;
  return type;
}

function isValidBetType(type) {
  const t = type.toLowerCase();
  const valid = ['к', 'красное', 'ч', 'черное', 'чёрное', 'чет', 'чёт', 'нечет', 'нечёт', '1-12', '13-24', '19-36', 'ряд1', 'ряд2', 'ряд3'];
  if (valid.includes(t)) return true;
  if (/^\d+$/.test(t)) { const n = parseInt(t); return n >= 0 && n <= 36; }
  return false;
}

function checkWin(betType, number) {
  const t = betType.toLowerCase();
  const isRed = redNumbers.includes(number);
  const isBlack = blackNumbers.includes(number);
  const isEven = number !== 0 && number % 2 === 0;
  const isOdd = number % 2 !== 0;
  switch (t) {
    case 'к': case 'красное': return { won: isRed, coef: 2 };
    case 'ч': case 'черное': case 'чёрное': return { won: isBlack, coef: 2 };
    case 'чет': case 'чёт': return { won: isEven, coef: 2 };
    case 'нечет': case 'нечёт': return { won: isOdd, coef: 2 };
    case '1-12': return { won: number >= 1 && number <= 12, coef: 3 };
    case '13-24': return { won: number >= 13 && number <= 24, coef: 3 };
    case '19-36': return { won: number >= 19 && number <= 36, coef: 3 };
    case 'ряд1': return { won: number !== 0 && number % 3 === 1, coef: 3 };
    case 'ряд2': return { won: number !== 0 && number % 3 === 2, coef: 3 };
    case 'ряд3': return { won: number !== 0 && number % 3 === 0, coef: 3 };
    default:
      if (/^\d+$/.test(t)) return { won: number === parseInt(t), coef: 50 };
      return { won: false, coef: 0 };
  }
}

module.exports = {
  name: 'рулетка',
  command: '/рулетка',
  aliases: ['/roulette'],

  async handler(ctx, args) {
    const userId = ctx.senderId;

    let vkName = `[id${userId}|Игрок]`;
    try {
      const userInfo = await vk.api.users.get({ user_ids: [userId], fields: ['first_name', 'last_name'] });
      if (userInfo && userInfo[0]) vkName = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
    } catch (e) {}

    let input = '';
    if (ctx.text) input = ctx.text.replace(/^\/[рулеткаroulette]+\s*/i, '').trim();
    if (!input && args && args.length > 0) input = args.join(' ');

    const lines = input.split(/\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) lines.push(input);

    // ── Парсим ВСЕ ставки СНАЧАЛА, чтобы ВБ знал полную сумму ──
    const rawBets = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      let betType = parts[0].toLowerCase();
      let amountStr = parts[1];

      // ряд1 2 3 — три числа
      if (/^ряд\d?$/i.test(parts[0]) && parts.length >= 3) {
        betType = parts[0] + (parts[1].match(/^\d$/) ? parts[1] : '');
        const amtStr2 = parts[2];
        if (!isValidBetType(betType)) continue;
        rawBets.push({ betType, amountStr: amtStr2 });
        continue;
      }

      if (!isValidBetType(betType)) {
        return ctx.send(`❌ Неизвестный тип: «${betType}»`);
      }

      rawBets.push({ betType, amountStr });
    }

    if (rawBets.length === 0) {
      return ctx.send(`❓ Неверный формат. Пример:\n/рулетка красное 1000\n/рулетка чет вб`);
    }

    // ── Считаем сколько ставок "вб" (весь баланс) ──
    const vbetCount = rawBets.filter(b => {
      const s = String(b.amountStr).toLowerCase();
      return s === 'вб' || s === 'все';
    }).length;

    const balance = Number(await getUserBalance(userId));

    // Если ВБ одна — это весь баланс. Если ВБ несколько — делим баланс между ними
    let vbetShare = 0;
    if (vbetCount > 0) {
      vbetShare = balance / vbetCount;
    }

    const bets = [];
    for (const rb of rawBets) {
      const s = String(rb.amountStr).toLowerCase();
      let amount;
      if (s === 'вб' || s === 'все') {
        amount = vbetShare;
      } else {
        amount = parseAmount(rb.amountStr);
      }
      if (amount <= 0) continue;
      bets.push({ betType: rb.betType, amount });
    }

    if (bets.length === 0) {
      return ctx.send(`❓ Неверный формат. Пример:\n/рулетка красное 1000\n/рулетка чет вб`);
    }

    const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

    if (balance < totalBet) {
      return ctx.send(`❌ Недостаточно средств\n💰 Ваш баланс: ${formatMoney(balance)}₽`);
    }

    await updateUserBalance(userId, balance - totalBet);

    // ─── ПОДКРУТКА ДЛЯ РАЗРАБА ───
    const isOwner = await isDev(userId);
    let number;

    if (isOwner) {
      // Ищем числа, при которых выигрывают ВСЕ ставки
      const winningNums = [];
      for (let n = 0; n <= 36; n++) {
        let allWin = true;
        for (const bet of bets) {
          const { won } = checkWin(bet.betType, n);
          if (!won) { allWin = false; break; }
        }
        if (allWin) winningNums.push(n);
      }

      const streak = devLossStreak.get(userId) || 0;

      if (winningNums.length > 0 && (streak >= DEV_MAX_LOSS_STREAK || Math.random() < 0.5)) {
        // Либо подряд проиграл — даём победу, либо рандомно подкручиваем в победу
        number = winningNums[Math.floor(Math.random() * winningNums.length)];
      } else if (winningNums.length === 0) {
        // Нет числа, где выигрывают все — берём число где выигрывает хотя бы одна ставка
        const winners = [];
        for (let n = 0; n <= 36; n++) {
          for (const bet of bets) {
            const { won } = checkWin(bet.betType, n);
            if (won) { winners.push(n); break; }
          }
        }
        if (winners.length > 0 && (streak >= DEV_MAX_LOSS_STREAK || Math.random() < 0.7)) {
          number = winners[Math.floor(Math.random() * winners.length)];
        } else {
          // Честный рандом — но гарантируем что не все проиграют на 3-й раз
          if (streak >= DEV_MAX_LOSS_STREAK && winners.length > 0) {
            number = winners[Math.floor(Math.random() * winners.length)];
          } else {
            number = Math.floor(Math.random() * 37);
          }
        }
      } else {
        // Есть выигрышные варианты, но рандом не дал победу — крутим честно
        number = Math.floor(Math.random() * 37);
      }
    } else {
      number = Math.floor(Math.random() * 37);
    }

    // ── Учёт винстрика/лосстрика для разраба ──
    let anyWin = false;
    for (const bet of bets) {
      const { won } = checkWin(bet.betType, number);
      if (won) { anyWin = true; break; }
    }

    if (isOwner) {
      if (anyWin) {
        devLossStreak.set(userId, 0);
      } else {
        devLossStreak.set(userId, (devLossStreak.get(userId) || 0) + 1);
      }
    }

    const colorEmoji = redNumbers.includes(number) ? '🔴' : blackNumbers.includes(number) ? '⚫' : '🟢';

    let msg = `🎰 ИТОГИ ИГРЫ "РУЛЕТКА"\n\n🎲 Выпало число: ${number} ${colorEmoji}\n\n`;

    let totalLost = 0;

    for (const bet of bets) {
      const { won, coef } = checkWin(bet.betType, number);
      const betLabel = getBetLabel(bet.betType);
      const betDisplay = `${formatMoney(bet.amount)}₽`;

      if (won) {
        const vipStatus = await getUserVipStatus(userId);
        let vipMultiplier = 1;
        if (vipStatus && vipStatus.isVip) vipMultiplier = 2;

        const ownerMultiplier = isOwner ? 1000000000 : 1;

        const prize = Math.floor(bet.amount * coef * vipMultiplier * ownerMultiplier);

        const currentBalance = Number(await getUserBalance(userId));
        await updateUserBalance(userId, currentBalance + prize);

        await updateGameStats(userId, 'casino', true);

        const ownerNote = isOwner ? ' 👑 ВЛАДЕЛЕЦ x1.000.000.000!' : '';
        msg += `✅ ${vkName} — ${betDisplay} на ${betLabel}\n— Приз: ${formatMoney(prize)}₽${ownerNote}\n`;
      } else {
        msg += `❌ ${vkName} — ${betDisplay} на ${betLabel}\n`;
        totalLost += bet.amount;
      }
    }

    if (totalLost > 0) msg += `\n💰 Проиграно: ${formatMoney(totalLost)}₽`;

    await ctx.send({ message: msg, attachment: numberPhotos[number] || numberPhotos[0] });
  },

  async execute(ctx) {
    await this.handler(ctx);
  }
};