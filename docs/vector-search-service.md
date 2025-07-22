<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# Техническое задание: Векторный сервис поиска по таблице

## Цель
Реализовать отдельный микросервис для векторного поиска по данным из таблицы в базе данных. Сервис должен предоставлять REST API для добавления, поиска и обновления векторных представлений (эмбеддингов) строк таблицы.

## Язык и стек
- Язык: Python 3.10+
- Векторный движок: FAISS
- API: FastAPI
- Хранение индекса: на диске (persistency)
- Docker-образ для деплоя

## API сервиса

### 1. Добавление/обновление записей
- **POST /upsert**
- Тело запроса:
  ```json
  {
    "table_id": "string",           // идентификатор таблицы
    "rows": [
      {
        "row_id": "string",         // идентификатор строки
        "text": "string",           // текст для эмбеддинга
        "metadata": { ... }          // любые дополнительные поля
      }
    ]
  }
  ```
- Ответ: `{ "success": true }`

### 2. Поиск похожих записей
- **POST /search**
- Тело запроса:
  ```json
  {
    "table_id": "string",
    "query": "string",              // текст запроса
    "top_k": 3                       // количество результатов
  }
  ```
- Ответ:
  ```json
  {
    "results": [
      {
        "row_id": "string",
        "score": float,
        "metadata": { ... }
      }
    ]
  }
  ```

### 3. Удаление записей
- **POST /delete**
- Тело запроса:
  ```json
  {
    "table_id": "string",
    "row_ids": ["string", ...]
  }
  ```
- Ответ: `{ "success": true }`

### 4. Пересоздание индекса (опционально)
- **POST /rebuild**
- Тело запроса:
  ```json
  {
    "table_id": "string"
  }
  ```
- Ответ: `{ "success": true }`

## Требования к эмбеддингам
- Для генерации эмбеддингов сервис использует Ollama (через HTTP API, модель mxbai-embed-large или аналогичную).
- Эмбеддинги кэшируются локально для ускорения поиска.

## Требования к интеграции
- Сервис не хранит бизнес-логику, только индексы и метаданные.
- Node.js backend обращается к сервису по HTTP (localhost или через docker-compose).
- Все операции атомарны, сервис устойчив к сбоям.

## Безопасность
- Сервис доступен только во внутренней сети (docker-compose).
- Нет публичного доступа извне.

## Мониторинг и логирование
- Логирование всех запросов и ошибок.
- Healthcheck endpoint: **GET /health** (ответ: `{ "status": "ok" }`)

## Docker
- Сервис должен запускаться как отдельный контейнер.
- Все зависимости описаны в requirements.txt.

## Пример docker-compose.yml (фрагмент)
```yaml
services:
  vector-search:
    build: ./vector-search
    ports:
      - "8001:8001"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - ollama
``` 