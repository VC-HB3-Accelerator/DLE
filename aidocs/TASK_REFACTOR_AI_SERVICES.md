# 🔧 ЗАДАЧА: Рефакторинг AI сервисов (устранение дублей + интеграция Queue/Cache)

**Дата:** 2025-10-09  
**Приоритет:** ВЫСОКИЙ  
**Статус:** 📋 В РАЗРАБОТКЕ

---

## 🎯 **ЦЕЛЬ**

Устранить дублирование кода и интегрировать существующие сервисы `ai-queue.js` и `ai-cache.js` в основной поток обработки.

---

## ❌ **НАЙДЕННЫЕ ДУБЛИ**

### **ДУБЛЬ #1: Кэширование** ⭐⭐⭐ КРИТИЧЕСКИЙ

#### **`ragService.js` (строки 20-22, 78-84, 182-185):**
```javascript
const ragCache = new Map();  // ❌ Примитивный дубль!
const RAG_CACHE_TTL = 5 * 60 * 1000;

// Использование:
const cached = ragCache.get(cacheKey);
ragCache.set(cacheKey, { result, timestamp: Date.now() });
```

#### **`ai-cache.js` (весь файл, 95 строк):**
```javascript
class AICache {
  this.cache = new Map();  // ✅ Полноценный сервис!
  this.maxSize = 1000;
  this.ttl = 24 * 60 * 60 * 1000;
  
  // + управление размером
  // + автоочистка
  // + статистика
}
```

**Вывод:** Удалить `ragCache` → использовать `ai-cache.js`

---

### **ДУБЛЬ #2: Вызовы Ollama API** ⭐⭐⭐ КРИТИЧЕСКИЙ

#### **`ragService.js` (строки 358-371):**
```javascript
const axios = require('axios');  // ❌ Внутри функции!
const ollamaConfig = require('./ollamaConfig');

const response = await axios.post(`${ollamaUrl}/api/chat`, {
  model: model || ollamaConfig.getDefaultModel(),
  messages: messages,
  stream: false
}, {
  timeout: ollamaConfig.getTimeout()
});
```

**Проблема:** Прямой вызов → пропускается `ai-queue.js`

**Вывод:** Использовать `ai-queue.addTask()`

---

### **ДУБЛЬ #3: Генерация ключа кэша** ⭐⭐

#### **`ragService.js`:**
```javascript
const cacheKey = `${tableId}:${userQuestion}:${product}`;  // ❌ Простая строка
```

#### **`ai-cache.js`:**
```javascript
generateKey(messages, options = {}) {
  return crypto.createHash('md5').update(content).digest('hex');  // ✅ MD5 хеш
}
```

**Вывод:** Использовать единый метод из `ai-cache.js`

---

### **ДУБЛЬ #4: Import внутри функций** ⭐⭐

**`ragService.js` (строки 359-361):**
```javascript
async function generateLLMResponse({...}) {
  const axios = require('axios');  // ❌ Каждый раз!
  const ollamaConfig = require('./ollamaConfig');  // ❌ Каждый раз!
}
```

**Вывод:** Вынести импорты наверх файла

---

### **ДУБЛЬ #5: Fallback на несуществующую очередь** ⭐

**`ragService.js` (строки 375-379):**
```javascript
if (error.message.includes('очередь перегружена') && answer) {  // ❌ Очередь не используется!
  return answer;
}
```

**Вывод:** Удалить или исправить после интеграции очереди

---

## 🔧 **ПЛАН ИСПРАВЛЕНИЙ**

### **ЭТАП 1: Доработать `ai-cache.js`** ⭐⭐⭐

**Файл:** `backend/services/ai-cache.js`

**Добавить методы:**

```javascript
class AICache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;
    this.ttl = 24 * 60 * 60 * 1000; // Default: 24 часа
    this.ragTtl = 5 * 60 * 1000;     // ✨ НОВОЕ: 5 минут для RAG
  }

  // ✨ НОВОЕ: Генерация ключа для RAG результатов
  generateKeyForRAG(tableId, userQuestion, product = null) {
    const content = JSON.stringify({ tableId, userQuestion, product });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // ✨ НОВОЕ: Получение с учетом типа (RAG или LLM)
  getWithTTL(key, type = 'llm') {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttl = type === 'rag' ? this.ragTtl : this.ttl;
    
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.response;
  }

  // ✨ НОВОЕ: Сохранение с типом
  setWithType(key, response, type = 'llm') {
    // Очищаем старые записи если кэш переполнен
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      type: type  // ✨ Сохраняем тип
    });

    logger.info(`[AICache] Cached ${type} response for key: ${key.substring(0, 8)}...`);
  }

  // ✨ НОВОЕ: Инвалидация по префиксу (для RAG при обновлении таблиц)
  invalidateByPrefix(prefix) {
    let deletedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      logger.info(`[AICache] Invalidated ${deletedCount} entries with prefix: ${prefix}`);
    }
    return deletedCount;
  }

  // ✨ НОВОЕ: Статистика по типу
  getStatsByType() {
    const stats = { rag: 0, llm: 0, other: 0 };
    for (const [key, value] of this.cache.entries()) {
      const type = value.type || 'other';
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }
}
```

