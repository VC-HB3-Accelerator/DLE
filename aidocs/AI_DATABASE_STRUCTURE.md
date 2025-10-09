# Структура базы данных для AI Ассистента

**Дата проверки:** 2025-10-08  
**Метод:** Прямая проверка через PostgreSQL  
**Статус:** ✅ ПРОВЕРКА ЗАВЕРШЕНА

---

## 📊 Список AI таблиц

Найдено таблиц: **27 таблиц** (25 связаны с AI, 2 CMS)

---

## 1. `ai_assistant_settings` ⭐ КЛЮЧЕВАЯ

**Назначение:** Основные настройки AI ассистента

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `selected_rag_tables` - INTEGER[] - массив ID RAG таблиц для использования
- `languages` - TEXT[] - массив поддерживаемых языков
- `updated_at` - TIMESTAMP - время последнего обновления (default: now())
- `updated_by` - INTEGER - кто обновил (user_id)
- `rules_id` - INTEGER (FK → ai_assistant_rules) - ID правил для AI
- `telegram_settings_id` - INTEGER (FK → telegram_settings) - ID настроек Telegram
- `email_settings_id` - INTEGER (FK → email_settings) - ID настроек Email
- `system_prompt_encrypted` - TEXT - зашифрованный системный промпт
- `model_encrypted` - TEXT - зашифрованное название модели
- `system_message_encrypted` - TEXT - зашифрованное системное сообщение
- `embedding_model_encrypted` - TEXT - зашифрованное название embedding модели
- `system_message` - TEXT - системное сообщение (расшифрованное)
- `embedding_model` - VARCHAR(128) - embedding модель (расшифрованное)

**Связи:**
- → `ai_assistant_rules` (через rules_id)
- → `telegram_settings` (через telegram_settings_id)
- → `email_settings` (через email_settings_id)

**Используется в:**
- aiAssistantSettingsService.js (getSettings, updateSettings)
- conversationService.js (getRagTableId)
- ai-assistant.js (generateResponse)
- routes/settings.js (API)

---

## 2. `ai_assistant_rules` ✅ АКТИВНАЯ

**Назначение:** Правила и инструкции для AI ассистента

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `created_at` - TIMESTAMP - дата создания (default: now())
- `updated_at` - TIMESTAMP - дата обновления (default: now())
- `name_encrypted` - TEXT - зашифрованное название правила
- `description_encrypted` - TEXT - зашифрованное описание правила
- `rules_encrypted` - TEXT - зашифрованные правила (JSON) ✅ ДОБАВЛЕНО

**Связи:**
- ← `ai_assistant_settings.rules_id` ссылается на эту таблицу

**Используется в:**
- aiAssistantRulesService.js (getAllRules, getRuleById, createRule)
- ai-assistant.js (получение правил)
- routes/settings.js (CRUD API)

---

## 3. `ai_providers_settings` ⭐ КЛЮЧЕВАЯ

**Назначение:** Настройки AI провайдеров (Ollama, OpenAI, Anthropic, Google)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `created_at` - TIMESTAMP NOT NULL - дата создания (default: now())
- `updated_at` - TIMESTAMP NOT NULL - дата обновления (default: now())
- `provider_encrypted` - TEXT - зашифрованное название провайдера ('ollama', 'openai', etc.)
- `api_key_encrypted` - TEXT - зашифрованный API ключ
- `base_url_encrypted` - TEXT - зашифрованный базовый URL
- `selected_model_encrypted` - TEXT - зашифрованное название выбранной модели
- `embedding_model_encrypted` - TEXT - зашифрованное название embedding модели
- `embedding_model` - VARCHAR(128) - embedding модель (незашифрованное, дублирует?)

**Связи:**
- Нет внешних ключей

**Используется в:**
- aiProviderSettingsService.js (getProviderSettings, upsertProviderSettings)
- ollamaConfig.js (loadSettingsFromDb - загружает настройки Ollama)
- ragService.js (getProviderSettings для вызова разных AI)
- routes/settings.js (CRUD API)

---

## 4. `messages` ⭐ КЛЮЧЕВАЯ

**Назначение:** Все сообщения пользователей и AI ответы

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `conversation_id` - INTEGER (FK → conversations) - ID беседы
- `sender_id` - INTEGER - ID отправителя (для админских сообщений)
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `user_id` - INTEGER (FK → users) - ID пользователя-владельца беседы
- `tokens_used` - INTEGER - количество токенов (default: 0)
- `is_processed` - BOOLEAN - обработано ли (default: false)
- `attachment_size` - BIGINT - размер вложения в байтах
- `attachment_data` - BYTEA - бинарные данные вложения
- `sender_type_encrypted` - TEXT - тип отправителя ('user', 'assistant', 'editor')
- `content_encrypted` - TEXT - текст сообщения
- `channel_encrypted` - TEXT - канал ('web', 'telegram', 'email')
- `role_encrypted` - TEXT - роль
- `attachment_filename_encrypted` - TEXT - имя файла
- `attachment_mimetype_encrypted` - TEXT - MIME тип
- `direction_encrypted` - TEXT - направление ('in', 'out')
- `message_id_encrypted` - TEXT - ID сообщения для дедупликации
- `message_type` - VARCHAR(20) NOT NULL - тип ('user_chat', 'admin_chat')

