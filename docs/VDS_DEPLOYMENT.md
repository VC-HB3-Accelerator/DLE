# Деплой на VDS - Руководство

## 📋 Обзор

Этот документ описывает процесс безопасного деплоя изменений из приватной ветки `private/development` на VDS сервер с сохранением данных пользователей.

## 🔄 Workflow разработки

### Структура веток:
```
🌍 main (публичная)                    ← Базовый софт для скачивания
🔒 private/development (приватная)     ← Разработка и тестирование
```

### VDS конфигурация:
- **Адрес:** 185.221.214.140
- **Пользователь:** root
- **Пароль:** [НЕ ХРАНИТЬ В ДОКУМЕНТАЦИИ - использовать переменные окружения]
- **Путь:** /home/docker/dapp
- **Compose файл:** docker-compose.prod.yml

## 🛡️ Безопасность данных

### Docker Volumes (сохраняются при обновлениях):
- `postgres_data` - база данных пользователей
- `ollama_data` - AI модели
- `vector_search_data` - векторные индексы

### Важно:
- Данные пользователей НЕ удаляются при обновлении кода
- Volumes остаются неизменными при пересборке контейнеров
- Возможен откат к предыдущей версии

## 🔐 Настройка безопасности

### Переменные окружения:

```bash
# Установить пароль VDS (временно)
export VDS_PASSWORD="your_vds_password"

# Или добавить в ~/.bashrc для постоянного использования
echo 'export VDS_PASSWORD="your_vds_password"' >> ~/.bashrc
source ~/.bashrc
```

### SSH ключи (рекомендуется):

```bash
# Создать SSH ключ
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Скопировать публичный ключ на VDS
ssh-copy-id root@185.221.214.140

# После этого можно использовать ssh без пароля
ssh root@185.221.214.140 "cd /home/docker/dapp && docker compose -f docker-compose.prod.yml ps"
```

## 🚀 Процесс деплоя

### 1. Подготовка изменений (локально):

```bash
# Убедитесь, что находитесь в приватной ветке
git checkout private/development

# Внесите изменения в код
# Протестируйте локально
./setup.sh

# Зафиксируйте изменения
git add .
git commit -m "feat: описание изменений"
git push origin private/development
```

### 2. Деплой на VDS:

```bash
# Полный деплой одной командой (используйте переменную окружения для пароля)
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && git pull origin private/development && docker compose -f docker-compose.prod.yml up -d --build && docker exec dapp-backend yarn migrate"

# Или используйте SSH ключи (рекомендуется):
ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && git pull origin private/development && docker compose -f docker-compose.prod.yml up -d --build && docker exec dapp-backend yarn migrate"
```

### 3. Проверка деплоя:

```bash
# Проверить статус контейнеров
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml ps"

# Проверить логи
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml logs backend"
```

## 📊 Мониторинг

### Просмотр логов в реальном времени:

```bash
# Backend логи
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml logs -f backend"

# Все логи
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml logs -f"
```

### Проверка использования ресурсов:

```bash
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker stats --no-stream"
```

## 🔧 Устранение неполадок

### Если деплой не удался:

```bash
# Проверить статус
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml ps"

# Перезапустить сервисы
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker compose -f docker-compose.prod.yml restart"
```

### Откат к предыдущей версии:

```bash
# Вернуться к предыдущему коммиту
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && git reset --hard HEAD~1 && docker compose -f docker-compose.prod.yml up -d --build"
```

## 📋 Чек-лист деплоя

### Перед деплоем:
- [ ] Код протестирован локально
- [ ] Изменения зафиксированы в `private/development`
- [ ] Изменения отправлены в GitHub
- [ ] Проверена совместимость схемы БД

### После деплоя:
- [ ] Все контейнеры запущены
- [ ] Логи не содержат ошибок
- [ ] Приложение доступно по домену
- [ ] Данные пользователей сохранены

## 🔄 Резервное копирование

### Создание бэкапа перед деплоем:

```bash
# Создать бэкап базы данных
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker exec dapp-postgres pg_dump -U dapp_user dapp_db > backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Восстановление из бэкапа:

```bash
# Восстановить базу данных
sshpass -p "$VDS_PASSWORD" ssh -o StrictHostKeyChecking=no root@185.221.214.140 \
"cd /home/docker/dapp && docker exec -i dapp-postgres psql -U dapp_user dapp_db < backup_YYYYMMDD_HHMMSS.sql"
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи контейнеров
2. Убедитесь, что все сервисы запущены
3. Проверьте доступность VDS сервера
4. При необходимости создайте issue в GitHub

---

**Автор:** Тарабанов Александр Викторович  
**Организация:** HB3 Accelerator  
**Email:** info@hb3-accelerator.com  
**Сайт:** [hb3-accelerator.com](https://hb3-accelerator.com)

**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**
