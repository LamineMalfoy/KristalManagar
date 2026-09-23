const { getUserBalance, updateUserBalance } = require('../filedb.js');
const vk = require('../vkInstance.js');

// ─── Состояние гонки по peerId: { horses, bets, status, messageId, interval } ───
const races = new Map();

const HORSES = [
  { id: 1, name: '🐎 Быстрый Ветер', coef: 2.5, chance: 0.38 },
  { id: 2, name: '🐎 Гром', coef: 3.0, chance: 0.32 },
  { id: 3, name: '🐎 Молния', coef: 4.5, chance: 0.21 },
  { id: 4, name: '🐎 Тёмная Лошадка', coef: 6.0, chance: 0.06 },
  { id: 5, name: '🐎 Чудо', coef: 15.0, chance: 0.03 }
];

const TRACK_LENGTH = 20; // длина дорожки в "шагах"

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

// ─── Отрисовка трека ───
function renderTrack(horses, positions, bets) {
  let out = '🏁 ГОНКА\n\n';
  for (const horse of horses) {
    const pos = positions[horse.id] || 0;
    const pct = Math.min(100, Math.floor((pos / TRACK_LENGTH) * 100));
    const filled = Math.round((pos / TRACK_LENGTH) * 10);
    const bar = '▬'.repeat(filled) + '🏇' + '▬'.repeat(Math.max(0, 10 - filled));

    // Сумма ставок на эту лошадь
    let betSum = 0;
    for (const b of bets) if (b.horseId === horse.id) betSum += b.amount;

    out += `${horse.id}. ${horse.name} x${horse.coef}\n`;
    out += `[${bar}] ${pct}%`;
    if (betSum > 0) out += `  💰 ${formatMoney(betSum)}₽`;
    out += '\n\n';
  }
  return out.trim();
}

