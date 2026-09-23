const fs = require('fs');
const path = require('path');
const { Keyboard } = require('vk-io');
const { vk } = require('../vkInstance.js');

const command = '/брак';
const aliases = ['/брак', '/marriage'];
const description = 'Сделать предложение о браке';

function getMarriagesFile(chat_id) {
    return path.join(__dirname, '../data/marriages_' + chat_id + '.json');
}
function getOffersFile(chat_id) {
    return path.join(__dirname, '../data/marriage_offers_' + chat_id + '.json');
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
    if (!msg.reply_message && args.length < 2) {
        return context.reply('Укажите пользователя через @, id или ответом на сообщение.');
    }
    let target_id = null;
    if (msg.reply_message) {
        target_id = msg.reply_message.from_id;
    } else {
        let mention = args[1];
        if (/^\[id(\d+)\|.*\]$/.test(mention)) {
            target_id = parseInt(mention.match(/^\[id(\d+)\|/)[1]);
        } else if (/^@?([a-zA-Z0-9_\.]+)$/.test(mention)) {
            return context.reply('Пожалуйста, используйте ответ на сообщение или ссылку вида [id123|Имя].');
        } else if (/^\d+$/.test(mention)) {
            target_id = parseInt(mention);
        }
    }
    if (!target_id || target_id == from_id) {
        return context.reply('Нельзя сделать предложение самому себе.');
    }
    // Проверка на уже существующий брак
    const marriagesFile = getMarriagesFile(chat_id);
    const marriages = loadJson(marriagesFile);
    if (marriages.some(m => (m.user1 === from_id && m.user2 === target_id) || (m.user1 === target_id && m.user2 === from_id))) {
        return context.reply('Вы уже в браке с этим пользователем!');
    }
    // Проверка на активное предложение
    const offersFile = getOffersFile(chat_id);
    let offers = loadJson(offersFile);
    if (offers.some(o => o.from_id === from_id || o.to_id === from_id)) {
        return context.reply('У вас уже есть активное предложение или вам уже сделали предложение.');
    }
    if (offers.some(o => o.to_id === target_id)) {
        return context.reply('Пользователю уже сделали предложение, дождитесь ответа.');
    }
    // Сохраняем предложение
    offers.push({ from_id, to_id: target_id, date: Date.now() });
    saveJson(offersFile, offers);
    // Получаем имена через VK API без падения
    let fromName = `[id${from_id}|Пользователь]`;
    let toName = `[id${target_id}|Пользователь]`;
    
    try {
        // Используем глобальный VK инстанс для надежности
        const globalVk = global.vk || vk;
        
        const users = await globalVk.api.users.get({ 
            user_ids: [from_id, target_id].join(','),
            fields: 'first_name,last_name'
        });
        
        if (users && users.length > 0) {
            // Находим пользователей по ID
            users.forEach(user => {
                if (user.id === from_id) {
                    fromName = `[id${from_id}|${user.first_name} ${user.last_name}]`;
                }
                if (user.id === target_id) {
                    toName = `[id${target_id}|${user.first_name} ${user.last_name}]`;
                }
            });
        }
        
    } catch (e) {
        // Оставляем кликабельные ссылки с "Пользователь" при ошибке VK API
    }
    
    // Создаем клавиатуру с кнопками (зеленая сверху, красная снизу)
    const keyboard = Keyboard.builder()
      .callbackButton({
        label: '✅ Принять',
        payload: {
          command: 'marriage_accept',
          from_id: from_id,
          to_id: target_id
        },
        color: Keyboard.POSITIVE_COLOR
      })
      .row() // Новая строка
      .callbackButton({
        label: '❌ Отказать',
        payload: {
          command: 'marriage_reject',
          from_id: from_id,
          to_id: target_id
        },
        color: Keyboard.NEGATIVE_COLOR
      })
      .inline();
    
    // Отправляем сообщение с новым текстом и фото
    context.reply({
      message: `${toName}, согласны ли Вы вступить в брак с ${fromName}?\n\n💞 Если да, то просто нажмите на зелёную кнопку. Если нет — на красную.`,
      keyboard: keyboard,
      attachment: 'photo-230511380_457239057' // Добавляем фото
    });
}

module.exports = { command, aliases, description, execute };