const { getUserBalance, updateUserBalance } = require('../filedb');
const vk = require('../vkInstance');

// Временные функции для работы с BTC и форматированием
async function getUserBTC(userId) {
  try {
    const { databaseQuery } = require('../filedb');
    const query = 'SELECT btc FROM user_balances WHERE user_id = ?';
    const result = await databaseQuery(query, [userId]);
    return result.length > 0 ? (result[0].btc || 0) : 0;
  } catch (error) {
    console.error('Ошибка получения BTC-баланса:', error);
    return 0;
  }
}

async function updateUserBTC(userId, btcAmount) {
  try {
    const { databaseQuery } = require('../filedb');
    const currentBTC = await getUserBTC(userId);
    const newBTC = currentBTC + btcAmount;
    
    await databaseQuery(`
      INSERT INTO user_balances (user_id, btc) 
      VALUES (?, ?) 
      ON DUPLICATE KEY UPDATE btc = ?
    `, [userId, newBTC, newBTC]);
    
    return newBTC;
  } catch (error) {
    console.error('Ошибка обновления BTC-баланса:', error);
    throw error;
  }
}

function formatMoney(amount) {
  if (amount >= 1000000000) {
    return `${(amount / 1000000000).toFixed(1).replace('.0', '')}млрд`;
  } else if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}кк`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1).replace('.0', '')}к`;
  } else {
    return amount.toString();
  }
}

function parseAmount(amountStr) {
  const str = amountStr.toLowerCase().trim();
  
  // Проверяем BTC
  if (str.includes('btc')) {
    const btcAmount = parseFloat(str.replace('btc', ''));
    return {
      amount: btcAmount * 230000, // 1 BTC = 230k
      isBTC: true,
      btcAmount: btcAmount,
      originalStr: amountStr
    };
  }
  
  // Парсим VK-форматы
  if (str.includes('ккк')) {
    return {
      amount: parseFloat(str.replace('ккк', '')) * 1000000000000,
      isBTC: false,
      originalStr: amountStr
    };
  } else if (str.includes('млрд')) {
    return {
      amount: parseFloat(str.replace('млрд', '')) * 1000000000,
      isBTC: false,
      originalStr: amountStr
    };
  } else if (str.includes('кк')) {
    return {
      amount: parseFloat(str.replace('кк', '')) * 1000000,
      isBTC: false,
      originalStr: amountStr
    };
  } else if (str.includes('к')) {
    return {
      amount: parseFloat(str.replace('к', '')) * 1000,
      isBTC: false,
      originalStr: amountStr
    };
  } else {
    return {
      amount: parseFloat(str) || 0,
      isBTC: false,
      originalStr: amountStr
    };
  }
}

// Маппинг чисел к фотографиям
const numberPhotos = {
  0: 'photo-230511380_457239020',
  1: 'photo-230511380_457239021',
  2: 'photo-230511380_457239022',
  3: 'photo-230511380_457239023',
  4: 'photo-230511380_457239024',
  5: 'photo-230511380_457239025',
  6: 'photo-230511380_457239026',
  7: 'photo-230511380_457239027',
  8: 'photo-230511380_457239028',
  9: 'photo-230511380_457239029',
  10: 'photo-230511380_457239030',
  11: 'photo-230511380_457239031',
  12: 'photo-230511380_457239032',
  13: 'photo-230511380_457239033',
  14: 'photo-230511380_457239034',
  15: 'photo-230511380_457239035',
  16: 'photo-230511380_457239036',
  17: 'photo-230511380_457239037',
  18: 'photo-230511380_457239038',
  19: 'photo-230511380_457239039',
  20: 'photo-230511380_457239040',
  21: 'photo-230511380_457239041',
  22: 'photo-230511380_457239042',
  23: 'photo-230511380_457239043',
  24: 'photo-230511380_457239044',
  25: 'photo-230511380_457239045',
  26: 'photo-230511380_457239046',
  27: 'photo-230511380_457239047',
  28: 'photo-230511380_457239048',
  29: 'photo-230511380_457239049',
  30: 'photo-230511380_457239050',
  31: 'photo-230511380_457239051',
  32: 'photo-230511380_457239052',
  33: 'photo-230511380_457239053',
  34: 'photo-230511380_457239054',
  35: 'photo-230511380_457239055',
  36: 'photo-230511380_457239056'
};

// Красные и черные числа
const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// Map для активных игр
const activeGames = new Map();

