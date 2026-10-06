const { Keyboard } = require('vk-io');
const { checkSysAccess, canManageAccess } = require('./sysadmin.js');
const { extractNumericId } = require('./ban.js');
const { vk } = require('../index.js');
const { hasCommandAccess } = require('../utils/commandAccess.js');
const database = require('../databases.js');
const util = require('util');
const path = require('path');
const fs = require('fs');
const databaseQuery = util.promisify(database.query).bind(database);

// Список системных команд и их описания
const systemCommands = {
  ticket:      { name: '!ticket',      description: 'Тикеты',              minAccess: 1 },
  answer:      { name: '!answer',      description: 'Ответ на тикет',       minAccess: 1 },
  banreport:   { name: '!banreport',   description: 'Блок тикетов',         minAccess: 1 },
  unbanreport: { name: '!unbanreport', description: 'Разблок тикетов',      minAccess: 1 },
  rbanlist:    { name: '!rbanlist',    description: 'Список забаненных',    minAccess: 1 },
  sysadmins:   { name: '!sysadmins',   description: 'Системные админы',     minAccess: 1 },
  sysban:      { name: '!sysban',      description: 'Системный бан',        minAccess: 2 },
  unsysban:    { name: '!unsysban',    description: 'Снятие сис. бана',     minAccess: 2 },
  sysrole:     { name: '!sysrole',     description: 'Системные роли',       minAccess: 3 },
  givemoney:   { name: '!givemoney',   description: 'Выдача денег',         minAccess: 4 },
  givehouse:   { name: '!givehouse',   description: 'Выдача домов',         minAccess: 4 },
  addhouse:    { name: '!addhouse',    description: 'Добавление домов',     minAccess: 5 },
  notif:       { name: '!notif',       description: 'Уведомления',          minAccess: 3 },
  giveagent:   { name: '!giveagent',   description: 'Права агента',         minAccess: 2 },
  giveadm:     { name: '!giveadm',     description: 'Права админа',         minAccess: 3 },
  givezam:     { name: '!givezam',     description: 'Права зама',           minAccess: 4 },
  giveowner:   { name: '!giveowner',   description: 'Права основателя',     minAccess: 5 },
  null:        { name: '!null',        description: 'Снятие прав',          minAccess: 2 },
  delhouse:    { name: '!delhouse',    description: 'Удаление домов',       minAccess: 5 },
  edit:        { name: '!edit',        description: 'Управление доступом',  minAccess: 3 }
};

async function getUserCommandAccess(userId) {
  try {
    const sysAccess = await checkSysAccess(userId);
    const commandAccess = {};

    for (const cmd in systemCommands) {
      commandAccess[cmd] = sysAccess >= systemCommands[cmd].minAccess;
    }

    try {
      const userAccessFile = path.join(__dirname, '../data/user_command_access', `${userId}.json`);
      if (fs.existsSync(userAccessFile)) {
        const userAccess = JSON.parse(fs.readFileSync(userAccessFile, 'utf8'));
        for (const cmd in userAccess) {
          if (systemCommands[cmd]) commandAccess[cmd] = userAccess[cmd];
        }
      }
    } catch (fileError) {}

    return { sysAccess, commandAccess };
  } catch (error) {
    console.error('Ошибка при получении прав доступа:', error);
    return { sysAccess: 0, commandAccess: {} };
  }
}

async function updateCommandAccess(userId, command, hasAccess) {
  try {
    const userAccessDir = path.join(__dirname, '../data/user_command_access');
    const userAccessFile = path.join(userAccessDir, `${userId}.json`);

    if (!fs.existsSync(userAccessDir)) fs.mkdirSync(userAccessDir, { recursive: true });

    let userAccess = {};
    if (fs.existsSync(userAccessFile)) {
      try {
        const fileContent = fs.readFileSync(userAccessFile, 'utf8');
        if (fileContent.trim()) userAccess = JSON.parse(fileContent);
      } catch (parseError) {
        userAccess = {};
      }
    }

    userAccess[command] = hasAccess;
    fs.writeFileSync(userAccessFile, JSON.stringify(userAccess, null, 2));
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении доступа к команде:', error);
    return false;
  }
}

