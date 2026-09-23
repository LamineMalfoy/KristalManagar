const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const util = require('util');
const databaseQuery = util.promisify(database.query);
const cacheManager = require('../cacheManager.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/gdelrole',
  description: 'Удаление кастомной роли во всех беседах пулла',
  async execute(context) {
    const { peerId, senderId } = context;
    const messageText = context.text;
    const parts = messageText.split(' ');
    if (!(await checkIfTableExists(`roles_${peerId}`))) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(peerId, senderId, '/gdelrole');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/gdelrole'] || 100;
      const senderRoleId = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /gdelrole требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }
    
    const senderRoleId = await getUserRole(peerId, context.senderId);

    // Получаем приоритет роли для удаления
    const priority = parseInt(parts[1]);

    if (!priority || isNaN(priority)) {
      return context.reply('❌ Укажите приоритет роли для удаления (число)\n\n❓ Пример использования:\n/gdelrole 25');
    }

    if (priority < 0 || priority > 99) {
      return context.reply('❌ Приоритет должен быть от 0 до 99');
    }

    if (priority >= senderRoleId) {
      return context.reply('❌ Вы не можете удалить роль с приоритетом равным или выше вашего');
    }

    // Поиск всех пуллов, где состоит этот peerId
    const fs = require('fs');
    const path = require('path');
    const poolsDir = path.join(__dirname, '../data/pools');
    
    if (!fs.existsSync(poolsDir)) {
      return context.reply('❌ Директория пуллов не найдена.');
    }
    
    const poolFiles = fs.readdirSync(poolsDir);
    let pools = [];
    for (const file of poolFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(poolsDir, file), 'utf8'));
        if (Array.isArray(data.pool_peerids) && data.pool_peerids.includes(String(peerId))) {
          pools.push(data);
        }
      } catch (error) {
        console.error(`Ошибка при чтении файла пулла ${file}:`, error);
      }
    }
    
    if (!pools.length) {
      return context.reply('❌ Пуллы не найдены.');
    }

    let deletedCount = 0;
    let deletedRoleName = '';
    
    for (const pool of pools) {
      const creatorId = pool.creator_id;
      if (parseInt(senderId) !== parseInt(creatorId) && senderRoleId < 100) {
        continue; // Пропускаем пуллы, где пользователь не создатель
      }

      const poolPeerIds = pool.pool_peerids;
      if (!Array.isArray(poolPeerIds) || poolPeerIds.length === 0) {
        continue;
      }

      for (const poolPeerId of poolPeerIds) {
        const senderRoleInChat = await getUserRole(poolPeerId, senderId);
        
        // Проверяем права в конкретной беседе
        if (senderRoleInChat < 100) {
          continue;
        }

        try {
          // Путь к файлу кастомных ролей
          const customRolesDir = path.join(__dirname, `../data/custom_roles_${poolPeerId}`);
          const customRolesFile = path.join(customRolesDir, 'roles.json');
          
          if (!fs.existsSync(customRolesFile)) {
            continue; // Файл ролей не существует в этой беседе
          }

          let customRoles = [];
          try {
            customRoles = JSON.parse(fs.readFileSync(customRolesFile, 'utf8'));
          } catch (parseError) {
            console.error(`Ошибка при чтении файла кастомных ролей для ${poolPeerId}:`, parseError);
            continue;
          }

          // Ищем роль с указанным приоритетом
          const roleIndex = customRoles.findIndex(role => role.priority === priority);
          if (roleIndex !== -1) {
            // Сохраняем название роли для сообщения
            if (!deletedRoleName) {
              deletedRoleName = customRoles[roleIndex].name;
            }
            
            // Удаляем роль из массива
            customRoles.splice(roleIndex, 1);
            
            // Сохраняем обновленный список ролей
            if (customRoles.length > 0) {
              fs.writeFileSync(customRolesFile, JSON.stringify(customRoles, null, 2));
            } else {
              // Если ролей не осталось, удаляем файл
              fs.unlinkSync(customRolesFile);
              // Пытаемся удалить директорию, если она пустая
              try {
                fs.rmdirSync(customRolesDir);
              } catch (error) {
                // Игнорируем ошибку, если директория не пустая
              }
            }
            
            // Очищаем кэш кастомных ролей для этой беседы
            const customRolesCacheKey = `custom_roles_${poolPeerId}`;
            cacheManager.invalidate('customRoles', customRolesCacheKey);
            
            deletedCount++;
          }
        } catch (error) {
          console.error(`Ошибка при удалении кастомной роли в беседе ${poolPeerId}:`, error);
        }
      }
    }

    if (deletedCount > 0) {
      const roleNameText = deletedRoleName ? `«${deletedRoleName}»` : '';
      context.reply(`✅ Кастомная роль ${roleNameText} с приоритетом ${priority} успешно удалена из ${deletedCount} беседы(ах) пулла.`);
    } else {
      context.reply(`⚠️ Роль с приоритетом ${priority} не найдена ни в одной беседе пулла или у вас нет прав на её удаление.`);
    }
  }
};
