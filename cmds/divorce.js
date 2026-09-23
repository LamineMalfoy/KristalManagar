const fs = require('fs');
const path = require('path');

const command = '/развод';
const aliases = ['/развод', '/divorce'];
const description = 'Расторгнуть брак';

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
function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function execute(context) {
    const msg = context.message || context;
    const chat_id = msg.peer_id || context.peerId;
    const from_id = msg.from_id || context.senderId;
    const text = msg.text ? msg.text.trim() : context.text.trim();
    let args = text.split(/\s+/);
    if (!aliases.includes(args[0].toLowerCase())) return;
    const marriagesFile = getMarriagesFile(chat_id);
    let marriages = loadJson(marriagesFile);
    const idx = marriages.findIndex(m => m.user1 === from_id || m.user2 === from_id);
    if (idx === -1) return context.reply('У вас нет брака в этом чате.');
    const partner = marriages[idx].user1 === from_id ? marriages[idx].user2 : marriages[idx].user1;
    // Получаем имя партнёра
    let partnerName = `[id${partner}|Партнёр]`;
    try {
        const info = await vk.api.users.get({ user_ids: partner });
        if (info && info[0]) partnerName = `[id${partner}|${info[0].first_name} ${info[0].last_name}]`;
    } catch (e) {}
    marriages.splice(idx, 1);
    saveJson(marriagesFile, marriages);
    context.reply(`💔 Вы успешно расторгли брак с пользователем ${partnerName}.`);
}

module.exports = { command, aliases, description, execute }; 