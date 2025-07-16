# Digital_Legal_Entity(DLE)

Веб3 приложение для бизнеса с ИИ ассистентом

## Требования

- Docker и Docker Compose
- Git

## Быстрый запуск

Чтобы запустить проект одной командой, выполните следующие шаги:

1. Клонируйте репозиторий:
```bash
git clone https://github.com/DAO-HB3-Accelerator/DLE.git
cd Digital_Legal_Entity(DLE)
```

2. Запустите скрипт установки:
```bash
./setup.sh
```

3. После запуска контейнеров выполните миграции изнутри контейнера backend:
```bash
docker exec -e NODE_ENV=migration dapp-backend yarn migrate
```

Скрипт автоматически:
- Проверит наличие Docker и Docker Compose
- Запустит PostgreSQL в контейнере
- Запустит Ollama и загрузит модель qwen2.5:7b
- Запустит backend и frontend сервисы
- Выведет адреса для доступа к сервисам

## Доступные сервисы

После успешного запуска вы получите доступ:

- Frontend: http://localhost:5173

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