async function handleBet(userId, peerId, betType, amount) {
  try {
    // Проверяем, есть ли активная игра
    if (!activeGames.has(peerId)) {
      activeGames.set(peerId, {
        bets: [],
        isAccepting: true,
        timer: null
      });
    }
    
    const game = activeGames.get(peerId);
    if (!game.isAccepting) {
      return {
        success: false,
        message: '❌ В данный момент ставки не принимаются'
      };
    }
    
    // Проверяем баланс
    const balance = await getUserBalance(userId);
    if (balance < amount) {
      return {
        success: false,
        message: `❌ Недостаточно средств\n💰 Ваш баланс: ${formatMoney(balance)}$`
      };
    }
    
    // Добавляем ставку
    game.bets.push({
      userId,
      betType,
      amount
    });
    
    // Списываем средства
    await updateUserBalance(userId, balance - amount);
    
    // Если это первая ставка, запускаем таймер
    if (game.bets.length === 1) {
      game.timer = setTimeout(() => endGame(peerId), 30000); // 30 секунд на приём ставок
    }
    
    return {
      success: true,
      message: `✅ Ставка принята!\n💰 Сумма: ${formatMoney(amount)}$\n🎲 Тип ставки: ${betType}`
    };
  } catch (error) {
    console.error('Ошибка при обработке ставки:', error);
    return {
      success: false,
      message: '❌ Произошла ошибка при обработке ставки'
    };
  }
}

