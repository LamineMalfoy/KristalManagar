const axios = require('axios');

module.exports = {
  command: '/ai',
  aliases: ['/ай', '/гпт'],
  description: 'Задать вопрос ИИ (реальный AI)',
  async execute(context) {
    const { text, peerId, senderId } = context;
    const parts = text.split(' ');
    
    // Проверяем VIP статус
    try {
      const { getUserVipStatus } = require('../filedb.js');
      const vipStatus = await getUserVipStatus(senderId);
      
      // Проверяем, есть ли активный VIP
      if (!vipStatus || !vipStatus.isVip) {
        return context.send('🚫 Эта команда доступна только для VIP членов!');
      }
    } catch (error) {
      console.error('Ошибка при проверке VIP:', error);
      return context.send('🚫 Ошибка при проверке VIP');
    }
    
    const question = parts.slice(1).join(' ').trim();
    
    if (!question) {
      return context.send('❌ Укажите вопрос для ИИ\n\nПример: /ai что такое машинное обучение?');
    }
    
    context.send('⏳ Получаю ответ от ИИ...');
    
    try {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
      if (!apiKey) {
        throw new Error('API ключ не настроен');
      }

      // OpenRouter API - работает с GPT-4, Claude, LLaMA и другими
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Ты русскоязычный помощник. Отвечай кратко, четко и по существу на русском языке.'
            },
            {
              role: 'user',
              content: question
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          timeout: 30000,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://vk.com',
            'X-Title': 'VK Bot AI'
          }
        }
      );
      
      let answer = '';
      
      // Обработка разных форматов ответов
      if (response.data?.choices && response.data.choices[0]?.message?.content) {
        answer = response.data.choices[0].message.content;
      } else if (response.data?.result?.choices && response.data.result.choices[0]?.message?.content) {
        answer = response.data.result.choices[0].message.content;
      } else {
        throw new Error('Неожиданный формат ответа');
      }
      
      // Чистим ответ от лишнего
      answer = answer.trim();
      
      // Обрезаем очень длинные ответы
      const maxLength = 2048;
      const truncatedAnswer = answer.length > maxLength 
        ? answer.substring(0, maxLength) + '...'
        : answer;
      
      return context.send(`🤖 Ответ ИИ:\n\n${truncatedAnswer}`);
      
    } catch (error) {
      console.error('Ошибка при запросе к AI:', error.message);
      
      // Местный ответ при ошибке
      const localAnswer = getLocalAnswer(question);
      return context.send(`🤖 Ответ ИИ:\n\n${localAnswer}`);
    }
  }
};

// Локальные ответы для базовых вопросов
function getLocalAnswer(question) {
  const q = question.toLowerCase();
  
  if (q.includes('привет')) return 'Привет! 👋 Как дела? Чем помочь?';
  if (q.includes('кто ты')) return 'Я ИИ ассистент! 🤖 Готов помочь!';
  if (q.includes('как дела')) return 'Со мной всё отлично, спасибо! 😊';
  if (q.includes('время')) return `⏰ ${new Date().toLocaleString('ru-RU')}`;
  if (q.match(/сколько.*\d/)) {
    try {
      const expr = q.replace(/[^0-9+\-*/().]/g, '');
      if (expr) return `Ответ: ${Function('return ' + expr)()}`;
    } catch (e) {}
  }
  
  return 'Извините, API недоступен. Попробуйте позже или спросите что-то проще.';
}
