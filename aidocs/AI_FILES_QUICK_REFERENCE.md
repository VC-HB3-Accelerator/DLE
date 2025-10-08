# AI Ассистент - Быстрый справочник файлов

**Всего: 47 файлов**  
**Дата:** 2025-10-08

---

## ⭐ КРИТИЧЕСКИ ВАЖНЫЕ (9) - без них AI не работает

| № | Файл | Путь | Что делает |
|---|------|------|------------|
| 1 | ai-assistant.js | services/ | Главный интерфейс AI |
| 2 | ollamaConfig.js | services/ | Настройки Ollama |
| 3 | ragService.js | services/ | RAG генерация |
| 4 | unifiedMessageProcessor.js | services/ | Обработка всех сообщений |
| 5 | botManager.js | services/ | Координатор ботов |
| 6 | wsHub.js | . | WebSocket уведомления |
| 7 | logger.js | utils/ | Логирование |
| 8 | encryptionUtils.js | utils/ | Шифрование |
| 9 | encryptedDatabaseService.js | services/ | Работа с БД |

---

## ✅ АКТИВНО ИСПОЛЬЗУЕМЫЕ (27)

### Настройки AI (3)
- aiAssistantSettingsService.js
- aiAssistantRulesService.js
- aiProviderSettingsService.js

### Боты (3)
- webBot.js
- telegramBot.js
- emailBot.js

### Обработка данных (8)
- conversationService.js
- messageDeduplicationService.js
- guestService.js
- guestMessageService.js
- identity-service.js
- botsSettings.js
- vectorSearchClient.js
- userDeleteService.js

### Аутентификация (3)
- admin-role.js
- auth-service.js
- session-service.js

### Routes - Основные (3)
- routes/chat.js ⭐
- routes/settings.js ⭐
- routes/messages.js

### Routes - Специализированные (7)
- routes/ollama.js
- routes/rag.js
- routes/monitoring.js
- routes/auth.js
- routes/identities.js
- routes/tables.js
- routes/uploads.js
- routes/system.js

### Utils (2)
- utils/constants.js (AI_USER_TYPES, AI_SENDER_TYPES)
- utils/userUtils.js (isUserBlocked)

---

## ⚠️ ЧАСТИЧНО ИСПОЛЬЗУЕМЫЕ (5)

| Файл | Где используется | Примечание |
|------|------------------|------------|
| ai-cache.js | routes/monitoring | Только метод clear() |
| ai-queue.js | routes/ai-queue | Отдельный API |
| routes/ai-queue.js | app.js | Отдельный API очереди |
| testNewBots.js | - | Только для тестов |
| notifyOllamaReady.js | Ollama контейнер | Отдельный скрипт |

---

## ❌ МЕРТВЫЙ КОД (2)

| Файл | Проблема | Рекомендация |
|------|----------|--------------|
| adminLogicService.js | НЕ импортируется нигде | Удалить или интегрировать |
| services/index.js | Ссылка на несуществующий vectorStore.js | Обновить код |

---

## 🔍 БЫСТРЫЙ ПОИСК

### По функциональности:

**Хочу настроить модель?**
→ `ollamaConfig.js` + `routes/settings.js`

**Хочу изменить промпт?**
→ `aiAssistantSettingsService.js` + `routes/settings.js`

**Хочу изменить правила AI?**
→ `aiAssistantRulesService.js` + `routes/settings.js`

**Проблемы с генерацией ответов?**
→ `ai-assistant.js` → `ragService.js`

**Боты не работают?**
→ `botManager.js` → конкретный бот (webBot/telegramBot/emailBot)

**Сообщения дублируются?**
→ `messageDeduplicationService.js`

**Проблемы с векторным поиском?**
→ `vectorSearchClient.js`

**Логи не показываются?**
→ `logger.js` (уровень логирования)

**Health check падает?**
→ `ollamaConfig.checkHealth()` → проверить Ollama

---

## 🔄 ПОТОК ОБРАБОТКИ СООБЩЕНИЯ

```
1. routes/chat.js (/message endpoint)
   ↓
2. botManager.getBot('web')
   ↓
3. webBot.handleMessage()
   ↓
4. botManager.processMessage()
   ↓
5. unifiedMessageProcessor.processMessage()
   ├─ identity-service (аутентификация)
   ├─ userUtils.isUserBlocked (проверка блокировки)
   ├─ messageDeduplicationService (дедупликация)
   ├─ conversationService (беседа)
   └─ ai-assistant.generateResponse()
      ├─ aiAssistantSettingsService (настройки)
      ├─ aiAssistantRulesService (правила)
      └─ ragService.ragAnswer()
         ├─ vectorSearchClient (поиск)
         └─ ollamaConfig (Ollama API)
   ↓
6. wsHub.broadcastChatMessage() (уведомление)
```

---

## 📝 ПРИМЕЧАНИЯ

### Что нужно знать:

1. **Все настройки хранятся в БД** (не в .env)
2. **Дублирования кода нет** - все централизовано
3. **AI работает для 3 каналов:** web, telegram, email
4. **Два неиспользуемых сервиса:** ai-cache и ai-queue (потенциал для оптимизации)
5. **Один мертвый файл:** adminLogicService.js (никогда не импортируется)

### Таблицы БД для AI:

- `ai_providers_settings` - настройки провайдеров
- `ai_assistant_settings` - настройки ассистента
- `ai_assistant_rules` - правила
- `messages` - сообщения
- `conversations` - беседы
- `message_deduplication` - дедупликация
- `guest_messages` - гостевые сообщения
- `user_tables/columns/rows/cell_values` - RAG база знаний

---

**Проверено:** ВСЕ 47 файлов  
**Автор:** Digital Legal Entity Project