// Новый handler для пакетных ставок и красивого вывода
module.exports = {
  name: "рулетка",
  command: "/рулетка",
  aliases: ["roulette"],
  async handler(ctx, args) {
    const userId = ctx.senderId || ctx.user_id || ctx.from_id;
    // Получаем имя игрока и создаем кликабельную ссылку VK
    let userName = 'Игрок';
    let vkName = `[id${userId}|Игрок]`;
    
    try {
      const vkApi = require('../vkInstance');
      const userInfo = await vkApi.api.users.get({ 
        user_ids: [userId], 
        fields: ['first_name', 'last_name'] 
      });
      
      if (userInfo && userInfo[0]) {
        const user = userInfo[0];
        userName = `${user.first_name} ${user.last_name}`;
        vkName = `[id${userId}|${userName}]`;
      }
    } catch (error) {
      console.log('Не удалось получить информацию о пользователе VK:', error.message);
    }
    const peerId = ctx.peerId || ctx.peer_id || ctx.chatId || ctx.chat_id;
    // Парсим ставки (поддержка ч1 500, ч 500, к 1000)
    const bets = [];
    
    // Правильно удаляем команду из текста
    let input = '';
    if (ctx.text) {
      // Удаляем команду типа "/рулетка" или "/roulette"
      input = ctx.text.replace(/^\/[рулеткаroulette]+\s*/i, '').trim();
    }
    
    // Если ничего не осталось, пробуем args
    if (input.length === 0 && args && args.length > 0) {
      input = args.join(' ');
    }
    

    
    // Разбиваем на строки и обрабатываем каждую
    const lines = input.split(/\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) {
      // Если нет переносов строк, обрабатываем как одну строку
      lines.push(input);
    }
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        let betType = parts[0];
        let amount = null;
        
        // Проверяем разные форматы: "к 1000", "ч1 500", "ч 2000"
        if (/^\d+$/.test(parts[1])) {
          // Простой формат: "к 1000"
          amount = parseInt(parts[1]);
        } else if (parts.length >= 3 && /^\d+$/.test(parts[2])) {
          // Сложный формат: "ч 1 500" -> "ч1 500"
          betType = parts[0] + parts[1];
          amount = parseInt(parts[2]);
        }
        
        // Проверяем что ставка валидна
        if (betType && !isNaN(amount) && amount > 0) {
          bets.push({ betType, amount });
        }
      }
    });
    if (bets.length === 0) {
      return ctx.send("❌ Не удалось распознать ставки!\n\n📝 Примеры:\n• /рулетка к 1000 (на красное)\n• /рулетка ч1 500 (на первую четверть)\n• /рулетка п1 10к (на первую половину)\n\n🔍 Ваш ввод: '" + input + "'");
    }
    // Проверяем баланс на все ставки сразу
    let totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
    const balance = await getUserBalance(userId);
    if (balance < totalBet) {
      return ctx.send(`❌ Недостаточно средств\n💰 Ваш баланс: ${formatMoney(balance)}$`);
    }
    console.log(`🔍 ОТЛАДКА: Списываем ${totalBet} с баланса ${balance} для пользователя ${userId}`);
    const updateResult = await updateUserBalance(userId, balance - totalBet);
    console.log(`🔍 ОТЛАДКА: Результат обновления баланса:`, updateResult);
    
    // Проверяем что баланс действительно обновился
    const newBalance = await getUserBalance(userId);
    console.log(`🔍 ОТЛАДКА: Новый баланс после списания: ${newBalance}`);
    // --- Сохраняем ставки в игру, не дублируем ---
    if (!activeGames.has(peerId)) {
      activeGames.set(peerId, { bets: [], isAccepting: true, timer: null, users: new Set() });
    }
    const game = activeGames.get(peerId);
    
    // Проверяем, принимаются ли еще ставки
    if (!game.isAccepting) {
      return ctx.send('🚫 Прием ставок уже закрыт!\n⏰ Дождитесь результатов текущего раунда.');
    }
    
    bets.forEach(bet => {
      // Не даём ставить одинаковую ставку дважды от одного игрока
      if (!game.bets.find(b => b.userId === userId && b.betType === bet.betType)) {
        game.bets.push({ userId, userName, vkName: vkName, betType: bet.betType, amount: bet.amount });
      }
    });
    // Выводим список принятых ставок
    let msg = bets.map(bet => {
      let label = getBetLabel(bet.betType);
      
      // Если функция getBetLabel не смогла распознать тип ставки
      if (label === bet.betType) {
        // Проверяем, это ставка на конкретное число?
        if (/^\d+$/.test(bet.betType)) {
          label = `число ${bet.betType}`;
        } else {
          // Для неизвестных типов показываем как есть
          label = bet.betType;
        }
      }
      
      return `✅ ${vkName} — ${formatMoney(bet.amount)}$ на ${label}`;
    }).join('\n');
    
    // Добавляем информацию о том, что ставки приняты
    msg = `🎰 Ставки приняты:\n${msg}`;
    
    await ctx.send(msg);
    // Если это первая ставка — запускаем 10 секунд ожидания
    if (!game.timer) {
      game.timer = setTimeout(async () => {
        // Закрываем прием ставок
        game.isAccepting = false;
        await ctx.send('🚫 Прием ставок для игры "Рулетка" закрыт!\n⏰ Итоги раунда через 5 секунд...');
        
        // Ждем 5 секунд и показываем результат
        setTimeout(async () => {
          const result = await endGame(peerId);
          if (!result || !result.success) return ctx.send(result ? result.message : 'Ошибка!');
          
          // Красивое итоговое сообщение
          let msg = `🎰 ИТОГИ ИГРЫ "РУЛЕТКА"\n\n`;
          msg += `🎲 Выпало число: ${result.number} ${redNumbers.includes(result.number) ? '🔴' : blackNumbers.includes(result.number) ? '⚫' : '🟢'}\n\n`;
          
          // Показываем все ставки
          msg += `📋 СТАВКИ ИГРОКОВ:\n`;
          let totalLost = 0;
          let totalWon = 0;
          
          for (const r of result.results) {
            const betLabel = getBetLabel(r.betType);
            if (r.won) {
              msg += `✅ ${r.vkName || r.userName}\n   💰 ${formatMoney(r.betAmount)}$ на ${betLabel}\n   🎉 Выигрыш: ${formatMoney(r.prize)}$\n\n`;
              totalWon += r.prize;
            } else {
              msg += `❌ ${r.vkName || r.userName}\n   💸 ${formatMoney(r.betAmount)}$ на ${betLabel}\n   😔 Проигрыш\n\n`;
              totalLost += r.betAmount;
            }
          }
          
          // Общая статистика
          if (totalWon > 0) msg += `💎 Общий выигрыш: ${formatMoney(totalWon)}$\n`;
          if (totalLost > 0) msg += `💸 Общий проигрыш: ${formatMoney(totalLost)}$`;
          
          await ctx.send({ message: msg, attachment: result.photo });
        }, 5000);
      }, 10000);
    } else {
      // Если игра уже идет, сбрасываем таймер на 10 секунд
      clearTimeout(game.timer);
      game.timer = setTimeout(async () => {
        // Закрываем прием ставок
        game.isAccepting = false;
        await ctx.send('🚫 Прием ставок для игры "Рулетка" закрыт!\n⏰ Итоги раунда через 5 секунд...');
        
        // Ждем 5 секунд и показываем результат
        setTimeout(async () => {
          const result = await endGame(peerId);
          if (!result || !result.success) return ctx.send(result ? result.message : 'Ошибка!');
          
          // Красивое итоговое сообщение
          let msg = `🎰 ИТОГИ ИГРЫ "РУЛЕТКА"\n\n`;
          msg += `🎲 Выпало число: ${result.number} ${redNumbers.includes(result.number) ? '🔴' : blackNumbers.includes(result.number) ? '⚫' : '🟢'}\n\n`;
          
          // Показываем все ставки
          msg += `📋 СТАВКИ ИГРОКОВ:\n`;
          let totalLost = 0;
          let totalWon = 0;
          
          for (const r of result.results) {
            const betLabel = getBetLabel(r.betType);
            if (r.won) {
              msg += `✅ ${r.vkName || r.userName}\n   💰 ${formatMoney(r.betAmount)}$ на ${betLabel}\n   🎉 Выигрыш: ${formatMoney(r.prize)}$\n\n`;
              totalWon += r.prize;
            } else {
              msg += `❌ ${r.vkName || r.userName}\n   💸 ${formatMoney(r.betAmount)}$ на ${betLabel}\n   😔 Проигрыш\n\n`;
              totalLost += r.betAmount;
            }
          }
          
          // Общая статистика
          if (totalWon > 0) msg += `💎 Общий выигрыш: ${formatMoney(totalWon)}$\n`;
          if (totalLost > 0) msg += `💸 Общий проигрыш: ${formatMoney(totalLost)}$`;
          
          await ctx.send({ message: msg, attachment: result.photo });
        }, 5000);
      }, 10000);
    }
  },
  async execute(ctx) {
    await this.handler(ctx);
  }
};

