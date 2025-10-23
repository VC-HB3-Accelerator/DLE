# Проверка схемы базы данных

## Таблица `users`
```sql
CREATE TABLE users (
    id                   SERIAL PRIMARY KEY,
    username             VARCHAR(255),
    email                VARCHAR(255) UNIQUE,
    address              VARCHAR(255) UNIQUE,
    first_name_encrypted TEXT,
    last_name_encrypted  TEXT,
    status               VARCHAR(50) DEFAULT 'active',
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role                 user_role DEFAULT 'user',
    first_name           VARCHAR(255),
    last_name            VARCHAR(255),
    preferred_language   JSONB,
    is_blocked           BOOLEAN DEFAULT false,
    blocked_at           TIMESTAMP
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `username` - VARCHAR(255)
- `email` - VARCHAR(255) UNIQUE
- `address` - VARCHAR(255) UNIQUE
- `first_name_encrypted` - TEXT (зашифрованное)
- `last_name_encrypted` - TEXT (зашифрованное)
- `status` - VARCHAR(50) DEFAULT 'active'
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `role` - user_role DEFAULT 'user'
- `first_name` - VARCHAR(255) (незашифрованное)
- `last_name` - VARCHAR(255) (незашифрованное)
- `preferred_language` - JSONB
- `is_blocked` - BOOLEAN DEFAULT false
- `blocked_at` - TIMESTAMP

## Таблица `conversations`
```sql
CREATE TABLE conversations (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(255),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    conversation_type VARCHAR(50) DEFAULT 'user_chat'
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER REFERENCES users(id)
- `title` - VARCHAR(255) (НЕ зашифрованное!)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `conversation_type` - VARCHAR(50) DEFAULT 'user_chat'

## Таблица `messages`
```sql
CREATE TABLE messages (
    id                    SERIAL PRIMARY KEY,
    conversation_id       INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type_encrypted TEXT NOT NULL,
    sender_id             INTEGER,
    content_encrypted     TEXT,
    channel_encrypted     TEXT NOT NULL,
    role_encrypted        TEXT NOT NULL DEFAULT 'user',
    direction_encrypted   TEXT,
    metadata              JSONB,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id               INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tokens_used           INTEGER DEFAULT 0,
    is_processed          BOOLEAN DEFAULT false,
    role                  VARCHAR(20) NOT NULL DEFAULT 'user',
    attachment_filename   TEXT,
    attachment_mimetype   TEXT,
    attachment_size       BIGINT,
    attachment_data       BYTEA,
    direction             VARCHAR(8),
    message_type          VARCHAR(20) DEFAULT 'public'
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `conversation_id` - INTEGER REFERENCES conversations(id)
- `sender_type_encrypted` - TEXT NOT NULL (зашифрованное)
- `sender_id` - INTEGER
- `content_encrypted` - TEXT (зашифрованное)
- `channel_encrypted` - TEXT NOT NULL (зашифрованное)
- `role_encrypted` - TEXT NOT NULL DEFAULT 'user' (зашифрованное)
- `direction_encrypted` - TEXT (зашифрованное)
- `metadata` - JSONB
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `user_id` - INTEGER REFERENCES users(id)
- `tokens_used` - INTEGER DEFAULT 0
- `is_processed` - BOOLEAN DEFAULT false
- `role` - VARCHAR(20) NOT NULL DEFAULT 'user' (НЕ зашифрованное!)
- `attachment_filename` - TEXT
- `attachment_mimetype` - TEXT
- `attachment_size` - BIGINT
- `attachment_data` - BYTEA
- `direction` - VARCHAR(8) (НЕ зашифрованное!)
- `message_type` - VARCHAR(20) DEFAULT 'public'

**Триггеры:**
- `trg_set_message_user_id` - автоматически устанавливает user_id

## Таблица `conversation_participants`
```sql
CREATE TABLE conversation_participants (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(conversation_id, user_id)
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `conversation_id` - INTEGER REFERENCES conversations(id)
- `user_id` - INTEGER REFERENCES users(id)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Индексы:**
- PRIMARY KEY на `id`
- UNIQUE CONSTRAINT на `(conversation_id, user_id)`
- Индекс на `conversation_id`
- Индекс на `user_id`

## Таблица `admin_read_messages`
```sql
CREATE TABLE admin_read_messages (
    admin_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP NOT NULL,
    PRIMARY KEY (admin_id, user_id)
);
```

**Колонки:**
- `admin_id` - INTEGER NOT NULL REFERENCES users(id) (админ)
- `user_id` - INTEGER NOT NULL REFERENCES users(id) (пользователь)
- `last_read_at` - TIMESTAMP NOT NULL (время последнего прочтения)

**Индексы:**
- PRIMARY KEY на `(admin_id, user_id)`

## Таблица `admin_read_contacts`
```sql
CREATE TABLE admin_read_contacts (
    admin_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL,
    read_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (admin_id, contact_id)
);
```

**Колонки:**
- `admin_id` - INTEGER NOT NULL REFERENCES users(id) (админ)
- `contact_id` - TEXT NOT NULL (ID контакта)
- `read_at` - TIMESTAMP NOT NULL DEFAULT NOW() (время прочтения)

**Индексы:**
- PRIMARY KEY на `(admin_id, contact_id)`
- Индекс на `admin_id`
- Индекс на `contact_id`

## Таблица `user_identities`
```sql
CREATE TABLE user_identities (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER REFERENCES users(id) ON DELETE CASCADE,
    provider_encrypted    TEXT NOT NULL,
    provider_id_encrypted TEXT NOT NULL,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER REFERENCES users(id) (пользователь)
- `provider_encrypted` - TEXT NOT NULL (зашифрованный провайдер)
- `provider_id_encrypted` - TEXT NOT NULL (зашифрованный ID провайдера)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Индексы:**
- PRIMARY KEY на `id`
- Индекс на `user_id`

## Таблица `user_preferences`
```sql
CREATE TABLE user_preferences (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key   VARCHAR(50) NOT NULL,
    preference_value TEXT,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER NOT NULL REFERENCES users(id) (пользователь)
- `preference_key` - VARCHAR(50) NOT NULL (ключ настройки)
- `preference_value` - TEXT (значение настройки)
- `metadata` - JSONB DEFAULT '{}' (метаданные)
- `created_at` - TIMESTAMP NOT NULL DEFAULT NOW()
- `updated_at` - TIMESTAMP NOT NULL DEFAULT NOW()

**Индексы:**
- PRIMARY KEY на `id`
- Индекс на `user_id`
- UNIQUE CONSTRAINT на `(user_id, preference_key)`

## Таблица `user_tag_links`
```sql
CREATE TABLE user_tag_links (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES user_rows(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tag_id)
);
```

**Колонки:**
- `id` - SERIAL PRIMARY KEY
- `user_id` - INTEGER NOT NULL REFERENCES users(id) (пользователь)
- `tag_id` - INTEGER NOT NULL REFERENCES user_rows(id) (тег)
- `created_at` - TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Индексы:**
- PRIMARY KEY на `id`
- Индекс на `user_id`
- Индекс на `tag_id`
- UNIQUE CONSTRAINT на `(user_id, tag_id)`

## Анализ проблем в коде

Теперь, имея полную схему базы данных, давайте проверим код на соответствие:
