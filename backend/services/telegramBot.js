const TelegramBot = require('node-telegram-bot-api');
const { ChatOllama } = require('@langchain/ollama');
const axios = require('axios');
const dns = require('dns').promises;
require('dotenv').config();
const { sleep } = require('../utils/helpers');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { linkIdentity, getUserIdByIdentity } = require('../utils/identity-linker');

class TelegramBotService {
  constructor() {
    // Проверяем наличие токена
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('Token is required');
    }

    this.isRunning = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 секунд между попытками
    
    // Создаем бота без polling
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
      polling: false,
      request: {
        proxy: null,
        agentOptions: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        },
        timeout: 30000
      }
    });
    
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.chat = new ChatOllama({
      model: 'mistral',
      baseUrl: 'http://localhost:11434'
    });

    // Добавляем настройки прокси для axios
    this.axiosConfig = {
      timeout: 5000,
      proxy: false,
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      })
    };

    this.initialize();
  }

  setupHandlers() {
    this.bot.onText(/.*/, async (msg) => {
      try {
        const chatId = msg.chat.id;
        const userQuestion = msg.text;
        
        // Пропускаем команды
        if (userQuestion.startsWith('/')) {
          return;
        }
        
        console.log('Получен вопрос:', userQuestion);

        // Используем локальную модель
        const result = await this.chat.invoke(userQuestion);
        const assistantResponse = result.content;
        
        await this.bot.sendMessage(chatId, assistantResponse);
      } catch (error) {
        console.error('Telegram bot error:', error);
        await this.bot.sendMessage(msg.chat.id, 
          'Извините, произошла ошибка при обработке вашего запроса. ' +
          'Попробуйте повторить позже или обратитесь к администратору.'
        );
      }
    });

    this.bot.onText(/\/link (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const ethAddress = match[1];
      
      // Проверяем формат Ethereum-адреса
      if (!/^0x[a-fA-F0-9]{40}$/.test(ethAddress)) {
        this.bot.sendMessage(chatId, 'Неверный формат Ethereum-адреса. Используйте формат 0x...');
        return;
      }
      
      try {
        // Получаем ID пользователя по Ethereum-адресу
        const userId = await getUserIdByIdentity('ethereum', ethAddress);
        
        if (!userId) {
          this.bot.sendMessage(chatId, 'Пользователь с таким Ethereum-адресом не найден. Сначала войдите через веб-интерфейс.');
          return;
        }
        
        // Связываем Telegram-аккаунт с пользователем
        const success = await linkIdentity(userId, 'telegram', chatId.toString());
        
        if (success) {
          this.bot.sendMessage(chatId, `Ваш Telegram-аккаунт успешно связан с Ethereum-адресом ${ethAddress}`);
        } else {
          this.bot.sendMessage(chatId, 'Не удалось связать аккаунты. Возможно, этот Telegram-аккаунт уже связан с другим пользователем.');
        }
      } catch (error) {
        console.error('Ошибка при связывании аккаунтов:', error);
        this.bot.sendMessage(chatId, 'Произошла ошибка при связывании аккаунтов. Попробуйте позже.');
      }
    });
  }

  setupCommands() {
    this.bot.onText(/\/start/, async (msg) => {
      const welcomeMessage = `
        👋 Здравствуйте! Я - ассистент DApp for Business.
        
        Я готов помочь вам с вопросами о:
        • Разработке dApps
        • Блокчейн-технологиях
        • Web3 и криптовалютах
        
        Просто задавайте вопросы, а если нужна помощь - 
        используйте команду /help
      `;
      await this.bot.sendMessage(msg.chat.id, welcomeMessage);
    });

    this.bot.onText(/\/help/, async (msg) => {
      const helpMessage = `
        🤖 Я - ассистент DApp for Business
        
         Я могу помочь вам с:
         • Разработкой децентрализованных приложений
         • Интеграцией блокчейн-технологий в бизнес
         • Консультациями по Web3 и криптовалютам
         
         Команды:
         /start - начать работу с ботом
         /help - показать это сообщение
         /status - проверить состояние бота
         
         Просто задавайте вопросы на русском или английском языке!
       `;
      await this.bot.sendMessage(msg.chat.id, helpMessage);
    });

    this.bot.onText(/\/status/, async (msg) => {
      try {
        const status = {
          isRunning: this.isRunning,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          connections: {
            telegram: Boolean(this.bot),
            ollama: Boolean(this.chat)
          }
        };

        const statusMessage = `
          📊 Статус бота:
          
          🟢 Статус: ${status.isRunning ? 'Работает' : 'Остановлен'}
          ⏱ Время работы: ${Math.floor(status.uptime / 60)} мин
          
          🔗 Подключения:
          • Telegram API: ${status.connections.telegram ? '✅' : '❌'}
          • Ollama: ${status.connections.ollama ? '✅' : '❌'}
          
          💾 Использование памяти:
          • Heap: ${Math.round(status.memoryUsage.heapUsed / 1024 / 1024)}MB
          • RSS: ${Math.round(status.memoryUsage.rss / 1024 / 1024)}MB
        `;

        await this.bot.sendMessage(msg.chat.id, statusMessage);
      } catch (error) {
        console.error('Ошибка при получении статуса:', error);
        await this.bot.sendMessage(msg.chat.id, 'Ошибка при получении статуса бота');
      }
    });
  }

  async initialize() {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        console.log(`Попытка инициализации Telegram бота (${retries + 1}/${this.maxRetries})...`);
        
        // Сначала проверяем DNS и доступность
        try {
          console.log('Проверка DNS для api.telegram.org...');
          const addresses = await dns.resolve4('api.telegram.org');
          console.log('IP адреса api.telegram.org:', addresses);
          
          // Пинг для проверки доступности (теперь ждем результат)
          try {
            const { stdout } = await exec('ping -c 1 api.telegram.org');
            console.log('Результат ping:', stdout);
          } catch (pingError) {
            console.error('Ошибка при выполнении ping:', pingError);
            throw new Error('Сервер Telegram недоступен');
          }
        } catch (error) {
          console.error('Ошибка сетевой проверки:', error);
          throw error;
        }
        
        // Затем проверяем API
        try {
          const response = await axios.get(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`,
            this.axiosConfig
          );
          
          if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          console.log('Успешное подключение к API Telegram:', {
            botInfo: response.data.result
          });
        } catch (error) {
          console.error('Ошибка при проверке API Telegram:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              timeout: error.config?.timeout
            }
          });
          throw error;
        }
        
        // Основная инициализация бота
        await this.initBot();
        console.log('Telegram bot service initialized');
        return;
        
      } catch (error) {
        retries++;
        console.error('Ошибка при инициализации Telegram бота:', {
          name: error.name,
          message: error.message,
          code: error.code,
          response: error.response?.data,
          stack: error.stack
        });
        
        if (retries < this.maxRetries) {
          console.log(`Повторная попытка через ${this.retryDelay/1000} секунд...`);
          await sleep(this.retryDelay);
        } else {
          console.error('Превышено максимальное количество попыток подключения к Telegram');
          throw error;
        }
      }
    }
  }

  async initBot() {
    try {
      // Проверяем, не запущен ли уже бот
      const webhookInfo = await this.bot.getWebHookInfo();
      
      // Если есть webhook или активный polling, пробуем остановить
      if (webhookInfo.url || webhookInfo.has_custom_certificate) {
        console.log('Удаляем существующий webhook...');
        await this.bot.deleteWebHook();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Пробуем получить обновления с большим таймаутом
      try {
        console.log('Проверяем наличие других экземпляров бота...');
        const updates = await this.bot.getUpdates({
          offset: -1,
          limit: 1,
          timeout: 0
        });
        console.log('Проверка существующих подключений:', updates);
      } catch (error) {
        if (error.code === 409) {
          console.log('Обнаружен активный бот, пробуем остановить...');
          await this.stop();
          await new Promise(resolve => setTimeout(resolve, 5000));
          // Повторная попытка получить обновления
          await this.bot.getUpdates({ offset: -1, limit: 1, timeout: 0 });
        }
      }

      // Небольшая пауза перед запуском поллинга
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Запускаем polling
      console.log('Запускаем polling...');
      await this.bot.startPolling({
        interval: 2000,
        params: {
          timeout: 10
        }
      });

      this.isRunning = true;
      this.setupHandlers();
      this.setupErrorHandlers();
      this.setupCommands();
    } catch (error) {
      if (error.code === 409) {
        console.log('Бот уже запущен в другом процессе');
        this.isRunning = false;
      } else {
        console.error('Ошибка при инициализации Telegram бота:', error);
        throw error;
      }
    }
  }

  setupErrorHandlers() {
    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      
      // Обработка различных ошибок
      if (this.isRunning && (error.code === 'EFATAL' || error.code === 'ETELEGRAM')) {
        console.log('Переподключение к Telegram через 5 секунд...');
        setTimeout(async () => {
          try {
            await this.stop();
            await this.initBot();
          } catch (err) {
            console.error('Ошибка при перезапуске бота:', err);
          }
        }, 5000);
      } else if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
        // Для ошибок соединения пробуем сразу переподключиться
        this.bot.startPolling();
      }
    });

    // Обработка других ошибок
    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
      // Пробуем переподключиться при любой ошибке
      setTimeout(() => this.bot.startPolling(), 5000);
    });

    // Обработка webhook ошибок
    this.bot.on('webhook_error', (error) => {
      console.error('Telegram webhook error:', error);
    });
  }

  async stop() {
    if (this.isRunning) {
      console.log('Останавливаем Telegram бота...');
      try {
        // Сначала отключаем обработчики
        this.bot.removeAllListeners();

        // Останавливаем поллинг
        await this.bot.stopPolling();

        // Очищаем очередь обновлений
        await this.bot.getUpdates({
          offset: -1,
          limit: 1,
          timeout: 1
        });

        this.isRunning = false;
        console.log('Telegram бот остановлен');
      } catch (error) {
        console.error('Ошибка при остановке бота:', error);
        // Принудительно отмечаем как остановленный
        this.isRunning = false;
      }
    }
  }

  async checkTelegramAvailability() {
    const { stdout } = await exec('ping -c 1 api.telegram.org');
    const match = stdout.match(/time=(\d+(\.\d+)?)/);
    if (match) {
      const pingTime = parseFloat(match[1]);
      console.log(`Время отклика Telegram API: ${pingTime}ms`);
      if (pingTime > 1000) { // Если пинг больше секунды
        console.warn('Внимание: высокая задержка при подключении к Telegram API');
      }
    }
    return stdout;
  }
}

module.exports = TelegramBotService; 