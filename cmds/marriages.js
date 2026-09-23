const fs = require('fs');
const path = require('path');

const command = '/браки';
const aliases = ['/браки', '/marriages'];
const description = 'Показать список браков в чате';

function getMarriagesFile(chat_id) {
    return path.join(__dirname, '../data/marriages_' + chat_id + '.json');
}
function loadJson(file) {
    try {
        if (!fs.existsSync(file)) return [];
        const data = fs.readFileSync(file, 'utf8');
        if (!data) return [];
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function execute(context) {
    const msg = context.message || context;
    const chat_id = msg.peer_id || context.peerId;
    const text = msg.text ? msg.text.trim() : context.text.trim();
    let args = text.split(/\s+/);
    if (!aliases.includes(args[0].toLowerCase())) return;
    const marriages = loadJson(getMarriagesFile(chat_id));
    if (!marriages.length) return context.reply('В этом чате пока нет браков.');
    // Собираем все user_id для запроса
    const userIds = [];
    marriages.forEach(m => { userIds.push(m.user1, m.user2); });
    // Получаем имена через VK API
    let usersInfo = [];
    try {
        usersInfo = await vk.api.users.get({ user_ids: userIds.join(','), fields: 'first_name,last_name' });
    } catch (e) {}
    const userMap = {};
    usersInfo.forEach(u => { userMap[u.id] = u; });
    let out = '💍 Браки в этом чате:\n';
    marriages.forEach((m, i) => {
        const u1 = userMap[m.user1] ? `[id${m.user1}|${userMap[m.user1].first_name} ${userMap[m.user1].last_name}]` : `[id${m.user1}|Пользователь 1]`;
        const u2 = userMap[m.user2] ? `[id${m.user2}|${userMap[m.user2].first_name} ${userMap[m.user2].last_name}]` : `[id${m.user2}|Пользователь 2]`;
        out += `${i+1}. ${u1} + ${u2} (${new Date(m.date).toLocaleDateString()})\n`;
    });
    context.reply(out);
}

module.exports = { command, aliases, description, execute }; 