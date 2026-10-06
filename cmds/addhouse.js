const fs = require('fs');
const path = require('path');
const util = require('util');
const { query } = require('../databases');
const databaseQuery = util.promisify(query);

const HOUSES_FILE = path.join(__dirname, '..', 'data', 'houses.json');

function load() {
  try { if (fs.existsSync(HOUSES_FILE)) return JSON.parse(fs.readFileSync(HOUSES_FILE, 'utf8')); } catch (e) {}
  return {};
}
function save(data) {
  try {
    const dir = path.dirname(HOUSES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HOUSES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

async function isAdmin(userId) {
  try {
    const res = await databaseQuery('SELECT access FROM sysadmins WHERE userid = ?', [userId]);
    return res && res[0] && Number(res[0].access) >= 5;
  } catch (e) { return false; }
}

function extractAttachment(link) {
  if (!link) return null;
  const m = link.match(/photo(-?\d+_\d+)/i);
  if (m) return `photo${m[1]}`;
  return null;
}

function parsePrice(str) {
  const s = String(str).toLowerCase().trim();
  if (s === 'бесценно' || s === 'бесценный' || s === 'бесценная') return { priceless: true, price: null };
  if (s.includes('ккк')) return { priceless: false, price: parseFloat(s.replace('ккк', '')) * 1e12 };
  if (s.includes('млрд')) return { priceless: false, price: parseFloat(s.replace('млрд', '')) * 1e9 };
  if (s.includes('кк')) return { priceless: false, price: parseFloat(s.replace('кк', '')) * 1e6 };
  if (s.includes('к')) return { priceless: false, price: parseFloat(s.replace('к', '')) * 1e3 };
  return { priceless: false, price: parseFloat(s) || 0 };
}

module.exports = {
  command: '/addhouse',
  description: 'Добавить дом по ссылке на фото',
  aliases: ['/добавитьдом'],

  async execute(context) {
    try {
      const senderId = context.senderId;
      if (!(await isAdmin(senderId))) return context.send('❌ Недостаточно прав');

      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);

      if (parts.length < 3) {
        return context.send(
          `🏠 Добавление дома\n\n` +
          `Использование:\n` +
          `/addhouse <название> <цена|Бесценно> <ссылка на фото>\n\n` +
          `Пример:\n` +
          `/addhouse Дом Ангела Бесценно https://vk.com/photo-241585274_457239080`
        );
      }

      const link = parts[parts.length - 1];
      const priceArg = parts[parts.length - 2];
      const name = parts.slice(0, parts.length - 2).join(' ');

      if (!name) return context.send('❌ Не указано название дома.');

      const priceInfo = parsePrice(priceArg);

      const attachment = extractAttachment(link);
      if (!attachment) {
        return context.send(
          `❌ Не удалось извлечь attachment из ссылки.\n\n` +
          `Ссылка должна содержать \`photo-XXX_YYY\`.`
        );
      }

      // ─── Проверка на дубликат ───
      const houses = load();

      // Ищем дом с таким же attachment
      const existing = Object.values(houses).find(h => h.attachment === attachment);
      if (existing) {
        return context.send(
          `⚠️ Этот дом уже добавлен!\n\n` +
          `🆔 ID: ${existing.id}\n` +
          `🏠 Название: ${existing.name}\n` +
          `📎 Attachment: ${attachment}`
        );
      }

      // Находим следующий свободный ID
      let newId = 1;
      while (houses[String(newId)]) newId++;

      houses[String(newId)] = {
        id: newId,
        name,
        price: priceInfo.priceless ? null : priceInfo.price,
        priceless: priceInfo.priceless,
        attachment
      };
      save(houses);

      const priceLine = priceInfo.priceless
        ? `💰 Цена: Бесценно 💎`
        : `💰 Цена: ${priceInfo.price.toLocaleString('de-DE')}₽`;

      return context.send(
        `✅ Дом добавлен!\n\n` +
        `🆔 ID: ${newId}\n` +
        `🏠 Название: ${name}\n` +
        `${priceLine}\n` +
        `📎 Attachment: ${attachment}`
      );

    } catch (e) {
      console.error('/addhouse:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};