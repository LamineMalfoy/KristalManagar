const { Keyboard } = require('vk-io');
const fs = require('fs');
const path = require('path');
const vk = global.vk;
const { updateGameStats } = require('./top.js');

// Хранилище активных игр по peer_id
const activeGames = new Map();

// Словарь для проверки слов
let wordDictionary = new Set();

// Загружаем словарь из файла
function loadDictionary() {
    try {
        const dictionaryPath = path.join(__dirname, '..', 'data', 'russian_words.txt');
        if (fs.existsSync(dictionaryPath)) {
            const content = fs.readFileSync(dictionaryPath, 'utf8');
            const words = content.split('\n').map(word => word.trim().toLowerCase()).filter(word => word.length > 0);
            wordDictionary = new Set(words);
            console.log(`Загружено ${wordDictionary.size} слов в словарь`);
        } else {
            // Базовый набор слов, если файл не найден
            wordDictionary = new Set([
                'автомобиль', 'лампа', 'арбуз', 'зебра', 'антенна', 'абрикос', 'лимон', 'нос', 'слон', 'нога',
                'апельсин', 'носорог', 'гитара', 'арфа', 'автобус', 'собака', 'кот', 'тигр', 'рыба', 'акула',
                'банан', 'ананас', 'самолет', 'телефон', 'нож', 'жираф', 'фламинго', 'олень', 'небо', 'облако',
                'окно', 'озеро', 'осень', 'ель', 'лето', 'осьминог', 'голубь', 'белка', 'альбом', 'мост',
                'стол', 'лодка', 'арка', 'кресло', 'огурец', 'цветок', 'кольцо', 'огонь', 'небосвод', 'дом',
                'море', 'ежик', 'кит', 'торт', 'танк', 'корабль', 'лес', 'солнце', 'енот', 'тюлень', 'нитка',
                'альпинист', 'тарелка', 'абажур', 'радуга', 'аквариум', 'мышь', 'шар', 'рак', 'кастрюля', 'яблоко'
            ]);
            console.log('Используется базовый словарь');
        }
    } catch (error) {
        console.error('Ошибка загрузки словаря:', error);
        // Используем базовый набор при ошибке
        wordDictionary = new Set([
            'автомобиль', 'лампа', 'арбуз', 'зебра', 'антенна', 'абрикос', 'лимон', 'нос', 'слон', 'нога',
            'апельсин', 'носорог', 'гитара', 'арфа', 'автобус', 'собака', 'кот', 'тигр', 'рыба', 'акула'
        ]);
    }
}

// Загружаем словарь при инициализации модуля
loadDictionary();

function createGameKeyboard(gameState) {
    const keyboard = Keyboard.builder();
    
    if (!gameState) {
        keyboard.textButton({
            label: 'Зайти в игру',
            payload: { action: 'join_game' },
            color: Keyboard.POSITIVE_COLOR
        }).row();
        keyboard.textButton({
            label: 'Правила',
            payload: { action: 'show_rules' },
            color: Keyboard.NEGATIVE_COLOR
        });
        return keyboard.inline();
    }
    
    if (gameState.status === 'waiting') {
        keyboard.textButton({
            label: '✋ Зайти в игру',
            payload: { action: 'join_game' },
            color: Keyboard.POSITIVE_COLOR
        }).row();
        keyboard.textButton({
            label: '🚫 Остановить',
            payload: { action: 'stop_game' },
            color: Keyboard.NEGATIVE_COLOR
        });
        keyboard.textButton({
            label: '📒 Правила',
            payload: { action: 'show_rules' },
            color: Keyboard.NEGATIVE_COLOR
        });
        return keyboard.inline();
    }
    
    if (gameState.status === 'playing') {
        keyboard.textButton({
            label: '🚪 Покинуть игру',
            payload: { action: 'leave_game' },
            color: Keyboard.NEGATIVE_COLOR
        }).row();
        keyboard.textButton({
            label: '🚫 Остановить',
            payload: { action: 'stop_game' },
            color: Keyboard.NEGATIVE_COLOR
        });
        keyboard.textButton({
            label: '📒 Правила',
            payload: { action: 'show_rules' },
            color: Keyboard.NEGATIVE_COLOR
        });
        return keyboard.inline();
    }
    
    if (gameState.status === 'finished') {
        keyboard.textButton({
            label: '📕 ещё раз',
            payload: { action: 'start_new_game' },
            color: Keyboard.SECONDARY_COLOR
        });
        return keyboard.inline();
    }
    
    return keyboard.inline();
}

