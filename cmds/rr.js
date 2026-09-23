const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const database = require('../databases.js');
const { Keyboard } = require('vk-io');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const cacheManager = require('../cache_manager.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');

module.exports = {
  command: '/rr',
  aliases: ['/удалитьроль', '/removerole'],  
  description: 'Удаление роли у пользователя',
  async execute(context) {
    const { peerId, replyMessage, text } = context;
    const senderId = context.senderId || context.userId; // поддержка message_event
    const payload = context.messagePayload || context.payload || context.eventPayload;

    // Универсальный безопасный отправитель сообщения в чат (работает и для message_event)
    const sendToChat = async (msg) => {
      try {
        if (typeof context.send === 'function') {
          await context.send({ message: msg, disable_mentions: true });
        } else if (global.vk && global.vk.api) {
          await vk.api.messages.send({
            peer_id: peerId,
            message: msg,
            random_id: Math.floor(Math.random() * 1e9),
            disable_mentions: true
          });
        }
      } catch (e) {
        console.error('rr safe send error:', e);
      }
    };

    // 1) Обработка отмены через текстовую кнопку (message payload)
    if (payload && payload.command === '/rr' && payload.action === 'cancel') {
      // Немедленный ACK для остановки спиннера и показа snackbar
      try {
        if (typeof context.sendMessageEventAnswer === 'function') {
          await context.sendMessageEventAnswer({
            event_id: context.eventId || payload.event_id,
            user_id: context.userId || senderId,
            peer_id: context.peerId || peerId,
            event_data: JSON.stringify({ type: 'show_snackbar', text: '⏳ Выполняю отмену...' })
          });
        }
      } catch (ackErr) {
        console.warn('rr cancel ACK warn:', ackErr?.message || ackErr);
      }
      const rolesTable = `roles_${peerId}`;
      const targetId = Number(payload.target);
      const prevRole = Number(payload.prevRole);
      const originalAdmin = Number(payload.admin);

      if (!await checkIfTableExists(rolesTable)) {
        return sendToChat(`❌ ${actorLink}: таблица ролей не существует`);
      }

      if (!Number.isFinite(targetId) || !Number.isFinite(prevRole) || !Number.isFinite(originalAdmin)) {
        return sendToChat(`❌ ${actorLink}: невалидные параметры отмены`);
      }

      // Ссылки для красивых сообщений
      let actorLink, initiatorLink, targetLinkPretty;
      try {
        actorLink = await getlink(senderId);
        initiatorLink = await getlink(originalAdmin);
        targetLinkPretty = await getlink(targetId);
      } catch (_) {
        actorLink = senderId < 0 ? `[club${Math.abs(senderId)}|Сообщество]` : `[id${senderId}|Пользователь]`;
        initiatorLink = originalAdmin < 0 ? `[club${Math.abs(originalAdmin)}|Сообщество]` : `[id${originalAdmin}|Пользователь]`;
        targetLinkPretty = targetId < 0 ? `[club${Math.abs(targetId)}|Сообщество]` : `[id${targetId}|Пользователь]`;
      }

      // Только инициатор снятия роли может отменить
      if (senderId !== originalAdmin) {
        return sendToChat(`⛔ ${actorLink}: отменить может только инициатор — ${initiatorLink}`);
      }

      // Текущая роль инициатора должна быть строго выше восстанавливаемой
      const senderRoleIdNow = await getUserRole(peerId, senderId);
      if (senderRoleIdNow <= prevRole) {
        const rn = await getRoleName(peerId, senderRoleIdNow);
        const prevRoleName = await getRoleName(peerId, prevRole);
        return sendToChat(`⛔ ${actorLink}: недостаточно прав — у вас ${rn} (${senderRoleIdNow}), требуется строго выше «${prevRoleName}» (${prevRole})`);
      }

      // Отменяем только если текущая роль цели всё ещё 0 (не была изменена кем-то другим)
      const currentRole = await getUserRole(peerId, targetId);
      if (Number(currentRole) !== 0) {
        return sendToChat(`⚠️ ${actorLink}: отмена невозможна — роль пользователя уже изменена у ${targetLinkPretty}`);
      }

      const sql = `
        INSERT INTO ${rolesTable} (user_id, role_id)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
      `;

      return database.query(sql, [targetId, prevRole], async (err) => {
        if (err) {
          console.error('rr cancel restore error:', err);
          return sendToChat(`❌ ${actorLink}: ошибка при восстановлении роли для ${targetLinkPretty}`);
        }
        try { cacheManager.invalidateUserRole(peerId, targetId); } catch (_) {}

        try {
          const adminLink = await getlink(senderId);
          const targetLink = await getlink(targetId);
          const restoredRoleName = await getRoleName(peerId, prevRole);
          await context.send({
            message: `✅ ${adminLink} | ${restoredRoleName}: отменил снятие роли. Восстановлена роль «${restoredRoleName}» у ${targetLink}`,
            disable_mentions: true
          });
        } catch (e) {
          console.error('rr cancel notify message error:', e);
        }
        return;
      });
    }

    // 2) Обычная команда /rr — снятие роли

    // Для обычной команды проверяем наличие таблицы ролей
    if (!await checkIfTableExists(`roles_${peerId}`)) {
      return context.reply('❌ Таблица ролей не существует');
    }

    // Проверяем приоритет команды через editcmd
    const hasPermission = await checkCommandPriority(context.peerId, context.senderId, '/rr');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(context.peerId);
      const requiredRole = priorities['/rr'] || 50;
      const senderRoleId = await getUserRole(context.peerId, context.senderId);
      const senderRoleName = await getRoleName(context.peerId, senderRoleId);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /rr требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRoleId})`);
    }
    
    const senderRoleId = await getUserRole(context.peerId, context.senderId);

    const target = replyMessage ? replyMessage.senderId : await extractNumericId(text || '');
    const userId = target || (replyMessage ? replyMessage.senderId : senderId);
    let label = userId;

    if (replyMessage) {
      label = replyMessage.senderId;
    }
	if(!label) {
		return context.reply('Вы не указали пользователя')
	}
    const chelikroleid = await getUserRole(peerId, label);
	
    if (senderRoleId <= chelikroleid) {
      return context.reply(`❌ С указанным пользователем ваши роли равны либо выше`);
    }
	
    const rolesTable = `roles_${peerId}`;

    const updateRoleQuery = `
      INSERT INTO ${rolesTable} (user_id, role_id)
      VALUES (?, 0)
      ON DUPLICATE KEY UPDATE role_id = 0;
    `;

    const prevRole = Number(chelikroleid || 0);
    database.query(updateRoleQuery, [label], async (error, result) => {
      if (error) {
        console.error('Ошибка при удалении роли:', error);
        return console.log('❌ Произошла ошибка.');
      }
      // Инвалидируем кэш роли удалённого пользователя
      try { cacheManager.invalidateUserRole(peerId, label); } catch (_) {}

	try {
		// Используем getlink для корректного отображения пользователей и сообществ
		const adminLink = await getlink(senderId);
		const targetLink = await getlink(label);
		            const adminRole = await getUserRole(peerId, senderId);
        const roleName = await getRoleName(peerId, adminRole);
		        
        // Кнопка Отменить показываем только если есть, что возвращать (prevRole > 0)
        try { cacheManager.invalidateUserRole(peerId, label); } catch (_) {}
        if (prevRole > 0) {
          const kb = Keyboard.builder()
            .inline()
            .callbackButton({
              label: 'Отменить',
              color: 'negative',
              payload: { command: '/rr', action: 'cancel', target: label, prevRole, admin: senderId }
            });
          context.reply({
            message: `✅️ ${adminLink} | ${roleName} обнулил права ${targetLink}`,
            keyboard: kb
          });
        } else {
          context.reply({
            message: `✅️ ${adminLink} | ${roleName} обнулил права ${targetLink}`
          });
        }
	} catch (error) {
		console.error('Ошибка при получении ссылок:', error);
		// Fallback с правильным форматом для сообществ
		const adminFallback = senderId < 0 ? `[club${Math.abs(senderId)}|Сообщество]` : `[id${senderId}|Пользователь]`;
		const targetFallback = label < 0 ? `[club${Math.abs(label)}|Сообщество]` : `[id${label}|Пользователь]`;
		        try { cacheManager.invalidateUserRole(peerId, label); } catch (_) {}
        if (prevRole > 0) {
          const kb = Keyboard.builder()
            .inline()
            .callbackButton({
              label: 'Отменить',
              color: 'negative',
              payload: { command: '/rr', action: 'cancel', target: label, prevRole, admin: senderId }
            });
          context.reply({
            message: `✅️ ${adminFallback} обнулил права ${targetFallback}`,
            keyboard: kb
          });
        } else {
          context.reply({
            message: `✅️ ${adminFallback} обнулил права ${targetFallback}`
          });
        }
	}
    });
  }
};
