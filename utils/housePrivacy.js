// Скрытие альбома через VK API
// Запуск: node utils/housePrivacy.js
require('dotenv').config();
const { VK } = require('vk-io');

const vk = new VK({ token: process.env.VK_TOKEN });

(async () => {
  try {
    // Скрываем альбом — приватность "только я"
    const res = await vk.api.photos.editAlbum({
      album_id: 310498666,
      owner_id: -241585274,
      title: 'Дома',
      // В VK API у альбомов сообщества нет прямой опции "скрыть",
      // но можно удалить его из блока "Фото" через настройки сообщества
      // Единственный способ — оставить как есть или удалить
    });
    console.log('Результат:', res);
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
})();