module.exports = {
    command: '/words',
    aliases: ['/слова'],
    description: 'Запуск игры в слова',
    async execute(context) {
        try {
            const peerId = context.peerId;
            const gameState = activeGames.get(peerId);
            
            if (!gameState) {
                // Создаем новую игру
                const newGame = {
                    status: 'waiting',
                    players: [context.senderId],
                    creator: context.senderId,
                    usedWords: new Set(),
                    wordCount: 0,
                    lastLetter: null,
                    currentPlayer: null,
                    timeoutId: null
                };
                
                activeGames.set(peerId, newGame);
                
                const userName = await getUserName(context.senderId);
                const message = `💭 ${userName} запустил игру: «слова». Нужно собрать ещё как минимум одного игрока.`;
                
                await context.send({
                    message: message,
                    keyboard: createGameKeyboard(newGame)
                });
            } else {
                // Игра уже существует
                let message = '';
                
                if (gameState.status === 'waiting') {
                    message = `🎮 Игра в слова уже создана! Присоединяйтесь к игре.`;
                } else if (gameState.status === 'playing') {
                    message = `🎮 Игра в слова уже идёт! Можете присоединиться или наблюдать.`;
                } else if (gameState.status === 'finished') {
                    message = `🎮 Предыдущая игра закончена. Можете начать новую игру.`;
                }
                
                await context.send({
                    message: message,
                    keyboard: createGameKeyboard(gameState)
                });
            }
        } catch (error) {
            console.error('Ошибка в команде words:', error);
            await context.reply('❌ Произошла ошибка при запуске игры в слова.');
        }
    }
};

async function getUserName(userId) {
    try {
        const userInfo = await vk.api.users.get({ user_ids: userId });
        return `[id${userId}|${userInfo[0].first_name} ${userInfo[0].last_name}]`;
    } catch (error) {
        return `[id${userId}|Пользователь]`;
    }
}

function getLastLetter(word) {
    const cleanWord = word.toLowerCase().replace(/[ъь]/g, '');
    return cleanWord[cleanWord.length - 1];
}

function getFirstLetter(word) {
    return word.toLowerCase()[0];
}

function validateWord(word, gameState) {
    if (/\d/.test(word)) {
        return { valid: false, error: '⛔ В слове не должно быть цифр.' };
    }
    
    if (word.includes(' ')) {
        return { valid: false, error: '⛔ Нельзя использовать фразы, только одно слово.' };
    }
    
    if (word.length < 3) {
        return { valid: false, error: '⛔ Слово должно иметь больше двух букв.' };
    }
    
    if (gameState.usedWords.has(word.toLowerCase())) {
        return { valid: false, error: `⛔ Слово: «${word}» уже говорили.` };
    }
    
    if (!wordDictionary.has(word.toLowerCase())) {
        return { valid: false, error: `⛔ Слово: «${word}» не имеется в базе и мы не можем проверить его на существование.` };
    }
    
    if (gameState.lastLetter && getFirstLetter(word) !== gameState.lastLetter) {
        return { valid: false, error: `⛔ Слово должно начинаться на букву «${gameState.lastLetter.toUpperCase()}».` };
    }
    
    return { valid: true };
}

// Функция для обновления статистики при завершении игры
async function updateWordsGameStats(winnerId) {
  try {
    await updateGameStats(winnerId, 'words', true);
    console.log(`Обновлена статистика игры в слова для пользователя ${winnerId}`);
  } catch (error) {
    console.error('Ошибка при обновлении статистики игры в слова:', error);
  }
}

// Экспортируем функции для использования в index.js
module.exports.activeGames = activeGames;
module.exports.validateWord = validateWord;
module.exports.getLastLetter = getLastLetter;
module.exports.getUserName = getUserName;
module.exports.createGameKeyboard = createGameKeyboard;
module.exports.updateWordsGameStats = updateWordsGameStats;
