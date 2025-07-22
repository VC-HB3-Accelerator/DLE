<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

# Скрипты миграции приложения

Этот набор скриптов позволяет полностью перенести приложение с базами данных между различными провайдерами.

## Файлы

- `migrate-app.sh` - Основной скрипт миграции приложения
- `update-dns.sh` - Скрипт обновления DNS записей
- `README.md` - Эта инструкция

## Что мигрируется

Скрипт переносит **всё приложение**:

### ✅ **Контейнеры:**
- Frontend (Vue.js)
- Backend (Node.js)
- PostgreSQL (база данных)
- Ollama (AI модели)
- Vector Search

### ✅ **Данные:**
- PostgreSQL база данных (полный дамп)
- Ollama модели (список для восстановления)
- Переменные окружения
- Конфигурационные файлы

### ❌ **Исключается:**
- `node_modules/` (пересобирается)
- `.git/` (не нужен на продакшене)
- `*.log` (логи)
- `temp/` (временные файлы)
- `sessions/` (сессии)

## Требования

### На исходном сервере:
- Docker и Docker Compose
- SSH доступ
- Достаточно места для бэкапа

### На целевом сервере:
- Docker и Docker Compose
- SSH доступ
- Достаточно места для приложения

### На локальной машине:
- SSH ключи настроены для обоих серверов
- `dig` (для проверки DNS)
- `curl` (для API запросов)
- `jq` (для работы с JSON)

## Использование

### 1. Миграция приложения

```bash
# Сделать скрипт исполняемым
chmod +x scripts/migrate-app.sh

# Запустить миграцию
./scripts/migrate-app.sh source-server target-server app-path
```

**Пример:**
```bash
./scripts/migrate-app.sh user@hostland-server.com user@aws-server.com /home/user/dapp
```

### 2. Обновление DNS записей

```bash
# Сделать скрипт исполняемым
chmod +x scripts/update-dns.sh

# Запустить обновление DNS
./scripts/update-dns.sh domain new-server-ip
```

**Пример:**
```bash
./scripts/update-dns.sh mydapp.site 123.456.789.10
```

## Автоматическое обновление DNS

Скрипт поддерживает автоматическое обновление DNS через API:

### Cloudflare
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
./scripts/update-dns.sh mydapp.site 123.456.789.10
```

### GoDaddy
```bash
export GODADDY_API_KEY="your-api-key"
export GODADDY_API_SECRET="your-api-secret"
./scripts/update-dns.sh mydapp.site 123.456.789.10
```

### Namecheap
```bash
export NAMECHEAP_API_USER="your-username"
export NAMECHEAP_API_KEY="your-api-key"
./scripts/update-dns.sh mydapp.site 123.456.789.10
```

## Процесс миграции

### 1. Подготовка
- Проверка подключений к серверам
- Проверка установки Docker
- Создание временных файлов

### 2. Создание бэкапа
- Остановка приложения
- Создание дампа PostgreSQL
- Сохранение списка Ollama моделей
- Создание полного архива

### 3. Восстановление
- Копирование архива на целевой сервер
- Распаковка файлов
- Восстановление PostgreSQL
- Восстановление Ollama моделей
- Запуск приложения

### 4. Проверка
- Проверка статуса контейнеров
- Проверка логов
- Проверка доступности портов
- Очистка временных файлов

## Примеры использования

### Миграция с Hostland на AWS

```bash
# 1. Мигрируем приложение
./scripts/migrate-app.sh user@hostland.com ec2-user@aws-server.com /home/ec2-user/dapp

# 2. Получаем новый IP
NEW_IP=$(ssh ec2-user@aws-server.com "curl -s ifconfig.me")

# 3. Обновляем DNS
./scripts/update-dns.sh mydapp.site $NEW_IP
```

### Миграция с AWS на DigitalOcean

```bash
# 1. Мигрируем приложение
./scripts/migrate-app.sh ec2-user@aws-server.com root@digitalocean.com /root/dapp

# 2. Получаем новый IP
NEW_IP=$(ssh root@digitalocean.com "curl -s ifconfig.me")

# 3. Обновляем DNS
./scripts/update-dns.sh mydapp.site $NEW_IP
```

## Мониторинг процесса

Скрипты выводят подробную информацию о процессе:

- `[INFO]` - Информационные сообщения
- `[SUCCESS]` - Успешные операции
- `[WARNING]` - Предупреждения
- `[ERROR]` - Ошибки

## Устранение неполадок

### Ошибка подключения SSH
```bash
# Проверьте SSH ключи
ssh -T user@server.com

# Добавьте ключ в ssh-agent
ssh-add ~/.ssh/id_rsa
```

### Ошибка Docker
```bash
# Установите Docker на сервере
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Ошибка DNS
```bash
# Проверьте DNS записи
dig mydapp.site

# Обновите вручную в панели управления доменом
```

### Ошибка восстановления PostgreSQL
```bash
# Проверьте логи PostgreSQL
docker compose logs postgres

# Создайте базу вручную
docker compose exec postgres createdb -U dapp_user dapp_db
```

## Безопасность

### SSH ключи
- Используйте SSH ключи вместо паролей
- Ограничьте доступ к серверам
- Регулярно обновляйте ключи

### API ключи
- Храните API ключи в переменных окружения
- Не коммитьте ключи в репозиторий
- Используйте минимальные права доступа

### Данные
- Бэкапы содержат чувствительные данные
- Удаляйте временные файлы после миграции
- Шифруйте бэкапы при необходимости

## Резервное копирование

Рекомендуется создавать резервные копии перед миграцией:

```bash
# Создать бэкап вручную
cd /path/to/app
docker compose down
tar -czf backup-$(date +%Y%m%d).tar.gz .
```

## Поддержка

При возникновении проблем:

1. Проверьте логи скриптов
2. Проверьте статус контейнеров
3. Проверьте подключения к серверам
4. Проверьте DNS записи
5. Обратитесь к документации провайдера

## Лицензия

Эти скрипты распространяются под MIT лицензией. 