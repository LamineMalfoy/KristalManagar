const database = require("../databases.js");
const { getUserRole, getRoleName, getUserName, checkIfTableExists } = require('./roles.js');
const { getUserVipStatus } = require('../filedb.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');

// 🚀 Используем централизованный CacheManager
const cacheManager = require('../cache_manager.js');

// Промисифицируем database.query для лучшей производительности
const queryAsync = util.promisify(database.query).bind(database);

// Функция для получения кэшированных данных участников беседы
async function getCachedConversationMembers(peerId) {
  // 🚀 Используем централизованный кэш
  const cached = cacheManager.getConversationMembers(peerId);
  if (cached) {
    return cached;
  }
  
  try {
    const conversationInfo = await vk.api.messages.getConversationMembers({
      peer_id: peerId,
    });
    
    // 🚀 Сохраняем в централизованный кэш
    cacheManager.setConversationMembers(peerId, conversationInfo);
    
    return conversationInfo;
  } catch (error) {
    console.error("Ошибка при получении информации о беседе:", error);
    return null;
  }
}

// Функция для получения кэшированных данных о браках
async function getCachedMarriageData(peerId) {
  // Используем централизованный кэш
  const cached = cacheManager.getMarriages(peerId);
  if (cached) {
    return cached;
  }
  
  try {
    const marriagesFile = path.join(__dirname, '../data/marriages_' + peerId + '.json');
    
    try {
      await fs.access(marriagesFile);
      const data = await fs.readFile(marriagesFile, 'utf8');
      const marriages = JSON.parse(data);
      
      // Сохраняем в централизованный кэш
      cacheManager.setMarriages(peerId, marriages);
      
      return marriages;
    } catch (fileError) {
      // Файл не существует - нет браков
      const emptyMarriages = [];
      cacheManager.setMarriages(peerId, emptyMarriages);
      return emptyMarriages;
    }
  } catch (error) {
    console.error("Ошибка при получении данных о браках:", error);
    return [];
  }
}

