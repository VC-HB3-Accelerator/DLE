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
- **Frontend**: http://localhost:5173

## 🔧 Управление

### Запуск
```bash
docker-compose up -d
```

### Остановка
```bash
docker-compose down
```

## 📝 Лицензия

Copyright (c) 2024-2025 Тарабанов Александр Викторович
All rights reserved.
This software is proprietary and confidential.
For licensing inquiries: info@hb3-accelerator.com


**© 2024-2025 Тарабанов Александр Викторович. Все права защищены.**

