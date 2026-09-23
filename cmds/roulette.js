const { getUserBalance, updateUserBalance, getUserBTC, updateUserBTC, getUserVipStatus } = require('../filedb');
const vk = require('../vkInstance');
const { updateGameStats } = require('./top.js');

function formatMoney(amount) {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  }
  return amount.toString();
}

function parseAmount(amountStr) {
  const str = amountStr.toLowerCase().trim();
  if (str.includes('btc') || str.includes('бтс')) {
    const btcAmount = parseFloat(str.replace(/(btc|бтс)/i, ''));
    return { amount: btcAmount * 320000, isBTC: true, btcAmount };
  }
  if (str.includes('ккк')) return { amount: parseFloat(str.replace('ккк', '')) * 1000000000000, isBTC: false };
  if (str.includes('млрд')) return { amount: parseFloat(str.replace('млрд', '')) * 1000000000, isBTC: false };
  if (str.includes('кк')) return { amount: parseFloat(str.replace('кк', '')) * 1000000, isBTC: false };
  if (str.includes('к')) return { amount: parseFloat(str.replace('к', '')) * 1000, isBTC: false };
  return { amount: parseFloat(str) || 0, isBTC: false };
}

const numberPhotos = {
  0: 'photo-230511380_457239020', 1: 'photo-230511380_457239021',
  2: 'photo-230511380_457239022', 3: 'photo-230511380_457239023',
  4: 'photo-230511380_457239024', 5: 'photo-230511380_457239025',
  6: 'photo-230511380_457239026', 7: 'photo-230511380_457239027',
  8: 'photo-230511380_457239028', 9: 'photo-230511380_457239029',
  10: 'photo-230511380_457239030', 11: 'photo-230511380_457239031',
  12: 'photo-230511380_457239032', 13: 'photo-230511380_457239033',
  14: 'photo-230511380_457239034', 15: 'photo-230511380_457239035',
  16: 'photo-230511380_457239036', 17: 'photo-230511380_457239037',
  18: 'photo-230511380_457239038', 19: 'photo-230511380_457239039',
  20: 'photo-230511380_457239040', 21: 'photo-230511380_457239041',
  22: 'photo-230511380_457239042', 23: 'photo-230511380_457239043',
  24: 'photo-230511380_457239044', 25: 'photo-230511380_457239045',
  26: 'photo-230511380_457239046', 27: 'photo-230511380_457239047',
  28: 'photo-230511380_457239048', 29: 'photo-230511380_457239049',
  30: 'photo-230511380_457239050', 31: 'photo-230511380_457239051',
  32: 'photo-230511380_457239052', 33: 'photo-230511380_457239053',
  34: 'photo-230511380_457239054', 35: 'photo-230511380_457239055',
  36: 'photo-230511380_457239056'
};

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

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
  if (/^\d+₽/.test(t)) return `число ${t}`;
  return type;
}

function isValidBetType(type) {
  const t = type.toLowerCase();
  const valid = ['к', 'красное', 'ч', 'черное', 'чёрное', 'чет', 'чёт', 'нечет', 'нечёт', '1-12', '13-24', '19-36', 'ряд1', 'ряд2', 'ряд3'];
  if (valid.includes(t)) return true;
  if (/^\d+₽/.test(t)) {
    const n = parseInt(t);
    return n >= 0 && n <= 36;
  }
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
      if (/^\d+₽/.test(t)) return { won: number === parseInt(t), coef: 50 };
      return { won: false, coef: 0 };
  }
}