module.exports = {
  command: '/edit',
  aliases: [],
  description: 'Редактирование прав доступа к системным командам',
  requiredRole: 0,
  getUserCommandAccess,
  updateCommandAccess,

  async execute(context) {
    const { senderId, text } = context;
    const args = text.split(' ').slice(1);

    try {
      const hasAccess = await hasCommandAccess(senderId, 'edit');
      if (!hasAccess) return context.send('❌ У вас нет доступа к команде управления правами');

      if (args.length === 0) {
        return context.send('❌ Использование: /edit [ID пользователя]');
      }

      const targetId = await extractNumericId(args[0]);
      if (!targetId) return context.send('❌ Не удалось определить ID пользователя');

      const senderSysAccess = await checkSysAccess(senderId);
      const targetAccess = await checkSysAccess(targetId);

      if (targetAccess > senderSysAccess) {
        return context.send('🛡️ Защита системы | Вы не можете редактировать права пользователя с более высоким системным уровнем доступа');
      }

      const targetInfo = await getUserCommandAccess(targetId);

      if (!canManageAccess(senderSysAccess, targetAccess)) {
        return context.send('❌ Вы не можете редактировать права этого пользователя');
      }

      let targetName = 'Пользователь';
      try {
        const userInfo = await vk.api.users.get({ user_ids: targetId });
        if (userInfo && userInfo[0]) targetName = `${userInfo[0].first_name} ${userInfo[0].last_name}`;
      } catch (error) {}

      let message = `🎛️ Редактирование прав доступа | 👤 ${targetName} | 🔑 ${getAccessLevelName(targetInfo.sysAccess)}\n\n`;
      message += `📋 Нажмите кнопку для переключения доступа\n\n`;

      const keyboard = Keyboard.builder();

      const commandEntries = Object.entries(systemCommands);
      const pageSize = 3;
      const currentPage = 0;
      const totalPages = Math.ceil(commandEntries.length / pageSize);

      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, commandEntries.length);
      const currentPageCommands = commandEntries.slice(startIndex, endIndex);

      for (const [cmdKey, cmdInfo] of currentPageCommands) {
        const hasAccess = targetInfo.commandAccess[cmdKey];
        const color = hasAccess ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR;
        const emoji = hasAccess ? '✅' : '❌';

        keyboard.callbackButton({
          label: `${emoji} ${cmdInfo.name}`,
          payload: {
            command: 'toggle_command_access',
            target_id: targetId,
            cmd_key: cmdKey,
            editor_id: senderId,
            page: currentPage
          },
          color: color
        });
        keyboard.row();
      }

      if (totalPages > 1) {
        const navRow = [];

        if (currentPage > 0) {
          navRow.push({
            label: '⬅️ Назад',
            payload: { command: 'edit_page_nav', target_id: targetId, page: currentPage - 1, editor_id: senderId },
            color: Keyboard.SECONDARY_COLOR
          });
        }

        navRow.push({
          label: `${currentPage + 1}/${totalPages}`,
          payload: { command: 'edit_page_info', target_id: targetId, page: currentPage, editor_id: senderId },
          color: Keyboard.SECONDARY_COLOR
        });

        if (currentPage < totalPages - 1) {
          navRow.push({
            label: 'Вперёд ➡️',
            payload: { command: 'edit_page_nav', target_id: targetId, page: currentPage + 1, editor_id: senderId },
            color: Keyboard.SECONDARY_COLOR
          });
        }

        for (const btn of navRow) keyboard.callbackButton(btn);
        keyboard.row();
      }

      keyboard.callbackButton({
        label: '❌ Закрыть',
        payload: { command: 'close_edit_menu', editor_id: senderId },
        color: Keyboard.NEGATIVE_COLOR
      });

      try {
        await context.send({ message, keyboard: keyboard.inline() });
      } catch (sendError) {
        await context.send('🎛️ Редактирование прав доступа\n\n❌ Ошибка при создании интерактивного меню');
      }

    } catch (error) {
      console.error('❌ Ошибка в команде /edit:', error);
      return context.send('❌ Произошла ошибка при обработке команды');
    }
  }
};

function getAccessLevelName(level) {
  switch (level) {
    case 1: return 'Агент поддержки';
    case 2: return 'Администрация бота';
    case 3: return 'Заместитель основателя';
    case 4: return 'Основатель';
    case 5: return 'Разработчик';
    default: return 'Пользователь';
  }
}
