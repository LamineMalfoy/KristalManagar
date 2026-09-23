const database = require('../databases.js');
const { checkUserRole, checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const util = require('util');
const queryAsync = util.promisify(database.query).bind(database);
const fs = require('fs');
const path = require('path');
const { Keyboard } = require('vk-io');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { invalidateChatSettings } = require('../optimized_util.js');

module.exports = {
  command: '/settings',
  description: 'Настройки беседы',
  execute: async (context) => {
    const { peerId, text, senderId } = context;
    const conferenceId = peerId;
    const messageText = context.text;
    const parts = messageText.split(' ');

    try {
      if (!await checkIfTableExists(`conference_${peerId}`)) {
        console.error('Таблица не существует');
        return context.send('❌ Беседа не зарегистрирована! Используйте команду /start для регистрации.');
      }

      // Проверяем приоритет команды через editcmd
      const hasPermission = await checkCommandPriority(peerId, senderId, '/settings');
      if (!hasPermission) {
        const priorities = await getCommandPriorities(peerId);
        const requiredRole = priorities['/settings'] || 80;
        const senderUserRole = await getUserRole(peerId, context.senderId);
        const senderRoleName = await getRoleName(peerId, senderUserRole);
        return context.reply(`⛔ Доступ запрещён | Для использования команды /settings требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderUserRole})`);
      }

      // Проверяем существование записи в таблице conference
      const conferenceFilePath = path.join(__dirname, '..', 'data', 'conference', `${conferenceId}.json`);
      let settings = {};
      
      if (fs.existsSync(conferenceFilePath)) {
        try {
          const fileContent = fs.readFileSync(conferenceFilePath, 'utf8');
          settings = JSON.parse(fileContent);
        } catch (error) {
          console.error('Ошибка при чтении файла настроек:', error);
          return context.send('❌ Ошибка при чтении настроек беседы.');
        }
      } else {
        // Если файл не существует, создаем его с базовыми настройками
        settings = {
          conference_id: conferenceId,
          games: 0,
          kick_leave: 0,
          rules: null,
          public: null,
          uniquekey: Math.random().toString(36).substring(2, 7),
          hello_text: null,
          stickers: 0,
          docs: 0,
          reposts: 0,
          links: 0,
          images: 0,
          groups: 0,
          video: 0,
          cooldown: 0,
          spam: 0,
          system_notifications_enabled: 0,
          notifications: 0
        };
        
        try {
          fs.writeFileSync(conferenceFilePath, JSON.stringify(settings, null, 2));
          console.log(`Создан новый файл настроек для беседы ${conferenceId}`);
        } catch (error) {
          console.error('Ошибка при создании файла настроек:', error);
          return context.send('❌ Ошибка при создании настроек беседы.');
        }
      }
      
      // Проверяем наличие payload в сообщении
      const payload = context.messagePayload;
      
      if (payload) {
        console.log('Получен payload от кнопки:', payload);
        
        if (payload.command === 'toggle_setting') {
          const settingName = payload.setting;
          const currentValue = settings[settingName] || 0;
          const newValue = currentValue === 1 ? 0 : 1;
          
          settings[settingName] = newValue;
          
          try {
            fs.writeFileSync(conferenceFilePath, JSON.stringify(settings, null, 2));
            
            // Очищаем кэш настроек, чтобы изменения вступили в силу немедленно
            invalidateChatSettings(context.peerId);
            
            let settingDisplayName = '';
            let successMessage = '';
            
            switch (settingName) {
              case 'kick_leave':
                settingDisplayName = 'Кик после выхода юзера';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'stickers':
                settingDisplayName = 'Запрет стикеров';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'docs':
                settingDisplayName = 'Запрет документов';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'reposts':
                settingDisplayName = 'Запрет репостов';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'links':
                settingDisplayName = 'Запрет ссылок';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'images':
                settingDisplayName = 'Запрет фотографий';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'video':
                settingDisplayName = 'Запрет видеозаписей';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'groups':
                settingDisplayName = 'Запрет групп';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;
              case 'spam':
                settingDisplayName = 'Анти-спам система';
                successMessage = newValue === 1 ? 'включена' : 'выключена';
                break;

            }
            
            await context.send(`✅ Настройка "${settingDisplayName}" успешно ${successMessage}.`);
            
            // Отправляем обновленные настройки
            if (payload.page === 'main') {
              await showMainSettings(context, settings);
            } else if (payload.page === 'additional') {
              await showAdditionalSettings(context, settings);
            }
            
            return;
          } catch (error) {
            console.error(`Ошибка при обновлении настройки ${settingName}:`, error);
            return context.send(`❌ Произошла ошибка при обновлении настройки.`);
          }
        }
        
        if (payload.command === 'show_additional') {
          return showAdditionalSettings(context, settings);
        }
        
        if (payload.command === 'show_main') {
          return showMainSettings(context, settings);
        }
        
        if (payload.command === 'set_cooldown') {
          return context.send(`ℹ️ Для установки задержки используйте: /settings cooldown [значение от 0 до 15]`);
        }
        
        if (payload.command === 'set_hello') {
          return context.send(`ℹ️ Для установки приветствия используйте: /приветствие [текст приветствия]`);
        }
        
        if (payload.command === 'set_rules') {
          return context.send(`ℹ️ Для установки правил используйте: /новыеправила [текст правил]`);
        }
      }
      
      // Обработка текстовых команд
      if (parts[1] === 'cooldown') {
        if (!parts[2]) {
          return context.send(`ℹ️ Используйте: /settings cooldown [значение от 0 до 15]`);
        }
        
        const newCooldownValue = parseInt(parts[2]);  
        
        if (isNaN(newCooldownValue) || newCooldownValue < 0 || newCooldownValue > 15) {
          return context.send('❌ Неверное значение! Введите значение от 0 до 15 сек.');
        }
        
        try {
          settings.cooldown = newCooldownValue;
          fs.writeFileSync(conferenceFilePath, JSON.stringify(settings, null, 2));
          await context.send(`✅ Теперь задержка в этом чате равна ${newCooldownValue} сек.\n❓ Задержка не действует на пользователей с ролью «Модератор» и выше.`);
          return showMainSettings(context, settings);
        } catch (error) {
          console.error('Ошибка при обновлении значения cooldown:', error);
          return context.send('❌ Произошла ошибка при обновлении значения cooldown.');
        }
      } else if (parts[1] && ['kick_leave', 'stickers', 'docs', 'reposts', 'links', 'images', 'groups', 'video', 'spam'].includes(parts[1])) {
        if (!parts[2]) {
          return context.send(`ℹ️ Используйте: /settings ${parts[1]} [0|1]`);
        }
      
        const newValue = parseInt(parts[2]);  
      
        if (isNaN(newValue) || (newValue !== 0 && newValue !== 1)) {
          return context.send('❌ Неверное значение. Используйте: 0 (выкл) или 1 (вкл)');
        }
      
        let settingName = '';
        switch (parts[1]) {
          case 'kick_leave':
            settingName = 'Кик после выхода юзера';
            break;
          case 'stickers':
            settingName = 'Запрет стикеров';
            break;
          case 'docs':
            settingName = 'Запрет документов';
            break;
          case 'reposts':
            settingName = 'Запрет репостов';
            break;
          case 'links':
            settingName = 'Запрет ссылок';
            break;
          case 'images':
            settingName = 'Запрет фотографий';
            break;
          case 'groups':
            settingName = 'Запрет групп';
            break;
          case 'video':
            settingName = 'Запрет видеозаписей';
            break;
          case 'spam':
            settingName = 'Анти-спам система';
            break;
        }
      
        try {
          // Обновляем настройку в объекте и записываем в файл
          settings[parts[1]] = newValue;
          fs.writeFileSync(conferenceFilePath, JSON.stringify(settings, null, 2));
          
          // Очищаем кэш настроек, чтобы изменения вступили в силу немедленно
          invalidateChatSettings(context.peerId);
          
          const successMessage = newValue === 1 ? 'включена' : 'выключена';
          await context.send(`✅ Настройка "${settingName}" успешно ${successMessage}.`);
          return showMainSettings(context, settings);
        } catch (error) {
          console.error(`Ошибка при обновлении настроек ${parts[1]}:`, error);
          return context.send(`❌ Произошла ошибка при обновлении настроек ${parts[1]}.`);
        }
      } else if (!parts[1]) {
        // Если нет аргументов, показываем основные настройки с кнопками
        return showMainSettings(context, settings);
      } else {
        return context.send(`❌ Неизвестный параметр: ${parts[1]}\n❓ Доступные параметры: kick_leave, stickers, docs, reposts, links, images, groups, video, spam, cooldown`);
      }
    } catch (error) {
      console.error('Ошибка при обработке команды /settings:', error);
      context.send('❌ Произошла ошибка при обработке команды /settings.');
    }
  },
};

// Функция для отображения основных настроек
async function showMainSettings(context, settings) {
  const helloText = settings.hello_text ? '✅' : '❌';
  const kickLeave = settings.kick_leave === 1 ? '✅' : '❌';
  const rules = settings.rules ? '✅' : '❌';
  const stickers = settings.stickers === 1 ? '✅' : '❌';
  const docs = settings.docs === 1 ? '✅' : '❌';
  const reposts = settings.reposts === 1 ? '✅' : '❌';
  const links = settings.links === 1 ? '✅' : '❌';
  const images = settings.images === 1 ? '✅' : '❌';
  const video = settings.video === 1 ? '✅' : '❌';
  const groups = settings.groups === 1 ? '✅' : '❌';
  const spam = settings.spam === 1 ? '✅' : '❌';

  const cooldown = settings.cooldown || 0;

  let settingsInfo = `⚠️ Настройки чата\n\n`;
  settingsInfo += `🔹 Кик после выхода юзера: ${kickLeave}\n`;
  settingsInfo += `🔹 Статус правил: ${rules}\n`;
  settingsInfo += `🔹 Приветствие: ${helloText}\n`;
  settingsInfo += `🔹 Запрет стикеров: ${stickers}\n`;
  settingsInfo += `🔹 Запрет документов: ${docs}\n`;
  settingsInfo += `🔹 Запрет репостов: ${reposts}\n`;
  settingsInfo += `🔹 Запрет ссылок: ${links}\n`;
  settingsInfo += `🔹 Запрет фотографий: ${images}\n`;
  settingsInfo += `🔹 Запрет видеозаписей: ${video}\n`;
  settingsInfo += `🔹 Запрет групп: ${groups}\n`;
  settingsInfo += `🔹 Анти-спам система: ${spam === '✅' ? 'Включена' : 'Отключена'}\n`;
  settingsInfo += `🔹 Задержка между сообщениями: ${cooldown} сек.`;

  // Создаем клавиатуру с кнопками для основных настроек
  const keyboard = Keyboard.builder()
    .textButton({
      label: `Кик после выхода: ${kickLeave === '✅' ? 'Вкл' : 'Выкл'}`,
      color: kickLeave === '✅' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'kick_leave', page: 'main' }
    })
    .row()
    .textButton({
      label: 'Настроить правила',
      color: Keyboard.SECONDARY_COLOR,
      payload: { command: 'set_rules' }
    })
    .textButton({
      label: 'Настроить приветствие',
      color: Keyboard.SECONDARY_COLOR,
      payload: { command: 'set_hello' }
    })
    .row()
    .textButton({
      label: `Стикеры: ${stickers === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: stickers === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'stickers', page: 'main' }
    })
    .textButton({
      label: `Документы: ${docs === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: docs === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'docs', page: 'main' }
    })

    .row()
    .textButton({
      label: 'Другие настройки →',
      color: Keyboard.PRIMARY_COLOR,
      payload: { command: 'show_additional' }
    })
    .inline(true);

  return context.send({
    message: settingsInfo,
    keyboard: keyboard.toString()
  });
}