// Функция для форматирования даты
function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const monthNames = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month} ${year} года в ${hours}:${minutes}`;
}

module.exports = {
  command: "/stats",
  aliases: ["/stats"],
  description: "Статистика пользователя",
  async execute(context) {
    const { peerId, senderId, text, replyMessage } = context;

    let target = senderId;
    let targetUserRole;

    // Определяем целевого пользователя
    if (replyMessage) {
      target = replyMessage.senderId;
    } else {
      const parts = text.split(" ");
      const extractedId = await extractNumericId(parts[1]);
      if (extractedId) {
        target = extractedId;
      }
    }

    // Проверяем существование таблицы
    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      console.error("Таблица не существует");
      return context.send("❌ Беседа не зарегистрирована!");
    }

    try {
      // Параллельно выполняем все запросы для ускорения - БЕЗ КЭШИРОВАНИЯ
      const [userDataResults, conversationInfo, marriages] = await Promise.allSettled([
        // 1. Получаем данные пользователя из БД
        queryAsync(`
          SELECT messages_count, warns, warn_history
          FROM conference_${peerId}
          WHERE user_id = ?
        `, [target]),
        
        // 2. Получаем информацию о участниках беседы ПРЯМО из VK API
        vk.api.messages.getConversationMembers({
          peer_id: peerId
        }),
        
        // 3. Получаем данные о браках из JSON файла (как команда /браки)
        new Promise((resolve) => {
          try {
            const fs = require('fs');
            const path = require('path');
            const marriagesFile = path.join(__dirname, '../data/marriages_' + peerId + '.json');
            
            if (!fs.existsSync(marriagesFile)) {
              resolve([]);
              return;
            }
            
            const data = fs.readFileSync(marriagesFile, 'utf8');
            if (!data) {
              resolve([]);
              return;
            }
            
            const marriages = JSON.parse(data);
            resolve(marriages);
          } catch (error) {
            console.error("Ошибка при чтении браков:", error);
            resolve([]);
          }
        })
      ]);

      // Обрабатываем данные пользователя
      let messages_count = 0;
      let warns = 0;
      let userExists = false;

      if (userDataResults.status === 'fulfilled' && userDataResults.value && userDataResults.value.length > 0) {
        const userData = userDataResults.value[0];
        messages_count = userData.messages_count || 0;
        warns = parseInt(userData.warns) || 0;
        userExists = true;
      }

      // Если пользователь не найден в БД, создаем запись
      if (!userExists) {
        console.log(`Пользователь ${target} не найден в базе данных, создаем запись`);
        try {
          await queryAsync(`
            INSERT INTO conference_${peerId} (user_id, messages_count, warns)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE user_id = user_id
          `, [target, 0, 0]);
        } catch (insertError) {
          console.error("Ошибка при создании записи для пользователя:", insertError);
        }
      }

      // Параллельно получаем роль и другие данные пользователя
      const [roleData, nickname, userVipStatus, targetLink] = await Promise.allSettled([
        getUserRole(peerId, target).then(role => getRoleName(peerId, role)),
        getUserName(peerId, target),
        getUserVipStatus(target),
        getlink(target)
      ]);

      const rolename = roleData.status === 'fulfilled' ? roleData.value : 'Пользователь';
      const userNickname = nickname.status === 'fulfilled' ? (nickname.value || "не установлен") : "не установлен";
      const vipData = userVipStatus.status === 'fulfilled' ? userVipStatus.value : null;
      const userLink = targetLink.status === 'fulfilled' ? targetLink.value : `[id${target}|Пользователь]`;

      // Обрабатываем дату вступления
      let formattedDate = "неизвестно";
      if (conversationInfo.status === 'fulfilled' && conversationInfo.value) {
        const currentUserInfo = conversationInfo.value.items.find(
          (item) => item.member_id === target
        );
        
        if (currentUserInfo && currentUserInfo.join_date) {
          formattedDate = formatDate(currentUserInfo.join_date);
        }
      }

      // Обрабатываем информацию о браке (из JSON файла)
      let marriageLine = '💍 В браке: не состоит';
      try {
        if (marriages.status === 'fulfilled' && marriages.value && marriages.value.length > 0) {
          const found = marriages.value.find(m => m.user1 === target || m.user2 === target);
          if (found) {
            const partnerId = found.user1 === target ? found.user2 : found.user1;
            try {
              const partnerName = await getlink(partnerId);
              marriageLine = `💍 В браке с ${partnerName} с ${new Date(found.date).toLocaleDateString()}`;
            } catch (linkError) {
              marriageLine = `💍 В браке с [id${partnerId}|Пользователь] с ${new Date(found.date).toLocaleDateString()}`;
            }
          }
        }
      } catch (marriageError) {
        console.error("Ошибка при получении информации о браке:", marriageError);
        marriageLine = '💍 В браке: не состоит';
      }

      // Обрабатываем VIP статус для короны и дополнительной информации
      let vipText = '';
      let vipInfoSection = '';
      
      if (vipData && vipData.isVip) {
        vipText = ' 👑';
        
        if (vipData.isPermanent) {
          vipInfoSection = 'навсегда';
        } else if (vipData.expiryDate) {
          try {
            const expiryDate = new Date(vipData.expiryDate);
            
            if (isNaN(expiryDate.getTime())) {
              vipInfoSection = 'неправильный формат даты';
            } else {
              const options = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Moscow'
              };
              vipInfoSection = expiryDate.toLocaleDateString('ru-RU', options);
            }
          } catch (dateError) {
            console.error("Ошибка при форматировании даты VIP:", dateError);
            vipInfoSection = 'ошибка даты';
          }
        } else {
          vipInfoSection = 'без срока';
        }
      } else {
        vipInfoSection = 'отсутствует';
      }

      // Формируем финальное сообщение в оригинальном стиле
      const warnsDisplay = Number.isInteger(warns) ? warns : 0;
      
      const responseMessage = `🌐 Профиль участника — ${userLink}\n\n🌀 Роль: ${rolename}${vipText}\n📛 Ник в беседе: ${userNickname}\n💬 Активность: ${messages_count} сообщений\n⚠️ Статус предупреждений: ${warnsDisplay} / 3\n${marriageLine.replace('💍 В браке:', '💍 Семейный статус:').replace('не состоит', 'Не состоит в браке')}\n📅 Дата входа: ${formattedDate}\n\nДополнительная информация:\nVIP-статус: ${vipInfoSection === 'отсутствует' ? 'отсутствует' : `действует ${vipInfoSection === 'навсегда' ? 'навсегда' : 'до ' + vipInfoSection}`}`;
      
      context.send(responseMessage);
      
    } catch (error) {
      console.error("Ошибка при выполнении команды stats:", error);
      context.send("❌ Произошла ошибка при получении статистики.");
    }
  },
};