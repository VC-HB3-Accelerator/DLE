# 🚀 Экспорт шаблона приложения в GitHub

## Цель
Экспортировать все образы и тома как файлы в GitHub репозиторий для создания полного шаблона приложения.

## 📋 Команды для экспорта

### 1. Создать папки для данных
```bash
mkdir -p ./docker-data/images
mkdir -p ./docker-data/volumes
```

### 2. Экспортировать образы в файлы
```bash
# Backend образ
docker save digital_legal_entitydle-backend:latest -o ./docker-data/images/backend.tar

# Frontend образ
docker save digital_legal_entitydle-frontend:latest -o ./docker-data/images/frontend.tar

# Vector Search образ
docker save digital_legal_entitydle-vector-search:latest -o ./docker-data/images/vector-search.tar

# Ollama образ
docker save digital_legal_entitydle-ollama:latest -o ./docker-data/images/ollama.tar

# WebSSH Agent образ
docker save digital_legal_entitydle-webssh-agent:latest -o ./docker-data/images/webssh-agent.tar
```

### 3. Экспортировать тома в файлы
```bash
# PostgreSQL данные
docker run --rm -v digital_legal_entitydle_postgres_data:/source -v $(pwd)/docker-data/volumes:/backup alpine tar czf /backup/postgres_data.tar.gz -C /source .

# Ollama данные
docker run --rm -v digital_legal_entitydle_ollama_data:/source -v $(pwd)/docker-data/volumes:/backup alpine tar czf /backup/ollama_data.tar.gz -C /source .

# Vector Search данные
docker run --rm -v digital_legal_entitydle_vector_search_data:/source -v $(pwd)/docker-data/volumes:/backup alpine tar czf /backup/vector_search_data.tar.gz -C /source .

# Backend node_modules
docker run --rm -v digital_legal_entitydle_backend_node_modules:/source -v $(pwd)/docker-data/volumes:/backup alpine tar czf /backup/backend_node_modules.tar.gz -C /source .

# Frontend node_modules
docker run --rm -v digital_legal_entitydle_frontend_node_modules:/source -v $(pwd)/docker-data/volumes:/backup alpine tar czf /backup/frontend_node_modules.tar.gz -C /source .
```

### 4. Загрузить все в GitHub
```bash
# Добавить файлы в git
git add docker-data/

# Закоммитить
git commit -m "Add exported images and volumes"

# Запушить в репозиторий
git push
```

## 📊 Результат

После выполнения всех команд в репозитории будут:
- ✅ Все образы как файлы (.tar)
- ✅ Все тома как файлы (.tar.gz)
- ✅ Полный шаблон приложения

## 🚀 Использование шаблона

### Для пользователей:
```bash
# Клонировать репозиторий
git clone https://github.com/VC-HB3-Accelerator/DLE.git
cd DLE

# Импортировать образы
docker load -i docker-data/images/backend.tar
docker load -i docker-data/images/frontend.tar
docker load -i docker-data/images/vector-search.tar
docker load -i docker-data/images/ollama.tar
docker load -i docker-data/images/webssh-agent.tar

# Импортировать тома
docker volume create digital_legal_entitydle_postgres_data
docker run --rm -v digital_legal_entitydle_postgres_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/postgres_data.tar.gz -C /target

docker volume create digital_legal_entitydle_ollama_data
docker run --rm -v digital_legal_entitydle_ollama_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/ollama_data.tar.gz -C /target

docker volume create digital_legal_entitydle_vector_search_data
docker run --rm -v digital_legal_entitydle_vector_search_data:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/vector_search_data.tar.gz -C /target

docker volume create digital_legal_entitydle_backend_node_modules
docker run --rm -v digital_legal_entitydle_backend_node_modules:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/backend_node_modules.tar.gz -C /target

docker volume create digital_legal_entitydle_frontend_node_modules
docker run --rm -v digital_legal_entitydle_frontend_node_modules:/target -v $(pwd)/docker-data/volumes:/backup alpine tar xzf /backup/frontend_node_modules.tar.gz -C /target

# Запустить приложение
docker-compose up -d
```

## ⚠️ Важные замечания

1. **Размер файлов**: Образы могут быть большими (несколько GB)
2. **Время загрузки**: Зависит от размера файлов и скорости интернета
3. **Место на диске**: Убедитесь, что достаточно места для всех файлов

## 📁 Структура после экспорта

```
docker-data/
├── images/
│   ├── backend.tar
│   ├── frontend.tar
│   ├── vector-search.tar
│   ├── ollama.tar
│   └── webssh-agent.tar
└── volumes/
    ├── postgres_data.tar.gz
    ├── ollama_data.tar.gz
    ├── vector_search_data.tar.gz
    ├── backend_node_modules.tar.gz
    └── frontend_node_modules.tar.gz
```

## ✅ Готово!

После выполнения всех команд у вас будет полный шаблон приложения в GitHub репозитории, который можно клонировать и запускать на любом устройстве.