module.exports = {
  command: '!гонка',
  description: 'Скачки на лошадях',
  aliases: ['/гонка', '!race'],

  async execute(context) {
    try {
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);
      const peerId = context.peerId;
      const userId = context.senderId;

      // ─── !гонка старт ───
      if (parts[0] && parts[0].toLowerCase() === 'старт') {
        return await this.start(context);
      }

      // ─── !гонка отмена ───
      if (parts[0] && parts[0].toLowerCase() === 'отмена') {
        return await this.cancel(context);
      }

      // ─── !гонка (список лошадей) ───
      let race = races.get(peerId);
      if (!race) {
        race = { horses: HORSES, bets: [], status: 'betting', messageId: null, interval: null };
        races.set(peerId, race);
      }

      if (race.status === 'running') {
        return context.send('🏁 Гонка уже идёт! Дождитесь окончания.');
      }

      let msg = `🏇 ДОСТУПНЫЕ ЛОШАДИ\n\n`;
      for (const h of HORSES) {
        const winChance = Math.round(h.chance * 100);
        msg += `${h.id}. ${h.name}\n`;
        msg += `   Коэф: x${h.coef} | Шанс победы: ${winChance}%\n\n`;
      }
      msg += `💰 Поставить: !ставка <сумма> <номер>\n`;
      msg += `🎯 Запустить: !гонка старт (нужно 2+ игрока)\n`;
      msg += `❌ Отменить ставку: !гонка отмена`;

      // Показываем сделанные ставки
      if (race.bets.length > 0) {
        msg += `\n\n📋 ТЕКУЩИЕ СТАВКИ:\n`;
        for (const b of race.bets) {
          msg += `• [id${b.userId}|Игрок] → ${b.horseId} (${formatMoney(b.amount)}₽)\n`;
        }
      }

      return context.send(msg);

    } catch (error) {
      console.error('Ошибка в !гонка:', error);
      return context.send('❌ Ошибка при показе лошадей');
    }
  },

  // ─── Ставка ───
  async bet(context, betAmount, horseId) {
    const peerId = context.peerId;
    const userId = context.senderId;

    let race = races.get(peerId);
    if (!race) {
      race = { horses: HORSES, bets: [], status: 'betting', messageId: null, interval: null };
      races.set(peerId, race);
    }

    if (race.status === 'running') {
      return context.send('🏁 Гонка уже идёт! Ставки не принимаются.');
    }

    if (!horseId || horseId < 1 || horseId > 5) {
      return context.send('❌ Номер лошади: от 1 до 5');
    }

    if (race.bets.find(b => b.userId === userId)) {
      return context.send('❌ Вы уже сделали ставку. Отмените: !гонка отмена');
    }

    const balance = await getUserBalance(userId);
    if (balance < betAmount) {
      return context.send(`❌ Недостаточно средств\n💰 Баланс: ${formatMoney(balance)}₽`);
    }

    await updateUserBalance(userId, balance - betAmount);

    const horse = HORSES.find(h => h.id === horseId);
    race.bets.push({ userId, horseId, amount: betAmount });

    let msg = `✅ Ставка принята!\n\n`;
    msg += `🐎 Лошадь: ${horse.name}\n`;
    msg += `💰 Сумма: ${formatMoney(betAmount)}₽\n`;
    msg += `📊 Коэф: x${horse.coef}\n\n`;
    msg += `👥 Всего игроков: ${race.bets.length}\n`;

    if (race.bets.length >= 2) {
      msg += `\n🎯 Можно запускать: !гонка старт`;
    } else {
      msg += `\n⏳ Нужен ещё 1 игрок для старта`;
    }

    return context.send(msg);
  },

  // ─── Старт гонки ───
  async start(context) {
    const peerId = context.peerId;
    const race = races.get(peerId);

    if (!race || race.bets.length === 0) {
      return context.send('❌ Нет ставок. Начните: !ставка <сумма> <номер>');
    }

    if (race.bets.length < 2) {
      return context.send('❌ Нужно минимум 2 игрока для старта');
    }

    if (race.status === 'running') {
      return context.send('🏁 Гонка уже идёт!');
    }

    race.status = 'running';

    // Позиции лошадей на дорожке
    const positions = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    // Скорости: у каждой лошади своя базовая скорость + случайность
    const baseSpeed = {};
    for (const h of HORSES) {
      baseSpeed[h.id] = h.chance * 3 + Math.random() * 0.5;
    }

    // Отправляем стартовое сообщение
    const startMsg = `🏁 ГОНКА НАЧАЛАСЬ!\n\n${renderTrack(HORSES, positions, race.bets)}`;
    const sent = await context.send(startMsg);

    // Пытаемся получить ID сообщения
    let messageId = null;
    try {
      // vk-io возвращает объект с conversation_message_id или message_id
      if (sent && sent.conversation_message_id) messageId = sent.conversation_message_id;
      else if (sent && sent.id) messageId = sent.id;
    } catch (e) {}

    race.messageId = messageId;

    // Интервал обновления — каждые 2 секунды
    race.interval = setInterval(async () => {
      try {
        // Каждая лошадь двигается вперёд
        for (const h of HORSES) {
          const speed = baseSpeed[h.id];
          const step = Math.max(0, Math.floor(speed * (0.5 + Math.random() * 1.5)));
          positions[h.id] += step;
        }

        // Проверяем, есть ли победитель (дошёл до конца)
        let winnerId = null;
        for (const h of HORSES) {
          if (positions[h.id] >= TRACK_LENGTH) {
            winnerId = h.id;
            break;
          }
        }

        // Обновляем сообщение
        const progressMsg = `🏁 ГОНКА ИДЁТ!\n\n${renderTrack(HORSES, positions, race.bets)}`;

        if (race.messageId) {
          try {
            await vk.api.messages.edit({
              peer_id: peerId,
              conversation_message_id: race.messageId,
              message: progressMsg
            });
          } catch (editErr) {
            // Если не удалось отредактировать — отправляем новое
            const newSent = await context.send(progressMsg);
            if (newSent && newSent.conversation_message_id) race.messageId = newSent.conversation_message_id;
          }
        } else {
          const newSent = await context.send(progressMsg);
          if (newSent && newSent.conversation_message_id) race.messageId = newSent.conversation_message_id;
        }

        // Если есть победитель — завершаем
        if (winnerId) {
          clearInterval(race.interval);
          race.interval = null;
          race.status = 'betting';

          const winner = HORSES.find(h => h.id === winnerId);
          let finishMsg = `🏆 ФИНИШ!\n\n`;
          finishMsg += `🥇 Победила лошадь: ${winner.name} (№${winner.id}, x${winner.coef})\n\n`;

          // Подсчёт выигрышей
          const winners = race.bets.filter(b => b.horseId === winnerId);
          const losers = race.bets.filter(b => b.horseId !== winnerId);

          if (winners.length > 0) {
            finishMsg += `💰 ВЫИГРЫШИ:\n`;
            for (const b of winners) {
              const win = Math.floor(b.amount * winner.coef * 0.95); // RTP 95%
              const bal = await getUserBalance(b.userId);
              await updateUserBalance(b.userId, bal + win);
              finishMsg += `• [id${b.userId}|Игрок] — ${formatMoney(win)}₽\n`;
            }
          } else {
            finishMsg += `😔 Никто не угадал победителя.\n`;
          }

          if (losers.length > 0) {
            finishMsg += `\n❌ Проиграли:\n`;
            for (const b of losers) {
              finishMsg += `• [id${b.userId}|Игрок] — потеряно ${formatMoney(b.amount)}₽\n`;
            }
          }

          finishMsg += `\n🔄 Можно начинать новую: !ставка <сумма> <номер>`;

          await context.send(finishMsg);

          // Сбрасываем гонку
          race.bets = [];
          race.messageId = null;
          races.set(peerId, race);
        }

      } catch (err) {
        console.error('Ошибка в интервале гонки:', err);
        clearInterval(race.interval);
        race.interval = null;
        race.status = 'betting';
      }
    }, 2000);

    return;
  },

  // ─── Отмена ставки ───
  async cancel(context) {
    const peerId = context.peerId;
    const userId = context.senderId;
    const race = races.get(peerId);

    if (!race) {
      return context.send('❌ У вас нет активной ставки');
    }

    if (race.status === 'running') {
      return context.send('❌ Гонка уже идёт — отменить нельзя');
    }

    const idx = race.bets.findIndex(b => b.userId === userId);
    if (idx === -1) {
      return context.send('❌ У вас нет ставки');
    }

    const bet = race.bets[idx];
    race.bets.splice(idx, 1);

    const balance = await getUserBalance(userId);
    await updateUserBalance(userId, balance + bet.amount);

    return context.send(`✅ Ставка отменена\n💰 Возврат: ${formatMoney(bet.amount)}₽`);
  },

  races
};