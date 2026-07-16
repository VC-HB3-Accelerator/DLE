**English** | [Русский](../../docs.ru/back-docs/tables-system.md)

# Spreadsheet system in DLE  

> **Temporary document for internal analysis**

---

## 📋 Table of contents

1. [System overview](#system-overview)
2. [Database architecture](#database-architecture)
3. [Field types](#field-types)
4. [Features](#features)
5. [Relations between tables](#relations-between-tables)
6. [AI (RAG) integration](#ai-rag-integration)
7. [API Reference](#api-reference)
8. [Usage examples](#usage-examples)
9. [Security](#security)

---

## System overview

### What is it?

The spreadsheet system in DLE is a **full-featured database with a graphical interface**, similar to **Notion Database** or **Airtable**, built into the application.

### Key features

```
┌─────────────────────────────────────────────────────────┐
│           DLE Spreadsheets                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ 6 field types (text, number, relation, lookup, etc.)│
│  ✅ Relations between tables (1:1, 1:N, N:N)           │
│  ✅ Lookup and data substitution                        │
│  ✅ Filtering and sorting                               │
│  ✅ Real-time updates (WebSocket)                       │
│  ✅ AI integration (RAG for search)                     │
│  ✅ Encryption of all data (AES-256)                    │
│  ✅ Placeholders for API access                         │
│  ✅ Cascade delete                                      │
│  ✅ Bulk operations                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Differences from Excel/Google Sheets

| Feature | Excel/Sheets | DLE Tables |
|---------|--------------|------------|
| **Data typing** | Weak | Strict (6 types) |
| **Relations between tables** | No | Yes (relation, lookup) |
| **AI search** | No | Yes (RAG, vector search) |
| **Real-time updates** | Partial | Full (WebSocket) |
| **Encryption** | No | AES-256 for all data |
| **API access** | Limited | Full REST API |
| **Access rights** | Basic | Detailed (by roles) |

---

## Database architecture

### Table schema (PostgreSQL)

```sql
┌──────────────────────────────────────────────────────────┐
│                    user_tables                           │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ name_encrypted        TEXT NOT NULL                      │
│ description_encrypted TEXT                               │
│ is_rag_source_id      INTEGER (reference to is_rag_source) │
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
│ placeholder_encrypted TEXT (for API)                     │
│ placeholder           TEXT (unencrypted)                 │
│ options               JSONB (settings)                   │
│ order                 INTEGER (display order)            │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│                     user_rows                            │
├──────────────────────────────────────────────────────────┤
│ id                    SERIAL PRIMARY KEY                 │
│ table_id              INTEGER → user_tables(id)          │
│ order                 INTEGER (row order)                │
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
│ value_encrypted       TEXT (encrypted value)             │
│ created_at            TIMESTAMP                          │
│ updated_at            TIMESTAMP                          │
│ UNIQUE(row_id, column_id)  ← One cell = one value        │
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

### Cascade delete

```
Deleting a table (user_tables)
  ↓
  ├── Deletes all columns (user_columns)
  ├── Deletes all rows (user_rows)
  │   └── Deletes all cell values (user_cell_values)
  └── Deletes all relations (user_table_relations)
```

**Important**: `ON DELETE CASCADE` is used for automatic cleanup.

### Indexes for performance

```sql
-- Indexes on relations (user_table_relations)
CREATE INDEX idx_user_table_relations_from_row ON user_table_relations(from_row_id);
CREATE INDEX idx_user_table_relations_column ON user_table_relations(column_id);
CREATE INDEX idx_user_table_relations_to_table ON user_table_relations(to_table_id);
CREATE INDEX idx_user_table_relations_to_row ON user_table_relations(to_row_id);
```

**Effect**: Fast filtering and search across related tables.

---

## Field types

### 1. Text

**Description**: A regular text field

```json
{
  "type": "text",
  "options": null
}
```

**Usage**:
- Names
- Descriptions
- Email
- URL
- Any text

### 2. Number

**Description**: A numeric field

```json
{
  "type": "number",
  "options": null
}
```

**Usage**:
- Prices
- Quantities
- Ratings
- Percentages

### 3. Multiselect

**Description**: Select multiple values from a list

```json
{
  "type": "multiselect",
  "options": {
    "choices": ["Option 1", "Option 2", "Option 3"]
  }
}
```

**Usage**:
- Tags
- Categories
- Statuses
- Skills

### 4. Multiselect-Relation

**Description**: Multiple selection of rows from another table

```json
{
  "type": "multiselect-relation",
  "options": {
    "relatedTableId": 5,
    "relatedColumnId": 12
  }
}
```

**Usage**:
- Contacts → Tags relation (N:N)
- Tasks → Assignees relation (N:N)
- Products → Categories relation (N:N)

**Storage**: Several records are created in the `user_table_relations` table:
```
from_row_id=100, column_id=3, to_table_id=5, to_row_id=20
from_row_id=100, column_id=3, to_table_id=5, to_row_id=21
from_row_id=100, column_id=3, to_table_id=5, to_row_id=22
```

### 5. Relation

**Description**: Relation to one row from another table (1:1 or 1:N)

```json
{
  "type": "relation",
  "options": {
    "relatedTableId": 3,
    "relatedColumnId": 8
  }
}
```

**Usage**:
- Task → Project (N:1)
- Contact → Company (N:1)
- Order → Client (N:1)

**Storage**: One record is created in `user_table_relations`:
```
from_row_id=50, column_id=2, to_table_id=3, to_row_id=15
```

### 6. Lookup

**Description**: Automatic substitution of a value from a related table

```json
{
  "type": "lookup",
  "options": {
    "relatedTableId": 4,
    "relatedColumnId": 10,
    "lookupColumnId": 11  // Which field to pull
  }
}
```

**Example**:
```
Table "Orders"
├── order_id (text)
├── product (relation → Products)
└── product_price (lookup → Products.price)

When you select product, the price is filled in automatically!
```

**Usage**:
- Prices from a catalog
- Email from contacts
- Statuses from related tasks

---

## Features

### 1. CRUD operations

#### Creating a table

```javascript
// Frontend
await tablesService.createTable({
  name: "Contacts",
  description: "Client database",
  isRagSourceId: 2  // Source for AI
});

// Backend: POST /tables
// Encrypts name and description with AES-256
```

#### Adding a column

```javascript
await tablesService.addColumn(tableId, {
  name: "Email",
  type: "text",
  order: 2,
  purpose: "contact"  // For special fields
});

// Backend: POST /tables/:id/columns
// Generates a unique placeholder: "email", "email_1", ...
```

#### Adding a row

```javascript
await tablesService.addRow(tableId);

// Backend: POST /tables/:id/rows
// Automatically indexes in the vector store for AI
```

#### Updating a cell (Upsert)

```javascript
await tablesService.saveCell({
  row_id: 123,
  column_id: 5,
  value: "new@email.com"
});

// Backend: POST /tables/cell
// INSERT ... ON CONFLICT ... DO UPDATE
// Automatically updates the vector store
```

#### Deleting a row

```javascript
await tablesService.deleteRow(rowId);

// Backend: DELETE /tables/row/:rowId
// Rebuilds the vector store (rebuild)
```

#### Deleting a column

```javascript
await tablesService.deleteColumn(columnId);

// Backend: DELETE /tables/column/:columnId
// Cascades and deletes:
// 1. All relations (user_table_relations)
// 2. All cell values (user_cell_values)
// 3. The column itself
```

#### Deleting a table

```javascript
await tablesService.deleteTable(tableId);

// Backend: DELETE /tables/:id
// Required: req.session.userAccessLevel?.hasAccess
// Cascades and deletes all related data
```

### 2. Data filtering

#### By product

```javascript
GET /tables/5/rows?product=Premium

// Backend filters rows:
filtered = rows.filter(r => r.product === 'Premium');
```

#### By tags

```javascript
GET /tables/5/rows?tags=VIP,B2B

// Backend filters rows with any of the tags:
filtered = rows.filter(r => 
  r.userTags.includes('VIP') || r.userTags.includes('B2B')
);
```

#### By relations (Relation)

```javascript
GET /tables/5/rows?relation_12=45,46

// Filter rows related to to_row_id = 45 or 46
// via column column_id = 12
```

#### By multiselect (Multiselect)

```javascript
GET /tables/5/rows?multiselect_8=10,11,12

// All selected values must be present
```

### 3. Placeholder system

**Automatic generation**:

```javascript
// Function: generatePlaceholder(name, existingPlaceholders)

"Имя клиента"     → "imya_klienta"
"Email"           → "email"
"Email" (2nd time) → "email_1"
"123"             → "column"  (fallback)
"Цена-$"          → "tsena"
```

**Transliteration**:
```javascript
const cyrillicToLatinMap = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
  е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  // ... full map
};
```

**Usage**:
```javascript
// API access to data via placeholder
GET /tables/5/data?fields=email,phone,imya_klienta
```

### 4. Row order

```javascript
// Change row order (drag-n-drop)
await tablesService.updateRowsOrder(tableId, [
  { rowId: 100, order: 0 },
  { rowId: 101, order: 1 },
  { rowId: 102, order: 2 }
]);

// Backend: PATCH /tables/:id/rows/order
// Updates the "order" field for each row
```

### 5. Real-time updates (WebSocket)

```javascript
// Backend sends notifications on changes
broadcastTableUpdate(tableId);           // Table update
broadcastTableRelationsUpdate();         // Relations update
broadcastTagsUpdate(null, rowId);        // Tags update

// Frontend subscribes to events
socket.on('table-update', (data) => {
  if (data.tableId === currentTableId) {
    reloadTableData();
  }
});
```

### 6. Bulk operations

```javascript
// Select multiple rows (checkbox)
const selectedRows = [100, 101, 102];

// Bulk delete
for (const rowId of selectedRows) {
  await tablesService.deleteRow(rowId);
}

// After deletion: automatic vector store rebuild
```

---

## Relations between tables

### Relation types

#### 1. One-to-Many (N:1) - Relation

**Example**: Tasks → Projects

```
Table "Tasks"                    Table "Projects"
├── task_1 → project_id=5        ├── project_5 (Website)
├── task_2 → project_id=5        └── project_6 (API)
└── task_3 → project_id=6
```

**Storage**:
```sql
user_table_relations
├── from_row_id=task_1, column_id=3, to_table_id=2, to_row_id=project_5
├── from_row_id=task_2, column_id=3, to_table_id=2, to_row_id=project_5
└── from_row_id=task_3, column_id=3, to_table_id=2, to_row_id=project_6
```

#### 2. Many-to-Many (N:N) - Multiselect-Relation

**Example**: Contacts → Tags

```
Table "Contacts"                 Table "Tags"
├── contact_1 → [VIP, B2B]       ├── tag_1 (VIP)
├── contact_2 → [VIP]            ├── tag_2 (B2B)
└── contact_3 → [B2B, Local]     └── tag_3 (Local)
```

**Storage**:
```sql
user_table_relations
├── from_row_id=contact_1, column_id=5, to_table_id=3, to_row_id=tag_1
├── from_row_id=contact_1, column_id=5, to_table_id=3, to_row_id=tag_2
├── from_row_id=contact_2, column_id=5, to_table_id=3, to_row_id=tag_1
├── from_row_id=contact_3, column_id=5, to_table_id=3, to_row_id=tag_2
└── from_row_id=contact_3, column_id=5, to_table_id=3, to_row_id=tag_3
```

#### 3. Lookup

**Example**: Orders → Product price

```
Table "Orders"
├── order_id (text)
├── product (relation → Products)
└── price (lookup → Products.price)

Table "Products"
├── product_name (text)
└── price (number)
```

**How it works**:
1. You select `product = "Laptop"` (relation to the product)
2. `price` is automatically filled from `Products.price`
3. If the product price changes, the lookup updates

### API for working with relations

```javascript
// Get all relations for a row
GET /tables/:tableId/row/:rowId/relations

// Add a relation
POST /tables/:tableId/row/:rowId/relations
Body: {
  column_id: 12,
  to_table_id: 5,
  to_row_id: 45
}

// Add multiple relations (multiselect)
POST /tables/:tableId/row/:rowId/relations
Body: {
  column_id: 12,
  to_table_id: 5,
  to_row_ids: [45, 46, 47]
}

// Delete a relation
DELETE /tables/:tableId/row/:rowId/relations/:relationId
```

---

## AI (RAG) integration

### Vector search

Tables are used as a **knowledge base for the AI assistant**.

#### Automatic indexing

**On row create/update**:

```javascript
// Backend: POST /tables/:id/rows
const rows = await getTableRows(tableId);
const upsertRows = rows
  .filter(r => r.row_id && r.text)
  .map(r => ({
    row_id: r.row_id,
    text: r.text,              // Question (question column)
    metadata: { 
      answer: r.answer,         // Answer (answer column)
      product: r.product,       // Filter by product
      userTags: r.userTags,     // Filter by tags
      priority: r.priority      // Priority
    }
  }));

if (upsertRows.length > 0) {
  await vectorSearchClient.upsert(tableId, upsertRows);
}
```

**On row delete**:

```javascript
// Backend: DELETE /tables/row/:rowId
const rows = await getTableRows(tableId);
const rebuildRows = /* ... */;

if (rebuildRows.length > 0) {
  await vectorSearchClient.rebuild(tableId, rebuildRows);
}
```

#### Special fields for RAG

```javascript
// Columns with purpose
{
  "type": "text",
  "options": {
    "purpose": "question"  // Question for AI
  }
}

{
  "type": "text",
  "options": {
    "purpose": "answer"  // AI answer
  }
}

{
  "type": "multiselect",
  "options": {
    "purpose": "product"  // Filter by product
  }
}

{
  "type": "multiselect",
  "options": {
    "purpose": "userTags"  // Filter by tags
  }
}
```

#### Manual index rebuild

```javascript
// Frontend (admins only)
await tablesService.rebuildIndex(tableId);

// Backend: POST /tables/:id/rebuild-index
// Required: req.session.userAccessLevel?.hasAccess
const { questionCol, answerCol } = await getQuestionAnswerColumnIds(tableId);
const rows = await getRowsWithQA(tableId, questionCol, answerCol);

if (rows.length > 0) {
  await vectorSearchClient.rebuild(tableId, rows);
}
```

#### How AI uses tables

```
1. User asks the AI a question:
   "How do I return a product?"

2. AI performs vector search:
   vectorSearch.search(tableId, query, top_k=3)

3. Finds similar questions in the table:
   - row_id: 123
   - text: "How do I process a product return?"
   - score: -250 (close to the 300 threshold)
   - metadata: { answer: "Return within 14 days..." }

4. AI returns the answer from metadata.answer

5. If not found (score > 300):
   AI generates an answer via LLM (Ollama)
```

#### Filtering by products and tags

```javascript
// Search only for the "Premium" product
const results = await vectorSearch.search(tableId, query, 3);
const filtered = results.filter(r => r.metadata.product === 'Premium');

// Search only for "VIP" or "B2B" tags
const filtered = results.filter(r => 
  r.metadata.userTags.includes('VIP') || 
  r.metadata.userTags.includes('B2B')
);
```

---

## API Reference

### Tables

#### GET /tables

Get a list of all tables

**Response**:
```json
[
  {
    "id": 1,
    "name": "Contacts",
    "description": "Client database",
    "is_rag_source_id": 2,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
]
```

#### POST /tables

Create a new table

**Request**:
```json
{
  "name": "Contacts",
  "description": "Client database",
  "isRagSourceId": 2
}
```

**Response**: The created table object

#### GET /tables/:id

Get the table structure and data

**Response**:
```json
{
  "name": "Contacts",
  "description": "Client database",
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

Update table metadata

**Request**:
```json
{
  "name": "Clients",
  "description": "Updated description"
}
```

#### DELETE /tables/:id

Delete a table (admins only)

**Requirements**: `req.session.userAccessLevel?.hasAccess === true`

### Columns

#### POST /tables/:id/columns

Add a column

**Request**:
```json
{
  "name": "Email",
  "type": "text",
  "order": 2,
  "purpose": "contact"
}
```

#### PATCH /tables/column/:columnId

Update a column

**Request**:
```json
{
  "name": "New name",
  "type": "text",
  "order": 5
}
```

#### DELETE /tables/column/:columnId

Delete a column (cascade deletes all values)

### Rows

#### POST /tables/:id/rows

Add a row

**Response**: The created row object

#### DELETE /tables/row/:rowId

Delete a row

#### PATCH /tables/:id/rows/order

Change row order

**Request**:
```json
{
  "order": [
    { "rowId": 100, "order": 0 },
    { "rowId": 101, "order": 1 }
  ]
}
```

### Cells

#### POST /tables/cell

Create or update a cell value (upsert)

**Request**:
```json
{
  "row_id": 100,
  "column_id": 5,
  "value": "new@email.com"
}
```

**Logic**:
```sql
INSERT INTO user_cell_values (row_id, column_id, value_encrypted) 
VALUES ($1, $2, encrypt_text($3, $4))
ON CONFLICT (row_id, column_id) 
DO UPDATE SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()
```

### Filtering

#### GET /tables/:id/rows

Get filtered rows

**Parameters**:
```
?product=Premium               // Filter by product
&tags=VIP,B2B                  // Filter by tags
&relation_12=45,46             // Filter by relation (column_id=12)
&multiselect_8=10,11           // Filter by multiselect (column_id=8)
&lookup_15=100                 // Filter by lookup (column_id=15)
```

### RAG index

#### POST /tables/:id/rebuild-index

Rebuild the vector index (admins only)

**Requirements**: `req.session.userAccessLevel?.hasAccess === true`

**Response**:
```json
{
  "success": true,
  "count": 150
}
```

### Relations

#### GET /tables/:tableId/row/:rowId/relations

Get all relations for a row

**Response**:
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

Add a relation or relations

**Single relation**:
```json
{
  "column_id": 12,
  "to_table_id": 5,
  "to_row_id": 45
}
```

**Multiple relations** (multiselect):
```json
{
  "column_id": 12,
  "to_table_id": 5,
  "to_row_ids": [45, 46, 47]
}
```

**Logic**:
- Deletes old relations for column_id
- Adds new relations

#### DELETE /tables/:tableId/row/:rowId/relations/:relationId

Delete a relation

### Placeholders

#### GET /tables/:id/placeholders

Get placeholders for the table columns

**Response**:
```json
[
  {
    "id": 1,
    "name": "Email",
    "placeholder": "email"
  },
  {
    "id": 2,
    "name": "Client name",
    "placeholder": "imya_klienta"
  }
]
```

#### GET /tables/placeholders/all

Get all placeholders across all tables

**Response**:
```json
[
  {
    "column_id": 1,
    "column_name": "Email",
    "placeholder": "email",
    "table_id": 1,
    "table_name": "Contacts"
  }
]
```

---

## Usage examples

### Example 1: FAQ knowledge base for AI

#### Creating a table

```javascript
const table = await tablesService.createTable({
  name: "FAQ",
  description: "Frequently asked questions for AI",
  isRagSourceId: 2  // RAG source
});
```

#### Adding columns

```javascript
// Question (for vector search)
await tablesService.addColumn(table.id, {
  name: "Question",
  type: "text",
  order: 0,
  purpose: "question"
});

// Answer (for AI)
await tablesService.addColumn(table.id, {
  name: "Answer",
  type: "text",
  order: 1,
  purpose: "answer"
});

// Product (for filtering)
await tablesService.addColumn(table.id, {
  name: "Product",
  type: "multiselect",
  order: 2,
  purpose: "product",
  options: {
    choices: ["Basic", "Premium", "Enterprise"]
  }
});

// Tags (for filtering)
await tablesService.addColumn(table.id, {
  name: "Tags",
  type: "multiselect",
  order: 3,
  purpose: "userTags",
  options: {
    choices: ["Payment", "Shipping", "Returns", "Warranty"]
  }
});
```

#### Adding data

```javascript
// Add a row
const row = await tablesService.addRow(table.id);

// Fill cells
await tablesService.saveCell({
  row_id: row.id,
  column_id: 1,  // Question
  value: "How do I return a product?"
});

await tablesService.saveCell({
  row_id: row.id,
  column_id: 2,  // Answer
  value: "Product returns are possible within 14 days of purchase..."
});

// Automatically indexed in the vector store!
```

#### Search via AI

```javascript
// User asks the AI
const userQuestion = "can I return a purchase?";

// AI performs vector search
const results = await vectorSearch.search(table.id, userQuestion, 3);

// Finds the similar question "How do I return a product?" (score: -200)
// Returns the answer from metadata.answer
```

### Example 2: CRM system

#### Structure

```javascript
// Table "Companies"
const companies = await tablesService.createTable({
  name: "Companies",
  description: "Company database"
});

await tablesService.addColumn(companies.id, {
  name: "Name",
  type: "text",
  order: 0
});

await tablesService.addColumn(companies.id, {
  name: "Website",
  type: "text",
  order: 1
});

await tablesService.addColumn(companies.id, {
  name: "Industry",
  type: "multiselect",
  order: 2,
  options: { choices: ["IT", "Finance", "Retail", "Manufacturing"] }
});

// Table "Contacts"
const contacts = await tablesService.createTable({
  name: "Contacts",
  description: "Contact database"
});

await tablesService.addColumn(contacts.id, {
  name: "Name",
  type: "text",
  order: 0
});

await tablesService.addColumn(contacts.id, {
  name: "Email",
  type: "text",
  order: 1
});

// Relation: Contact → Company
await tablesService.addColumn(contacts.id, {
  name: "Company",
  type: "relation",
  order: 2,
  options: {
    relatedTableId: companies.id,
    relatedColumnId: 1  // Company name
  }
});

// Lookup: Company website
await tablesService.addColumn(contacts.id, {
  name: "Company website",
  type: "lookup",
  order: 3,
  options: {
    relatedTableId: companies.id,
    relatedColumnId: 2,  // Via "Company" relation
    lookupColumnId: 2    // Pull "Website"
  }
});
```

#### Usage

```javascript
// Add a company
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

// Add a contact
const contact = await tablesService.addRow(contacts.id);
await tablesService.saveCell({
  row_id: contact.id,
  column_id: 1,
  value: "John Doe"
});

// Link the contact to the company
await api.post(`/tables/${contacts.id}/row/${contact.id}/relations`, {
  column_id: 3,  // "Company"
  to_table_id: companies.id,
  to_row_id: company.id
});

// Lookup automatically fills in "https://microsoft.com"!
```

### Example 3: Task management

#### Structure

```javascript
// Table "Projects"
const projects = await tablesService.createTable({
  name: "Projects",
  description: "Active projects"
});

await tablesService.addColumn(projects.id, {
  name: "Name",
  type: "text",
  order: 0
});

await tablesService.addColumn(projects.id, {
  name: "Status",
  type: "multiselect",
  order: 1,
  options: { choices: ["Planning", "In progress", "Completed"] }
});

// Table "Tasks"
const tasks = await tablesService.createTable({
  name: "Tasks",
  description: "Tasks by project"
});

await tablesService.addColumn(tasks.id, {
  name: "Name",
  type: "text",
  order: 0
});

await tablesService.addColumn(tasks.id, {
  name: "Project",
  type: "relation",
  order: 1,
  options: {
    relatedTableId: projects.id,
    relatedColumnId: 1
  }
});

await tablesService.addColumn(tasks.id, {
  name: "Priority",
  type: "number",
  order: 2
});

await tablesService.addColumn(tasks.id, {
  name: "Status",
  type: "multiselect",
  order: 3,
  options: { choices: ["To Do", "In Progress", "Review", "Done"] }
});
```

#### Filtering tasks by project

```javascript
// Get all tasks for project with ID = 5
const tasks = await api.get(`/tables/${tasks.id}/rows?relation_2=5`);

// Get tasks with priority > 5
const highPriority = tasks.filter(task => {
  const priority = cellValues.find(
    cell => cell.row_id === task.id && cell.column_id === 3
  )?.value;
  return parseInt(priority) > 5;
});
```

---

## Security

### Data encryption

**All sensitive data is encrypted with AES-256**:

```javascript
// Encrypted:
name_encrypted          // Table name
description_encrypted   // Description
value_encrypted         // Cell values
placeholder_encrypted   // Placeholders

// NOT encrypted (for indexes and performance):
placeholder             // Unencrypted placeholder
options                 // JSONB settings
order                   // Order
```

**Encryption functions in PostgreSQL**:

```sql
-- Encryption
encrypt_text(plain_text, encryption_key)

-- Decryption
decrypt_text(encrypted_text, encryption_key)

-- Usage example
INSERT INTO user_tables (name_encrypted) 
VALUES (encrypt_text('Contacts', $1));

SELECT decrypt_text(name_encrypted, $1) as name 
FROM user_tables;
```

### Access rights

```javascript
// View: all authenticated users
GET /tables
GET /tables/:id
GET /tables/:id/rows

// Edit: users with permissions
if (!canEditData) {
  return res.status(403).json({ error: 'Access denied' });
}
POST /tables/:id/columns
POST /tables/:id/rows
POST /tables/cell
PATCH /tables/column/:columnId

// Delete: administrators only
if (!req.session.userAccessLevel?.hasAccess) {
  return res.status(403).json({ error: 'Administrators only' });
}
DELETE /tables/:id
DELETE /tables/column/:columnId
DELETE /tables/row/:rowId
POST /tables/:id/rebuild-index
```

### Access checks via tokens

```javascript
// Backend checks token balance
const address = req.session.address;
const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
const balance = await dleContract.balanceOf(address);

if (balance === 0n) {
  return res.status(403).json({ 
    error: 'Access denied: no tokens' 
  });
}

// Determine access level
const accessLevel = determineAccessLevel(balance);
req.session.userAccessLevel = accessLevel;
```

### Protection against SQL injection

**Parameterized queries**:

```javascript
// ✅ Safe (parameters)
await db.getQuery()(
  'SELECT * FROM user_tables WHERE id = $1',
  [tableId]
);

// ❌ DANGEROUS (concatenation)
await db.getQuery()(
  `SELECT * FROM user_tables WHERE id = ${tableId}`
);
```

### Input validation

```javascript
// Type check
if (typeof name !== 'string') {
  return res.status(400).json({ error: 'Invalid name' });
}

// Existence check
const exists = await db.getQuery()(
  'SELECT id FROM user_tables WHERE id = $1',
  [tableId]
);
if (!exists.rows[0]) {
  return res.status(404).json({ error: 'Table not found' });
}

// Uniqueness check (placeholder)
const duplicate = await db.getQuery()(
  'SELECT id FROM user_columns WHERE placeholder = $1 AND id != $2',
  [placeholder, columnId]
);
if (duplicate.rows.length > 0) {
  placeholder = generateUniquePlaceholder();
}
```

### Cascade delete (protection from orphaned data)

```sql
-- All relations with ON DELETE CASCADE
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

-- Result: deleting a table automatically deletes EVERYTHING
```

### Rate Limiting

```javascript
// Can be added in backend/routes/tables.js
const rateLimit = require('express-rate-limit');

const tablesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests
  message: 'Too many requests to tables'
});

router.use(tablesLimiter);
```

---

## Performance

### Optimizations

#### 1. Parallel queries

```javascript
// Instead of sequential queries:
const tableMeta = await db.query('SELECT ...');
const columns = await db.query('SELECT ...');
const rows = await db.query('SELECT ...');
const cellValues = await db.query('SELECT ...');

// Parallel queries are used:
const [tableMeta, columns, rows, cellValues] = await Promise.all([
  db.query('SELECT ...'),
  db.query('SELECT ...'),
  db.query('SELECT ...'),
  db.query('SELECT ...')
]);

// Speedup: 4x
```

#### 2. Indexes on relations

```sql
CREATE INDEX idx_user_table_relations_from_row 
  ON user_table_relations(from_row_id);
  
CREATE INDEX idx_user_table_relations_to_table 
  ON user_table_relations(to_table_id);
  
-- Result: fast filtering by relations
```

#### 3. UNIQUE constraint

```sql
CREATE TABLE user_cell_values (
  ...
  UNIQUE(row_id, column_id)
);

-- Benefits:
-- 1. Prevents duplicate cells
-- 2. Speeds up upsert (ON CONFLICT)
-- 3. Automatic index
```

#### 4. WebSocket instead of polling

```javascript
// ❌ Polling (slow)
setInterval(async () => {
  const data = await fetchTableData();
  updateUI(data);
}, 5000);

// ✅ WebSocket (instant)
socket.on('table-update', (data) => {
  if (data.tableId === currentTableId) {
    updateUI(data);
  }
});

// Result: real-time updates, no server load from polling
```

#### 5. Caching

```javascript
// Backend can add a cache for frequently requested tables
const NodeCache = require('node-cache');
const tableCache = new NodeCache({ stdTTL: 300 }); // 5 minutes

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

### Metrics

**Typical response times**:
```
GET /tables           → 50-100ms   (all tables)
GET /tables/:id       → 150-300ms  (with data, Promise.all)
POST /tables/cell     → 100-200ms  (upsert + vector update)
DELETE /tables/row/:id → 200-400ms (delete + rebuild vector)
POST /tables/:id/rebuild-index → 1-5s (depends on size)
```

**Optimal table sizes**:
```
Rows: up to 10,000     → Excellent
Rows: 10,000-50,000    → Good
Rows: >50,000          → Additional optimizations needed (pagination, lazy load)
```

---

## Limitations and future improvements

### Current limitations

1. **No pagination**: All rows are loaded at once
   - May be slow for large tables (>1000 rows)

2. **No formulas**: Cannot create computed fields
   - Workaround: use lookup

3. **No grouping**: Cannot group rows
   - Workaround: filtering on the frontend

4. **No change history**: Who changed what and when is not tracked
   - An audit trail can be added

5. **Limited sorting**: Only via the order field
   - No column sorting on the backend

### Possible improvements

```javascript
// 1. Pagination
GET /tables/:id/rows?page=1&limit=50

// 2. Sorting
GET /tables/:id/rows?sort_by=column_id&order=asc

// 3. Formulas
{
  "type": "formula",
  "options": {
    "formula": "{{price}} * {{quantity}}"
  }
}

// 4. Change history
CREATE TABLE user_cell_history (
  id SERIAL PRIMARY KEY,
  cell_id INTEGER REFERENCES user_cell_values(id),
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER,
  changed_at TIMESTAMP
);

// 5. Export/import
POST /tables/:id/export → CSV/Excel
POST /tables/:id/import ← CSV/Excel

// 6. Table templates
POST /tables/templates/crm → Create CRM from template
POST /tables/templates/tasks → Create Kanban from template
```

---

## Conclusion

The spreadsheet system in DLE is a **powerful tool** for managing structured data with:

✅ **Flexible structure** (6 field types)  
✅ **Relations between tables** (relation, lookup)  
✅ **AI integration** (RAG, vector search)  
✅ **Real-time updates** (WebSocket)  
✅ **Security** (AES-256, access rights)  
✅ **Performance** (indexes, parallel queries)  

This is **not just Excel**, but a **full-fledged database** with a convenient interface and an AI assistant!

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Document version**: 1.0.0  
**Created**: February 28, 2026  
**Status**: Temporary (for internal use)