**Индексы:**
- idx_messages_conversation_id
- idx_messages_created_at
- idx_messages_message_type
- idx_messages_user_id

**Связи:**
- → `conversations` (ON DELETE CASCADE)
- → `users` (ON DELETE CASCADE)

**Триггеры:**
- `trg_set_message_user_id` - автоустановка user_id

**Используется в:**
- unifiedMessageProcessor.js (saveUserMessage)
- messageDeduplicationService.js (сохранение)
- conversationService.js (история)
- routes/messages.js, routes/chat.js

---

## 5. `conversations` ⭐ КЛЮЧЕВАЯ

**Назначение:** Беседы (диалоги) пользователей с AI

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор беседы
- `user_id` - INTEGER (FK → users) - ID пользователя-владельца
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `title_encrypted` - TEXT - зашифрованный заголовок беседы
- `conversation_type` - VARCHAR(50) - тип беседы (default: 'user_chat')
  - `'user_chat'` - обычный чат пользователя
  - `'admin_chat'` - приватный чат между админами

**Индексы:**
- idx_conversations_conversation_type
- idx_conversations_created_at
- idx_conversations_user_id

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)
- ← `conversation_participants` (для многопользовательских чатов)
- ← `messages` (все сообщения беседы)

**Используется в:**
- conversationService.js (findOrCreateConversation, getConversationHistory)
- unifiedMessageProcessor.js (создание беседы)
- guestMessageService.js (перенос гостевых сообщений)
- routes/messages.js (CRUD беседы)

---

## 6. `message_deduplication` ⭐ КЛЮЧЕВАЯ

**Назначение:** Предотвращение дублирования сообщений (дедупликация)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `channel` - VARCHAR(20) NOT NULL - канал ('web', 'telegram', 'email')
- `message_id_hash` - VARCHAR(64) NOT NULL - SHA-256 хеш ID
- `user_id` - INTEGER NOT NULL (FK → users) - ID пользователя
- `sender_type` - VARCHAR(20) NOT NULL - тип отправителя ('user', 'assistant')
- `original_message_id_encrypted` - TEXT - оригинальный ID
- `processed_at` - TIMESTAMP WITH TIME ZONE - время обработки (default: now())
- `expires_at` - TIMESTAMP WITH TIME ZONE - время истечения

**Индексы:**
- idx_message_dedup_expires
- idx_message_dedup_lookup (channel, hash, user_id, sender_type)
- idx_message_dedup_user_channel
- UNIQUE (channel, hash, user_id, sender_type)

**Связи:**
- → `users` (ON DELETE CASCADE)

**Используется в:**
- messageDeduplicationService.js
- unifiedMessageProcessor.js
- ai-assistant.js

---

## 7. `guest_messages` ✅ АКТИВНАЯ

**Назначение:** Временное хранение сообщений гостей

**Столбцы:**
- `id` - INTEGER (PK)
- `is_ai` - BOOLEAN - от AI? (default: false)
- `created_at` - TIMESTAMP WITH TIME ZONE (default: now())
- `attachment_size` - BIGINT
- `attachment_data` - BYTEA
- `guest_id_encrypted` - TEXT - ID гостя (sessionID)
- `content_encrypted` - TEXT
- `language_encrypted` - TEXT
- `attachment_filename_encrypted` - TEXT
- `attachment_mimetype_encrypted` - TEXT
- `attachment_filename` - TEXT (дубль?)
- `attachment_mimetype` - TEXT (дубль?)

**Связи:**
- Нет FK (временная)

**Используется в:**
- guestService.js
- guestMessageService.js (перенос после auth)

**Цикл:**
1. Гость пишет → сохраняется
2. Авторизация → перенос в messages
3. Удаление из guest_messages

---

## 8. `guest_user_mapping` ✅ АКТИВНАЯ

**Назначение:** Связь между гостями и зарегистрированными пользователями

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `user_id` - INTEGER NOT NULL (FK → users) - ID пользователя
- `processed` - BOOLEAN - обработаны ли сообщения (default: false)
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `guest_id_encrypted` - TEXT - зашифрованный ID гостя (sessionID)

**Индексы:**
- idx_guest_user_mapping_guest_id_encrypted - UNIQUE
- idx_guest_user_mapping_user_id

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- guestMessageService.js (processGuestMessages - проверка и создание mapping)

