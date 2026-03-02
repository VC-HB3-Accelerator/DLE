**English** | [Русский](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/Docs/src/branch/main/docs.ru/back-docs/tables-system.md)

# DLE Spreadsheet (Tables) System

> **Internal working document**

---

## Table of Contents

1. [System overview](#system-overview)
2. [Database architecture](#database-architecture)
3. [Field types](#field-types)
4. [Features](#features)
5. [Table relations](#table-relations)
6. [AI (RAG) integration](#ai-rag-integration)
7. [API reference](#api-reference)
8. [Examples](#examples)
9. [Security](#security)

---

## System overview

### What it is

The tables system in DLE is a **full database with a GUI** — similar to **Notion Database** or **Airtable** — built into the app.

### Features

- 6 field types (text, number, relation, lookup, multiselect, multiselect-relation)
- Relations between tables (1:1, 1:N, N:N)
- Lookup and data rollup
- Filtering and sorting
- Real-time updates (WebSocket)
- AI integration (RAG search)
- AES-256 encryption for data
- Placeholders for API access
- Cascade delete, bulk operations

### vs Excel/Sheets

| | Excel/Sheets | DLE Tables |
|-|--------------|------------|
| Data typing | Weak | Strict (6 types) |
| Relations | No | Yes (relation, lookup) |
| AI search | No | Yes (RAG, vector) |
| Real-time | Partial | Full (WebSocket) |
| Encryption | No | AES-256 |
| API | Limited | Full REST |

---

## Database architecture

### Main tables (PostgreSQL)

- **user_tables:** id, name_encrypted, description_encrypted, is_rag_source_id, created_at, updated_at
- **user_columns:** id, table_id, name_encrypted, type_encrypted, placeholder_encrypted, placeholder, options (JSONB), order, created_at, updated_at
- **user_rows:** id, table_id, order, created_at, updated_at
- **user_cell_values:** id, row_id, column_id, value_encrypted, created_at, updated_at, UNIQUE(row_id, column_id)
- **user_table_relations:** id, from_row_id, column_id, to_table_id, to_row_id, created_at, updated_at

Cascade: delete table → columns, rows, cell values, relations. Indexes on relation columns for performance.

---

## Field types

1. **Text** — plain text
2. **Number** — numeric
3. **Multiselect** — multiple choices from a list (options.choices)
4. **Multiselect-relation** — multiple rows from another table (options: relatedTableId, relatedColumnId); stored in user_table_relations
5. **Relation** — single row in another table (1:1 or N:1); one row in user_table_relations
6. **Lookup** — value pulled from related table (options: relatedTableId, relatedColumnId, lookupColumnId)

---

## Features

### CRUD

- **Create table:** POST /tables (name, description, isRagSourceId); name/description encrypted
- **Add column:** POST /tables/:id/columns (name, type, order, purpose, options)
- **Add row:** POST /tables/:id/rows (auto index for RAG if applicable)
- **Save cell:** POST /tables/cell (row_id, column_id, value); upsert; update vector store
- **Delete row:** DELETE /tables/row/:rowId (rebuild vector store)
- **Delete column:** DELETE /tables/column/:columnId (cascade relations and cell values)
- **Delete table:** DELETE /tables/:id (admin; cascade all)

### Filtering

- GET /tables/:id/rows?product=… — by product
- ?tags=… — by user tags
- ?relation_&lt;columnId&gt;=&lt;to_row_ids&gt; — by relation
- ?multiselect_&lt;columnId&gt;=… — by multiselect

### Placeholders

Auto-generated from column name (transliteration, uniqueness). Used for API: GET /tables/:id/data?fields=placeholder1,placeholder2.

### Order

PATCH /tables/:id/rows/order with array of { rowId, order }.

### WebSocket

Events: table-update, table-relations-update, tags-update. Frontend subscribes and reloads when needed.

### Bulk

Select rows (checkboxes); bulk delete or other actions; after delete, vector store rebuilt as needed.

---

## Table relations

- **N:1 (Relation):** one column links to one row in another table (e.g. Task → Project).
- **N:N (Multiselect-relation):** multiple links (e.g. Contacts → Tags).
- **Lookup:** show a field from the related row (e.g. Order → Product → Product.price).

API: GET/POST/DELETE on /tables/:tableId/row/:rowId/relations (column_id, to_table_id, to_row_id or to_row_ids for multiselect).

---

## AI (RAG) integration

- Tables (or selected tables) can be **RAG sources**. Columns with **purpose** “question” and “answer” are used for vector indexing.
- On row create/update: rows with question/answer are upserted into vector store (FAISS). On row delete: rebuild for that table.
- **Rebuild index:** POST /tables/:id/rebuild-index (admin). Reads question/answer columns and rebuilds vector index.
- **RAG flow:** User asks → vector search in table(s) → top_k results with score and metadata (answer, product, userTags, priority) → LLM gets context and generates reply. Filter by product/tags in metadata if needed.

---

## API reference (summary)

- **Tables:** GET/POST /tables, GET/PATCH/DELETE /tables/:id
- **Columns:** POST /tables/:id/columns, PATCH/DELETE /tables/column/:columnId
- **Rows:** POST /tables/:id/rows, DELETE /tables/row/:rowId, PATCH /tables/:id/rows/order
- **Cell:** POST /tables/cell (upsert)
- **Filtered rows:** GET /tables/:id/rows?…
- **RAG:** POST /tables/:id/rebuild-index
- **Relations:** GET/POST/DELETE …/row/:rowId/relations
- **Placeholders:** GET /tables/:id/placeholders, GET /tables/placeholders/all

---

## Examples

### FAQ for AI

Create table with columns: Question (purpose: question), Answer (purpose: answer), Product (multiselect, purpose: product), Tags (multiselect, purpose: userTags). Add rows; enable as RAG source. AI will search by question and return answer; filter by product/tags.

### CRM

Tables: Companies (name, website, industry), Contacts (name, email, company relation, company website lookup). Relation from Contact to Company; lookup “company website” from Company via relation.

### Tasks

Tables: Projects (name, status), Tasks (name, project relation, priority, status). Filter tasks by project: GET .../rows?relation_&lt;projectColumnId&gt;=&lt;projectRowId&gt;.

---

## Security

- **Encryption:** AES-256 for name_encrypted, description_encrypted, value_encrypted, placeholder_encrypted. placeholder and options can be plain for indexing/performance.
- **Access:** View for authenticated users; edit for users with edit rights; delete and rebuild-index for admins (e.g. userAccessLevel.hasAccess). Token balance checked for access level.
- **SQL:** Parameterized queries only. Validate types, existence, uniqueness (e.g. placeholder). Cascade deletes to avoid orphaned data. Optional rate limiting on tables routes.

---

## Performance

- Parallel queries for table meta, columns, rows, cell values where possible. Indexes on user_table_relations. UNIQUE(row_id, column_id) for fast upsert. WebSocket instead of polling. Optional server-side cache for frequent GET /tables/:id.

Typical: GET /tables 50–100 ms, GET /tables/:id 150–300 ms, POST cell 100–200 ms, rebuild-index 1–5 s. Tables up to ~10k rows fine; larger may need pagination/lazy load.

---

## Limits and future

Current: no server-side pagination, no formulas, no grouping, no change history, limited server-side sort. Possible: pagination, sort params, formula fields, audit table, export/import, table templates.

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

Version: 1.0.0 | Date: February 28, 2026 | Status: Internal
