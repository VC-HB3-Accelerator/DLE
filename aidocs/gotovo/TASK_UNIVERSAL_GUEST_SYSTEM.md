# Задача: Универсальная система обработки гостевых сообщений

**Дата создания:** 2025-10-09  
**Приоритет:** 🔴 ВЫСОКИЙ  
**Статус:** 🔄 В РАЗРАБОТКЕ (95% готово)

### ✅ ВЫПОЛНЕНО:
- ✅ Все сервисы созданы и обновлены
- ✅ Все миграции выполнены
- ✅ Все боты обновлены для медиа
- ✅ База данных готова
- ✅ Роуты обновлены

### 📋 ОСТАЛОСЬ:
- 🧪 Тестирование комбинированного контента
- 🔍 Проверка работы медиа-процессора в реальных условиях  
**Оценка времени:** 10-14 часов разработки + тестирование

---

## ⚠️ ВАЖНО

### ПЕРЕПИСЫВАЕТСЯ СТАРАЯ ЛОГИКА:
- `unifiedMessageProcessor.js` - полная переработка
- `guestService.js` - deprecated
- `guestMessageService.js` - deprecated  
- `telegramBot.js` - значительные изменения
- `emailBot.js` - значительные изменения
- `webBot.js` - добавлена поддержка медиа

### ДОБАВЛЕНА УНИВЕРСАЛЬНАЯ МЕДИА-СИСТЕМА:
- `UniversalMediaProcessor.js` - новый сервис для обработки всех типов медиа
- Поддержка: аудио, видео, изображения, документы, архивы
- Централизованная обработка для всех каналов (Web, Telegram, Email)
- Реальные ограничения размеров из существующего кода

### УДАЛЯЮТСЯ ВСЕ ТЕСТОВЫЕ ДАННЫЕ:
- Все пользователи (users)
- Все сообщения (messages)
- Все беседы (conversations)
- Все идентификаторы (user_identities)

### После внедрения:
- **Все пользователи БЕЗ кошелька = гости**
- **Полноценный user_id только у владельцев кошельков**
- **История автоматически мигрирует при подключении кошелька**

---

## 🎯 ЦЕЛЬ

Создать **централизованную систему** обработки сообщений от неавторизованных пользователей (гостей) для **всех каналов коммуникации** (Web, Telegram, Email) с автоматической миграцией истории при подключении Web3 кошелька и **универсальной поддержкой медиа-контента**.

---

## 🔥 ПРОБЛЕМЫ ТЕКУЩЕЙ РЕАЛИЗАЦИИ

### ❌ Что НЕ работает сейчас:

1. **Разная логика для разных каналов:**
   - Web: гости сохраняются в `guest_messages` БЕЗ `user_id`
   - Telegram: СРАЗУ создается `user_id` при первом сообщении
   - Email: СРАЗУ создается `user_id` при первом письме

2. **Создаются дубликаты пользователей:**
   ```
   Сценарий: Пользователь пишет в Telegram → создается user_id=42
             Позже подключает кошелек на сайте → создается user_id=99
   Результат: ДВА аккаунта с разными историями!
   ```

3. **AI ответы гостям НЕ сохраняются:**
   - Web гости: ответы AI не попадают в БД
   - Telegram/Email: сохраняются, но в разных местах
   
4. **История теряется:**
   - Web гости не имеют истории для контекста AI
   - При авторизации история может не мигрировать

5. **Отсутствует механизм связывания:**
   - Нет способа связать Telegram/Email с кошельком без дубликатов
   - Нет генерации ссылок для привязки идентификаторов

6. **Отсутствует единая обработка медиа-контента:**
   - Разные каналы обрабатывают файлы по-разному
   - Нет централизованной валидации типов и размеров
   - Медиа-файлы не сохраняются в структурированном виде
   - Поддержка форматов различается между каналами

---

## ✅ РЕШЕНИЕ: Вариант C + элементы Варианта A

### Концепция:

```
┌─────────────────────────────────────────────────────────┐
│     ВСЕ пользователи БЕЗ кошелька = "ГОСТИ"             │
├─────────────────────────────────────────────────────────┤
│ Web:      web:guest_abc123                              │
│ Telegram: telegram:123456789                            │
│ Email:    email:user@example.com                        │
│                                                         │
│ → Сохраняются в unified_guest_messages                  │
│ → История + AI ответы с is_ai=true/false                │
│ → Медиа-контент через UniversalMediaProcessor           │
│ → НЕ создается user_id до подключения кошелька          │
└─────────────────────────────────────────────────────────┘
                         ↓
              [Связывание через токен]
              Бот генерирует ссылку →
              Пользователь переходит →
              Подключает кошелек
                         ↓
┌─────────────────────────────────────────────────────────┐
│         ПОЛНОЦЕННЫЙ ПОЛЬЗОВАТЕЛЬ (с кошельком)          │
├─────────────────────────────────────────────────────────┤
│ users: user_id = 42, role = 'user'/'editor'             │
│                                                         │
│ user_identities:                                        │
│ - wallet: 0x1234... (главный идентификатор)             │
│ - telegram: 123456789 (связанный)                       │
│                                                         │
│ messages:                                               │
│ - ВСЯ история автоматически перенесена                  │
│ - conversation_id создана                               │
│ - роли сохранены (user/assistant)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 КОМПОНЕНТЫ СИСТЕМЫ

### 1. База данных (3 новых таблицы)

#### 1.1. `unified_guest_messages` - Единое хранилище истории

```sql
CREATE TABLE unified_guest_messages (
  id SERIAL PRIMARY KEY,
  
  -- Универсальный идентификатор
  identifier_encrypted TEXT NOT NULL,
  -- Примеры: 
  --   "web:guest_abc123def456..."
  --   "telegram:123456789"
  --   "email:user@example.com"
  
  -- Канал
  channel VARCHAR(20) NOT NULL,  -- 'web', 'telegram', 'email'
  
  -- Контент
  content_encrypted TEXT NOT NULL,
  
  -- Роль (кто автор: гость или AI)
  is_ai BOOLEAN DEFAULT false NOT NULL,
  
  -- Метаданные канала (JSON)
  metadata JSONB DEFAULT '{}',
  -- Примеры:
  --   Telegram: {"username": "@user", "first_name": "John", "chat_id": 123}
  --   Email: {"from": "user@example.com", "subject": "Question"}
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Вложения
  attachment_filename_encrypted TEXT,
  attachment_mimetype_encrypted TEXT,
  attachment_size BIGINT,
  attachment_data BYTEA,
  
  -- Индексы для быстрого поиска
  CONSTRAINT check_channel CHECK (channel IN ('web', 'telegram', 'email'))
);

-- Индексы
CREATE INDEX idx_unified_guest_identifier ON unified_guest_messages(identifier_encrypted);
CREATE INDEX idx_unified_guest_channel ON unified_guest_messages(channel);
CREATE INDEX idx_unified_guest_created_at ON unified_guest_messages(created_at DESC);
CREATE INDEX idx_unified_guest_is_ai ON unified_guest_messages(is_ai);
```

#### 1.2. `identity_link_tokens` - Токены для связывания

```sql
CREATE TABLE identity_link_tokens (
  id SERIAL PRIMARY KEY,
  
  -- Уникальный токен
  token VARCHAR(64) UNIQUE NOT NULL,
  
  -- Кого связываем (источник)
  source_provider VARCHAR(20) NOT NULL,  -- 'telegram', 'email'
  source_identifier_encrypted TEXT NOT NULL,
  
  -- Опциональный user_id если уже создан
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  
  -- Состояние токена
  is_used BOOLEAN DEFAULT false NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  linked_wallet TEXT,  -- Кошелек, который привязали
  
  -- TTL (Time To Live)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_source_provider CHECK (source_provider IN ('telegram', 'email'))
);