**Логика:**
- При аутентификации гостя создается запись
- `processed = false` → сообщения еще не перенесены
- `processed = true` → сообщения уже перенесены в messages

---

## 9. `telegram_settings` ✅ АКТИВНАЯ

**Назначение:** Настройки Telegram бота

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `created_at` - TIMESTAMP NOT NULL - дата создания (default: now())
- `updated_at` - TIMESTAMP NOT NULL - дата обновления (default: now())
- `bot_token_encrypted` - TEXT - зашифрованный токен Telegram бота
- `bot_username_encrypted` - TEXT - зашифрованное имя бота

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- ← `ai_assistant_settings.telegram_settings_id` ссылается на эту таблицу

**Используется в:**
- telegramBot.js (loadSettings - загрузка токена)
- botsSettings.js (getTelegramSettings, saveTelegramSettings, testConnection)
- routes/admin (API для настройки Telegram)

---

## 10. `email_settings` ✅ АКТИВНАЯ

**Назначение:** Настройки Email бота (SMTP + IMAP)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `smtp_port` - INTEGER NOT NULL - порт SMTP (обычно 465)
- `imap_port` - INTEGER - порт IMAP (обычно 993)
- `created_at` - TIMESTAMP NOT NULL - дата создания (default: now())
- `updated_at` - TIMESTAMP NOT NULL - дата обновления (default: now())
- `smtp_host_encrypted` - TEXT - зашифрованный хост SMTP
- `smtp_user_encrypted` - TEXT - зашифрованный пользователь SMTP
- `smtp_password_encrypted` - TEXT - зашифрованный пароль SMTP
- `imap_host_encrypted` - TEXT - зашифрованный хост IMAP
- `from_email_encrypted` - TEXT - зашифрованный email отправителя
- `imap_user_encrypted` - TEXT - зашифрованный пользователь IMAP
- `imap_password_encrypted` - TEXT - зашифрованный пароль IMAP

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- ← `ai_assistant_settings.email_settings_id` ссылается на эту таблицу

**Используется в:**
- emailBot.js (loadSettings - создание SMTP транспортера и IMAP соединения)
- botsSettings.js (getEmailSettings, saveEmailSettings, testEmailSMTP, testEmailIMAP)
- routes/admin (API для настройки Email)

---

## 11. `is_rag_source` ✅ АКТИВНАЯ

**Назначение:** Источники данных для RAG (справочник)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор источника
- `name_encrypted` - TEXT - зашифрованное название источника

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- ← `user_tables.is_rag_source_id` ссылается на эту таблицу

**Используется в:**
- Связывает RAG таблицы с типом источника данных
- user_tables имеет default: is_rag_source_id = 2

**Примеры источников:**
- ID 1: "FAQ"
- ID 2: "База знаний"
- ID 3: "Документация"
(зависит от данных в БД)

---

## 12. `user_tables` ⭐ КЛЮЧЕВАЯ (RAG)

**Назначение:** Пользовательские таблицы с данными для RAG базы знаний

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор таблицы
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `is_rag_source_id` - INTEGER (FK → is_rag_source) - тип источника (default: 2)
- `name_encrypted` - TEXT - зашифрованное название таблицы
- `description_encrypted` - TEXT - зашифрованное описание

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- → `is_rag_source` (is_rag_source_id)
- ← `user_columns` (table_id, ON DELETE CASCADE)
- ← `user_rows` (table_id, ON DELETE CASCADE)
- ← `user_table_relations` (to_table_id, ON DELETE CASCADE)

**Используется в:**
- ragService.js (getTableData - получение данных для RAG)
- routes/tables.js (CRUD таблиц)
- routes/rag.js (выбор таблицы для RAG запроса)

**Структура RAG:**
```
user_tables (таблица)
  └─ user_columns (колонки с purpose)
       └─ user_rows (строки)
            └─ user_cell_values (значения ячеек)
```

---

## 13. `user_columns` ⭐ КЛЮЧЕВАЯ (RAG)

**Назначение:** Колонки пользовательских таблиц с метаданными для RAG

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор колонки
- `table_id` - INTEGER NOT NULL (FK → user_tables) - ID таблицы
- `order` - INTEGER - порядок отображения (default: 0)
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `name_encrypted` - TEXT - зашифрованное название колонки
- `type_encrypted` - TEXT - зашифрованный тип ('text', 'number', 'date', etc.)
- `placeholder_encrypted` - TEXT - зашифрованный плейсхолдер
- `placeholder` - VARCHAR(255) - плейсхолдер для RAG (UNIQUE)
- `options` - JSONB - дополнительные опции (default: '{}')
  - `purpose` - назначение колонки ('question', 'answer', 'context', 'product', 'priority', 'date')