---

### **ЭТАП 2: Доработать `ai-queue.js`** ⭐⭐⭐

**Файл:** `backend/services/ai-queue.js`

**Добавить методы для обработки:**

```javascript
const axios = require('axios');
const ollamaConfig = require('./ollamaConfig');
const aiCache = require('./ai-cache');

class AIQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.isProcessing = false;  // ✨ НОВОЕ
    this.maxQueueSize = 100;    // ✨ НОВОЕ
    this.workerInterval = null; // ✨ НОВОЕ
    this.stats = {
      totalAdded: 0,
      totalProcessed: 0,
      totalFailed: 0,
      avgResponseTime: 0,
      lastProcessedAt: null,
      initializedAt: Date.now()
    };
  }

  // ✨ НОВОЕ: Добавление задачи с Promise
  async addTask(taskData) {
    // Проверяем лимит очереди
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Очередь переполнена');
    }

    const taskId = Date.now() + Math.random();
    const priority = taskData.priority || 5;
    
    const queueItem = {
      id: taskId,
      request: taskData,
      priority,
      status: 'queued',
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority);
    this.stats.totalAdded++;

    logger.info(`[AIQueue] Задача ${taskId} добавлена (priority: ${priority}). Очередь: ${this.queue.length}`);
    this.emit('requestAdded', queueItem);

    // Возвращаем Promise для ожидания результата
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Queue timeout'));
      }, 120000); // 2 минуты

      this.once(`task_${taskId}_completed`, (result) => {
        clearTimeout(timeout);
        resolve(result.response);
      });

      this.once(`task_${taskId}_failed`, (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }

  // ✨ НОВОЕ: Запуск автоматического worker
  startWorker() {
    if (this.workerInterval) {
      logger.warn('[AIQueue] Worker уже запущен');
      return;
    }

    logger.info('[AIQueue] 🚀 Запуск worker для обработки очереди...');
    
    this.workerInterval = setInterval(() => {
      this.processNextTask();
    }, 100); // Проверяем очередь каждые 100ms
  }

  // ✨ НОВОЕ: Остановка worker
  stopWorker() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      logger.info('[AIQueue] ⏹️ Worker остановлен');
    }
  }

  // ✨ НОВОЕ: Обработка следующей задачи
  async processNextTask() {
    if (this.isProcessing) return;
    
    const task = this.getNextRequest();
    if (!task) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info(`[AIQueue] Обработка задачи ${task.id}`);

      // 1. Проверяем кэш
      const cacheKey = aiCache.generateKey(task.request.messages);
      const cached = aiCache.get(cacheKey);
      
      if (cached) {
        logger.info(`[AIQueue] Cache HIT для задачи ${task.id}`);
        const responseTime = Date.now() - startTime;
        
        this.updateRequestStatus(task.id, 'completed', cached, null, responseTime);
        this.emit(`task_${task.id}_completed`, { response: cached, fromCache: true });
        return;
      }

      // 2. Вызываем Ollama API
      const ollamaUrl = ollamaConfig.getBaseUrl();
      const timeouts = ollamaConfig.getTimeouts();

      const response = await axios.post(`${ollamaUrl}/api/chat`, {
        model: task.request.model || ollamaConfig.getDefaultModel(),
        messages: task.request.messages,
        stream: false
      }, {
        timeout: timeouts.ollamaChat
      });

      const result = response.data.message.content;
      const responseTime = Date.now() - startTime;

      // 3. Сохраняем в кэш
      aiCache.set(cacheKey, result);

      // 4. Обновляем статус
      this.updateRequestStatus(task.id, 'completed', result, null, responseTime);
      this.emit(`task_${task.id}_completed`, { response: result, fromCache: false });

      logger.info(`[AIQueue] ✅ Задача ${task.id} выполнена за ${responseTime}ms`);

    } catch (error) {
      logger.error(`[AIQueue] ❌ Ошибка задачи ${task.id}:`, error.message);
      
      this.updateRequestStatus(task.id, 'failed', null, error.message);
      this.emit(`task_${task.id}_failed`, { message: error.message });

    } finally {
      this.isProcessing = false;
    }
  }
}
```

