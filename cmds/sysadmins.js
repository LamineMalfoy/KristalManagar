const { query } = require('../filedb.js');
const { checkSysAccess, getAccessLevelName } = require('./sysadmin.js');
const { hasCommandAccess, getAccessDeniedMessage } = require('../utils/commandAccess.js');
const { vk } = require('../index.js');
const { Keyboard } = require('vk-io');
const { getlink } = require('../util.js');
const util = require('util');
const databaseQuery = util.promisify(query);

// Кэш для системных администраторов (TTL 3 минуты)
const sysAdminsCache = new Map();
const SYS_ADMINS_CACHE_TTL = 3 * 60 * 1000;

// Константы для уровней доступа (без эмодзи — в стиле staff)
const ACCESS_LEVELS = {
  5: { name: 'Разработчики', requiresLevel: 5 },
  4: { name: 'Основатели', requiresLevel: 1 },
  3: { name: 'Заместители основателя', requiresLevel: 1 },
  2: { name: 'Администрация бота', requiresLevel: 1 },
  1: { name: 'Агенты поддержки', requiresLevel: 1 }
};

module.exports = {
  command: '/sysadmins',
  description: 'Список администраторов системы бота',
  async execute(context) {
    const startTime = Date.now();
    
    try {
      // ОПТИМИЗАЦИЯ: Параллельная проверка доступа
      const [hasAccess, senderAccess] = await Promise.all([
        hasCommandAccess(context.senderId, 'sysadmins'),
        checkSysAccess(context.senderId)
      ]);
      
      if (!hasAccess) {
        return context.reply(getAccessDeniedMessage('sysadmins'));
      }

      // ОПТИМИЗАЦИЯ: Кэшированное получение администраторов
      const cacheKey = 'sysadmins_list';
      let admins;
      const cached = sysAdminsCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < SYS_ADMINS_CACHE_TTL) {
        admins = cached.data;
      } else {
        const queryStr = 'SELECT userid, access FROM sysadmins ORDER BY access DESC';
        admins = await databaseQuery(queryStr);
        sysAdminsCache.set(cacheKey, {
          data: admins,
          timestamp: Date.now()
        });
      }
      
      if (!admins || admins.length === 0) {
        return context.reply('❌ Ошибка | Администраторы системы не найдены');
      }

      // ОПТИМИЗАЦИЯ: Батчевое получение информации о пользователях
      const userIds = admins.map(admin => admin.userid);
      
      let userInfos = [];
      if (userIds.length > 0) {
        try {
          userInfos = await vk.api.users.get({ user_ids: userIds });
        } catch (error) {
          console.error('Ошибка при получении информации о пользователях:', error);
        }
      }

      // ОПТИМИЗАЦИЯ: Создание оптимизированной карты пользователей
      const userMap = new Map();
      for (const user of userInfos) {
        userMap.set(user.id, user);
      }

      // ОПТИМИЗАЦИЯ: Быстрая группировка администраторов по уровням доступа
      const accessGroups = {};
      const linkPromises = [];
      
      // Инициализируем группы и собираем промисы для getlink
      for (const admin of admins) {
        const access = admin.access;
        if (!accessGroups[access]) {
          accessGroups[access] = [];
        }
        
        // Добавляем промис для получения ссылки
        linkPromises.push(
          getlink(admin.userid).then(link => ({ access, link }))
        );
      }
      
      // ОПТИМИЗАЦИЯ: Параллельное получение всех ссылок
      const linkResults = await Promise.allSettled(linkPromises);
      
      // Группируем результаты
      for (const result of linkResults) {
        if (result.status === 'fulfilled') {
          const { access, link } = result.value;
          accessGroups[access].push(link);
        }
      }
      
      // Сообщение в стиле staff: без заголовка и без эмодзи
      let message = '';

      // ОПТИМИЗАЦИЯ: Быстрое формирование сообщения с проверкой доступа
      for (const level of [5, 4, 3, 2, 1]) {
        const levelInfo = ACCESS_LEVELS[level];
        const adminsAtLevel = accessGroups[level];
        
        if (adminsAtLevel && adminsAtLevel.length > 0) {
          // Проверяем, нужно ли показывать этот уровень
          if (level === 5 && senderAccess !== 5) {
            continue; // Разработчиков показываем только разработчикам
          }
          
          // Каждую запись оформляем с тире, как в staff.js
          const formatted = adminsAtLevel.map(link => `— ${link}`).join('\n');
          message += `${levelInfo.name}:\n${formatted}\n\n`;
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(`SysAdmins command optimized execution time: ${executionTime}ms`);

      // Кнопка "Никнеймы" как в staff.js
      const keyboard = Keyboard.builder()
        .callbackButton({
          label: 'Никнеймы',
          payload: { command: 'show_nicknames', event_id: 8888 },
          color: Keyboard.POSITIVE_COLOR,
        })
        .inline();

      context.send({ message: message, disable_mentions: true, keyboard });
    } catch (error) {
      console.error('Ошибка при выполнении команды sysadmins:', error);
      context.reply('❌ Произошла ошибка при выполнении команды');
    }
  },
}; 