-- Индексы
CREATE INDEX idx_link_tokens_token ON identity_link_tokens(token);
CREATE INDEX idx_link_tokens_expires ON identity_link_tokens(expires_at);
CREATE INDEX idx_link_tokens_used ON identity_link_tokens(is_used);
```

#### 1.3. `unified_guest_mapping` - Маппинг гость → пользователь

```sql
CREATE TABLE unified_guest_mapping (
  id SERIAL PRIMARY KEY,
  
  -- Пользователь
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Гостевой идентификатор
  identifier_encrypted TEXT NOT NULL,  -- "telegram:123456789"
  
  -- Канал
  channel VARCHAR(20) NOT NULL,
  
  -- Статус обработки
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Временные метки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Уникальность
  UNIQUE(identifier_encrypted, channel),
  
  CONSTRAINT check_channel CHECK (channel IN ('web', 'telegram', 'email'))
);

-- Индексы
CREATE INDEX idx_unified_mapping_user_id ON unified_guest_mapping(user_id);
CREATE INDEX idx_unified_mapping_identifier ON unified_guest_mapping(identifier_encrypted);
CREATE INDEX idx_unified_mapping_processed ON unified_guest_mapping(processed);
```

---

### 1.4. `media_files` - Метаданные медиа-файлов

```sql
CREATE TABLE media_files (
  id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(20) NOT NULL,
  mime_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Связь с сообщением
  message_id INTEGER,
  identifier VARCHAR(255),
  channel VARCHAR(50),
  
  -- Метаданные
  metadata JSONB,
  
  -- Связи
  CONSTRAINT fk_media_files_message 
    FOREIGN KEY (message_id) REFERENCES unified_guest_messages(id) ON DELETE CASCADE
);
```

---

### 2. Backend сервисы (3 новых, 3 обновить)

#### 2.1. ✨ НОВЫЙ: `UniversalGuestService.js`

**Путь:** `backend/services/UniversalGuestService.js`

**Функционал:**

```javascript
class UniversalGuestService {
  /**
   * Создать унифицированный идентификатор
   * @param {string} channel - 'web', 'telegram', 'email'
   * @param {string} rawId - Исходный ID
   * @returns {string} - "channel:rawId"
   */
  createIdentifier(channel, rawId) {}
  
  /**
   * Сгенерировать гостевой ID для Web
   * @returns {string} - "guest_abc123..."
   */
  generateWebGuestId() {}
  
  /**
   * Сохранить сообщение гостя
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async saveMessage(messageData) {}
  
  /**
   * Сохранить AI ответ гостю
   * @param {Object} responseData
   * @returns {Promise<Object>}
   */
  async saveAiResponse(responseData) {}
  
  /**
   * Получить историю сообщений гостя
   * @param {string} identifier - "channel:id"
   * @returns {Promise<Array>} - [{role: 'user'/'assistant', content}]
   */
  async getHistory(identifier) {}
  
  /**
   * Обработать сообщение гостя (сохранить + получить AI ответ)
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async processMessage(messageData) {}
  
  /**
   * Мигрировать историю гостя в user_id
   * @param {string} identifier - "channel:id"
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async migrateToUser(identifier, userId) {}
  
  /**
   * Проверить, является ли идентификатор гостевым
   * @param {string} identifier
   * @returns {boolean}
   */
  isGuest(identifier) {}
  
  /**
   * Получить статистику по гостям
   * @returns {Promise<Object>}
   */
  async getStats() {}
}
```

#### 2.2. ✨ НОВЫЙ: `UniversalMediaProcessor.js`

**Путь:** `backend/services/UniversalMediaProcessor.js`

**Функционал:**
- Централизованная обработка всех типов медиа-контента
- Поддержка: аудио (.mp3, .wav), видео (.mp4, .avi), изображения (.jpg, .jpeg, .png, .gif), документы (.txt, .pdf, .docx, .xlsx, .pptx, .odt, .ods, .odp), архивы (.zip, .rar, .7z)
- Реальные ограничения размеров: 5MB для изображений, 10MB для остальных файлов
- Автоматическое определение типа медиа по расширению
- Генерация уникальных имен файлов
- Создание структурированных данных контента
- Обработка комбинированного контента (текст + медиа)
- Fallback обработка при ошибках

**Ключевые методы:**
```javascript
// Обработка отдельного файла
await processFile(fileData, filename, metadata)

