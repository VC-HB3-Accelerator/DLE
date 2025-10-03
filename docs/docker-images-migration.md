# Миграция Docker образов на VDS

## 📋 Процесс миграции Docker образов

### **🎯 Как работает импорт Docker образов:**

#### **Автоматическая миграция (единственный способ)**
1. **Запуск настройки VDS** через форму
2. **Автоматический экспорт** образов агентом из локального Docker
3. **Автоматическая передача** образов агентом через SCP
4. **Автоматический импорт** образов на VDS

### **🔧 Детальный процесс автоматической миграции:**

#### **1. Автоматический экспорт ВСЕХ образов приложения (агентом):**
```bash
# Агент экспортирует ВСЕ образы приложения из локального Docker
docker save dapp-postgres:latest -o /tmp/dapp-postgres.tar      # PostgreSQL с данными БД
docker save dapp-ollama:latest -o /tmp/dapp-ollama.tar          # Ollama AI сервис
docker save dapp-vector-search:latest -o /tmp/dapp-vector-search.tar  # Vector Search
docker save dapp-backend:latest -o /tmp/dapp-backend.tar        # Backend API
docker save dapp-frontend-nginx:latest -o /tmp/dapp-frontend-nginx.tar  # Frontend + Nginx
docker save dapp-webssh-agent:latest -o /tmp/dapp-webssh-agent.tar      # WebSSH Agent

# Создание архива с ВСЕМИ образами
tar -czf /tmp/docker-images.tar.gz dapp-postgres.tar dapp-ollama.tar dapp-vector-search.tar dapp-backend.tar dapp-frontend-nginx.tar dapp-webssh-agent.tar
```

#### **2. Автоматическая передача (агент):**
```bash
# Передача архива на VDS через SCP
scp /tmp/docker-images.tar.gz ubuntu@vds:/home/docker/dapp/docker-images.tar.gz

# Создание скрипта импорта на VDS
# Импорт образов
cd /home/docker/dapp && ./import-images.sh
```

#### **3. Импорт образов (на VDS):**
```bash
#!/bin/bash
# Скрипт import-images.sh создается агентом

# Распаковка архива
tar -xzf ./docker-images.tar.gz -C ./temp-images

# Импорт ВСЕХ образов приложения
docker load -i ./temp-images/dapp-postgres.tar      # PostgreSQL с данными БД
docker load -i ./temp-images/dapp-ollama.tar        # Ollama AI сервис
docker load -i ./temp-images/dapp-vector-search.tar # Vector Search
docker load -i ./temp-images/dapp-backend.tar       # Backend API
docker load -i ./temp-images/dapp-frontend-nginx.tar # Frontend + Nginx
docker load -i ./temp-images/dapp-webssh-agent.tar  # WebSSH Agent

# Очистка временных файлов
rm -rf ./temp-images
```

### **📦 Содержимое архива образов:**

| Образ | Назначение | Размер (примерно) |
|-------|------------|-------------------|
| `dapp-postgres:latest` | PostgreSQL с данными БД | ~400MB |
| `dapp-ollama:latest` | AI модели | ~4GB |
| `dapp-vector-search:latest` | Векторный поиск | ~500MB |
| `dapp-backend:latest` | Backend API | ~300MB |
| `dapp-frontend-nginx:latest` | Frontend + Nginx | ~200MB |
| `dapp-webssh-agent:latest` | SSH агент | ~150MB |

### **⚡ Преимущества автоматической миграции:**

#### **✅ Скорость:**
- **С образами:** ~5-10 минут (включая PostgreSQL с данными)
- **Без образов:** ~30-60 минут (сборка на VDS + настройка БД)

#### **✅ Надежность:**
- **PostgreSQL с данными** - все переменные в зашифрованных таблицах
- Проверенные образы с локальной машины
- Нет риска ошибок сборки на VDS
- Быстрое восстановление при сбоях

#### **✅ Консистентность:**
- Одинаковые образы на локальной машине и VDS
- **База данных с настройками** - готова к работе
- Нет различий в версиях зависимостей

### **🚨 Важные моменты:**

#### **Предварительные требования:**
1. **Образы должны быть собраны** на локальной машине
2. **PostgreSQL образ содержит данные БД** - готовая база с настройками
3. **Агент НЕ создает БД** - использует готовую из образа

#### **Что НЕ нужно делать:**
- ❌ Создавать базу данных на VDS
- ❌ Восстанавливать данные из бэкапа
- ❌ Настраивать таблицы БД
- ❌ Импортировать данные вручную
3. **VDS должен иметь достаточно места** (минимум 10GB свободного места)

#### **Если архива нет:**
- Агент покажет предупреждение
- Образы будут собираться на VDS
- Процесс займет больше времени

### **📝 Логи процесса:**

#### **Успешная миграция:**
```
✅ Docker образы переданы на VDS
🚀 Импорт Docker образов на VDS...
📦 Импорт образа ollama...
📦 Импорт образа vector-search...
📦 Импорт образа backend...
📦 Импорт образа frontend-nginx...
📦 Импорт образа webssh-agent...
✅ Образы успешно импортированы!
```

#### **Если архива нет:**
```
⚠️ Локальный архив образов не найден. Образы будут собираться на VDS.
ℹ️ Для ускорения процесса выполните: ./scripts/export-images.sh
```

## ✅ **Итог:**
**Импорт Docker образов настроен правильно и работает автоматически при наличии архива образов!**