module.exports = {
  name: 'рулетка',
  command: '/рулетка',
  aliases: ['/roulette'],

  async handler(ctx, args) {
    const userId = ctx.senderId || ctx.user_id || ctx.from_id;
    const peerId = ctx.peerId || ctx.peer_id || ctx.chatId || ctx.chat_id;

    let vkName = `[id${userId}|Игрок]`;
    try {
      const userInfo = await vk.api.users.get({ user_ids: [userId], fields: ['first_name', 'last_name'] });
      if (userInfo && userInfo[0]) {
        vkName = `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
      }
    } catch (e) { /* ignore */ }

    let input = '';
    if (ctx.text) input = ctx.text.replace(/^\/[рулеткаroulette]+\s*/i, '').trim();
    if (!input && args && args.length > 0) input = args.join(' ');
    input = input.replace(/\s+на\s+\d+/gi, '');

    const lines = input.split(/\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) lines.push(input);

    const bets = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      let betType = parts[0].toLowerCase();
      let isBTC = false;
      let btcAmount = 0;
      let amount = null;

      if (/^\d+₽/.test(parts[1])) {
        amount = parseInt(parts[1]);
      } else if (/^\d*\.?\d+(btc|бтс)₽/i.test(parts[1])) {
        btcAmount = parseFloat(parts[1].replace(/(btc|бтс)/i, ''));
        amount = btcAmount * 320000;
        isBTC = true;
      } else {
        const parsed = parseAmount(parts[1]);
        amount = parsed.amount;
        isBTC = parsed.isBTC || false;
        btcAmount = parsed.btcAmount || 0;
      }

      if (/^ряд\d?₽/i.test(parts[0]) && parts.length >= 3) {
        betType = parts[0] + (parts[1].match(/^\d₽/) ? parts[1] : '');
        if (/^\d+₽/.test(parts[2])) amount = parseInt(parts[2]);
        else if (/^\d*\.?\d+(btc|бтс)₽/i.test(parts[2])) {
          btcAmount = parseFloat(parts[2].replace(/(btc|бтс)/i, ''));
          amount = btcAmount * 320000;
          isBTC = true;
        } else {
          const parsed = parseAmount(parts[2]);
          amount = parsed.amount;
          isBTC = parsed.isBTC || false;
          btcAmount = parsed.btcAmount || 0;
        }
      }

      if (!isValidBetType(betType)) {
        return ctx.send(`❌ Неизвестный тип ставки: «${betType}»

🎯 Доступные:
• красное / черное / чет / нечет — x2
• 1-12 / 13-24 / 19-36 / ряд1 / ряд2 / ряд3 — x3
• число 0–36 — x50`);
      }

      if (!amount || amount <= 0) continue;
      bets.push({ betType, amount, isBTC, btcAmount });
    }

    if (bets.length === 0) {
      return ctx.send(`❓ Неверный формат. Примеры:

/рулетка красное 1000
/рулетка чет 5к
/рулетка ряд1 500
/рулетка 5 1кк

🎯 Коэффициенты:
• красное / черное / чет / нечет — x2
• 1-12 / 13-24 / 19-36 / ряд1 / ряд2 / ряд3 — x3
• число 0–36 — x50`);
    }

    const totalDollar = bets.filter(b => !b.isBTC).reduce((s, b) => s + b.amount, 0);
    const totalBTC = bets.filter(b => b.isBTC).reduce((s, b) => s + b.btcAmount, 0);

    if (totalDollar > 0) {
      const balance = await getUserBalance(userId);
      if (balance < totalDollar) {
        return ctx.send(`❌ Недостаточно долларов\n💰 Ваш баланс: ${formatMoney(balance)}₽`);
      }
    }
    if (totalBTC > 0) {
      const btcBalance = await getUserBTC(userId);
      if (btcBalance < totalBTC) {
        return ctx.send(`❌ Недостаточно BTC\n₿ Ваш баланс: ${btcBalance} BTC`);
      }
    }

    // Списываем деньги
    if (totalDollar > 0) {
      const balance = await getUserBalance(userId);
      await updateUserBalance(userId, balance - totalDollar);
    }
    if (totalBTC > 0) {
      const btcBalance = await getUserBTC(userId);
      await updateUserBTC(userId, btcBalance - totalBTC);
    }

    // ─── СРАЗУ крутим рулетку и отвечаем ───
    const number = Math.floor(Math.random() * 37);
    const colorEmoji = redNumbers.includes(number) ? '🔴' : blackNumbers.includes(number) ? '⚫' : '🟢';

    let msg = `🎰 ИТОГИ ИГРЫ "РУЛЕТКА"\n\n`;
    msg += `🎲 Выпало число: ${number} ${colorEmoji}\n\n`;

    let totalLost = 0;

    for (const bet of bets) {
      const { won, coef } = checkWin(bet.betType, number);
      const betLabel = getBetLabel(bet.betType);
      const betDisplay = bet.isBTC ? `${bet.btcAmount} BTC` : `${formatMoney(bet.amount)}₽`;

      if (won) {
        const vipStatus = await getUserVipStatus(userId);
        let vipMultiplier = 1;
        let vipMessage = '';
        if (vipStatus && vipStatus.isVip) {
          vipMultiplier = 2.0;
          vipMessage = ' 👑 VIP x2.0!';
        }

        let prize;
        if (bet.isBTC) {
          prize = bet.btcAmount * coef * vipMultiplier;
          const currentBTC = await getUserBTC(userId);
          await updateUserBTC(userId, currentBTC + prize);
        } else {
          prize = Math.floor(bet.amount * coef * vipMultiplier);
          const currentBalance = await getUserBalance(userId);
          await updateUserBalance(userId, currentBalance + prize);
        }

        await updateGameStats(userId, 'casino', true);

        const prizeDisplay = bet.isBTC ? `${prize.toFixed(4)} BTC` : `${formatMoney(prize)}₽`;
        msg += `✅ ${vkName} — ${betDisplay} на ${betLabel}\n— Приз: ${prizeDisplay}${vipMessage}\n`;
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