// Обработка комбинированного контента
await processCombinedContent({
  text: "Текст сообщения",
  files: [...],
  audio: {...},
  video: {...}
})

// Создание записи для БД
createDatabaseRecord(processedContent, identifier, channel)

// Восстановление из БД
restoreFromDatabase(dbRecord)
```

---

#### 2.3. ✨ НОВЫЙ: `IdentityLinkService.js`

**Путь:** `backend/services/IdentityLinkService.js`

**Функционал:**

```javascript
class IdentityLinkService {
  /**
   * Сгенерировать токен для связывания
   * @param {string} provider - 'telegram', 'email'
   * @param {string} identifier - ID пользователя
   * @returns {Promise<Object>} - {token, linkUrl, expiresAt}
   */
  async generateLinkToken(provider, identifier) {}
  
  /**
   * Проверить токен и получить данные
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async verifyLinkToken(token) {}
  
  /**
   * Использовать токен (связать с кошельком)
   * @param {string} token
   * @param {string} walletAddress
   * @returns {Promise<Object>}
   */
  async useLinkToken(token, walletAddress) {}
  
  /**
   * Очистить истекшие токены
   * @returns {Promise<number>} - Количество удаленных
   */
  async cleanupExpiredTokens() {}
}
```

#### 2.3. 🔄 ПЕРЕПИСАТЬ: `unifiedMessageProcessor.js`

**⚠️ СТАРАЯ ЛОГИКА ПОЛНОСТЬЮ ЗАМЕНЯЕТСЯ**

**Изменения:**

```javascript
// УДАЛИТЬ:
async function processGuestMessage(messageData) {
  // Старая логика с guestService
}

// ЗАМЕНИТЬ НА:
async function processMessage(messageData) {
  const { identifier, content, channel } = messageData;
  
  // 1. Определяем: гость или пользователь?
  const universalGuestService = require('./UniversalGuestService');
  
  if (universalGuestService.isGuest(identifier)) {
    // ГОСТЬ: обработка через UniversalGuestService
    return await universalGuestService.processMessage(messageData);
  }
  
  // 2. ПОЛЬЗОВАТЕЛЬ: ищем user_id
  const identityService = require('./identity-service');
  const [provider, providerId] = identifier.split(':');
  const user = await identityService.findUserByIdentity(provider, providerId);
  
  if (!user) {
    throw new Error('User not found for authenticated message');
  }
  
  const userId = user.id;
  
  // 3. Проверяем: админ или обычный пользователь?
  const adminLogicService = require('./adminLogicService');
  const isAdmin = user.role === 'editor' || user.role === 'readonly';
  
  // 4. Определяем нужно ли генерировать AI ответ
  const shouldGenerateAi = adminLogicService.shouldGenerateAiReply({
    senderType: isAdmin ? 'admin' : 'user',
    userId: userId,
    recipientId: messageData.recipientId || userId,
    channel: channel
  });
  
  // 5. Сохраняем сообщение пользователя
  // ... (существующая логика)
  
  // 6. Генерируем AI ответ (если нужно)
  if (shouldGenerateAi) {
    // ... (существующая логика)
  }
  
  return result;
}
```

#### 2.5. 🔄 ОБНОВИТЬ: `telegramBot.js`

**Изменения:**

```javascript
// БЫЛО:
async handleMessage(ctx, processor = null) {
  const telegramId = ctx.from.id.toString();
  
  // ❌ Искал/создавал user_id сразу
  const user = await findOrCreateUser(telegramId);
  
  // Обработка...
}