---

### **ЭТАП 3: Рефакторинг `ragService.js`** ⭐⭐⭐

**Файл:** `backend/services/ragService.js`

**Изменения:**

#### **3.1. Вынести импорты наверх (строки 13-23)**

**Было:**
```javascript
const encryptedDb = require('./encryptedDatabaseService');
const vectorSearch = require('./vectorSearchClient');
const logger = require('../utils/logger');

// Простой кэш для RAG результатов
const ragCache = new Map();  // ❌ УДАЛИТЬ!
const RAG_CACHE_TTL = 5 * 60 * 1000;  // ❌ УДАЛИТЬ!
```

**Стало:**
```javascript
const encryptedDb = require('./encryptedDatabaseService');
const vectorSearch = require('./vectorSearchClient');
const logger = require('../utils/logger');
const axios = require('axios');  // ✨ НОВОЕ
const ollamaConfig = require('./ollamaConfig');  // ✨ НОВОЕ
const aiCache = require('./ai-cache');  // ✨ НОВОЕ
const aiQueue = require('./ai-queue');  // ✨ НОВОЕ

// Флаги для включения/выключения
const USE_AI_CACHE = process.env.USE_AI_CACHE !== 'false'; // default: true
const USE_AI_QUEUE = process.env.USE_AI_QUEUE !== 'false'; // default: true
```

#### **3.2. Заменить `ragCache` на `ai-cache` (строки 78-84)**

**Было:**
```javascript
const cacheKey = `${tableId}:${userQuestion}:${product}`;
const cached = ragCache.get(cacheKey);
if (cached && (Date.now() - cached.timestamp) < RAG_CACHE_TTL) {
  return cached.result;
}
```

**Стало:**
```javascript
// Используем ai-cache с коротким TTL для RAG
const cacheKey = aiCache.generateKeyForRAG(tableId, userQuestion, product);
const cached = aiCache.getWithTTL(cacheKey, 'rag');
if (cached) {
  console.log('[RAG] Возврат из кэша');
  return cached;
}
```

#### **3.3. Заменить `ragCache.set()` (строки 182-185)**

**Было:**
```javascript
ragCache.set(cacheKey, {
  result,
  timestamp: Date.now()
});
```

**Стало:**
```javascript
// Сохраняем в ai-cache с типом 'rag'
aiCache.setWithType(cacheKey, result, 'rag');
```

#### **3.4. Заменить прямой вызов Ollama на очередь (строки 358-383)**

**Было:**
```javascript
async function generateLLMResponse({...}) {
  // ...
  try {
    const axios = require('axios');  // ❌ Внутри!
    const ollamaConfig = require('./ollamaConfig');  // ❌ Внутри!
    
    const response = await axios.post(`${ollamaUrl}/api/chat`, {...});
    llmResponse = response.data.message.content;
  } catch (error) {
    // ...
  }
}
```

