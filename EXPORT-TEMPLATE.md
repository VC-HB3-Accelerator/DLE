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

### 4. Создать архив для GitHub Release
```bash
# Создать сжатый архив
tar -czf dle-template.tar.gz docker-data/

# Проверить размер
ls -lh dle-template.tar.gz
# Ожидаемый размер: ~5.3GB
```

### 5. Создать GitHub Release
```bash
# Создать тег версии
git tag v1.0.0
git push origin v1.0.0

# GitHub автоматически создаст Release
# Затем вручную загрузить dle-template.tar.gz в Release
```

## 📊 Результат

После выполнения всех команд:
- ✅ **GitHub Release** с архивом `dle-template.tar.gz` (5.3GB)
- ✅ **Все образы** как файлы (.tar) внутри архива
- ✅ **Все тома** как файлы (.tar.gz) внутри архива
- ✅ **Полный шаблон** приложения готов к скачиванию

## 🚀 Использование шаблона

### Для пользователей:

#### Автоматическая установка (рекомендуется):
```bash
# Скачать и запустить скрипт установки
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup-template.sh | bash
```

#### Ручная установка:
```bash
# 1. Клонировать репозиторий
git clone https://github.com/VC-HB3-Accelerator/DLE.git
cd DLE

# 2. Скачать архив из GitHub Release
# Перейти на страницу Release и скачать dle-template.tar.gz (5.3GB)

# 3. Распаковать архив
tar -xzf dle-template.tar.gz

# 4. Импортировать образы
docker load -i docker-data/images/backend.tar
docker load -i docker-data/images/frontend.tar
docker load -i docker-data/images/vector-search.tar
docker load -i docker-data/images/ollama.tar
docker load -i docker-data/images/webssh-agent.tar

# 5. Создать и импортировать тома
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

# 6. Запустить приложение
docker-compose up -d
```

## 📊 Точные размеры экспорта

### Образы (5 файлов .tar):
- `backend.tar` - **36MB**
- `frontend.tar` - **45MB** 
- `vector-search.tar` - **40MB**
- `ollama.tar` - **46MB**
- `webssh-agent.tar` - **47MB**
- **Итого образы**: ~215MB

### Volumes (5 файлов .tar.gz):
- `postgres_data.tar.gz` - **28MB**
- `ollama_data.tar.gz` - **5.2GB** (самый большой!)
- `vector_search_data.tar.gz` - **87 байт** (пустой)
- `backend_node_modules.tar.gz` - **127MB**
- `frontend_node_modules.tar.gz` - **40MB**
- **Итого volumes**: ~5.4GB

### **ОБЩИЙ РАЗМЕР**: ~5.6GB

## 🚨 Проблема с GitHub

**GitHub имеет лимиты:**
- Максимум 100MB на файл
- Максимум 1GB на репозиторий (бесплатно)
- Наш архив 5.3GB превышает лимиты!

## 💡 Варианты решения для хранения архива

### 1. GitHub Releases (рекомендуется) ✅
```bash
# Создать архив
tar -czf dle-template.tar.gz docker-data/

# Создать тег и Release
git tag v1.0.0
git push origin v1.0.0

# Загрузить dle-template.tar.gz в GitHub Release
# Лимит: 2GB на файл, 10GB на релиз
```
**Плюсы**: 
- Простота настройки
- Нет лимитов размера (до 2GB на файл)
- Версионирование релизов
- Отдельно от кода репозитория

**Минусы**: 
- Пользователи скачивают архив отдельно
- Нужно обновлять инструкции

### 2. Git LFS (Large File Storage)
```bash
# Настроить LFS
git lfs track "*.tar" "*.tar.gz"
git add .gitattributes
git add docker-data/
```
**Плюсы**: Автоматическое управление большими файлами
**Минусы**: Лимит 1GB (бесплатно), нужен Git LFS

### 3. Внешние хранилища
- **Google Drive** - 15GB бесплатно
- **Dropbox** - 2GB бесплатно  
- **OneDrive** - 5GB бесплатно
- **Mega** - 20GB бесплатно

### 4. Облачные хранилища
- **AWS S3** - платно, но надежно
- **Google Cloud Storage** - платно
- **Azure Blob** - платно

### 5. Разделение на части
```bash
# Разделить архив на части по 1GB
split -b 1G dle-template.tar.gz dle-template-part-
# Результат: dle-template-part-aa, dle-template-part-ab, etc.
```

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

После выполнения всех команд у вас будет:
- ✅ **GitHub Release** с архивом `dle-template.tar.gz` (5.3GB)
- ✅ **Полный шаблон** приложения готов к скачиванию
- ✅ **Автоматический скрипт** установки для пользователей
- ✅ **Ручные инструкции** для продвинутых пользователей

**Пользователи могут:**
1. **Автоматически**: `curl -fsSL ... | bash`
2. **Вручную**: Скачать архив из Release и следовать инструкциям
