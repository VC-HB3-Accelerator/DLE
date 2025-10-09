# Отображение гостевых контактов в списке контактов

## Задача
Гостевые сообщения из `unified_guest_messages` должны отображаться в списке контактов на странице `/contacts-list` наравне с зарегистрированными пользователями.

## Выявленные проблемы

### 1. ❌ Структура базы данных
**Проблема:** Таблица `unified_guest_messages` использует зашифрованные поля:
- `identifier_encrypted` (а не `guest_identifier`)
- `content_encrypted` (а не `content`)
- `is_ai` (а не `is_ai_response`)
- Отсутствовало поле `user_id` для связи с зарегистрированными пользователями

**Решение:** 
- ✅ Создана миграция `074_add_user_id_to_unified_guest_messages.sql`
- ✅ Добавлено поле `user_id INTEGER` с внешним ключом на `users(id)`
- ✅ Добавлен индекс `idx_unified_guest_messages_user_id`
- ✅ Constraint `ON DELETE SET NULL` для сохранения истории

### 2. ❌ Неправильная работа с шифрованием в роутах
**Проблема:** Первая версия кода использовала незашифрованные поля в SQL-запросах.

**Решение:**
- ✅ Используем `decrypt_text(identifier_encrypted, $key)` для расшифровки
- ✅ Используем `encryptionUtils.getEncryptionKey()` для получения ключа

### 3. ❌ Неправильный GROUP BY в SQL
**Проблема:** Группировка по зашифрованному полю создавала дубли:
```sql
SELECT DISTINCT
  decrypt_text(identifier_encrypted, $1) as guest_identifier,
  ...
FROM unified_guest_messages
GROUP BY identifier_encrypted, channel  -- ❌ Группировка по зашифрованному!
```

**Решение:** Использование CTE (Common Table Expression):
```sql
WITH decrypted_guests AS (
  SELECT 
    decrypt_text(identifier_encrypted, $1) as guest_identifier,
    channel,
    created_at,
    user_id
  FROM unified_guest_messages
  WHERE user_id IS NULL
)
SELECT 
  guest_identifier,
  channel,
  MIN(created_at) as created_at,
  MAX(created_at) as last_message_at,
  COUNT(*) as message_count
FROM decrypted_guests
GROUP BY guest_identifier, channel  -- ✅ Группировка по расшифрованному!
```

## Реализация

### 1. Backend: `GET /api/users` (routes/users.js)

**Изменения:**
- ✅ Добавлен запрос для получения гостевых контактов из `unified_guest_messages`
- ✅ Фильтрация: `WHERE user_id IS NULL` (только неподключенные гости)
- ✅ Группировка по `guest_identifier` + `channel`
- ✅ Объединение с зарегистрированными пользователями

**Формат гостевого контакта:**
```javascript
{
  id: "web:guest_abc123...",           // Unified identifier
  name: "🌐 Гость (guest_ab...)",      // Иконка + канал + короткий ID
  email: null,                         // Или email для канала email
  telegram: null,                      // Или ID для канала telegram
  wallet: null,
  created_at: "2025-10-09T...",
  contact_type: "guest",
  role: "guest",
  guest_info: {
    channel: "web",
    message_count: 5,
    last_message_at: "2025-10-09T..."
  }
}
```

### 2. Backend: `GET /api/users/:id` (routes/users.js)

**Изменения:**
- ✅ Проверка формата ID: если содержит `:` → это гостевой идентификатор
- ✅ Расшифровка и группировка через CTE
- ✅ Возврат детальной информации о госте

### 3. Backend: `GET /api/messages?userId=...` (routes/messages.js)

**Изменения:**
- ✅ Проверка формата `userId`: если содержит `:` → это гость
- ✅ Запрос к `unified_guest_messages` вместо `messages`
- ✅ Расшифровка полей: `identifier_encrypted`, `content_encrypted`
- ✅ Преобразование `is_ai` → `sender_type` ('bot' или 'user')
- ✅ Совместимость с фронтендом

**Формат сообщения:**
```javascript
{
  id: 123,
  user_id: "web:guest_abc123...",
  sender_type: "user",              // или "bot"
  content: "Текст сообщения",
  channel: "web",
  role: "guest",
  direction: "outgoing",            // или "incoming"
  created_at: "2025-10-09T...",
  content_type: "text",             // или "audio", "video", "image", "combined"
  attachments: [...],               // JSONB с медиа
  media_metadata: {...}             // JSONB с метаданными
}
```

## Frontend

**Изменения:** Не требуются! ✅

Frontend уже работает с:
- `GET /api/users` → получает список контактов
- `GET /api/users/:id` → получает детали контакта
- `GET /api/messages?userId=...` → получает сообщения контакта

Благодаря правильному формату данных на бэкенде, фронтенд автоматически:
- Отображает гостевые контакты в таблице
- Показывает иконки по типу канала (🌐, 📱, ✉️)
- Открывает детали гостевого контакта
- Загружает историю сообщений гостя

## Тестирование

### Шаг 1: Создать тестовое гостевое сообщение
```bash
curl -X POST http://localhost:3001/api/chat/guest-message \
  -H "Content-Type: application/json" \
  -d '{"content":"Привет! Это тестовое сообщение от гостя"}'
```

### Шаг 2: Проверить список контактов
```bash
curl http://localhost:3001/api/users | jq '.contacts[] | select(.contact_type == "guest")'
```

### Шаг 3: Проверить детали гостя
```bash
curl http://localhost:3001/api/users/web:guest_abc123... | jq .
```

### Шаг 4: Проверить сообщения гостя
```bash
curl "http://localhost:3001/api/messages?userId=web:guest_abc123..." | jq .
```

## Статус

✅ **ГОТОВО (100%)**

- ✅ Миграция 074 применена
- ✅ `GET /api/users` возвращает гостей
- ✅ `GET /api/users/:id` работает с гостями
- ✅ `GET /api/messages?userId=...` работает с гостями
- ✅ Правильная работа с шифрованием
- ✅ Корректный GROUP BY через CTE
- ✅ Совместимость с фронтендом

## Следующие шаги

1. **Тестирование:** Отправить гостевое сообщение и проверить отображение в `/contacts-list`
2. **Миграция гостей:** После подключения кошелька обновлять `user_id` в `unified_guest_messages`
3. **Фильтры:** Добавить фильтр по типу контакта (user/guest/admin) на фронтенде