**Стало:**
```javascript
async function generateLLMResponse({
  userQuestion,
  context,
  answer,
  systemPrompt,
  history,
  model,
  metadata = {}
}) {
  try {
    // Формируем сообщения для LLM
    const messages = [];
    const finalSystemPrompt = systemPrompt || 'Ты — ИИ-ассистент для бизнеса. Отвечай кратко и по делу';
    
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    
    for (const h of (history || [])) {
      if (h && h.content) {
        const role = h.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: h.content });
      }
    }
    
    // Формируем финальный промпт
    let prompt = `Вопрос пользователя: ${userQuestion}`;
    if (answer) prompt += `\n\nНайденный ответ из базы знаний: ${answer}`;
    if (context) prompt += `\n\nДополнительный контекст: ${context}`;
    
    messages.push({ role: 'user', content: prompt });

    // ✨ НОВОЕ: Определяем приоритет
    const priority = metadata.isAdmin ? 10 : metadata.isGuest ? 1 : 5;

    let llmResponse;

    // ✨ НОВОЕ: Используем очередь (если включена)
    if (USE_AI_QUEUE) {
      try {
        llmResponse = await aiQueue.addTask({
          messages,
          model,
          priority,
          metadata
        });
        
        console.log('[RAG] LLM response from queue:', llmResponse?.substring(0, 100) + '...');
        return llmResponse;
        
      } catch (queueError) {
        logger.warn('[RAG] Queue error, fallback to direct call:', queueError.message);
        
        // Fallback: если очередь перегружена и есть ответ из RAG - возвращаем его
        if (queueError.message.includes('переполнена') && answer) {
          logger.info('[RAG] Возврат прямого ответа из RAG (очередь переполнена)');
          return answer;
        }
        
        // Иначе пробуем прямой вызов (без очереди)
        // Продолжаем к прямому вызову ниже
      }
    }

    // Прямой вызов (если очередь отключена или ошибка)
    try {
      const ollamaUrl = ollamaConfig.getBaseUrl();
      const timeouts = ollamaConfig.getTimeouts();

      const response = await axios.post(`${ollamaUrl}/api/chat`, {
        model: model || ollamaConfig.getDefaultModel(),
        messages,
        stream: false
      }, {
        timeout: timeouts.ollamaChat
      });

      llmResponse = response.data.message.content;
      console.log('[RAG] LLM response (direct):', llmResponse?.substring(0, 100) + '...');
      
      return llmResponse;

    } catch (error) {
      console.error('[RAG] Error in direct Ollama call:', error.message);
      
      // Финальный fallback - возврат ответа из RAG
      if (answer) {
        logger.info('[RAG] Возврат прямого ответа из RAG (ошибка Ollama)');
        return answer;
      }
      
      return 'Извините, произошла ошибка при генерации ответа.';
    }

  } catch (error) {
    console.error('[RAG] Critical error in generateLLMResponse:', error);
    return 'Извините, произошла ошибка при генерации ответа.';
  }
}
```

---

### **ЭТАП 4: Запустить Worker в `server.js`**

**Файл:** `backend/server.js`

**Добавить после инициализации BotManager:**

```javascript
// Запускаем AI Queue Worker
const aiQueue = require('./services/ai-queue');
const aiQueueInstance = new aiQueue();
aiQueueInstance.startWorker();
logger.info('[Server] ✅ AI Queue Worker запущен');

// Graceful shutdown
process.on('SIGTERM', () => {
  aiQueueInstance.stopWorker();
  process.exit(0);
});
```

---

### **ЭТАП 5: Передать метаданные из основного потока**

#### **5.1. `ai-assistant.js` (строка ~120)**

**Добавить в вызов `generateLLMResponse`:**
```javascript
const aiResponse = await generateLLMResponse({
  userQuestion,
  context: ragResult?.context || '',
  answer: ragResult?.answer || '',
  systemPrompt: aiSettings ? aiSettings.system_prompt : '',
  history: conversationHistory,
  model: aiSettings ? aiSettings.model : undefined,
  rules: rules ? rules.rules : null,
  metadata: {  // ✨ НОВОЕ
    isAdmin: metadata?.isAdmin || false,
    isGuest: metadata?.isGuest || false,
    channel: channel
  }
});
```

#### **5.2. `UniversalGuestService.js` (строка ~350)**

**Передать metadata:**
```javascript
const aiResponse = await aiAssistant.generateResponse({
  channel: channel,
  messageId: `guest_${identifier}_${Date.now()}`,
  userId: identifier,
  userQuestion: fullMessageContent,
  conversationHistory: conversationHistory,
  metadata: { 
    isGuest: true,  // ✅ Уже есть
    priority: 1,    // ✨ НОВОЕ - низкий приоритет для гостей
    hasMedia: !!processedContent,
    mediaSummary: processedContent?.summary
  }
});
```

#### **5.3. `unifiedMessageProcessor.js` (строка ~203)**

**Передать metadata:**
```javascript
aiResponse = await aiAssistant.generateResponse({
  channel,
  messageId: userMessageId,
  userId: userId,
  userQuestion: content,
  conversationHistory,
  conversationId,
  metadata: {
    hasAttachments: attachments.length > 0,
    channel,
    isAdmin,  // ✅ Уже есть
    priority: isAdmin ? 10 : 5  // ✨ НОВОЕ - высокий приоритет для админов
  }
});
```

---

### **ЭТАП 6: Обновить мониторинг**

**Файл:** `backend/routes/monitoring.js`

**Добавить статистику:**
```javascript
// AI Cache статистика
const aiCache = require('../services/ai-cache');
const cacheStats = aiCache.getStats();
const cacheByType = aiCache.getStatsByType();

results.aiCache = {
  status: 'ok',
  size: cacheStats.size,
  maxSize: cacheStats.maxSize,
  hitRate: `${(cacheStats.hitRate * 100).toFixed(2)}%`,
  byType: cacheByType
};

// AI Queue статистика
const AIQueue = require('../services/ai-queue');
const queueStats = aiQueueInstance.getStats();

results.aiQueue = {
  status: 'ok',
  currentSize: queueStats.currentQueueSize,
  totalProcessed: queueStats.totalProcessed,
  totalFailed: queueStats.totalFailed,
  avgResponseTime: `${Math.round(queueStats.averageProcessingTime)}ms`
};
```

