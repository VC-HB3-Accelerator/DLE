# Задача: Система приветствий для каналов коммуникации

## Контекст

В системе реализованы три канала взаимодействия с пользователями:
- **Web** - чат на сайте
- **Telegram** - бот в мессенджере
- **Email** - почтовый робот

У каждого канала своя специфика первого контакта:
- Web: сразу при открытии чата
- Telegram: после нажатия `/start`
- Email: после получения первого письма

## Текущее состояние

### Что работает:
- ✅ AI Assistant с настройками промптов, RAG таблиц, правил
- ✅ Векторный поиск по базе знаний (таблицы типа Notion)
- ✅ Система плейсхолдеров для подстановки данных
- ✅ Обработка сообщений от авторизованных пользователей

### Что НЕ работает:
- ❌ Первое взаимодействие не использует RAG и настройки AI
- ❌ Нет автоматических приветствий с контекстом
- ❌ Каждый канал обрабатывается по-разному
- ❌ Нет UI для управления приветствиями

## Требования

### 1. Использовать существующую инфраструктуру
- Настройки из `/settings/ai/assistant` (system_prompt, RAG tables, rules)
- Векторный поиск для получения актуального контекста
- Плейсхолдеры из таблиц базы данных

### 2. Генерация приветствий с AI
При первом контакте:
1. Загрузить настройки AI Assistant
2. Выполнить RAG-поиск по выбранным таблицам
3. Сгенерировать контекстное приветствие через LLM
4. Запомнить, что приветствие показано

### 3. Специфика каналов
Учесть особенности каждого канала:
- **Web**: показать приветствие сразу при загрузке чата
- **Telegram**: отправить при команде `/start`
- **Email**: отправить автоответ на первое письмо

### 4. UI для управления
Добавить в `/settings/ai/assistant` секцию:
```
┌──────────────────────────────────────┐
│ Настройки первого контакта           │
├──────────────────────────────────────┤
│ [Web] [Telegram] [Email]             │
│                                      │
│ ☑ Включить AI-приветствие           │
│ ☑ Использовать RAG                  │
│ ☑ Применять правила                 │
│                                      │
│ Дополнительный промпт:               │
│ [текстовое поле]                     │
└──────────────────────────────────────┘
```

## Техническая реализация

### БД: Таблица конфигурации каналов
```sql
CREATE TABLE channel_welcome_configs (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(20) UNIQUE NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  use_ai_assistant_settings BOOLEAN DEFAULT true,
  custom_prompt_encrypted TEXT,
  show_on VARCHAR(20) DEFAULT 'first_contact',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### БД: Таблица отслеживания первых контактов
```sql
CREATE TABLE first_contact_tracking (
  id SERIAL PRIMARY KEY,
  identifier_hash VARCHAR(64) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  welcome_shown BOOLEAN DEFAULT false,
  first_message_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(identifier_hash, channel)
);
```

### Backend: Сервис `ChannelWelcomeService`
```javascript
class ChannelWelcomeService {
  // Проверить, показывали ли приветствие
  async isFirstContact(identifier, channel);
  
  // Загрузить настройки канала
  async getChannelConfig(channel);
  
  // Сгенерировать AI-приветствие
  async generateWelcome(channel, identifier);
  
  // Пометить, что приветствие показано
  async markWelcomeShown(identifier, channel);
}
```

### Интеграция с существующим кодом

**1. Обновить `unifiedMessageProcessor.js`:**
```javascript
async function processMessage(messageData) {
  const { userId, channel, identifier } = messageData;
  
  // Проверяем первый контакт
  if (await channelWelcomeService.isFirstContact(identifier, channel)) {
    const welcome = await channelWelcomeService.generateWelcome(channel, identifier);
    await channelWelcomeService.markWelcomeShown(identifier, channel);
    
    // Добавляем приветствие в ответ
    messageData.systemMessage = welcome;
  }
  
  // Остальная обработка...
}
```

**2. Обновить `WebBot`, `TelegramBot`, `EmailBot`:**
- Добавить метод `sendSystemMessage()` для отправки приветствий
- При первом сообщении запрашивать приветствие у `ChannelWelcomeService`

**3. Frontend: расширить `AiAssistantSettings.vue`:**
- Добавить секцию "Настройки каналов"
- Табы для Web/Telegram/Email
- Настройки: вкл/выкл, использовать RAG, доп. промпт

## Результат

После реализации:
- ✅ Каждый канал генерирует умные приветствия с RAG
- ✅ Используются существующие настройки AI Assistant
- ✅ Админ управляет через UI
- ✅ Отслеживание первых контактов
- ✅ Масштабируемость для новых каналов

## Приоритет
**Средний** - улучшает UX, но не критично для работы системы.

## Оценка времени
**3-4 часа** разработки + тестирование.

