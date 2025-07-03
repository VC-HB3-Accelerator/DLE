# Vector Search Service

## Запуск локально
```
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8001
```

## Запуск в Docker
```
docker build -t vector-search .
docker run -p 8001:8001 vector-search
```

## Эндпоинты
- POST /upsert — добавить/обновить строки
- POST /search — поиск похожих
- POST /delete — удалить строки
- POST /rebuild — пересоздать индекс
- GET /health — проверка статуса

## Пример запроса /upsert
```
curl -X POST http://localhost:8001/upsert -H "Content-Type: application/json" -d '{"table_id": "t1", "rows": [{"row_id": "1", "text": "Пример", "metadata": {}}]}'
``` 