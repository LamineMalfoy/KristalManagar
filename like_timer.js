const fs = require('fs');
const path = require('path');

const POSTS_FILE = path.join(__dirname, 'data', 'like_posts.json');
const LIKES_FILE = path.join(__dirname, 'data', 'like_rewards.json');

const LIKE_REWARD = 2000000n;      // 2.000.000₽
const COMMENT_REWARD = 500000n;    // 500.000₽
const MAX_COMMENTS = 3;            // максимум 3 коммента

function load(file, def = {}) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return def;
}
function save(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

async function checkPosts(vk) {
  const posts = load(POSTS_FILE);
  const rewards = load(LIKES_FILE);

  const { getUserBalance, updateUserBalance } = require('./filedb.js');
  const { toBigInt, formatBigInt } = require('./utils/bigint.js');

  for (const [key, post] of Object.entries(posts)) {
    try {
      // Получаем лайки
      const likesRes = await vk.api.likes.getList({
        type: 'post',
        owner_id: post.ownerId,
        item_id: post.postId,
        count: 1000
      });

      const currentLikes = likesRes.items.map(u => Number(u));
      const prevLikes = rewards[key]?.likes || [];

      // Новые лайки
      const newLikes = currentLikes.filter(u => !prevLikes.includes(u));

      // Снятые лайки
      const removedLikes = prevLikes.filter(u => !currentLikes.includes(u));

      // Начисляем новым
      for (const uid of newLikes) {
        const bal = toBigInt(await getUserBalance(uid));
        await updateUserBalance(uid, (bal + LIKE_REWARD).toString());

        try {
          await vk.api.messages.send({
            user_id: uid,
            message: `👍 Спасибо за лайк на пост!\n💰 Получено: ${formatBigInt(LIKE_REWARD)}`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {}
      }

      // Забираем у снявших
      for (const uid of removedLikes) {
        const bal = toBigInt(await getUserBalance(uid));
        const newBal = bal - LIKE_REWARD;
        await updateUserBalance(uid, (newBal < 0n ? 0n : newBal).toString());

        try {
          await vk.api.messages.send({
            user_id: uid,
            message: `❌ Вы убрали лайк — ${formatBigInt(LIKE_REWARD)} списано.`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {}
      }

      // ─── Комментарии ───
      const commentsRes = await vk.api.wall.getComments({
        owner_id: post.ownerId,
        post_id: post.postId,
        count: 100
      });

      const currentComments = {};
      for (const c of commentsRes.items) {
        if (c.from_id > 0) {
          if (!currentComments[c.from_id]) currentComments[c.from_id] = [];
          currentComments[c.from_id].push(c.id);
        }
      }

      const prevComments = rewards[key]?.comments || {};

      // Новые комментарии
      for (const [uid, ids] of Object.entries(currentComments)) {
        const prevIds = prevComments[uid] || [];
        const newIds = ids.filter(id => !prevIds.includes(id));

        if (newIds.length === 0) continue;

        // Сколько ещё можно комментариев
        const usedCount = prevIds.length;
        const canAdd = Math.min(newIds.length, MAX_COMMENTS - usedCount);

        if (canAdd <= 0) continue;

        const reward = COMMENT_REWARD * BigInt(canAdd);
        const bal = toBigInt(await getUserBalance(Number(uid)));
        await updateUserBalance(Number(uid), (bal + reward).toString());

        try {
          await vk.api.messages.send({
            user_id: Number(uid),
            message: `💬 Спасибо за комментарий!\n💰 Получено: ${formatBigInt(reward)} (${canAdd} шт.)`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {}
      }

      // Удалённые комментарии
      for (const [uid, ids] of Object.entries(prevComments)) {
        const curIds = currentComments[uid] || [];
        const removedIds = ids.filter(id => !curIds.includes(id));

        if (removedIds.length === 0) continue;

        const refund = COMMENT_REWARD * BigInt(removedIds.length);
        const bal = toBigInt(await getUserBalance(Number(uid)));
        const newBal = bal - refund;
        await updateUserBalance(Number(uid), (newBal < 0n ? 0n : newBal).toString());

        try {
          await vk.api.messages.send({
            user_id: Number(uid),
            message: `❌ Вы удалили комментарий — ${formatBigInt(refund)} списано.`,
            random_id: Math.floor(Math.random() * 1e9)
          });
        } catch (e) {}
      }

      // Сохраняем
      rewards[key] = {
        likes: currentLikes,
        comments: currentComments
      };
      save(LIKES_FILE, rewards);

    } catch (e) {
      console.error('like_timer post error:', e.message);
    }
  }
}

function startLikeTimer(vk) {
  // Каждые 2 минуты
  setInterval(() => {
    checkPosts(vk).catch(e => console.error('like_timer:', e.message));
  }, 2 * 60 * 1000);
  console.log('👍 like_timer запущен');
}

module.exports = { startLikeTimer };