# 🚀 Digital Legal Entity (DLE) - Шаблон приложения

## Описание
Полный шаблон приложения Digital Legal Entity

## 📋 Требования
- Docker и Docker Compose

## 🚀 Быстрый запуск

### Автоматическая установка (рекомендуется)
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup-template.sh | bash
```

### Ручная установка
```bash
# 1. Клонирование репозитория
git clone https://github.com/VC-HB3-Accelerator/DLE.git
cd DLE

# 2. Импорт образов
docker load -i docker-data/images/backend.tar
docker load -i docker-data/images/frontend.tar
docker load -i docker-data/images/vector-search.tar
docker load -i docker-data/images/ollama.tar
docker load -i docker-data/images/webssh-agent.tar

# 3. Создание и импорт томов
docker volume create digital_legal_entitydle_postgres_data
docker volume create digital_legal_entitydle_ollama_data
docker volume create digital_legal_entitydle_vector_search_data
docker volume create digital_legal_entitydle_backend_node_modules
docker volume create digital_legal_entitydle_frontend_node_modules

docker run --rm -v digital_legal_entitydle_postgres_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /target
docker run --rm -v digital_legal_entitydle_ollama_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/ollama_data.tar.gz -C /target
docker run --rm -v digital_legal_entitydle_vector_search_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/vector_search_data.tar.gz -C /target
docker run --rm -v digital_legal_entitydle_backend_node_modules:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/backend_node_modules.tar.gz -C /target
docker run --rm -v digital_legal_entitydle_frontend_node_modules:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/frontend_node_modules.tar.gz -C /target

# 4. Запуск приложения
docker-compose up -d
```

### Доступ к приложению

#### Разработка (dev)
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000

#### Продакшн (production)
- **Frontend**: http://localhost:9000 (HTTP) или https://localhost:9443 (HTTPS)
- **Backend API**: http://localhost:9000/api (через nginx proxy)

## 🔧 Управление

### Запуск
```

#### Продакшн (production)
```bash
# Пересборка образов
docker-compose build --no-cache

# Запуск продакшн-сервисов
NODE_ENV=production docker-compose --profile production up -d

# Проверка
docker-compose ps
curl http://localhost:9000/api/health
```

### Остановка
```bash
docker-compose-down
```

### Полезные команды
```bash
# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f frontend-nginx

# Перезапуск сервиса
docker-compose restart backend
docker-compose restart frontend-nginx

# Пересборка конкретного сервиса
docker-compose build --no-cache backend
docker-compose build --no-cache frontend-nginx

# Просмотр статуса
docker-compose ps
docker ps  # Все контейнеры в системе
```

## 📝 Лицензия

**ПРОПРИЕТАРНОЕ ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ**

Copyright (c) 2024-2025 Тарабанов Александр Викторович  
Все права защищены.

### ⚠️ **ВАЖНЫЕ ОГРАНИЧЕНИЯ:**

- ❌ **Запрещено** перепродавать, дарить или передавать третьим лицам
- ❌ **Запрещено** модифицировать без явного разрешения
- ❌ **Запрещено** использовать в образовательных учреждениях без разрешения
- ✅ **Разрешено** только личное использование для бизнес-операций

### 📞 **Контакты:**
- **Email:** info@hb3-accelerator.com
- **Сайт:** https://hb3-accelerator.com
- **GitHub:** https://github.com/HB3-ACCELERATOR

**Подробная информация:** [LICENSE](LICENSE) | [Юридическая документация](legal/README.md)

## 🔐 Проверка подлинности

### Цифровые подписи:
- **LICENSE.asc** - подпись лицензии
- **README.md.asc** - подпись README
- **public-key.asc** - публичный ключ для проверки

### Проверка подписи:
```bash
# Скачать публичный ключ
curl -O https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/public-key.asc

# Импортировать ключ
gpg --import public-key.asc

# Проверить подпись лицензии
gpg --verify LICENSE.asc LICENSE

# Проверить подпись README
gpg --verify README.md.asc README.md
```

**GPG Key ID:** `4603583F81054FEECE7E821E026FD26F71D70B17`

---

**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**

