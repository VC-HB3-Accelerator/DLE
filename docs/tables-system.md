# Система электронных таблиц в DLE  

> **Временный документ для внутреннего анализа**

---

## 📋 Содержание

1. [Обзор системы](#обзор-системы)
2. [Архитектура базы данных](#архитектура-базы-данных)
3. [Типы полей](#типы-полей)
4. [Функциональные возможности](#функциональные-возможности)
5. [Связи между таблицами](#связи-между-таблицами)
6. [Интеграция с AI (RAG)](#интеграция-с-ai-rag)
7. [API Reference](#api-reference)
8. [Примеры использования](#примеры-использования)
9. [Безопасность](#безопасность)

---

## Обзор системы

### Что это?

Система электронных таблиц в DLE — это **полнофункциональная база данных с графическим интерфейсом**, аналог **Notion Database** или **Airtable**, встроенный в приложение.

### Ключевые особенности

```
┌─────────────────────────────────────────────────────────┐
│           Электронные таблицы DLE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ 6 типов полей (text, number, relation, lookup, etc.)│
│  ✅ Связи между таблицами (1:1, 1:N, N:N)              │
│  ✅ Lookup и подстановка данных                         │
│  ✅ Фильтрация и сортировка                             │
│  ✅ Real-time обновления (WebSocket)                    │
│  ✅ Интеграция с AI (RAG для поиска)                    │
│  ✅ Шифрование всех данных (AES-256)                    │
│  ✅ Плейсхолдеры для API доступа                        │
│  ✅ Каскадное удаление                                  │
│  ✅ Массовые операции                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Отличия от Excel/Google Sheets

| Функция | Excel/Sheets | DLE Tables |
|---------|--------------|------------|
| **Типизация данных** | Слабая | Строгая (6 типов) |
| **Связи между таблицами** | Нет | Да (relation, lookup) |
| **AI поиск** | Нет | Да (RAG, векторный поиск) |
| **Real-time обновления** | Частичная | Полная (WebSocket) |
| **Шифрование** | Нет | AES-256 для всех данных |
| **API доступ** | Ограниченный | Полный REST API |
| **Права доступа** | Базовые | Детальные (по ролям) |

---

## Архитектура базы данных

### Схема таблиц (PostgreSQL)

```sql
┌──────────────────────────────────────────────────────────┐
│                    user_tables                           │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ name_encrypted        TEXT NOT NULL                      │
│ description_encrypted TEXT                               │
│ is_rag_source_id      INTEGER (ссылка на is_rag_source) │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│                    user_columns                          │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ table_id              INTEGER → user_tables(id)          │
│ name_encrypted        TEXT NOT NULL                      │
│ type_encrypted        TEXT NOT NULL                      │
│ placeholder_encrypted TEXT (для API)                     │
│ placeholder           TEXT (незашифрованный)             │
│ options               JSONB (настройки)                  │
│ order                 INTEGER (порядок отображения)      │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│                     user_rows                            │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ table_id              INTEGER → user_tables(id)          │
│ order                 INTEGER (порядок строк)            │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│                  user_cell_values                        │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ row_id                INTEGER → user_rows(id)            │
│ column_id             INTEGER → user_columns(id)         │
│ value_encrypted       TEXT (зашифрованное значение)      │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
│ UNIQUE(row_id, column_id)  ← Одна ячейка = одно значение│
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│               user_table_relations                       │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ from_row_id           INTEGER → user_rows(id)            │
│ column_id             INTEGER → user_columns(id)         │
│ to_table_id           INTEGER → user_tables(id)          │
│ to_row_id             INTEGER → user_rows(id)            │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
└──────────────────────────────────────────────────────────┘
```

### Каскадное удаление

```
Удаление таблицы (user_tables)
  ↓
  ├── Удаляет все столбцы (user_columns)
  ├── Удаляет все строки (user_rows)
  │   └── Удаляет все значения ячеек (user_cell_values)
  └── Удаляет все связи (user_table_relations)
```

**Важно**: Используется `ON DELETE CASCADE` для автоматической очистки.

### Индексы для производительности

```sql
-- Индексы на связях (user_table_relations)
CREATE INDEX idx_user_table_relations_from_row ON user_table_relations(from_row_id);
CREATE INDEX idx_user_table_relations_column ON user_table_relations(column_id);
CREATE INDEX idx_user_table_relations_to_table ON user_table_relations(to_table_id);
CREATE INDEX idx_user_table_relations_to_row ON user_table_relations(to_row_id);
```

**Эффект**: Быстрая фильтрация и поиск по связанным таблицам.

---

## Типы полей

### 1. Text (Текст)

**Описание**: Обычное текстовое поле

```json
{
  "type": "text",
  "options": null
}
```

**Использование**:
- Имена
- Описания
- Email
- URL
- Любой текст

### 2. Number (Число)

**Описание**: Числовое поле

```json
{
  "type": "number",
  "options": null
}
```

**Использование**:
- Цены
- Количество
- Рейтинги
- Проценты

### 3. Multiselect (Множественный выбор)

**Описание**: Выбор нескольких значений из списка

```json
{
  "type": "multiselect",
  "options": {
    "choices": ["Вариант 1", "Вариант 2", "Вариант 3"]
  }
}
```

**Использование**:
- Теги
- Категории
- Статусы
- Навыки

### 4. Multiselect-Relation (Мультивыбор из таблицы)

**Описание**: Множественный выбор строк из другой таблицы

```json
{
  "type": "multiselect-relation",
  "options": {
    "relatedTableId": 5,
    "relatedColumnId": 12
  }
}
```

**Использование**:
- Связь Контактов → Теги (N:N)
- Связь Задач → Исполнители (N:N)
- Связь Продуктов → Категории (N:N)

**Хранение**: В таблице `user_table_relations` создается несколько записей:
```
from_row_id=100, column_id=3, to_table_id=5, to_row_id=20
from_row_id=100, column_id=3, to_table_id=5, to_row_id=21
from_row_id=100, column_id=3, to_table_id=5, to_row_id=22
```

### 5. Relation (Связь)

**Описание**: Связь с одной строкой из другой таблицы (1:1 или 1:N)

```json
{
  "type": "relation",
  "options": {
    "relatedTableId": 3,
    "relatedColumnId": 8
  }
}
```

**Использование**:
- Задача → Проект (N:1)
- Контакт → Компания (N:1)
- Заказ → Клиент (N:1)

**Хранение**: В `user_table_relations` создается одна запись:
```
from_row_id=50, column_id=2, to_table_id=3, to_row_id=15
```

### 6. Lookup (Подстановка)

**Описание**: Автоматическая подстановка значения из связанной таблицы

```json
{
  "type": "lookup",
  "options": {
    "relatedTableId": 4,
    "relatedColumnId": 10,
    "lookupColumnId": 11  // Какое поле подставлять
  }
}
```

**Пример**:
```
Таблица "Заказы"
├── order_id (text)
├── product (relation → Продукты)
└── product_price (lookup → Продукты.price)

Когда выбираешь product, автоматически подставляется цена!
```

**Использование**:
- Цены из справочника
- Email из контактов
- Статусы из связанных задач

---

## Функциональные возможности

### 1. CRUD операции

#### Создание таблицы

```javascript
// Frontend
await tablesService.createTable({
  name: "Контакты",
  description: "База клиентов",
  isRagSourceId: 2  // Источник для AI
});

// Backend: POST /tables
// Шифрует name и description с AES-256
```

#### Добавление столбца

```javascript
await tablesService.addColumn(tableId, {
  name: "Email",
  type: "text",
  order: 2,
  purpose: "contact"  // Для специальных полей
});

// Backend: POST /tables/:id/columns
// Генерирует уникальный placeholder: "email", "email_1", ...
```

#### Добавление строки

```javascript
await tablesService.addRow(tableId);

// Backend: POST /tables/:id/rows
// Автоматически индексирует в vector store для AI
```

#### Обновление ячейки (Upsert)

```javascript
await tablesService.saveCell({
  row_id: 123,
  column_id: 5,
  value: "new@email.com"
});

// Backend: POST /tables/cell
// INSERT ... ON CONFLICT ... DO UPDATE
// Автоматически обновляет vector store
```

#### Удаление строки

```javascript
await tablesService.deleteRow(rowId);

// Backend: DELETE /tables/row/:rowId
// Пересобирает vector store (rebuild)
```

#### Удаление столбца

```javascript
await tablesService.deleteColumn(columnId);

// Backend: DELETE /tables/column/:columnId
// Каскадно удаляет:
// 1. Все связи (user_table_relations)
// 2. Все значения ячеек (user_cell_values)
// 3. Сам столбец
```

#### Удаление таблицы

```javascript
await tablesService.deleteTable(tableId);

// Backend: DELETE /tables/:id
// Требуется: req.session.userAccessLevel?.hasAccess
// Каскадно удаляет все связанные данные
```

### 2. Фильтрация данных

#### По продукту

```javascript
GET /tables/5/rows?product=Premium

// Backend фильтрует строки:
filtered = rows.filter(r => r.product === 'Premium');
```

#### По тегам

```javascript
GET /tables/5/rows?tags=VIP,B2B

// Backend фильтрует строки с любым из тегов:
filtered = rows.filter(r => 
  r.userTags.includes('VIP') || r.userTags.includes('B2B')
);
```

#### По связям (Relation)

```javascript
GET /tables/5/rows?relation_12=45,46

// Фильтр строк, связанных с to_row_id = 45 или 46
// через столбец column_id = 12
```

#### По мультивыбору (Multiselect)

```javascript
GET /tables/5/rows?multiselect_8=10,11,12

// Все выбранные значения должны присутствовать
```

### 3. Placeholder система

**Автоматическая генерация**:

```javascript
// Функция: generatePlaceholder(name, existingPlaceholders)

"Имя клиента"     → "imya_klienta"
"Email"           → "email"
"Email" (2-й раз) → "email_1"
"123"             → "column"  (fallback)
"Цена-$"          → "tsena"
```

**Транслитерация**:
```javascript
const cyrillicToLatinMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
  е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  // ... полная карта
};
```

**Использование**:
```javascript
// API доступ к данным через placeholder
GET /tables/5/data?fields=email,phone,imya_klienta
```

### 4. Порядок строк (Order)

```javascript
// Изменение порядка строк (drag-n-drop)
await tablesService.updateRowsOrder(tableId, [
  { rowId: 100, order: 0 },
  { rowId: 101, order: 1 },
  { rowId: 102, order: 2 }
]);

// Backend: PATCH /tables/:id/rows/order
// Обновляет поле "order" для каждой строки
```

### 5. Real-time обновления (WebSocket)

```javascript
// Backend отправляет уведомления при изменениях
broadcastTableUpdate(tableId);           // Обновление таблицы
broadcastTableRelationsUpdate();         // Обновление связей
broadcastTagsUpdate(null, rowId);        // Обновление тегов

// Frontend подписывается на события
socket.on('table-update', (data) => {
  if (data.tableId === currentTableId) {
    reloadTableData();
  }
});
```

### 6. Массовые операции

```javascript
// Выбор нескольких строк (checkbox)
const selectedRows = [100, 101, 102];

// Массовое удаление
for (const rowId of selectedRows) {
  await tablesService.deleteRow(rowId);
}

// После удаления: автоматический rebuild vector store
```

---

## Связи между таблицами

### Типы связей

#### 1. One-to-Many (N:1) - Relation

**Пример**: Задачи → Проекты

```
Таблица "Задачи"                 Таблица "Проекты"
├── task_1 → project_id=5        ├── project_5 (Сайт)
├── task_2 → project_id=5        └── project_6 (API)
└── task_3 → project_id=6
```

**Хранение**:
```sql
user_table_relations
├── from_row_id=task_1, column_id=3, to_table_id=2, to_row_id=project_5
├── from_row_id=task_2, column_id=3, to_table_id=2, to_row_id=project_5
└── from_row_id=task_3, column_id=3, to_table_id=2, to_row_id=project_6
```

#### 2. Many-to-Many (N:N) - Multiselect-Relation

**Пример**: Контакты → Теги

```
Таблица "Контакты"              Таблица "Теги"
├── contact_1 → [VIP, B2B]      ├── tag_1 (VIP)
├── contact_2 → [VIP]           ├── tag_2 (B2B)
└── contact_3 → [B2B, Local]    └── tag_3 (Local)
```

**Хранение**:
```sql
user_table_relations
├── from_row_id=contact_1, column_id=5, to_table_id=3, to_row_id=tag_1
├── from_row_id=contact_1, column_id=5, to_table_id=3, to_row_id=tag_2
├── from_row_id=contact_2, column_id=5, to_table_id=3, to_row_id=tag_1
├── from_row_id=contact_3, column_id=5, to_table_id=3, to_row_id=tag_2
└── from_row_id=contact_3, column_id=5, to_table_id=3, to_row_id=tag_3
```

#### 3. Lookup (Подстановка)

**Пример**: Заказы → Цена товара

```
Таблица "Заказы"
├── order_id (text)
├── product (relation → Товары)
└── price (lookup → Товары.price)

Таблица "Товары"
├── product_name (text)
└── price (number)
```

**Как работает**:
1. Выбираете `product = "Ноутбук"` (связь с товаром)
2. `price` автоматически подставляется из `Товары.price`
3. Если цена товара изменится, lookup обновится

### API для работы со связями

```javascript
// Получить все связи строки
GET /tables/:tableId/row/:rowId/relations

// Добавить связь
POST /tables/:tableId/row/:rowId/relations
Body: {
  column_id: 12,
  to_table_id: 5,
  to_row_id: 45
}

// Добавить несколько связей (multiselect)
POST /tables/:tableId/row/:rowId/relations
Body: {
  column_id: 12,
  to_table_id: 5,
  to_row_ids: [45, 46, 47]
}

// Удалить связь
DELETE /tables/:tableId/row/:rowId/relations/:relationId
```

---

## Интеграция с AI (RAG)

### Векторный поиск

Таблицы используются как **база знаний для AI ассистента**.

#### Автоматическая индексация

**При создании/изменении строки**:

```javascript
// Backend: POST /tables/:id/rows
const rows = await getTableRows(tableId);
const upsertRows = rows
  .filter(r => r.row_id && r.text)
  .map(r => ({
    row_id: r.row_id,
    text: r.text,              // Вопрос (question column)
    metadata: { 
      answer: r.answer,         // Ответ (answer column)
      product: r.product,       // Фильтр по продукту
      userTags: r.userTags,     // Фильтр по тегам
      priority: r.priority      // Приоритет
    }
  }));

if (upsertRows.length > 0) {
  await vectorSearchClient.upsert(tableId, upsertRows);
}
```

**При удалении строки**:

```javascript
// Backend: DELETE /tables/row/:rowId
const rows = await getTableRows(tableId);
const rebuildRows = /* ... */;

if (rebuildRows.length > 0) {
  await vectorSearchClient.rebuild(tableId, rebuildRows);
}
```

#### Специальные поля для RAG

```javascript
// Столбцы с purpose
{
  "type": "text",
  "options": {
    "purpose": "question"  // Вопрос для AI
  }
}

{
  "type": "text",
  "options": {
    "purpose": "answer"  // Ответ AI
  }
}

{
  "type": "multiselect",
  "options": {
    "purpose": "product"  // Фильтр по продукту
  }
}

{
  "type": "multiselect",
  "options": {
    "purpose": "userTags"  // Фильтр по тегам
  }
}
```

#### Ручная пересборка индекса

```javascript
// Frontend (только для админов)
await tablesService.rebuildIndex(tableId);

// Backend: POST /tables/:id/rebuild-index
// Требуется: req.session.userAccessLevel?.hasAccess
const { questionCol, answerCol } = await getQuestionAnswerColumnIds(tableId);
const rows = await getRowsWithQA(tableId, questionCol, answerCol);

if (rows.length > 0) {
  await vectorSearchClient.rebuild(tableId, rows);
}
```

#### Как AI использует таблицы

```
1. Пользователь задает вопрос AI:
   "Как вернуть товар?"

2. AI делает векторный поиск:
   vectorSearch.search(tableId, query, top_k=3)

3. Находит похожие вопросы в таблице:
   - row_id: 123
   - text: "Как оформить возврат товара?"
   - score: -250 (близко к порогу 300)
   - metadata: { answer: "Возврат в течение 14 дней..." }

4. AI возвращает ответ из metadata.answer

5. Если не нашел (score > 300):
   AI генерирует ответ через LLM (Ollama)
```

#### Фильтрация по продуктам и тегам

```javascript
// Поиск только по продукту "Premium"
const results = await vectorSearch.search(tableId, query, 3);
const filtered = results.filter(r => r.metadata.product === 'Premium');

// Поиск только по тегам "VIP" или "B2B"
const filtered = results.filter(r => 
  r.metadata.userTags.includes('VIP') || 
  r.metadata.userTags.includes('B2B')
);
```

---

## API Reference

### Таблицы

#### GET /tables

Получить список всех таблиц

**Ответ**:
```json
[
  {
    "id": 1,
    "name": "Контакты",
    "description": "База клиентов",
    "is_rag_source_id": 2,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

#### POST /tables

Создать новую таблицу

**Запрос**:
```json
{
  "name": "Контакты",
  "description": "База клиентов",
  "isRagSourceId": 2
}
```

**Ответ**: Объект созданной таблицы

#### GET /tables/:id

Получить структуру и данные таблицы

**Ответ**:
```json
{
  "name": "Контакты",
  "description": "База клиентов",
  "columns": [
    {
      "id": 1,
      "table_id": 1,
      "name": "Email",
      "type": "text",
      "placeholder": "email",
      "options": null,
      "order": 0
    }
  ],
  "rows": [
    {
      "id": 100,
      "table_id": 1,
      "order": 0,
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "cellValues": [
    {
      "id": 500,
      "row_id": 100,
      "column_id": 1,
      "value": "user@example.com"
    }
  ]
}
```

#### PATCH /tables/:id

Обновить метаданные таблицы

**Запрос**:
```json
{
  "name": "Клиенты",
  "description": "Обновленное описание"
}
```

#### DELETE /tables/:id

Удалить таблицу (только для админов)

**Требования**: `req.session.userAccessLevel?.hasAccess === true`

### Столбцы

#### POST /tables/:id/columns

Добавить столбец

**Запрос**:
```json
{
  "name": "Email",
  "type": "text",
  "order": 2,
  "purpose": "contact"
}
```

#### PATCH /tables/column/:columnId

Обновить столбец

**Запрос**:
```json
{
  "name": "Новое название",
  "type": "text",
  "order": 5
}
```

#### DELETE /tables/column/:columnId

Удалить столбец (каскадное удаление всех значений)

### Строки

#### POST /tables/:id/rows

Добавить строку

**Ответ**: Объект созданной строки

#### DELETE /tables/row/:rowId

Удалить строку

#### PATCH /tables/:id/rows/order

Изменить порядок строк

**Запрос**:
```json
{
  "order": [
    { "rowId": 100, "order": 0 },
    { "rowId": 101, "order": 1 }
  ]
}
```

### Ячейки

#### POST /tables/cell

Создать или обновить значение ячейки (upsert)

**Запрос**:
```json
{
  "row_id": 100,
  "column_id": 5,
  "value": "new@email.com"
}
```

**Логика**:
```sql
INSERT INTO user_cell_values (row_id, column_id, value_encrypted) 
VALUES ($1, $2, encrypt_text($3, $4))
ON CONFLICT (row_id, column_id) 
DO UPDATE SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()
```

### Фильтрация

#### GET /tables/:id/rows

Получить отфильтрованные строки

**Параметры**:
```
?product=Premium               // Фильтр по продукту
&tags=VIP,B2B                  // Фильтр по тегам
&relation_12=45,46             // Фильтр по связи (column_id=12)
&multiselect_8=10,11           // Фильтр по мультивыбору (column_id=8)
&lookup_15=100                 // Фильтр по lookup (column_id=15)
```

### RAG индекс

#### POST /tables/:id/rebuild-index

Пересобрать векторный индекс (только для админов)

**Требования**: `req.session.userAccessLevel?.hasAccess === true`

**Ответ**:
```json
{
  "success": true,
  "count": 150
}
```

### Связи

#### GET /tables/:tableId/row/:rowId/relations

Получить все связи строки

**Ответ**:
```json
[
  {
    "id": 1000,
    "from_row_id": 100,
    "column_id": 12,
    "to_table_id": 5,
    "to_row_id": 45
  }
]
```

#### POST /tables/:tableId/row/:rowId/relations

Добавить связь или связи

**Одна связь**:
```json
{
  "column_id": 12,
  "to_table_id": 5,
  "to_row_id": 45
}
```

**Несколько связей** (multiselect):
```json
{
  "column_id": 12,
  "to_table_id": 5,
  "to_row_ids": [45, 46, 47]
}
```

**Логика**:
- Удаляет старые связи для column_id
- Добавляет новые связи

#### DELETE /tables/:tableId/row/:rowId/relations/:relationId

Удалить связь

### Плейсхолдеры

#### GET /tables/:id/placeholders

Получить плейсхолдеры для столбцов таблицы

**Ответ**:
```json
[
  {
    "id": 1,
    "name": "Email",
    "placeholder": "email"
  },
  {
    "id": 2,
    "name": "Имя клиента",
    "placeholder": "imya_klienta"
  }
]
```

#### GET /tables/placeholders/all

Получить все плейсхолдеры по всем таблицам

**Ответ**:
```json
[
  {
    "column_id": 1,
    "column_name": "Email",
    "placeholder": "email",
    "table_id": 1,
    "table_name": "Контакты"
  }
]
```

---

## Примеры использования

### Пример 1: База знаний FAQ для AI

#### Создание таблицы

```javascript
const table = await tablesService.createTable({
  name: "FAQ",
  description: "Часто задаваемые вопросы для AI",
  isRagSourceId: 2  // RAG источник
});
```

#### Добавление столбцов

```javascript
// Вопрос (для векторного поиска)
await tablesService.addColumn(table.id, {
  name: "Вопрос",
  type: "text",
  order: 0,
  purpose: "question"
});

// Ответ (для AI)
await tablesService.addColumn(table.id, {
  name: "Ответ",
  type: "text",
  order: 1,
  purpose: "answer"
});

// Продукт (для фильтрации)
await tablesService.addColumn(table.id, {
  name: "Продукт",
  type: "multiselect",
  order: 2,
  purpose: "product",
  options: {
    choices: ["Базовый", "Премиум", "Корпоративный"]
  }
});

// Теги (для фильтрации)
await tablesService.addColumn(table.id, {
  name: "Теги",
  type: "multiselect",
  order: 3,
  purpose: "userTags",
  options: {
    choices: ["Оплата", "Доставка", "Возврат", "Гарантия"]
  }
});
```

#### Добавление данных

```javascript
// Добавляем строку
const row = await tablesService.addRow(table.id);

// Заполняем ячейки
await tablesService.saveCell({
  row_id: row.id,
  column_id: 1,  // Вопрос
  value: "Как вернуть товар?"
});

await tablesService.saveCell({
  row_id: row.id,
  column_id: 2,  // Ответ
  value: "Возврат товара возможен в течение 14 дней с момента покупки..."
});

// Автоматически индексируется в vector store!
```

#### Поиск через AI

```javascript
// Пользователь спрашивает AI
const userQuestion = "можно ли вернуть покупку?";

// AI делает векторный поиск
const results = await vectorSearch.search(table.id, userQuestion, 3);

// Находит похожий вопрос "Как вернуть товар?" (score: -200)
// Возвращает ответ из metadata.answer
```

### Пример 2: CRM система

#### Структура

```javascript
// Таблица "Компании"
const companies = await tablesService.createTable({
  name: "Компании",
  description: "База компаний"
});

await tablesService.addColumn(companies.id, {
  name: "Название",
  type: "text",
  order: 0
});

await tablesService.addColumn(companies.id, {
  name: "Сайт",
  type: "text",
  order: 1
});

await tablesService.addColumn(companies.id, {
  name: "Отрасль",
  type: "multiselect",
  order: 2,
  options: { choices: ["IT", "Финансы", "Ритейл", "Производство"] }
});

// Таблица "Контакты"
const contacts = await tablesService.createTable({
  name: "Контакты",
  description: "База контактов"
});

await tablesService.addColumn(contacts.id, {
  name: "Имя",
  type: "text",
  order: 0
});

await tablesService.addColumn(contacts.id, {
  name: "Email",
  type: "text",
  order: 1
});

// Связь: Контакт → Компания
await tablesService.addColumn(contacts.id, {
  name: "Компания",
  type: "relation",
  order: 2,
  options: {
    relatedTableId: companies.id,
    relatedColumnId: 1  // Название компании
  }
});

// Lookup: Сайт компании
await tablesService.addColumn(contacts.id, {
  name: "Сайт компании",
  type: "lookup",
  order: 3,
  options: {
    relatedTableId: companies.id,
    relatedColumnId: 2,  // Связь через "Компания"
    lookupColumnId: 2    // Подставить "Сайт"
  }
});
```

#### Использование

```javascript
// Добавляем компанию
const company = await tablesService.addRow(companies.id);
await tablesService.saveCell({
  row_id: company.id,
  column_id: 1,
  value: "Microsoft"
});
await tablesService.saveCell({
  row_id: company.id,
  column_id: 2,
  value: "https://microsoft.com"
});

// Добавляем контакт
const contact = await tablesService.addRow(contacts.id);
await tablesService.saveCell({
  row_id: contact.id,
  column_id: 1,
  value: "John Doe"
});

// Связываем контакт с компанией
await api.post(`/tables/${contacts.id}/row/${contact.id}/relations`, {
  column_id: 3,  // "Компания"
  to_table_id: companies.id,
  to_row_id: company.id
});

// Lookup автоматически подставит "https://microsoft.com"!
```

### Пример 3: Управление задачами

#### Структура

```javascript
// Таблица "Проекты"
const projects = await tablesService.createTable({
  name: "Проекты",
  description: "Активные проекты"
});

await tablesService.addColumn(projects.id, {
  name: "Название",
  type: "text",
  order: 0
});

await tablesService.addColumn(projects.id, {
  name: "Статус",
  type: "multiselect",
  order: 1,
  options: { choices: ["Планирование", "В работе", "Завершен"] }
});

// Таблица "Задачи"
const tasks = await tablesService.createTable({
  name: "Задачи",
  description: "Задачи по проектам"
});

await tablesService.addColumn(tasks.id, {
  name: "Название",
  type: "text",
  order: 0
});

await tablesService.addColumn(tasks.id, {
  name: "Проект",
  type: "relation",
  order: 1,
  options: {
    relatedTableId: projects.id,
    relatedColumnId: 1
  }
});

await tablesService.addColumn(tasks.id, {
  name: "Приоритет",
  type: "number",
  order: 2
});

await tablesService.addColumn(tasks.id, {
  name: "Статус",
  type: "multiselect",
  order: 3,
  options: { choices: ["To Do", "In Progress", "Review", "Done"] }
});
```

#### Фильтрация задач по проекту

```javascript
// Получить все задачи проекта с ID = 5
const tasks = await api.get(`/tables/${tasks.id}/rows?relation_2=5`);

// Получить задачи с приоритетом > 5
const highPriority = tasks.filter(task => {
  const priority = cellValues.find(
    cell => cell.row_id === task.id && cell.column_id === 3
  )?.value;
  return parseInt(priority) > 5;
});
```

---

## Безопасность

### Шифрование данных

**Все чувствительные данные шифруются AES-256**:

```javascript
// Шифруются:
name_encrypted          // Название таблицы
description_encrypted   // Описание
value_encrypted         // Значения ячеек
placeholder_encrypted   // Плейсхолдеры

// НЕ шифруются (для индексов и производительности):
placeholder             // Незашифрованный плейсхолдер
options                 // JSONB настройки
order                   // Порядок
```

**Функции шифрования в PostgreSQL**:

```sql
-- Шифрование
encrypt_text(plain_text, encryption_key)

-- Расшифровка
decrypt_text(encrypted_text, encryption_key)

-- Пример использования
INSERT INTO user_tables (name_encrypted) 
VALUES (encrypt_text('Контакты', $1));

SELECT decrypt_text(name_encrypted, $1) as name 
FROM user_tables;
```

### Права доступа

```javascript
// Просмотр: все авторизованные пользователи
GET /tables
GET /tables/:id
GET /tables/:id/rows

// Редактирование: пользователи с правами
if (!canEditData) {
  return res.status(403).json({ error: 'Доступ запрещен' });
}
POST /tables/:id/columns
POST /tables/:id/rows
POST /tables/cell
PATCH /tables/column/:columnId

// Удаление: только администраторы
if (!req.session.userAccessLevel?.hasAccess) {
  return res.status(403).json({ error: 'Только для администраторов' });
}
DELETE /tables/:id
DELETE /tables/column/:columnId
DELETE /tables/row/:rowId
POST /tables/:id/rebuild-index
```

### Проверка прав через токены

```javascript
// Backend проверяет баланс токенов
const address = req.session.address;
const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
const balance = await dleContract.balanceOf(address);

if (balance === 0n) {
  return res.status(403).json({ 
    error: 'Доступ запрещен: нет токенов' 
  });
}

// Определяем уровень доступа
const accessLevel = determineAccessLevel(balance);
req.session.userAccessLevel = accessLevel;
```

### Защита от SQL-инъекций

**Параметризованные запросы**:

```javascript
// ✅ Безопасно (параметры)
await db.getQuery()(
  'SELECT * FROM user_tables WHERE id = $1',
  [tableId]
);

// ❌ ОПАСНО (конкатенация)
await db.getQuery()(
  `SELECT * FROM user_tables WHERE id = ${tableId}`
);
```

### Валидация входных данных

```javascript
// Проверка типов
if (typeof name !== 'string') {
  return res.status(400).json({ error: 'Invalid name' });
}

// Проверка существования
const exists = await db.getQuery()(
  'SELECT id FROM user_tables WHERE id = $1',
  [tableId]
);
if (!exists.rows[0]) {
  return res.status(404).json({ error: 'Table not found' });
}

// Проверка уникальности (placeholder)
const duplicate = await db.getQuery()(
  'SELECT id FROM user_columns WHERE placeholder = $1 AND id != $2',
  [placeholder, columnId]
);
if (duplicate.rows.length > 0) {
  placeholder = generateUniquePlaceholder();
}
```

### Каскадное удаление (защита от orphaned data)

```sql
-- Все связи с ON DELETE CASCADE
CREATE TABLE user_columns (
  table_id INTEGER NOT NULL 
    REFERENCES user_tables(id) ON DELETE CASCADE
);

CREATE TABLE user_rows (
  table_id INTEGER NOT NULL 
    REFERENCES user_tables(id) ON DELETE CASCADE
);

CREATE TABLE user_cell_values (
  row_id INTEGER NOT NULL 
    REFERENCES user_rows(id) ON DELETE CASCADE,
  column_id INTEGER NOT NULL 
    REFERENCES user_columns(id) ON DELETE CASCADE
);

-- Результат: удаление таблицы автоматически удаляет ВСЁ
```

### Rate Limiting

```javascript
// В backend/routes/tables.js можно добавить
const rateLimit = require('express-rate-limit');

const tablesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 минут
  max: 100,                   // 100 запросов
  message: 'Слишком много запросов к таблицам'
});

router.use(tablesLimiter);
```

---

## Производительность

### Оптимизации

#### 1. Параллельные запросы

```javascript
// Вместо последовательных запросов:
const tableMeta = await db.query('SELECT ...');
const columns = await db.query('SELECT ...');
const rows = await db.query('SELECT ...');
const cellValues = await db.query('SELECT ...');

// Используются параллельные:
const [tableMeta, columns, rows, cellValues] = await Promise.all([
  db.query('SELECT ...'),
  db.query('SELECT ...'),
  db.query('SELECT ...'),
  db.query('SELECT ...')
]);

// Ускорение: 4x
```

#### 2. Индексы на связях

```sql
CREATE INDEX idx_user_table_relations_from_row 
  ON user_table_relations(from_row_id);
  
CREATE INDEX idx_user_table_relations_to_table 
  ON user_table_relations(to_table_id);
  
-- Результат: быстрая фильтрация по связям
```

#### 3. UNIQUE constraint

```sql
CREATE TABLE user_cell_values (
  ...
  UNIQUE(row_id, column_id)
);

-- Преимущества:
-- 1. Предотвращает дубликаты ячеек
-- 2. Ускоряет upsert (ON CONFLICT)
-- 3. Автоматический индекс
```

#### 4. WebSocket вместо polling

```javascript
// ❌ Polling (медленно)
setInterval(async () => {
  const data = await fetchTableData();
  updateUI(data);
}, 5000);

// ✅ WebSocket (мгновенно)
socket.on('table-update', (data) => {
  if (data.tableId === currentTableId) {
    updateUI(data);
  }
});

// Результат: real-time обновления, нет нагрузки на сервер
```

#### 5. Кэширование

```javascript
// Backend может добавить кэш для часто запрашиваемых таблиц
const NodeCache = require('node-cache');
const tableCache = new NodeCache({ stdTTL: 300 }); // 5 минут

router.get('/:id', async (req, res) => {
  const cacheKey = `table_${req.params.id}`;
  const cached = tableCache.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }
  
  const data = await fetchTableData(req.params.id);
  tableCache.set(cacheKey, data);
  res.json(data);
});
```

### Метрики

**Типичное время ответа**:
```
GET /tables           → 50-100ms   (все таблицы)
GET /tables/:id       → 150-300ms  (с данными, Promise.all)
POST /tables/cell     → 100-200ms  (upsert + vector update)
DELETE /tables/row/:id → 200-400ms (удаление + rebuild vector)
POST /tables/:id/rebuild-index → 1-5s (зависит от размера)
```

**Оптимальные размеры таблиц**:
```
Строк: до 10,000    → Отлично
Строк: 10,000-50,000 → Хорошо
Строк: >50,000       → Нужны доп. оптимизации (pagination, lazy load)
```

---

## Ограничения и будущие улучшения

### Текущие ограничения

1. **Нет пагинации**: Все строки загружаются сразу
   - Для больших таблиц (>1000 строк) может быть медленно

2. **Нет формул**: Нельзя делать вычисляемые поля
   - Workaround: использовать lookup

3. **Нет группировки**: Нельзя группировать строки
   - Workaround: фильтрация на frontend

4. **Нет истории изменений**: Не отслеживается, кто и когда изменил
   - Можно добавить audit trail

5. **Ограниченная сортировка**: Только через order поле
   - Нет сортировки по столбцам на backend

### Возможные улучшения

```javascript
// 1. Пагинация
GET /tables/:id/rows?page=1&limit=50

// 2. Сортировка
GET /tables/:id/rows?sort_by=column_id&order=asc

// 3. Формулы
{
  "type": "formula",
  "options": {
    "formula": "{{price}} * {{quantity}}"
  }
}

// 4. История изменений
CREATE TABLE user_cell_history (
  id SERIAL PRIMARY KEY,
  cell_id INTEGER REFERENCES user_cell_values(id),
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER,
  changed_at TIMESTAMP
);

// 5. Экспорт/импорт
POST /tables/:id/export → CSV/Excel
POST /tables/:id/import ← CSV/Excel

// 6. Шаблоны таблиц
POST /tables/templates/crm → Создать CRM из шаблона
POST /tables/templates/tasks → Создать Kanban из шаблона
```

---

## Заключение

Система электронных таблиц в DLE — это **мощный инструмент** для управления структурированными данными с:

✅ **Гибкой структурой** (6 типов полей)  
✅ **Связями между таблицами** (relation, lookup)  
✅ **AI интеграцией** (RAG, векторный поиск)  
✅ **Real-time обновлениями** (WebSocket)  
✅ **Безопасностью** (AES-256, права доступа)  
✅ **Производительностью** (индексы, параллельные запросы)  

Это **не просто Excel**, а **полноценная база данных** с удобным интерфейсом и AI ассистентом!

---

**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**

**Версия документа**: 1.0.0  
**Дата создания**: October 25, 2025  
**Статус**: Временный (для внутреннего использования)

