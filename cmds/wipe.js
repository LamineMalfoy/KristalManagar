const fs = require('fs');
const path = require('path');
const util = require('util');
const database = require('../databases.js');
const queryAsync = util.promisify(database.query).bind(database);
const cacheManager = require('../cache_manager.js');
const utils = require('../util.js');
const { invalidateBanList } = require('../optimized_util.js');
const { checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

async function wipeBans(peerId) {
  try {
    const stats = { filesCleared: 0, legacyCleared: false, beforeSql: 0, afterSql: 0, sqlAffected: 0 };
    // 1) Современное хранилище: data/conference/* (filedb_optimizer читает оттуда)
    const conferenceDir = path.join(__dirname, '../data/conference');
    if (fs.existsSync(conferenceDir)) {
      const files = fs.readdirSync(conferenceDir).filter(f => f.startsWith(`${peerId}_`) && f.endsWith('.json'));
      for (const file of files) {
        try {
          const p = path.join(conferenceDir, file);
          const data = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(data.blocked_users)) {
            data.blocked_users = [];
            fs.writeFileSync(p, JSON.stringify(data, null, 2));
            stats.filesCleared++;
          }
        } catch (e) {
          // игнорируем поврежденные файлы
        }
      }
    }

    // 1b) Формат filedb: директория data/conference_<peerId>/* — чистим blocked_users в каждом файле
    try {
      const filedbConfDir = path.join(__dirname, `../data/conference_${peerId}`);
      if (fs.existsSync(filedbConfDir)) {
        const files = fs.readdirSync(filedbConfDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const p = path.join(filedbConfDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            // В filedb каждая запись — объект с полями, среди которых может быть blocked_users
            if (data && Object.prototype.hasOwnProperty.call(data, 'blocked_users')) {
              data.blocked_users = [];
              fs.writeFileSync(p, JSON.stringify(data, null, 2));
              stats.filesCleared++;
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('wipeBans filedb directory cleanup error:', e);
    }

    // 2) Легаси-файл: data/banlist/<peerId>.json — очищаем на всякий случай
    try {
      const legacyDir = path.join(__dirname, '../data/banlist');
      const legacyFile = path.join(legacyDir, `${peerId}.json`);
      if (!fs.existsSync(legacyDir)) fs.mkdirSync(legacyDir, { recursive: true });
      fs.writeFileSync(legacyFile, JSON.stringify({}, null, 2));
      stats.legacyCleared = true;
    } catch (_) {}

    // Обновляем/инвалидируем кэш
    try { cacheManager.setBanList(peerId, []); } catch (_) {}
    invalidateBanList(peerId);

    // 3) Чистим блокировки в SQL (команда /banlist читает из БД conference_<peerId>)
    try {
      const confTable = `conference_${peerId}`;
      const countBeforeSql = `
        SELECT COUNT(*) AS cnt
        FROM ${confTable}
        WHERE blocked_users IS NOT NULL AND TRIM(blocked_users) <> '' AND TRIM(blocked_users) <> '[]'
      `;
      const beforeRows = await queryAsync(countBeforeSql);
      stats.beforeSql = (Array.isArray(beforeRows) ? beforeRows[0]?.cnt : beforeRows?.cnt) || 0;

      const updateSql = `UPDATE ${confTable} SET blocked_users = '[]'`;
      const updRes = await queryAsync(updateSql);
      stats.sqlAffected = (updRes && typeof updRes.affectedRows === 'number') ? updRes.affectedRows : 0;

      const countAfterSql = `
        SELECT COUNT(*) AS cnt
        FROM ${confTable}
        WHERE blocked_users IS NOT NULL AND TRIM(blocked_users) <> '' AND TRIM(blocked_users) <> '[]'
      `;
      const afterRows = await queryAsync(countAfterSql);
      stats.afterSql = (Array.isArray(afterRows) ? afterRows[0]?.cnt : afterRows?.cnt) || 0;
    } catch (e) {
      console.error('wipeBans SQL cleanup error:', e);
    }
    return stats;
  } catch (e) {
    console.error('wipeBans error:', e);
    return false;
  }
}

async function wipeWarns(peerId) {
  try {
    const tableName = `conference_${peerId}`;
    if (!await checkIfTableExists(tableName)) {
      return true; // Нечего чистить
    }
    // Сбрасываем warns и историю предупреждений
    const sql = `UPDATE ${tableName} SET warns = 0, warns_history = NULL`;
    await queryAsync(sql);
    return true;
  } catch (e) {
    console.error('wipeWarns error:', e);
    return false;
  }
}

async function wipeNicknames(peerId) {
  try {
    const tableName = `nicknames_${peerId}`;
    const countSql = `SELECT COUNT(*) AS cnt FROM ${tableName}`;
    const beforeRows = await queryAsync(countSql);
    const before = (Array.isArray(beforeRows) ? beforeRows[0]?.cnt : beforeRows?.cnt) || 0;

    let deleted = 0;
    try {
      const delSql = `DELETE FROM ${tableName}`;
      const delRes = await queryAsync(delSql);
      deleted = (delRes && typeof delRes.affectedRows === 'number') ? delRes.affectedRows : before;
    } catch (e) {
      // если таблицы нет — считаем, что нечего удалять
      console.error('wipeNicknames SQL delete error:', e);
      deleted = 0;
    }

    // Дополнительно чистим файловое хранилище filedb: data/nicknames_<peerId>/*
    try {
      const dir = path.join(__dirname, `../data/nicknames_${peerId}`);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
        }
      }
    } catch (e) {
      console.error('wipeNicknames filedb directory cleanup error:', e);
    }
    // Инвалидируем кэш никнеймов для этой беседы
    try {
      if (cacheManager && cacheManager.userNicknames && typeof cacheManager.userNicknames.keys === 'function') {
        const prefix = `${peerId}_`;
        for (const key of Array.from(cacheManager.userNicknames.keys())) {
          if (typeof key === 'string' && key.startsWith(prefix)) {
            cacheManager.userNicknames.delete(key);
          }
        }
      }
    } catch (_) {}
    return { before, deleted };
  } catch (e) {
    console.error('wipeNicknames error:', e);
    return false;
  }
}

async function wipeCustomRoles(peerId, senderId) {
  try {
    // Чистим кастомные роли (файл roles.json в data/custom_roles_<peerId>)
    const customRolesDir = path.join(__dirname, `../data/custom_roles_${peerId}`);
    const rolesFile = path.join(customRolesDir, 'roles.json');

    if (!fs.existsSync(customRolesDir)) {
      // Нечего чистить
      return true;
    }

    try {
      if (fs.existsSync(rolesFile)) {
        fs.writeFileSync(rolesFile, JSON.stringify([], null, 2));
      }
    } catch (e) {
      console.error('wipeCustomRoles file cleanup error:', e);
    }

    // Инвалидируем кэш кастомных ролей
    const cacheKey = `custom_roles_${peerId}`;
    try { cacheManager.invalidate('customRoles', cacheKey); } catch (_) {}

    // Снимаем роли у всех пользователей в беседе (roles_<peerId> => role_id = 0)
    try {
      const rolesTable = `roles_${peerId}`;
      // Сохраняем текущих владельцев (100), чтобы выдать снова стандартную 100
      let owners = [];
      try {
        const sel = await queryAsync(`SELECT user_id FROM ${rolesTable} WHERE role_id = ?`, [100]);
        if (Array.isArray(sel)) {
          owners = sel.map(r => r.user_id).filter(Boolean);
        }
      } catch (e) {
        // таблицы может не быть — пропускаем
      }

      try {
        await queryAsync(`UPDATE ${rolesTable} SET role_id = 0`);
      } catch (e) {
        // если таблицы нет — игнорируем
      }

      // Возвращаем владельцам роль 100
      if (owners.length) {
        for (const uid of owners) {
          try {
            await queryAsync(`UPDATE ${rolesTable} SET role_id = ? WHERE user_id = ?`, [100, Number(uid)]);
          } catch (_) {}
        }
      }

    } catch (e) {
      console.error('wipeCustomRoles SQL roles reset error:', e);
    }

    // Инвалидируем кэш ролей всех пользователей в этой беседе
    try {
      for (const key of cacheManager.userRoles.keys()) {
        if (typeof key === 'string' && key.startsWith(`${peerId}_`)) {
          cacheManager.userRoles.delete(key);
        }
      }
    } catch (_) {}

    return true;
  } catch (e) {
    console.error('wipeCustomRoles error:', e);
    return false;
  }
}

function parseCategory(text) {
  const lower = (text || '').trim().toLowerCase();
  // Пустой аргумент — считаем, что категории нет
  if (!lower) return null;
  // Признаки "все": all | все | всё
  if (/(^|\s)(all|все|всё)($|\s)/.test(lower)) return 'all';
  if (/(^|\s)(ban|bans|бан|баны)($|\s)/.test(lower)) return 'bans';
  if (/(^|\s)(warn|warns|варн|варны|пред|преды|предупреждения)($|\s)/.test(lower)) return 'warn';
  if (/(^|\s)(nick|nicks|ник|ники|nickname|nicknames)($|\s)/.test(lower)) return 'nick';
  if (/(^|\s)(role|roles|роль|роли|custom|кастом)($|\s)/.test(lower)) return 'roles';
  return lower; // пусть упадёт в default
}

module.exports = {
  command: '/wipe',
  aliases: ['/вайп'],
  description: 'Амнистия/очистка по категориям: bans | warn | nick | roles | all',
  priority: 100,
  async execute(context) {
    const { peerId, senderId, text } = context;

    // Проверяем регистрацию беседы (наличие таблицы ролей)
    if (!await checkIfTableExists(`roles_${peerId}`)) {
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    // Проверяем права через актуальный приоритет (обход возможного кэширования)
    const priorities = await getCommandPriorities(peerId).catch(() => ({}));
    const required = (priorities && typeof priorities['/wipe'] === 'number') ? priorities['/wipe'] : 100;
    const senderRole = await getUserRole(peerId, senderId);
    if (senderRole < required) {
      const roleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /wipe требуется приоритет ${required} или выше\n👤 Ваша роль: ${roleName} (приоритет ${senderRole})`);
    }

    // Определяем категорию
    const parts = (text || '').trim().split(/\s+/);
    const categoryArg = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const category = parseCategory(categoryArg);

    // Проверяем отсутствие категории или попытку удалить всё
    if (!category || category === 'all') {
      return context.reply(
        '❌ Неверный синтаксис. Укажите одну категорию для очистки.\n' +
        'Доступные категории: bans | warn | nick | roles\n' +
        'Примеры: /wipe roles, /wipe bans\n\n' +
        '⚠️ Массовая очистка (all) запрещена из соображений безопасности.'
      );
    }

    const results = { bans: null, warn: null, nick: null, roles: null };

    async function doCategory(cat) {
      switch (cat) {
        case 'bans':
          results.bans = await wipeBans(peerId);
          break;
        case 'warn':
          results.warn = await wipeWarns(peerId);
          break;
        case 'nick':
          results.nick = await wipeNicknames(peerId);
          break;
        case 'roles':
          results.roles = await wipeCustomRoles(peerId, senderId);
          break;
        default:
          return false;
      }
      return true;
    }

    try {
      const ok = await doCategory(category);
      if (!ok) {
        return context.reply('❓ Неизвестная категория. Доступные: bans | warn | nick | roles');
      }

      const okBans = results.bans !== false;
      const okWarn = results.warn !== false;
      const okNick = results.nick !== false;
      const okRoles = results.roles !== false;

      // Красивое уведомление без статистики, с кликабельным ником администратора
      const adminLink = await utils.getlink(senderId);
      const categoryName = {
        bans: 'банлист',
        warn: 'предупреждения',
        nick: 'ники',
        roles: 'роли'
      }[category] || category;

      let extra = '';
      if (category === 'roles' && okRoles) {
        extra = '\n• Всем роли сняты; владельцам возвращена роль «Владелец (100)»';
      }
      const message = `✅ ${adminLink} амнистировал(-а) всех в категории: ${categoryName}${extra}`;
      return context.reply({ message, disable_mentions: true });
    } catch (e) {
      console.error('wipe command error:', e);
      return context.reply('❌ Произошла ошибка при выполнении очистки');
    }
  }
};