// Функция для отображения дополнительных настроек
async function showAdditionalSettings(context, settings) {
  const reposts = settings.reposts === 1 ? '✅' : '❌';
  const links = settings.links === 1 ? '✅' : '❌';
  const images = settings.images === 1 ? '✅' : '❌';
  const video = settings.video === 1 ? '✅' : '❌';
  const groups = settings.groups === 1 ? '✅' : '❌';
  const cooldown = settings.cooldown || 0;
  const spam = settings.spam === 1 ? '✅' : '❌';

  let settingsInfo = `⚠️ Дополнительные настройки чата\n\n`;
  settingsInfo += `🔹 Запрет репостов: ${reposts}\n`;
  settingsInfo += `🔹 Запрет ссылок: ${links}\n`;
  settingsInfo += `🔹 Запрет фотографий: ${images}\n`;
  settingsInfo += `🔹 Запрет видеозаписей: ${video}\n`;
  settingsInfo += `🔹 Запрет групп: ${groups}\n`;
  settingsInfo += `🔹 Анти-спам система: ${spam === '✅' ? 'Включена' : 'Отключена'}\n`;
  settingsInfo += `🔹 Задержка между сообщениями: ${cooldown} сек.`;

  // Создаем клавиатуру с кнопками для дополнительных настроек
  const keyboard = Keyboard.builder()
    .textButton({
      label: `Репосты: ${reposts === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: reposts === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'reposts', page: 'additional' }
    })
    .textButton({
      label: `Ссылки: ${links === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: links === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'links', page: 'additional' }
    })
    .row()
    .textButton({
      label: `Фото: ${images === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: images === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'images', page: 'additional' }
    })
    .textButton({
      label: `Видео: ${video === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: video === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'video', page: 'additional' }
    })
    .row()
    .textButton({
      label: `Группы: ${groups === '✅' ? 'Запрещены' : 'Разрешены'}`,
      color: groups === '✅' ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'groups', page: 'additional' }
    })
    .textButton({
      label: `Анти-спам: ${spam === '✅' ? 'Вкл' : 'Выкл'}`,
      color: spam === '✅' ? Keyboard.POSITIVE_COLOR : Keyboard.NEGATIVE_COLOR,
      payload: { command: 'toggle_setting', setting: 'spam', page: 'additional' }
    })
    .row()
    .textButton({
      label: 'Задержка сообщений',
      color: Keyboard.SECONDARY_COLOR,
      payload: { command: 'set_cooldown' }
    })
    .row()
    .textButton({
      label: '← Назад к основным',
      color: Keyboard.PRIMARY_COLOR,
      payload: { command: 'show_main' }
    })
    .inline(true);

  return context.send({
    message: settingsInfo,
    keyboard: keyboard.toString()
  });
}