**Индексы:**
- PRIMARY KEY: id
- idx_user_columns_options (GIN) - для быстрого поиска по JSONB
- user_columns_placeholder_key (UNIQUE) - уникальность плейсхолдеров

**Связи:**
- → `user_tables` (table_id, ON DELETE CASCADE)
- ← `user_table_relations` (column_id, ON DELETE CASCADE)

**Используется в:**
- ragService.js (getTableData - определение колонок по purpose)
- routes/tables.js (CRUD колонок)

**Важно для RAG:**
- `options.purpose` определяет роль колонки:
  - 'question' - вопрос для поиска
  - 'answer' - ответ
  - 'context' - контекст
  - 'product', 'priority', 'date' - метаданные

---

## 14. `user_rows` ⭐ КЛЮЧЕВАЯ (RAG)

**Назначение:** Строки данных в пользовательских таблицах (записи для RAG)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор строки
- `table_id` - INTEGER NOT NULL (FK → user_tables) - ID таблицы
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `order` - INTEGER - порядок отображения (default: 0)

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- → `user_tables` (table_id, ON DELETE CASCADE)
- ← `user_cell_values` (row_id, ON DELETE CASCADE)
- ← `user_table_relations` (from_row_id, to_row_id, ON DELETE CASCADE)
- ← `user_tag_links` (tag_id, ON DELETE CASCADE)

**Используется в:**
- ragService.js (getTableData - получение всех строк таблицы)
- routes/tables.js (CRUD строк)

**Важно:**
- Каждая строка = одна запись в RAG (например, один вопрос-ответ)
- Значения хранятся в `user_cell_values`

---

## 15. `user_cell_values` ⭐ КЛЮЧЕВАЯ (RAG)

**Назначение:** Значения ячеек в пользовательских таблицах (данные для RAG)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор значения
- `row_id` - INTEGER NOT NULL (FK → user_rows) - ID строки
- `column_id` - INTEGER NOT NULL (FK → user_columns) - ID колонки ✅ ИСПРАВЛЕНО
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `value_encrypted` - TEXT - зашифрованное значение ячейки

**Индексы:**
- PRIMARY KEY: id
- user_cell_values_row_id_column_id_key (UNIQUE) - уникальная пара (row_id, column_id)

**Связи:**
- → `user_rows` (row_id, ON DELETE CASCADE)
- → `user_columns` (column_id, ON DELETE CASCADE) ✅ ДОБАВЛЕНО

**Используется в:**
- ragService.js (getTableData - получение всех значений для построения RAG данных)
- routes/tables.js (CRUD значений ячеек)

**Как работает RAG:**
1. ragService получает все cell_values для строк таблицы
2. Группирует по row_id
3. Находит значения по column_id с нужным purpose (question/answer/context)
4. Формирует данные для векторного поиска

---

## 16. `conversation_participants` ✅ АКТИВНАЯ

**Назначение:** Участники многопользовательских бесед (для admin_chat)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `conversation_id` - INTEGER (FK → conversations) - ID беседы
- `user_id` - INTEGER (FK → users) - ID участника
- `created_at` - TIMESTAMP - дата добавления (default: CURRENT_TIMESTAMP)

**Индексы:**
- PRIMARY KEY: id
- conversation_participants_conversation_id_user_id_key (UNIQUE) - пара (conversation_id, user_id)
- idx_conversation_participants_conversation_id
- idx_conversation_participants_user_id

**Связи:**
- → `conversations` (conversation_id, ON DELETE CASCADE)
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- routes/messages.js (создание admin_chat бесед между админами)
- routes/chat.js (поиск приватных бесед)

**Логика:**
- Для обычных чатов (`user_chat`) - НЕ используется (один владелец)
- Для админских чатов (`admin_chat`) - хранит всех участников беседы

---

## 17. `users` ⭐ КРИТИЧЕСКАЯ

**Назначение:** Пользователи системы (основа для всех AI взаимодействий)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор пользователя
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)
- `role` - user_role ENUM - роль пользователя (default: 'user')
  - 'user' - обычный пользователь
  - 'editor' - администратор-редактор
  - 'readonly' - администратор только для чтения
- `is_blocked` - BOOLEAN NOT NULL - заблокирован ли (default: false)
- `blocked_at` - TIMESTAMP - время блокировки
- `username_encrypted` - TEXT - зашифрованное имя пользователя
- `status_encrypted` - TEXT - зашифрованный статус
- `first_name_encrypted` - TEXT - зашифрованное имя
- `last_name_encrypted` - TEXT - зашифрованная фамилия
- `preferred_language` - JSONB - предпочитаемый язык

**Индексы:**
- PRIMARY KEY: id
- idx_users_role

