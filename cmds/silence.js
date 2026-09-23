const database = require('../databases.js');
const util = require('util');
const { getUserRole, getRoleName, checkIfTableExists } = require('./roles.js');
const { checkCommandPriority, getCommandPriorities } = require('./editcmd.js');
const { getlink } = require('../util.js');
const { Keyboard } = require('vk-io');
const logger = require('../logger.js');
const vk = require('../vkInstance.js');

const queryAsync = util.promisify(database.query).bind(database);

// Глобальный объект для хранения активных режимов тишины
global.silenceModes = global.silenceModes || {};

module.exports = {
  command: '/тишина',
  aliases: ['/silence'],
  description: 'Включение/отключение режима тишины в чате с указанием времени',
  async execute(context) {
    try {
      const { peerId, senderId, text } = context;
      const conferenceId = peerId;
      
      // Проверяем приоритет команды через editcmd
      const hasPermission = await checkCommandPriority(conferenceId, senderId, '/тишина');
      if (!hasPermission) {
        const priorities = await getCommandPriorities(conferenceId);
        const requiredRole = priorities['/тишина'] || 40;
        const senderUserRole = await getUserRole(conferenceId, senderId);
        const senderRoleName = await getRoleName(conferenceId, senderUserRole);
        return context.reply(`⛔ Доступ запрещён | Для использования команды /тишина требуется приоритет ${requiredRole} или выше\n👤 Ваша роль: ${senderRoleName} (приоритет ${senderUserRole})`);
      }

      // Получаем кликабельную ссылку на пользователя
      const userLink = await getlink(senderId);
      
      // Показываем меню выбора режима тишины
      const keyboard = Keyboard.builder()
        .callbackButton({
          label: '🗑️ Удалять сообщения',
          payload: {
            action: 'silence_mode',
            mode: 'delete',
            peerId: peerId,
            adminId: senderId
          },
          color: Keyboard.SECONDARY_COLOR
        })
        .row()
        .callbackButton({
          label: '🔇 Системный мут',
          payload: {
            action: 'silence_mode',
            mode: 'mute',
            peerId: peerId,
            adminId: senderId
          },
          color: Keyboard.SECONDARY_COLOR
        })
        .inline();

      // Проверяем, активен ли уже режим тишины
      const currentMode = global.silenceModes && global.silenceModes[peerId];
      if (currentMode) {
        // Если режим активен, предлагаем его отключить
        const deactivateKeyboard = Keyboard.builder()
          .callbackButton({
            label: '🔴 Отключить тишину',
            payload: {
              action: 'silence_mode',
              mode: 'deactivate',
              peerId: peerId,
              adminId: senderId
            },
            color: Keyboard.NEGATIVE_COLOR
          })
          .inline();

        const modeEmoji = currentMode.mode === 'delete' ? '🗑️' : '🔇';
        const modeText = currentMode.mode === 'delete' ? 'Удаление сообщений' : 'Системный мут';
        const adminLink = await getlink(currentMode.adminId);
        return context.send(`🔴 Режим тишины активен\n\n${modeEmoji} Режим: ${modeText}\n⏰ Включен: ${currentMode.startTime.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\n👤 Админ: ${adminLink}`, { keyboard: deactivateKeyboard });
      }

      await context.send(`🔇 Режим тишины | Выберите режим\n\n🗑️ Удалять сообщения - бот будет удалять все новые сообщения\n🔇 Системный мут - выдаст мут всем участникам\n\n⚠️ Админы и звёзды не затрагиваются`, { keyboard });
      
    } catch (error) {
      logger.error('[SILENCE] Ошибка в execute:', error);
      return context.send('❌ Произошла ошибка при выполнении команды тишина');
    }
  },

  // Функция для активации режима удаления сообщений
  async activateDeleteMode(peerId, adminId) {
    try {
      // Проверяем права администратора
      const hasPermission = await checkCommandPriority(peerId, adminId, '/тишина');
      if (!hasPermission) {
        return { success: false, message: '⛔ У вас недостаточно прав для активации режима тишины!' };
      }

      // Активируем режим удаления сообщений
      global.silenceModes[peerId] = {
        mode: 'delete',
        adminId: adminId,
        startTime: new Date()
      };

      const adminLink = await getlink(adminId);
      return { 
        success: true, 
        message: `✅ Режим тишины активирован\n\n🗑️ Тип: Удаление сообщений\n👤 Админ: ${adminLink}\n\n⚠️ Админы и звёзды не затрагиваются` 
      };
    } catch (error) {
      console.error('Ошибка при активации режима удаления:', error);
      return { success: false, message: '❌ Произошла ошибка при активации режима удаления сообщений.' };
    }
  },

  // Функция для активации режима системного мута
  async activateMuteMode(peerId, adminId) {
    try {
      // Проверяем права администратора
      const hasPermission = await checkCommandPriority(peerId, adminId, '/тишина');
      if (!hasPermission) {
        return { success: false, message: '⛔ У вас недостаточно прав для активации режима тишины!' };
      }

      // Получаем всех участников чата
      const chatMembers = await vk.api.messages.getConversationMembers({
        peer_id: peerId
      });
      
      const memberIds = [];
      const failedUsers = [];
      
      // Фильтруем участников (исключаем звезд и администраторов)
      for (const member of chatMembers.items) {
        if (member.member_id > 0 && member.member_id !== adminId) { // Только пользователи, не боты, не сам админ
          const userRole = await getUserRole(peerId, member.member_id);
          if (userRole < 50) { // Исключаем звезд (50+)
            memberIds.push(member.member_id);
          }
        }
      }
      
      // Устанавливаем системный мут пакетами для оптимизации
      const batchSize = 25; // VK API лимит
      let mutedCount = 0;
      
      for (let i = 0; i < memberIds.length; i += batchSize) {
        const batch = memberIds.slice(i, i + batchSize);
        try {
          await vk.api.messages.changeConversationMemberRestrictions({
            peer_id: peerId,
            member_ids: batch,
            for: 3600, // 1 час мута
            action: "ro"
          });
          mutedCount += batch.length;
        } catch (error) {
          console.error('Ошибка при муте пакета пользователей:', error);
          // Пробуем по одному если пакет не прошел
          for (const userId of batch) {
            try {
              await vk.api.messages.changeConversationMemberRestrictions({
                peer_id: peerId,
                member_ids: [userId],
                for: 3600,
                action: "ro"
              });
              mutedCount++;
            } catch (singleError) {
              const userLink = await getlink(userId);
              failedUsers.push(userLink);
            }
          }
        }
      }

      // Активируем режим системного мута
      global.silenceModes[peerId] = {
        mode: 'mute',
        adminId: adminId,
        startTime: new Date()
      };

      const adminLink = await getlink(adminId);
      let message = `✅ Режим тишины активирован\n\n🔇 Тип: Системный мут\n👥 Замучено: ${mutedCount} чел.\n⏱ Срок: 1 час\n👤 Админ: ${adminLink}`;
      
      if (failedUsers.length > 0) {
        message += `\n\n⚠️ Не удалось замутить: ${failedUsers.slice(0, 3).join(', ')}${failedUsers.length > 3 ? ` +${failedUsers.length - 3}` : ''}`;
      }

      return { success: true, message };
    } catch (error) {
      console.error('Ошибка при активации режима мута:', error);
      return { success: false, message: '❌ Произошла ошибка при активации режима системного мута.' };
    }
  },

  // Функция для отключения режима тишины
  async deactivateSilenceMode(peerId, adminId) {
    try {
      const currentMode = global.silenceModes[peerId];
      if (!currentMode) {
        return { success: false, message: '❌ Режим тишины не активен в этой беседе.' };
      }

      // Проверяем права
      const hasPermission = await checkCommandPriority(peerId, adminId, '/тишина');
      if (!hasPermission) {
        return { success: false, message: '⛔ У вас недостаточно прав для отключения режима тишины!' };
      }

      const adminLink = await getlink(adminId);
      let message = '';

      if (currentMode.mode === 'mute') {
        // Снимаем системный мут
        try {
          const chatMembers = await vk.api.messages.getConversationMembers({
            peer_id: peerId
          });
          
          const memberIds = [];
          for (const member of chatMembers.items) {
            if (member.member_id > 0) {
              const userRole = await getUserRole(peerId, member.member_id);
              if (userRole < 50) {
                memberIds.push(member.member_id);
              }
            }
          }
          
          // Снимаем мут пакетами
          const batchSize = 25;
          for (let i = 0; i < memberIds.length; i += batchSize) {
            const batch = memberIds.slice(i, i + batchSize);
            try {
              await vk.api.messages.changeConversationMemberRestrictions({
                peer_id: peerId,
                member_ids: batch,
                for: 1, // Минимальное время для снятия мута
                action: "ro"
              });
            } catch (error) {
              console.error('Ошибка при снятии мута с пакета:', error);
            }
          }
          
          message = `✅ Режим тишины отключён\n\n🔓 Мут снят со всех участников\n👤 Админ: ${adminLink}`;
        } catch (error) {
          console.error('Ошибка при снятии мута:', error);
          message = `⚠️ Режим отключён, но были ошибки\n👤 Админ: ${adminLink}`;
        }
      } else {
        message = `✅ Режим тишины отключён\n\n🗑️ Бот больше не удаляет сообщения\n👤 Админ: ${adminLink}`;
      }

      // Удаляем режим тишины
      delete global.silenceModes[peerId];
      
      return { success: true, message };
    } catch (error) {
      console.error('Ошибка при отключении режима тишины:', error);
      return { success: false, message: '❌ Произошла ошибка при отключении режима тишины.' };
    }
  },
};