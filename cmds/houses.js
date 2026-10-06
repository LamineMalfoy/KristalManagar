const fs = require('fs');
const path = require('path');

const HOUSES_FILE = path.join(__dirname, '..', 'data', 'houses.json');

function load() {
  try { if (fs.existsSync(HOUSES_FILE)) return JSON.parse(fs.readFileSync(HOUSES_FILE, 'utf8')); } catch (e) {}
  return {};
}

function formatRub(amount) {
  return Number(amount || 0).toLocaleString('de-DE') + '₽';
}

module.exports = {
  command: '/houses',
  description: 'Список всех домов',
  aliases: ['/дома', '/дом'],

  async execute(context) {
    try {
      const houses = load();
      const list = Object.values(houses);

      if (list.length === 0) {
        return context.send('🏠 Пока нет добавленных домов.');
      }

      // Сортируем по id
      list.sort((a, b) => a.id - b.id);

      // Пагинация — 20 домов на страницу
      const PER_PAGE = 20;
      const text = context.text || '';
      const parts = text.trim().split(/\s+/).slice(1);
      let page = parseInt(parts[0]) || 1;
      if (page < 1) page = 1;

      const totalPages = Math.ceil(list.length / PER_PAGE);
      if (page > totalPages) page = totalPages;

      const startIdx = (page - 1) * PER_PAGE;
      const endIdx = Math.min(startIdx + PER_PAGE, list.length);
      const slice = list.slice(startIdx, endIdx);

      let msg = `🏠 Список домов (всего: ${list.length})\n`;
      msg += `📄 Страница ${page}/${totalPages}\n\n`;

      for (const h of slice) {
        const priceLine = h.priceless ? 'Бесценно 💎' : formatRub(h.price);
        msg += `🆔 ${h.id}. ${h.name} — ${priceLine}\n`;
      }

      if (totalPages > 1) {
        msg += `\n📖 /houses ${page + 1 <= totalPages ? page + 1 : 1} — следующая страница`;
      }

      return context.send(msg);

    } catch (e) {
      console.error('/houses:', e);
      return context.send(`❌ Ошибка: ${e.message}`);
    }
  }
};