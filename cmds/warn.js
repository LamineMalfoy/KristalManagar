const { checkIfTableExists, getUserRole, getRoleName } = require('./roles.js');
const database = require('../databases.js');
const { vk } = require('../index.js');
const { addLog } = require('../utils/logs.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const { Keyboard } = require('vk-io');
const logger = require('../logger.js');

module.exports = {
  command: '/warn',
  description: 'Выдать предупреждение пользователю',
  async execute(context) {
    const { peerId, senderId, text, replyMessage } = context;

    // 1. Сначала проверяем существование таблицы
    if (!await checkIfTableExists(`conference_${peerId}`)) {
      logger.error('Таблица не существует');
      return context.send('⚠️ Беседа не активирована | Для активации используйте команду /start');
    }

    // 2. Затем проверяем права доступа
    const senderUserRole = await getUserRole(peerId, context.senderId);
    const hasPermission = await checkCommandPriority(peerId, context.senderId, '/warn');
    if (!hasPermission) {
      const priorities = await getCommandPriorities(peerId);
      const requiredRole = priorities['/warn'] || 20;
      const senderRole = await getUserRole(peerId, context.senderId);
      const senderRoleName = await getRoleName(peerId, senderRole);
      return context.reply(`⛔ Доступ запрещён | Для использования команды /warn требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderRole})`);
    }
    
    // 3. Только после проверки прав проверяем параметры
    let target;
    let reason = 'Без причины';

    if (replyMessage) {
      target = replyMessage.senderId;
      const parts = text.split(' ');
      reason = parts.slice(1).join(' ') || 'Без причины';
    } else {
      const parts = text.split(' ');
      target = await extractNumericId(parts[1]);  
      reason = parts.slice(2).join(' ') || 'Без причины';
    }

    if (!target) {
      return context.reply(`❓ Аргументы введены неверно. Необходимо указать пользователя и причину предупреждения.
      
❓ Примеры использования:
/warn @user причина
/warn @user
/warn - ответом на сообщение`);
    }
    
    // Проверяем, что цель не является нашим ботом
    const botId = global.botId;
    if (target === botId) {
      return context.reply('❌ Ошибка | Нельзя выдать предупреждение этому боту.');
    }
    
    // 4. Проверяем роль цели
    const targetUserRole = await getUserRole(peerId, target);

    if (senderUserRole <= targetUserRole) {
      return context.reply('⛔ Доступ запрещён | Вы не можете выдать предупреждение пользователю с равной или более высокой ролью');
    }

    // Проверяем, находится ли пользователь в чате
    try {
      const chatMembers = await vk.api.messages.getConversationMembers({
        peer_id: peerId
      });
      
      const isMember = chatMembers.items.some(member => member.member_id === target);
      if (!isMember) {
        return context.reply('❌ Ошибка | Нельзя выдать предупреждение пользователю, которого нет в беседе.');
      }
    } catch (error) {
      logger.error('Ошибка при проверке членства в чате:', error);
      return context.reply('❌ Ошибка системы | Не удалось проверить присутствие пользователя в чате.');
    }

    const selectUserInfoQuery = `
      SELECT warns, warns_history
      FROM conference_${peerId}
      WHERE user_id = ?
    `;

    database.query(selectUserInfoQuery, [target], async (error, results) => {
      if (error) {
        logger.error('Ошибка при запросе информации о пользователе:', error);
        return context.send('❌ Ошибка системы | Не удалось получить данные о пользователе');
      }

      if (results.length === 0) {
         
        const insertUserInfoQuery = `
          INSERT INTO conference_${peerId} (user_id, warns, warns_history)
          VALUES (?, 1, '[{"Date": "${new Date().toISOString()}", "Reason": "${reason}", "Author": ${senderId}}]')
        `;

        database.query(insertUserInfoQuery, [target], async (insertError, insertResult) => {
          if (insertError) {
            logger.error('Ошибка при добавлении пользователя:', insertError);
            return context.send('❌ Ошибка системы | Не удалось добавить пользователя в базу данных');
          }
          try {
            const userInfo = await vk.api.users.get({ user_ids: senderId });
            const targetUserInfo = await vk.api.users.get({ user_ids: target });
            const adminRole = await getUserRole(peerId, context.senderId);
            const roleName = await getRoleName(peerId, adminRole);
            
            const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
            const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
            
            // Добавляем запись в журнал действий
            addLog(peerId, senderId, target, 'warn', `Причина: ${reason}. Предупреждение: 1/3`)
              .catch(err => logger.error('Ошибка при логировании предупреждения:', err));
            
            // Создаем кнопку отмены
            const keyboard = Keyboard.builder()
              .callbackButton({
                label: 'Отменить',
                payload: {
                  event_id: 6920,
                  target_user: target,
                  warn_author: senderId,
                  warn_reason: reason
                },
                color: Keyboard.POSITIVE_COLOR
              })
              .inline();
            
            const adminLink = await getlink(senderId);
            const targetLink = await getlink(target);
            const displayReason = reason === 'Без причины' ? 'не указана' : reason;
            context.reply(`✅ ${targetLink} получил предупреждение 1/3 от ${adminLink} | ${roleName}\n❓ Причина: ${displayReason}`, { keyboard });
          } catch (error) {
            const targetLink = await getlink(target);
            context.reply(`⚠️ Предупреждение выдано | ${targetLink} получил 1/3 предупреждений\n📝 Причина: ${reason}`);
          }
        });
      } else {
        const { warns: warnsRaw, warns_history, vigs } = results[0];
        const warns = parseInt(warnsRaw) || 0;
        const updatedWarns = warns + 1;

         
        if (updatedWarns >= 3) {
          // Пользователь получил 3 предупреждения - кикаем его
          try {
            await vk.api.messages.removeChatUser({
              chat_id: peerId - 2000000000,
              member_id: target,
            });
          } catch (kickError) {
            logger.error('Ошибка при кике пользователя:', kickError);
          }

          const updateUserInfoQuery = `
            UPDATE conference_${peerId}
            SET warns = ?
            WHERE user_id = ?
          `;

          database.query(updateUserInfoQuery, [0, target], async (updateError, updateResult) => {
            if (updateError) {
              logger.error('Ошибка при обновлении информации о пользователе:', updateError);
              return context.send('❌ Ошибка системы | Не удалось обновить данные пользователя');
            }

            const targetLink = await getlink(target);
            return context.reply(`🚫 ${targetLink} 3/3 предупреждений — пользователь исключён из беседы. Причина: 3/3 варнов`);
          });
        } else {
           
          const currentDate = new Date().toISOString();
    const updatedHistory = warns_history ? JSON.parse(warns_history) : [];
          updatedHistory.push({
            Date: currentDate,
            Reason: reason,
            Author: senderId,
          });

          const updateUserInfoQuery = `
            UPDATE conference_${peerId}
            SET warns = ?, warns_history = ?
            WHERE user_id = ?
          `;

          database.query(updateUserInfoQuery, [updatedWarns, JSON.stringify(updatedHistory), target], async (updateError, updateResult) => {
            if (updateError) {
              logger.error('Ошибка при обновлении информации о пользователе:', updateError);
              return context.send('❌ Ошибка системы | Не удалось обновить данные пользователя');
            }

            try {
              const userInfo = await vk.api.users.get({ user_ids: senderId });
              const targetUserInfo = await vk.api.users.get({ user_ids: target });
              const adminRole = await getUserRole(peerId, context.senderId);
              const roleName = await getRoleName(peerId, adminRole);
              
              const adminName = userInfo[0] ? `${userInfo[0].first_name} ${userInfo[0].last_name}` : 'Пользователь';
              const targetUserName = targetUserInfo[0] ? `${targetUserInfo[0].first_name} ${targetUserInfo[0].last_name}` : 'Пользователь';
              
              // Добавляем запись в журнал действий
              addLog(peerId, senderId, target, 'warn', `Причина: ${reason}. Предупреждение: ${updatedWarns}/3`)
                .catch(err => logger.error('Ошибка при логировании предупреждения:', err));
              
              // Создаем кнопку отмены
              const keyboard = Keyboard.builder()
                .callbackButton({
                  label: 'Отменить',
                  payload: {
                    event_id: 6920,
                    target_user: target,
                    warn_author: senderId,
                    warn_reason: reason,
                    warn_count: updatedWarns
                  },
                  color: Keyboard.POSITIVE_COLOR
                })
                .inline();
              
              const adminLink = await getlink(senderId);
              const targetLink = await getlink(target);
              const displayReason = reason === 'Без причины' ? 'не указана' : reason;
              context.reply(`✅ ${targetLink} получил предупреждение ${updatedWarns}/3 от ${adminLink} | ${roleName}\n❓ Причина: ${displayReason}`, { keyboard });
            } catch (error) {
              const targetLink = await getlink(target);
              context.reply(`⚠️ Предупреждение выдано | ${targetLink} получил ${updatedWarns}/3 предупреждений\n📝 Причина: ${reason}`);
            }
          });
        }
      }
    });
  },
};