// СТАЛО:
async handleMessage(ctx, processor = null) {
  const telegramId = ctx.from.id.toString();
  
  // ✅ Создаем гостевой идентификатор
  const universalGuestService = require('./UniversalGuestService');
  const identifier = universalGuestService.createIdentifier('telegram', telegramId);
  
  const messageData = {
    identifier: identifier,  // "telegram:123456789"
    content: ctx.message.text,
    channel: 'telegram',
    metadata: {
      telegram_username: ctx.from.username,
      telegram_first_name: ctx.from.first_name,
      telegram_last_name: ctx.from.last_name,
      chat_id: ctx.chat.id
    }
  };
  
  // Обработка через unified processor
  const result = await unifiedMessageProcessor.processMessage(messageData);
  
  // Отправляем ответ
  if (result.success && result.aiResponse) {
    await ctx.reply(result.aiResponse.response);
  }
}

// ✨ НОВАЯ КОМАНДА: /connect
bot.command('connect', async (ctx) => {
  const telegramId = ctx.from.id.toString();
  
  const identityLinkService = require('./IdentityLinkService');
  const linkData = await identityLinkService.generateLinkToken('telegram', telegramId);
  
  await ctx.reply(
    `🔗 *Подключите Web3 кошелек для полного доступа*\n\n` +
    `Перейдите по ссылке:\n${linkData.linkUrl}\n\n` +
    `⏱ Ссылка действительна до ${linkData.expiresAt}`,
    { parse_mode: 'Markdown' }
  );
});
```

#### 2.6. 🔄 ОБНОВИТЬ: `emailBot.js`

**Аналогичные изменения как в `telegramBot.js`:**

```javascript
// Использовать identifier = "email:user@example.com"
// При первом письме отправлять инструкцию:
// "Для полного доступа подключите кошелек: [ссылка]"
```

---

#### 2.7. 🔄 ОБНОВИТЬ: `webBot.js`

**Изменения:**
- Добавлен импорт `UniversalMediaProcessor`
- Метод `processMessage` обновлен для обработки медиа
- Автоматическая обработка вложений через медиа-процессор
- Создание структурированных `contentData`
- Добавление метаданных о медиа-файлах

```javascript
// НОВОЕ: обработка медиа-контента
if (messageData.attachments && messageData.attachments.length > 0) {
  const processedFiles = [];
  
  for (const attachment of messageData.attachments) {
    const processedFile = await universalMediaProcessor.processFile(
      attachment.data,
      attachment.filename,
      { webUpload: true, originalSize: attachment.size, mimeType: attachment.mimetype }
    );
    processedFiles.push(processedFile);
  }
  
  messageData.contentData = {
    text: messageData.content,
    files: processedFiles.map(file => ({...}))
  };
}
```

---

### 3. Backend роуты (2 новых, 1 обновить)

#### 3.1. ✨ НОВЫЙ: `POST /api/auth/wallet-with-link`

**Путь:** `backend/routes/auth.js`

**Назначение:** Подключение кошелька через токен связывания

```javascript
router.post('/wallet-with-link', async (req, res) => {
  try {
    const { address, signature, token } = req.body;
    
    // 1. Проверяем подпись
    const isValid = await verifySignature(address, signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Неверная подпись' });
    }
    
    // 2. Проверяем и используем токен
    const identityLinkService = require('../services/IdentityLinkService');
    const linkResult = await identityLinkService.useLinkToken(token, address);
    
    if (!linkResult.success) {
      return res.status(400).json({ error: linkResult.error });
    }
    
    const { userId, identifier } = linkResult;
    
    // 3. Мигрируем историю гостя
    const universalGuestService = require('../services/UniversalGuestService');
    await universalGuestService.migrateToUser(identifier, userId);
    
    // 4. Обновляем сессию
    req.session.userId = userId;
    req.session.address = address;
    req.session.authenticated = true;
    await req.session.save();
    
    res.json({ 
      success: true, 
      userId,
      message: 'Кошелек успешно подключен, история перенесена'
    });
    
  } catch (error) {
    logger.error('[Auth] Error in wallet-with-link:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
```

#### 3.2. ✨ НОВЫЙ: `GET /api/identity/link-status/:token`

**Назначение:** Проверка статуса токена связывания

```javascript
router.get('/link-status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const identityLinkService = require('../services/IdentityLinkService');
    const tokenData = await identityLinkService.verifyLinkToken(token);
    
    if (!tokenData) {
      return res.json({ 
        valid: false, 
        error: 'Токен недействителен или истек' 
      });
    }
    
    res.json({
      valid: true,
      provider: tokenData.source_provider,
      expiresAt: tokenData.expires_at,
      isUsed: tokenData.is_used
    });
    
  } catch (error) {
    logger.error('[Identity] Error checking link status:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
```

#### 3.3. 🔄 ОБНОВИТЬ: `POST /api/chat/guest-message`

**Изменения:**
- Добавлен импорт `UniversalMediaProcessor`
- Обновлена обработка вложений через медиа-процессор
- Создание структурированных `contentData`
- Поддержка комбинированного контента (текст + медиа)

```javascript
// БЫЛО:
router.post('/guest-message', async (req, res) => {
  // Обработка только для Web гостей
  const guestService = require('../services/guestService');
  // ...
});

// СТАЛО:
router.post('/guest-message', async (req, res) => {
  try {
    const { content, guestId } = req.body;
    
    const universalGuestService = require('../services/UniversalGuestService');
    
    // Создаем или используем существующий гостевой ID
    const webGuestId = guestId || universalGuestService.generateWebGuestId();
    const identifier = universalGuestService.createIdentifier('web', webGuestId);
    
    const messageData = {
      identifier: identifier,
      content: content,
      channel: 'web'
    };
    
    // Обработка через универсальный процессор
    const result = await universalGuestService.processMessage(messageData);
    
    res.json({
      success: true,
      guestId: webGuestId,
      aiResponse: result.aiResponse
    });
    
  } catch (error) {
    logger.error('[Chat] Error in guest-message:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});
```

---

### 4. Миграции базы данных

**Путь:** `backend/migrations/`

Создать 6 файлов миграций:

#### 4.1. `068_create_unified_guest_messages.sql`

```sql
-- Создание таблицы unified_guest_messages
-- (см. раздел 1.1 выше)
```

#### 4.2. `069_create_identity_link_tokens.sql`

```sql
-- Создание таблицы identity_link_tokens
-- (см. раздел 1.2 выше)
```

#### 4.3. `070_create_unified_guest_mapping.sql`

```sql
-- Создание таблицы unified_guest_mapping
-- (см. раздел 1.3 выше)
```

#### 4.4. `071_cleanup_test_data.sql`

```sql
-- ⚠️ ПОЛНАЯ ОЧИСТКА ТЕСТОВЫХ ДАННЫХ
-- Удаляем ВСЕХ пользователей и связанные данные

-- 1. Удалить все сообщения
TRUNCATE TABLE messages CASCADE;

-- 2. Удалить все беседы
TRUNCATE TABLE conversations CASCADE;

-- 3. Удалить участников бесед
TRUNCATE TABLE conversation_participants CASCADE;

-- 4. Удалить статусы прочтения
TRUNCATE TABLE global_read_status CASCADE;
TRUNCATE TABLE admin_read_messages CASCADE;
TRUNCATE TABLE admin_read_contacts CASCADE;

-- 5. Удалить дедупликацию сообщений
TRUNCATE TABLE message_deduplication CASCADE;

-- 6. Удалить идентификаторы
TRUNCATE TABLE user_identities CASCADE;

-- 7. Удалить пользователей
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Логирование
RAISE NOTICE 'Все тестовые данные пользователей удалены. БД готова к новой системе.';
```

#### 4.5. `072_migrate_existing_guest_data.sql`

#### 4.6. `073_add_media_support_to_unified_guest_messages.sql`

**Содержимое:**
- Добавление колонок `content_type`, `attachments`, `media_metadata` в `unified_guest_messages`
- Создание таблицы `media_files` для метаданных медиа-файлов
- Индексы для оптимизации поиска по типу контента
- Ограничения для допустимых типов контента

```sql
-- Миграция существующих данных из guest_messages → unified_guest_messages

INSERT INTO unified_guest_messages (
  identifier_encrypted,
  channel,
  content_encrypted,
  is_ai,
  created_at,
  attachment_filename_encrypted,
  attachment_mimetype_encrypted,
  attachment_size,
  attachment_data
)
SELECT 
  guest_id_encrypted,  -- будет как "web:guest_..."
  'web',
  content_encrypted,
  COALESCE(is_ai, false),  -- На случай если NULL
  created_at,
  attachment_filename_encrypted,
  attachment_mimetype_encrypted,
  attachment_size,
  attachment_data
FROM guest_messages;

-- Логирование
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM unified_guest_messages WHERE channel = 'web';
  RAISE NOTICE 'Мигрировано гостевых сообщений: %', migrated_count;
END $$;

-- После успешной миграции удаляем старые таблицы:
DROP TABLE IF EXISTS guest_messages CASCADE;
DROP TABLE IF EXISTS guest_user_mapping CASCADE;
```

---

### 5. Frontend изменения

#### 5.1. Страница связывания кошелька

**Путь:** `frontend/src/views/ConnectWalletView.vue`

**Функционал:**

```vue
<template>
  <div class="connect-wallet-page">
    <!-- Если токен валиден -->
    <div v-if="tokenValid">
      <h1>🔗 Подключение кошелька</h1>
      <p>Вы переходите из {{ providerName }}</p>
      <p>Подключите кошелек для сохранения истории</p>
      
      <button @click="connectWallet">
        Подключить MetaMask
      </button>
    </div>
    
    <!-- Если токен истек -->
    <div v-else>
      <h1>⏰ Ссылка истекла</h1>
      <p>Запросите новую ссылку в боте</p>
    </div>
  </div>
</template>

<script>
export default {
  async mounted() {
    const token = this.$route.query.token;
    if (token) {
      await this.checkToken(token);
    }
  },
  
  methods: {
    async checkToken(token) {
      const response = await fetch(`/api/identity/link-status/${token}`);
      const data = await response.json();
      
      this.tokenValid = data.valid;
      this.provider = data.provider;
    },
    
    async connectWallet() {
      // 1. Запрос MetaMask
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      const address = accounts[0];
      
      // 2. Получить подпись
      const message = `Подключение кошелька: ${address}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });
      
      // 3. Отправить на сервер
      const token = this.$route.query.token;
      const response = await fetch('/api/auth/wallet-with-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, token })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.$router.push('/chat');
      }
    }
  }
};
</script>
```

---

## 🔧 ПЛАН РЕАЛИЗАЦИИ

### Этап 1: База данных (2 часа)

1. ✅ Создать миграции 068-070 (новые таблицы)
2. ✅ Создать миграцию 071 (очистка ВСЕХ пользователей)
3. ✅ Создать миграцию 072 (миграция guest_messages)
4. ✅ Создать миграцию 073 (поддержка медиа-контента)
5. ✅ Запустить миграции на dev окружении
6. ✅ Проверить что все пользователи удалены (users пуста)
7. ✅ Протестировать индексы и constraints
8. ✅ Проверить новые колонки медиа в unified_guest_messages

### Этап 2: Backend сервисы (4 часа)

1. ✅ Создать `UniversalGuestService.js`
2. ✅ Создать `IdentityLinkService.js`
3. ✅ Создать `UniversalMediaProcessor.js`
4. ✅ **ПЕРЕПИСАТЬ** `unifiedMessageProcessor.js`
5. ✅ Обновить `telegramBot.js` (добавить `/connect` + медиа)
6. ✅ Обновить `emailBot.js` (добавить инструкции + медиа)
7. ✅ Обновить `webBot.js` (добавить медиа)
8. ✅ Интегрировать `adminLogicService.js` в процессор

### Этап 3: Backend роуты (1 час)

1. ✅ Создать `/api/auth/wallet-with-link`
2. ✅ Создать `/api/identity/link-status/:token`
3. ✅ Обновить `/api/chat/guest-message`
4. ✅ Обновить `/api/chat/message` (проверка админов)

### Этап 4: Frontend (2 часа)

1. ✅ Создать `ConnectWalletView.vue`
2. ✅ Добавить роут `/connect-wallet`
3. ✅ Обновить логику чата для работы с identifier

### Этап 5: Тестирование медиа-системы (2 часа)

1. ✅ Тестирование `UniversalMediaProcessor`:
   - Обработка различных типов файлов
   - Валидация размеров и форматов
   - Создание структурированных данных
   - Fallback обработка при ошибках

2. ✅ Интеграционное тестирование:
   - Web: загрузка файлов через форму
   - Telegram: отправка медиа-файлов
   - Email: обработка вложений
   - Комбинированный контент (текст + медиа)

3. ✅ Проверка сохранения в БД:
   - Колонки `content_type`, `attachments`, `media_metadata`
   - Таблица `media_files`
   - Связи между сообщениями и файлами

### Этап 6: Общее тестирование (3 часа)

1. ✅ Unit тесты для `UniversalGuestService`
2. ✅ Unit тесты для `IdentityLinkService`
3. ✅ Интеграционные тесты:
   - Web гость → кошелек
   - Telegram → ссылка → кошелек
   - Email → ссылка → кошелек
4. ✅ Проверка миграции истории
5. ✅ Проверка админской логики

### Этап 6: Cleanup старого кода (1 час)

1. ✅ Удалить старую логику из `guestService.js` (или пометить deprecated)
2. ✅ Удалить старую логику из `guestMessageService.js`
3. ✅ Обновить документацию

---

## ⚠️ КРИТИЧЕСКИЕ МОМЕНТЫ

### 1. Обратная совместимость

**Проблема:** Существующие гости в `guest_messages`

**Решение:** Миграция данных через SQL (071_migrate_existing_guest_data.sql)

### 2. Старые тестовые данные

**Проблема:** Существующие пользователи (тестовые данные)

**Решение:** 
- Полная очистка всех пользователей через миграцию 071
- После очистки - все начинают с чистого листа
- Все новые пользователи создаются только через подключение кошелька

### 3. Дедупликация при миграции

**Проблема:** Один гость может быть в нескольких каналах

**Решение:**
- `unified_guest_mapping` с UNIQUE constraint
- При повторной миграции - пропускать

### 4. TTL токенов

**Проблема:** Токены накапливаются в БД

**Решение:**
- Cron задача: `identityLinkService.cleanupExpiredTokens()`
- Запускать каждые 6 часов

---

## 📋 CHECKLIST ПЕРЕД ДЕПЛОЕМ

- [ ] Все миграции 068-072 запущены успешно
- [ ] Проверено: таблица users пуста (все удалено)
- [ ] `UniversalGuestService` покрыт тестами
- [ ] `IdentityLinkService` покрыт тестами
- [ ] Telegram bot команда `/connect` работает
- [ ] Email bot отправляет ссылку
- [ ] Web гости обрабатываются через новую систему
- [ ] Миграция истории работает корректно
- [ ] Роли (user/assistant) сохраняются при миграции
- [ ] Админская логика интегрирована
- [ ] Frontend страница `/connect-wallet` работает
- [ ] Токены истекают и очищаются
- [ ] Существующие web гости мигрированы в unified_guest_messages
- [ ] Старые таблицы guest_messages и guest_user_mapping удалены
- [ ] Документация обновлена
- [ ] Старый код помечен как deprecated

---

## 📊 МЕТРИКИ УСПЕХА

После внедрения системы должны улучшиться:

1. **Дедупликация:** 0% дубликатов пользователей
2. **Сохранение истории:** 100% AI ответов сохраняются
3. **Миграция:** 100% истории переносится при авторизации
4. **Контекст:** Гости видят предыдущие сообщения
5. **Unified:** Все каналы используют одну логику

---

## 🔗 СВЯЗАННЫЕ ДОКУМЕНТЫ

- `AI_DATABASE_STRUCTURE.md` - Структура БД
- `AI_FULL_INVENTORY.md` - Список всех файлов
- `TASK_CHANNEL_ONBOARDING.md` - Система приветствий (следующая задача)

---

**Статус:** 📋 Готово к реализации  
**Автор:** AI Assistant  
**Дата:** 2025-10-09

