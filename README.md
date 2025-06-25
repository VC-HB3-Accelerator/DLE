# DApp-for-Business

Приложение для бизнеса

## Требования

- Docker и Docker Compose
- Git

## Быстрый запуск

Чтобы запустить проект одной командой, выполните следующие шаги:

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/DApp-for-Business.git
cd DApp-for-Business
```

2. Запустите скрипт установки:
```bash
./setup.sh

3. Выполните миграции изнутри контейнера backend:
```
  docker exec -e NODE_ENV=migration dapp-backend yarn migrate
  
  ```

Скрипт автоматически:
- Проверит наличие Docker и Docker Compose
- Запустит PostgreSQL в контейнере
- Запустит Ollama и загрузит модель qwen2.5:7b
- Запустит backend и frontend сервисы
- Выведет адреса для доступа к сервисам

## Доступные сервисы

После успешного запуска вы получите доступ к следующим сервисам:

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Ollama API: http://localhost:11434
- PostgreSQL: localhost:5432 (по умолчанию dapp_db/dapp_user/dapp_password)

## Ручной запуск

Если вы хотите запустить проект вручную:

```bash
# Запуск в фоновом режиме
docker compose up -d

# Запуск с логами
docker compose up

# Перезапуск контейнеров
docker-compose restart

# Остановка сервисов
docker compose down

# Остановка сервисов и удаление томов
docker compose down -v
```