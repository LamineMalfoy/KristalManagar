const fs = require('fs');
const path = require('path');
const logger = require('./logger.js');
const { getlink } = require('./util.js');
const { Keyboard } = require('vk-io');

class BonusReminderManager {
    constructor(vk) {
        this.vk = vk;
        this.reminders = new Map();
        this.dataFile = path.join(__dirname, 'data', 'bonus_reminders.json');
        this.loadReminders();
    }

    // Загрузка напоминаний из файла при старте бота
    loadReminders() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
                
                // Восстанавливаем таймеры для всех сохраненных напоминаний
                for (const [key, reminderData] of Object.entries(data)) {
                    const timeLeft = new Date(reminderData.nextBonusTime) - new Date();
                    
                    if (timeLeft > 0) {
                        // Если время еще не пришло, создаем новый таймер
                        this.scheduleReminder(
                            reminderData.userId,
                            reminderData.peerId,
                            timeLeft
                        );
                    } else {
                        // Если время прошло, отправляем напоминание сразу
                        this.sendReminder(reminderData.userId, reminderData.peerId);
                    }
                }
            }
        } catch (error) {
            logger.error('Ошибка загрузки напоминаний о бонусах:', error);
        }
    }

    // Сохранение напоминаний в файл
    saveReminders() {
        try {
            const dataDir = path.dirname(this.dataFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const data = {};
            for (const [key, value] of this.reminders.entries()) {
                data[key] = {
                    userId: value.userId,
                    peerId: value.peerId,
                    nextBonusTime: value.nextBonusTime
                };
            }
            
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Ошибка сохранения напоминаний о бонусах:', error);
        }
    }

    // Планирование нового напоминания
    scheduleReminder(userId, peerId, delayMs = 24 * 60 * 60 * 1000) {
        const key = `${peerId}_${userId}`;
        
        // Отменяем предыдущий таймер, если он существует
        if (this.reminders.has(key)) {
            const existingReminder = this.reminders.get(key);
            if (existingReminder.timer) {
                clearTimeout(existingReminder.timer);
            }
        }

        // Создаем новый таймер
        const timer = setTimeout(() => {
            this.sendReminder(userId, peerId);
        }, delayMs);

        // Сохраняем информацию о напоминании
        const nextBonusTime = new Date(Date.now() + delayMs).toISOString();
        this.reminders.set(key, {
            userId,
            peerId,
            timer,
            nextBonusTime
        });

        // Сохраняем в файл
        this.saveReminders();
    }

    // Отправка напоминания
    async sendReminder(userId, peerId) {
        try {
            // Получаем кликабельную ссылку на пользователя
            const userLink = await getlink(userId);
            
            // Создаем inline callback-кнопку для получения бонуса (зелёная)
            const keyboard = Keyboard.builder()
                .callbackButton({
                    label: '✅ Получить бонус',
                    payload: {
                        command: 'get_bonus',
                        user_id: userId
                    },
                    color: Keyboard.POSITIVE_COLOR
                })
                .inline();

            // Отправляем сообщение с напоминанием
            await this.vk.api.messages.send({
                peer_id: peerId,
                message: `✅ ${userLink} вам снова доступен бонус`,
                keyboard: keyboard,
                random_id: Math.floor(Math.random() * 999999999)
            });

            // Удаляем напоминание из списка
            const key = `${peerId}_${userId}`;
            this.reminders.delete(key);
            this.saveReminders();

        } catch (error) {
            logger.error('Ошибка отправки напоминания о бонусе:', error);
        }
    }

    // Отмена напоминания (если нужно)
    cancelReminder(userId, peerId) {
        const key = `${peerId}_${userId}`;
        
        if (this.reminders.has(key)) {
            const reminder = this.reminders.get(key);
            if (reminder.timer) {
                clearTimeout(reminder.timer);
            }
            this.reminders.delete(key);
            this.saveReminders();
        }
    }

    // Получение информации о следующем бонусе
    getNextBonusTime(userId, peerId) {
        const key = `${peerId}_${userId}`;
        
        if (this.reminders.has(key)) {
            return new Date(this.reminders.get(key).nextBonusTime);
        }
        
        return null;
    }
}

module.exports = BonusReminderManager;
