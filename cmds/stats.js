const database = require("../databases.js");
const { getUserRole, getRoleName, getUserName, checkIfTableExists } = require('./roles.js');
const { getUserVipStatus } = require('../filedb.js');
const { extractNumericId } = require('./ban.js');
const { getlink } = require('../util.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const pathMod = require('path');
const util = require('util');

const cacheManager = require('../cache_manager.js');
const queryAsync = util.promisify(database.query).bind(database);

// ─── Дома пользователя ───
function getUserHouses(userId) {
  try {
    const file = pathMod.join(__dirname, '..', 'data', 'user_houses.json');
    if (!fsSync.existsSync(file)) return [];
    const data = JSON.parse(fsSync.readFileSync(file, 'utf8'));
    return data[userId] || [];
  } catch (e) {
    return [];
  }
}

async function getCachedConversationMembers(peerId) {
  const cached = cacheManager.getConversationMembers(peerId);
  if (cached) return cached;
  try {
    const conversationInfo = await vk.api.messages.getConversationMembers({ peer_id: peerId });
    cacheManager.setConversationMembers(peerId, conversationInfo);
    return conversationInfo;
  } catch (error) {
    console.error("Ошибка при получении информации о беседе:", error);
    return null;
  }
}

async function getCachedMarriageData(peerId) {
  const cached = cacheManager.getMarriages(peerId);
  if (cached) return cached;
  try {
    const marriagesFile = path.join(__dirname, '../data/marriages_' + peerId + '.json');
    try {
      await fs.access(marriagesFile);
      const data = await fs.readFile(marriagesFile, 'utf8');
      const marriages = JSON.parse(data);
      cacheManager.setMarriages(peerId, marriages);
      return marriages;
    } catch (fileError) {
      const emptyMarriages = [];
      cacheManager.setMarriages(peerId, emptyMarriages);
      return emptyMarriages;
    }
  } catch (error) {
    return [];
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const monthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
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

    if (replyMessage) {
      target = replyMessage.senderId;
    } else {
      const parts = text.split(" ");
      const extractedId = await extractNumericId(parts[1]);
      if (extractedId) target = extractedId;
    }

    if (!(await checkIfTableExists(`conference_${peerId}`))) {
      console.error("Таблица не существует");
      return context.send("❌ Беседа не зарегистрирована!");
    }

    try {
      const [userDataResults, conversationInfo, marriages] = await Promise.allSettled([
        queryAsync(`SELECT messages_count, warns, warn_history FROM conference_${peerId} WHERE user_id = ?`, [target]),
        vk.api.messages.getConversationMembers({ peer_id: peerId }),
        new Promise((resolve) => {
          try {
            const fs2 = require('fs');
            const path2 = require('path');
            const marriagesFile = path2.join(__dirname, '../data/marriages_' + peerId + '.json');
            if (!fs2.existsSync(marriagesFile)) { resolve([]); return; }
            const data = fs2.readFileSync(marriagesFile, 'utf8');
            if (!data) { resolve([]); return; }
            resolve(JSON.parse(data));
          } catch (error) {
            resolve([]);
          }
        })
      ]);

      let messages_count = 0;
      let warns = 0;
      let userExists = false;

      if (userDataResults.status === 'fulfilled' && userDataResults.value && userDataResults.value.length > 0) {
        const userData = userDataResults.value[0];
        messages_count = userData.messages_count || 0;
        warns = parseInt(userData.warns) || 0;
        userExists = true;
      }

      if (!userExists) {
        try {
          await queryAsync(`
            INSERT INTO conference_${peerId} (user_id, messages_count, warns)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE user_id = user_id
          `, [target, 0, 0]);
        } catch (insertError) {}
      }

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

      let formattedDate = "неизвестно";
      if (conversationInfo.status === 'fulfilled' && conversationInfo.value) {
        const currentUserInfo = conversationInfo.value.items.find((item) => item.member_id === target);
        if (currentUserInfo && currentUserInfo.join_date) {
          formattedDate = formatDate(currentUserInfo.join_date);
        }
      }

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
        marriageLine = '💍 В браке: не состоит';
      }

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
              const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' };
              vipInfoSection = expiryDate.toLocaleDateString('ru-RU', options);
            }
          } catch (dateError) {
            vipInfoSection = 'ошибка формата даты';
          }
        } else {
          vipInfoSection = 'без срока';
        }
      } else {
        vipInfoSection = 'отсутствует';
      }

      const warnsDisplay = Number.isInteger(warns) ? warns : 0;

      // ─── ДОМ (активный) ───
      const userHouses = getUserHouses(target);
      const activeHouse = userHouses.find(h => h.active === true);

      let attachment = undefined;
      let houseLine = '';
      if (activeHouse) {
        houseLine = `\n🏠 Дом: ${activeHouse.name}`;
        attachment = activeHouse.attachment;
      }

      const responseMessage =
        `🌐 Профиль участника — ${userLink}\n\n` +
        `🌀 Роль: ${rolename}${vipText}\n` +
        `📛 Ник в беседе: ${userNickname}\n` +
        `💬 Активность: ${messages_count} сообщений\n` +
        `⚠️ Статус предупреждений: ${warnsDisplay} / 3\n` +
        `${marriageLine.replace('💍 В браке:', '💍 Семейный статус:').replace('не состоит', 'Не состоит в браке')}\n` +
        `📅 Дата входа: ${formattedDate}` +
        houseLine +
        `\n\nДополнительная информация:\n` +
        `VIP-статус: ${vipInfoSection === 'отсутствует' ? 'отсутствует' : `действует ${vipInfoSection === 'навсегда' ? 'навсегда' : 'до ' + vipInfoSection}`}`;

      if (attachment) {
        return context.send({ message: responseMessage, attachment });
      } else {
        return context.send(responseMessage);
      }

    } catch (error) {
      console.error("Ошибка при выполнении команды stats:", error);
      context.send("❌ Произошла ошибка при получении статистики.");
    }
  },
};