function getBetLabel(type) {
  switch (type.toLowerCase()) {
    case 'к': return 'красное';
    case 'ч': return 'черное';
    case 'п1': return 'первую половину [1-18]';
    case 'п2': return 'вторую половину [19-36]';
    case 'ч1': return 'первую четверть [1-9]';
    case 'ч2': return 'вторую четверть [10-18]';
    case 'ч3': return 'третью четверть [19-27]';
    case 'ч4': return 'четвертую четверть [28-36]';
    case 'д1': return 'первую дюжину [1-12]';
    case 'д2': return 'вторую дюжину [13-24]';
    case 'д3': return 'третью дюжину [25-36]';
    default: return type;
  }
}

// --- Новый endGame с разбором ставок ---
async function endGame(peerId) {
  try {
    const game = activeGames.get(peerId);
    if (!game) return { success: false, message: 'Игра не найдена' };
    
    // Игра уже должна быть закрыта к этому моменту
    game.isAccepting = false;
    const number = Math.floor(Math.random() * 37);
    const isRed = redNumbers.includes(number);
    const isBlack = blackNumbers.includes(number);
    let results = [];
    for (const bet of game.bets) {
      const user = bet.userId;
      const amount = bet.amount;
      let won = false;
      let prize = 0;
      let betType = bet.betType;
      let coef = 0;
      // --- Разбор ставок ---
      switch (betType.toLowerCase()) {
        case 'к': case 'красное': won = isRed; coef = 2; break;
        case 'ч': case 'черное': won = isBlack; coef = 2; break;
        case '0': won = number === 0; coef = 35; break;
        case 'п1': won = number >= 1 && number <= 18; coef = 1.9; break;
        case 'п2': won = number >= 19 && number <= 36; coef = 1.9; break;
        case 'ч1': won = number >= 1 && number <= 9; coef = 3.8; break;
        case 'ч2': won = number >= 10 && number <= 18; coef = 3.8; break;
        case 'ч3': won = number >= 19 && number <= 27; coef = 3.8; break;
        case 'д1': won = number >= 1 && number <= 12; coef = 2.85; break;
        case 'д2': won = number >= 13 && number <= 24; coef = 2.85; break;
        case 'д3': won = number >= 25 && number <= 36; coef = 2.85; break;
        default: break;
      }
      if (won) {
        prize = Math.round(amount * coef);
        const balance = await getUserBalance(user);
        await updateUserBalance(user, balance + prize);
      }
      // Получаем имя игрока (если есть)
      let userName = bet.userName || 'Игрок';
      let vkName = bet.vkName || userName;
      results.push({ userId: user, userName, vkName, betType, won, prize: won ? prize : 0, betAmount: amount });
    }
    const photo = numberPhotos[number];
    return { success: true, number, results, photo };
  } catch (error) {
    console.error('Ошибка при завершении игры:', error);
    return { success: false, message: '❌ Произошла ошибка при подведении итогов' };
  } finally {
    activeGames.delete(peerId);
  }
}