**Связи (Referenced by):**
- ← conversation_participants (9 таблиц ссылаются!)
- ← conversations
- ← message_deduplication
- ← global_read_status
- ← guest_user_mapping
- ← messages
- ← user_identities
- ← user_preferences
- ← user_tag_links
- ← verification_codes

**Используется в:**
- identity-service.js (создание пользователей)
- auth-service.js (проверка ролей)
- userUtils.js (isUserBlocked)
- ВСЕ AI сервисы (через связи)

---

## 18. `user_identities` ⭐ КРИТИЧЕСКАЯ

**Назначение:** Идентификаторы пользователей (wallet, email, telegram)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `user_id` - INTEGER (FK → users) - ID пользователя
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `provider_encrypted` - TEXT - зашифрованный провайдер ('wallet', 'email', 'telegram')
- `provider_id_encrypted` - TEXT - зашифрованный идентификатор (адрес, email, telegram ID)

**Индексы:**
- PRIMARY KEY: id
- idx_user_identities_user_id

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- identity-service.js (findUserByIdentity, saveIdentity, linkWalletToUser)
- unifiedMessageProcessor.js (authenticateUser - поиск пользователя по Telegram/Email)
- telegramBot.js, emailBot.js (связь external ID с user_id)
- routes/identities.js (управление идентификаторами)
- routes/messages.js (broadcast - поиск каналов пользователя)

**Логика:**
- Один пользователь может иметь несколько идентификаторов (wallet + email + telegram)
- При входе через любой канал - система находит или создает пользователя

---

## 19. `global_read_status` ✅ АКТИВНАЯ

**Назначение:** Глобальный статус прочтения сообщений для user_chat

**Столбцы:**
- `user_id` - INTEGER (PK, FK → users) - ID пользователя
- `last_read_at` - TIMESTAMP NOT NULL - время последнего прочитанного сообщения
- `updated_by_admin_id` - INTEGER NOT NULL - ID админа, который обновил статус
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)

**Индексы:**
- PRIMARY KEY: user_id
- idx_global_read_status_last_read_at
- idx_global_read_status_user_id

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- routes/messages.js (mark-read, read-status для user_chat)

**Логика:**
- Один статус на пользователя (общий для всех админов)
- Для обычных чатов (`user_chat`)
- Для админских чатов используется `admin_read_messages`

---

## 20. `admin_read_messages` ✅ АКТИВНАЯ

**Назначение:** Персональный статус прочтения для admin_chat

**Столбцы:**
- `admin_id` - INTEGER NOT NULL (PK, FK → users) - ID администратора
- `user_id` - INTEGER NOT NULL (PK, FK → users) - ID пользователя/другого админа
- `last_read_at` - TIMESTAMP NOT NULL - время последнего прочитанного сообщения

**Индексы:**
- PRIMARY KEY: (admin_id, user_id) - составной ключ

**Связи:**
- → `users` (admin_id, ON DELETE CASCADE) ✅ ДОБАВЛЕНО
- → `users` (user_id, ON DELETE CASCADE) ✅ ДОБАВЛЕНО

**Используется в:**
- routes/messages.js (mark-read, read-status для admin_chat)

**Логика:**
- Персональный статус для каждого админа
- Для приватных чатов между админами (`admin_chat`)
- Каждый админ имеет свой статус прочтения

**Отличие от global_read_status:**
- global_read_status - общий для всех админов (user_chat)
- admin_read_messages - персональный для каждого админа (admin_chat)

---

## 21. `user_tag_links` ✅ АКТИВНАЯ

**Назначение:** Связь пользователей с тегами (для RAG фильтрации)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `user_id` - INTEGER NOT NULL (FK → users) - ID пользователя
- `tag_id` - INTEGER NOT NULL (FK → user_rows) - ID тега (строка из таблицы тегов)
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)

**Индексы:**
- PRIMARY KEY: id
- idx_user_tag_links_tag_id
- idx_user_tag_links_user_id
- user_tag_links_user_id_tag_id_key (UNIQUE) - уникальная пара (user_id, tag_id)

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)
- → `user_rows` (tag_id, ON DELETE CASCADE) - теги хранятся как строки в RAG таблицах

**Используется в:**
- ragService.js (фильтрация данных по пользовательским тегам)
- routes/tables.js (управление тегами пользователей)

**Логика:**
- Теги позволяют фильтровать RAG данные по пользователю
- Один пользователь может иметь несколько тегов
- Используется для персонализации AI ответов

---

## 22. `roles` ⚠️ ВОЗМОЖНО УСТАРЕВШАЯ

**Назначение:** Роли пользователей (возможно старая таблица)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `name_encrypted` - TEXT - зашифрованное название роли

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- Нет внешних ключей
- Нет Referenced by (никто не ссылается!)