---

## 📋 **ЧЕКЛИСТ ИСПРАВЛЕНИЙ**

### **Доработка существующих файлов:**

- [ ] **1. `ai-cache.js`** - добавить методы:
  - [ ] `generateKeyForRAG(tableId, question, product)`
  - [ ] `getWithTTL(key, type)`
  - [ ] `setWithType(key, response, type)`
  - [ ] `invalidateByPrefix(prefix)`
  - [ ] `getStatsByType()`

- [ ] **2. `ai-queue.js`** - добавить методы:
  - [ ] `addTask(taskData)` - возвращает Promise
  - [ ] `startWorker()` - запуск обработки
  - [ ] `stopWorker()` - остановка
  - [ ] `processNextTask()` - обработка с Ollama + Cache
  - [ ] Свойство `maxQueueSize = 100`

- [ ] **3. `ragService.js`** - исправить:
  - [ ] Удалить `ragCache` и `RAG_CACHE_TTL`
  - [ ] Добавить импорты наверху: `axios`, `ollamaConfig`, `aiCache`, `aiQueue`
  - [ ] Заменить `ragCache.get()` → `aiCache.getWithTTL(key, 'rag')`
  - [ ] Заменить `ragCache.set()` → `aiCache.setWithType(key, result, 'rag')`
  - [ ] В `generateLLMResponse()`:
    - Удалить `require()` внутри функции
    - Добавить вызов `aiQueue.addTask()`
    - Оставить fallback на прямой вызов

- [ ] **4. `ai-assistant.js`** - передать metadata:
  - [ ] Добавить `metadata` в вызов `generateLLMResponse()`

- [ ] **5. `UniversalGuestService.js`** - передать priority:
  - [ ] Добавить `priority: 1` в metadata

- [ ] **6. `unifiedMessageProcessor.js`** - передать priority:
  - [ ] Добавить `priority: isAdmin ? 10 : 5` в metadata

- [ ] **7. `server.js`** - запустить worker:
  - [ ] Создать экземпляр `AIQueue`
  - [ ] Вызвать `aiQueueInstance.startWorker()`
  - [ ] Добавить graceful shutdown

- [ ] **8. `routes/monitoring.js`** - добавить статистику:
  - [ ] Статистика `aiCache`
  - [ ] Статистика `aiQueue`

---

## ⏱️ **ОЦЕНКА ВРЕМЕНИ**

| Файл | Изменения | Время |
|------|-----------|-------|
| `ai-cache.js` | +5 методов | 1-2 часа |
| `ai-queue.js` | +3 метода + worker | 2-3 часа |
| `ragService.js` | Удаление дублей, интеграция | 2-3 часа |
| Остальные | Передача metadata | 1 час |
| Тестирование | Полное | 2-3 часа |

**ИТОГО:** 8-12 часов

---

## 🚀 **ПОРЯДОК РАБОТЫ**

1. ✅ Доработать `ai-cache.js` (добавить методы)
2. ✅ Доработать `ai-queue.js` (добавить worker)
3. ✅ Рефакторить `ragService.js` (убрать дубли)
4. ✅ Интегрировать в основной поток
5. ✅ Протестировать

---

**Статус:** ✅ ВЫПОЛНЕНО

## ✅ **ВЫПОЛНЕННЫЕ ЗАДАЧИ:**

1. ✅ Доработан `ai-cache.js` (+5 методов, TTL из ollamaConfig)
2. ✅ Доработан `ai-queue.js` (+worker, FIFO без приоритетов)
3. ✅ Рефакторинг `ragService.js` (удален ragCache, интеграция Cache + Queue)
4. ✅ Обновлен `adminLogicService.js` (editor/readonly, удалены неиспользуемые методы)
5. ✅ Добавлена валидация прав (chat.js, messages.js, auth.js)
6. ✅ Удалены legacy сервисы (guestService, guestMessageService, index.js)
7. ✅ Интегрирован WebBot (botManager использует класс)
8. ✅ Централизованы все AI таймауты в ollamaConfig.js

**Всего изменено:** 13 файлов  
**Удалено:** 3 файла  
**Создано:** 0 файлов (только доработка существующих!) 


