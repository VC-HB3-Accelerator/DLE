-- Таблица для Канбан-досок
CREATE TABLE IF NOT EXISTS kanban_boards (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для колонок Канбан-доски
CREATE TABLE IF NOT EXISTS kanban_columns (
  id SERIAL PRIMARY KEY,
  board_id INTEGER REFERENCES kanban_boards(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL,
  wip_limit INTEGER DEFAULT NULL, -- Лимит задач в работе (Work In Progress)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для карточек (задач) Канбан-доски
CREATE TABLE IF NOT EXISTS kanban_cards (
  id SERIAL PRIMARY KEY,
  column_id INTEGER REFERENCES kanban_columns(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  due_date TIMESTAMP,
  labels JSONB DEFAULT '[]',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для комментариев к карточкам
CREATE TABLE IF NOT EXISTS kanban_comments (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES kanban_cards(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица для доступа к доскам
CREATE TABLE IF NOT EXISTS kanban_board_access (
  id SERIAL PRIMARY KEY,
  board_id INTEGER REFERENCES kanban_boards(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  access_level VARCHAR(20) NOT NULL, -- 'read', 'write', 'admin'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(board_id, user_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_kanban_columns_board_id ON kanban_columns(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_cards_column_id ON kanban_cards(column_id);
CREATE INDEX IF NOT EXISTS idx_kanban_comments_card_id ON kanban_comments(card_id);
CREATE INDEX IF NOT EXISTS idx_kanban_board_access_board_id ON kanban_board_access(board_id);
CREATE INDEX IF NOT EXISTS idx_kanban_board_access_user_id ON kanban_board_access(user_id); 