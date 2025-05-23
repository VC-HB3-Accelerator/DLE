# DApp-for-Business

Бизнес-платформа для работы с блокчейн и интеграцией ИИ.

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

2. Настройте переменные окружения:
```bash
# Создайте файлы .env из примеров
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Отредактируйте файлы .env с вашими настройками
nano backend/.env
nano frontend/.env
```

3. Запустите скрипт установки:
```bash
./setup.sh

4. Выполните миграции изнутри контейнера backend:
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

## Безопасность

По умолчанию проект настроен с базовыми учетными данными для разработки. Перед использованием в продакшене:

1. **Измените все пароли и ключи в .env файлах**
2. **Не публикуйте .env файлы в репозитории** (они добавлены в .gitignore)
3. **Обновите SESSION_SECRET для защиты сессий**
4. **Используйте безопасные пароли для базы данных**
5. **Настройте SSL/TLS для продакшен-окружения**

## Переменные окружения

Основные переменные, которые следует настроить:

- `DB_USER`, `DB_PASSWORD` - учетные данные для базы данных
- `SESSION_SECRET` - секрет для шифрования сессий
- `PRIVATE_KEY` - приватный ключ для подписи транзакций
- `EMAIL_*` - настройки почтового сервера
- `TELEGRAM_BOT_TOKEN` - токен для Telegram бота

## Примечания

- Загрузка модели qwen2.5:7b может занять некоторое время в зависимости от скорости интернета
- Для использования GPU Ollama требуются установленные драйверы NVIDIA и nvidia-container-toolkit

## Важно! Если в контейнерах нет доступа к интернету

1. Откройте Docker Desktop → Settings → Docker Engine.
2. Добавьте строку:
   "dns": ["8.8.8.8", "1.1.1.1"]
   Пример:
   {
     ...
     "dns": ["8.8.8.8", "1.1.1.1"]
   }
3. Нажмите "Apply & Restart".
4. Перезапустите приложение:
   docker compose down
   docker compose up -d