**⚠️ ПРОБЛЕМА:**
- Таблица существует, но НЕ используется
- В `users` роль хранится как ENUM `user_role`, а не FK
- Возможно старая таблица, которую можно удалить

**Используется в:**
- ❌ НЕ найдено использования в коде

---

## 23. `admin_pages` ⚠️ НЕ СВЯЗАНА С AI

**Назначение:** Страницы контента (CMS), НЕ связана с AI напрямую

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `author_address_encrypted` - TEXT NOT NULL - зашифрованный адрес автора
- `created_at` - TIMESTAMP - дата создания (default: now())
- `updated_at` - TIMESTAMP - дата обновления (default: now())
- `title_encrypted` - TEXT - зашифрованный заголовок
- `summary_encrypted` - TEXT - зашифрованное краткое описание
- `content_encrypted` - TEXT - зашифрованное содержимое
- `seo_encrypted` - TEXT - зашифрованные SEO данные
- `status_encrypted` - TEXT - зашифрованный статус
- `settings_encrypted` - TEXT - зашифрованные настройки

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- Нет внешних ключей

**Используется в:**
- routes/pages.js (CMS система)
- ❌ НЕ используется в AI сервисах

**Примечание:**
- Это таблица для CMS (система управления контентом)
- НЕ связана с AI ассистентом
- Упомянута в вашем списке, но к AI не относится

---

## 24. `admin_pages_simple` ⚠️ НЕ СВЯЗАНА С AI

**Назначение:** Упрощенные страницы контента БЕЗ шифрования, НЕ связана с AI

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `author_address` - TEXT NOT NULL - адрес автора (НЕ зашифрован!)
- `created_at` - TIMESTAMP - дата создания (default: now())
- `updated_at` - TIMESTAMP - дата обновления (default: now())
- `title` - TEXT - заголовок (НЕ зашифрован!)
- `summary` - TEXT - краткое описание
- `content` - TEXT - содержимое
- `seo` - TEXT - SEO данные
- `status` - TEXT - статус
- `settings` - TEXT - настройки

**Индексы:**
- PRIMARY KEY: id

**Связи:**
- Нет внешних ключей

**Используется в:**
- routes/pages.js (CMS система)
- ❌ НЕ используется в AI сервисах

**Примечание:**
- Это таблица для CMS (система управления контентом)
- В отличие от `admin_pages`, данные НЕ зашифрованы
- НЕ связана с AI ассистентом
- Упомянута в вашем списке, но к AI не относится

---

## 25. `user_table_relations` ⭐ КЛЮЧЕВАЯ (RAG)

**Назначение:** Связи между строками в разных RAG таблицах (реляционная модель данных)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор связи
- `from_row_id` - INTEGER NOT NULL (FK → user_rows) - исходная строка
- `column_id` - INTEGER NOT NULL (FK → user_columns) - колонка со связью
- `to_table_id` - INTEGER NOT NULL (FK → user_tables) - целевая таблица
- `to_row_id` - INTEGER NOT NULL (FK → user_rows) - целевая строка
- `created_at` - TIMESTAMP - дата создания (default: CURRENT_TIMESTAMP)
- `updated_at` - TIMESTAMP - дата обновления (default: CURRENT_TIMESTAMP)

**Индексы:**
- PRIMARY KEY: id
- idx_user_table_relations_column
- idx_user_table_relations_from_row
- idx_user_table_relations_to_row
- idx_user_table_relations_to_table

**Связи:**
- → `user_columns` (column_id, ON DELETE CASCADE)
- → `user_rows` (from_row_id, ON DELETE CASCADE)
- → `user_rows` (to_row_id, ON DELETE CASCADE)
- → `user_tables` (to_table_id, ON DELETE CASCADE)

**Используется в:**
- routes/tables.js (создание связей между данными)
- ragService.js (получение связанных данных для контекста)

**Логика:**
- Позволяет создавать связи "один-ко-многим" и "многие-ко-многим" между RAG данными
- Пример: FAQ вопрос → связанные продукты, документы → связанные разделы
- Используется для обогащения контекста AI ответов

**Структура связи:**
```
user_rows[from_row_id] 
  → user_columns[column_id] (тип: "relation")
    → user_tables[to_table_id]
      → user_rows[to_row_id]
```

---

## 26. `admin_read_contacts` ✅ АКТИВНАЯ

**Назначение:** Статус прочтения контактов админами (для UI непрочитанных пользователей)

**Столбцы:**
- `admin_id` - INTEGER NOT NULL (PK, FK → users) - ID администратора
- `contact_id` - INTEGER NOT NULL (PK, FK → users) - ID контакта (user_id)
- `read_at` - TIMESTAMP NOT NULL - время прочтения (default: now())

**Индексы:**
- PRIMARY KEY: (admin_id, contact_id) - составной ключ

**Связи:**
- → `users` (admin_id, ON DELETE CASCADE) ✅ ДОБАВЛЕНО
- → `users` (contact_id, ON DELETE CASCADE) ✅ ДОБАВЛЕНО

**Используется в:**
- routes/messages.js (mark-contact-read - отметить контакт как прочитанный)
- adminLogicService.js (управление непрочитанными контактами)

**Логика:**
- Отслеживает, когда админ последний раз просматривал чат пользователя
- Используется для отображения непрочитанных контактов в списке
- Отличается от `global_read_status` (статус сообщений) и `admin_read_messages` (приватные чаты)

**Применение:**
- UI показывает список пользователей с новыми сообщениями
- Когда админ открывает чат → обновляется `read_at`
- Новые сообщения после `read_at` = непрочитанные

---

## 27. `user_preferences` ✅ АКТИВНАЯ

**Назначение:** Пользовательские настройки и предпочтения (может влиять на AI)

**Столбцы:**
- `id` - INTEGER (PK) - уникальный идентификатор
- `user_id` - INTEGER NOT NULL (FK → users) - ID пользователя
- `created_at` - TIMESTAMP NOT NULL - дата создания (default: now())
- `updated_at` - TIMESTAMP NOT NULL - дата обновления (default: now())
- `preference_key_encrypted` - TEXT - зашифрованный ключ настройки
- `preference_value_encrypted` - TEXT - зашифрованное значение настройки
- `metadata` - JSONB - дополнительные метаданные (default: '{}')

**Индексы:**
- PRIMARY KEY: id
- idx_user_preferences_user_id

**Связи:**
- → `users` (user_id, ON DELETE CASCADE) ✅ ИСПРАВЛЕНО

**Используется в:**
- routes/preferences.js (CRUD настроек)
- Может использоваться для персонализации AI ответов

**Возможные настройки:**
- Язык интерфейса
- Тема оформления
- Уведомления
- Персональные предпочтения для AI (стиль общения, детальность ответов)

**Примечание:**
- В таблице `users` уже есть `preferred_language` (JSONB)
- `user_preferences` - более гибкая система для любых настроек
- Может расширяться для AI-специфичных настроек

---

## 28. `unified_guest_messages` ⭐ НОВАЯ (2025-10-09)

**Назначение:** Централизованное хранилище сообщений гостей для всех каналов

**Столбцы:**
- `id` - SERIAL PRIMARY KEY
- `identifier_encrypted` - TEXT NOT NULL - зашифрованный универсальный идентификатор ("channel:id")
- `channel` - VARCHAR(20) NOT NULL - канал ('web', 'telegram', 'email')
- `content_encrypted` - TEXT NOT NULL - зашифрованный текст сообщения
- `is_ai` - BOOLEAN NOT NULL DEFAULT false - TRUE если ответ AI, FALSE если от гостя
- `metadata` - JSONB DEFAULT '{}' - метаданные канала (username, chat_id и т.д.)
- `created_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()
- `attachment_filename_encrypted` - TEXT
- `attachment_mimetype_encrypted` - TEXT
- `attachment_size` - BIGINT
- `attachment_data` - BYTEA

**Индексы:**
- idx_unified_guest_identifier
- idx_unified_guest_channel
- idx_unified_guest_created_at
- idx_unified_guest_is_ai

**Связи:**
- Нет FK (временное хранилище до авторизации)

**Используется в:**
- UniversalGuestService.js (сохранение/загрузка истории)
- unifiedMessageProcessor.js (обработка гостевых сообщений)

**Логика:**
- Заменяет старую таблицу `guest_messages`
- Работает для ВСЕХ каналов (web, telegram, email)
- Сохраняет как вопросы гостей (is_ai=false), так и ответы AI (is_ai=true)
- При подключении кошелька - данные мигрируют в `messages`

---

## 29. `identity_link_tokens` ⭐ НОВАЯ (2025-10-09)

**Назначение:** Токены для связывания Telegram/Email с Web3 кошельками

**Столбцы:**
- `id` - SERIAL PRIMARY KEY
- `token` - VARCHAR(64) UNIQUE NOT NULL - уникальный токен
- `source_provider` - VARCHAR(20) NOT NULL - провайдер ('telegram', 'email')
- `source_identifier_encrypted` - TEXT NOT NULL - зашифрованный ID источника
- `user_id` - INTEGER FK → users - опциональный user_id
- `is_used` - BOOLEAN NOT NULL DEFAULT false - флаг использования
- `used_at` - TIMESTAMP WITH TIME ZONE - время использования
- `linked_wallet` - TEXT - адрес привязанного кошелька
- `expires_at` - TIMESTAMP WITH TIME ZONE NOT NULL - время истечения (TTL)
- `created_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Индексы:**
- idx_link_tokens_token (UNIQUE)
- idx_link_tokens_expires
- idx_link_tokens_used
- idx_link_tokens_provider

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- IdentityLinkService.js (генерация/проверка токенов)
- routes/auth.js (подключение кошелька через токен)
- routes/identities.js (проверка статуса токена)

**Логика:**
- Telegram/Email бот генерирует токен и ссылку
- Пользователь переходит по ссылке и подключает кошелек
- Токен связывает Telegram/Email с wallet без дубликатов
- TTL 1 час, после использования помечается is_used=true

---

## 30. `unified_guest_mapping` ⭐ НОВАЯ (2025-10-09)

**Назначение:** Маппинг между гостевыми идентификаторами и пользователями

**Столбцы:**
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER NOT NULL FK → users
- `identifier_encrypted` - TEXT NOT NULL - зашифрованный идентификатор ("channel:id")
- `channel` - VARCHAR(20) NOT NULL - канал ('web', 'telegram', 'email')
- `processed` - BOOLEAN NOT NULL DEFAULT false - флаг миграции
- `processed_at` - TIMESTAMP WITH TIME ZONE - время миграции
- `created_at` - TIMESTAMP WITH TIME ZONE DEFAULT NOW()

**Индексы:**
- idx_unified_mapping_user_id
- idx_unified_mapping_identifier
- idx_unified_mapping_processed
- idx_unified_mapping_channel
- UNIQUE(identifier_encrypted, channel)

**Связи:**
- → `users` (user_id, ON DELETE CASCADE)

**Используется в:**
- UniversalGuestService.js (маппинг при миграции)

**Логика:**
- Создается при миграции гостевой истории в user_id
- UNIQUE constraint предотвращает дубликаты
- processed=true означает что сообщения уже мигрированы

---

## 📊 ИТОГОВАЯ СТАТИСТИКА

**Всего проверено:** 30 таблиц

**По категориям:**
- ⭐ КРИТИЧЕСКИЕ: 4 (users, user_identities, messages, conversations)
- ⭐ КЛЮЧЕВЫЕ: 13 (ai_assistant_settings, ai_providers_settings, message_deduplication, user_tables, user_columns, user_rows, user_cell_values, user_table_relations, unified_guest_messages ✨, identity_link_tokens ✨, unified_guest_mapping ✨)
- ✅ АКТИВНЫЕ: 10 (ai_assistant_rules, telegram_settings, email_settings, is_rag_source, conversation_participants, global_read_status, admin_read_messages, user_tag_links, admin_read_contacts, user_preferences)
- ⚠️ ПРОБЛЕМНЫЕ: 1 (roles - не используется)
- ⚠️ НЕ СВЯЗАНЫ С AI: 2 (admin_pages, admin_pages_simple)

**Обнаруженные проблемы:**
- ~~1. `ai_assistant_rules` - отсутствует столбец `rules_encrypted`~~ ✅ ИСПРАВЛЕНО (миграция 064)
- ~~2. `user_cell_values` - нет FK на `user_columns` (column_id)~~ ✅ ИСПРАВЛЕНО (миграция 065)
- 3. `roles` - таблица существует, но не используется ⚠️ НИЗКИЙ ПРИОРИТЕТ
- ~~4. `admin_read_messages` - нет FK на users~~ ✅ ИСПРАВЛЕНО (миграция 066)
- ~~5. `admin_read_contacts` - нет FK на users~~ ✅ ИСПРАВЛЕНО (миграция 066)
- ~~6. `user_preferences` - нет ON DELETE CASCADE для user_id~~ ✅ ИСПРАВЛЕНО (миграция 067)

**Применённые миграции:**
- 064_add_rules_encrypted_to_ai_assistant_rules.sql
- 065_add_fk_user_cell_values_column_id.sql
- 066_add_fk_admin_read_tables.sql
- 067_add_cascade_user_preferences.sql
- 068_create_unified_guest_messages.sql ✨ НОВАЯ (2025-10-09)
- 069_create_identity_link_tokens.sql ✨ НОВАЯ (2025-10-09)
- 070_create_unified_guest_mapping.sql ✨ НОВАЯ (2025-10-09)
- 071_cleanup_test_data.sql ⚠️ ОЧИСТКА ДАННЫХ (2025-10-09)
- 072_migrate_existing_guest_data.sql ✨ МИГРАЦИЯ (2025-10-09)

**Дата проверки:** 2025-10-08  
**Дата исправлений:** 2025-10-08  
**Дата обновления:** 2025-10-09 (Универсальная гостевая система)  
**Статус:** ✅ ПРОВЕРКА ЗАВЕРШЕНА + КРИТИЧНЫЕ ПРОБЛЕМЫ ИСПРАВЛЕНЫ + НОВАЯ СИСТЕМА ГОСТЕЙ

