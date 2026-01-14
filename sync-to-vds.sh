#!/bin/bash
# Скрипт для синхронизации кода с localhost на VDS

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Синхронизация кода с VDS...${NC}"

# Параметры VDS (из настроек)
VDS_HOST="185.221.214.140"
VDS_USER="root"
VDS_PORT="22"
VDS_PATH="/home/docker/dapp"

# SSH опции
SSH_OPTS="-p $VDS_PORT -o StrictHostKeyChecking=no"
# SCP опции (scp использует -P для порта, а не -p)
SCP_OPTS="-P $VDS_PORT -o StrictHostKeyChecking=no"

# Проверяем наличие rsync на удаленном сервере
echo -e "${YELLOW}🔍 Проверка наличия rsync на VDS...${NC}"
if ssh $SSH_OPTS $VDS_USER@$VDS_HOST "command -v rsync >/dev/null 2>&1"; then
    USE_RSYNC=true
    echo -e "${GREEN}✅ rsync найден на VDS${NC}"
else
    USE_RSYNC=false
    echo -e "${YELLOW}⚠️  rsync не найден на VDS, будет использован метод tar/scp${NC}"
    read -p "Установить rsync на VDS? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📦 Установка rsync на VDS...${NC}"
        ssh $SSH_OPTS $VDS_USER@$VDS_HOST "apt-get update && apt-get install -y rsync"
        if ssh $SSH_OPTS $VDS_USER@$VDS_HOST "command -v rsync >/dev/null 2>&1"; then
            USE_RSYNC=true
            echo -e "${GREEN}✅ rsync успешно установлен${NC}"
        else
            echo -e "${RED}❌ Не удалось установить rsync, используется tar/scp${NC}"
        fi
    fi
fi

# Функция синхронизации через rsync
sync_with_rsync() {
    local SRC=$1
    local DST=$2
    rsync -avz --progress -e "ssh $SSH_OPTS" \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='.env' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.next' \
        --exclude='coverage' \
        --exclude='.nyc_output' \
        --exclude='sessions' \
        --exclude='temp' \
        --exclude='tmp' \
        --exclude='*.swp' \
        --exclude='*.swo' \
        --exclude='*~' \
        --exclude='.DS_Store' \
        "$SRC" "$DST"
}

# Функция синхронизации через tar/scp
sync_with_tar() {
    local SRC_DIR=$1
    local DST_DIR=$2
    local DIR_NAME=$(basename "$SRC_DIR")
    
    # Создаем временный архив
    local TMP_TAR="/tmp/${DIR_NAME}_sync_$$.tar.gz"
    
    # Упаковываем директорию с исключениями
    tar -czf "$TMP_TAR" \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='.env' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='.next' \
        --exclude='coverage' \
        --exclude='.nyc_output' \
        --exclude='sessions' \
        --exclude='temp' \
        --exclude='tmp' \
        --exclude='*.swp' \
        --exclude='*.swo' \
        --exclude='*~' \
        --exclude='.DS_Store' \
        -C "$(dirname "$SRC_DIR")" "$DIR_NAME"
    
    # Копируем архив на VDS
    scp $SCP_OPTS "$TMP_TAR" "$VDS_USER@$VDS_HOST:/tmp/"
    
    # Распаковываем на VDS
    ssh $SSH_OPTS $VDS_USER@$VDS_HOST "mkdir -p $DST_DIR && tar -xzf /tmp/$(basename $TMP_TAR) -C $DST_DIR --strip-components=1 && rm /tmp/$(basename $TMP_TAR)"
    
    # Удаляем локальный архив
    rm -f "$TMP_TAR"
}

# Синхронизация backend
echo -e "${YELLOW}📦 Синхронизация backend...${NC}"
if [ "$USE_RSYNC" = true ]; then
    sync_with_rsync "./backend/" "$VDS_USER@$VDS_HOST:$VDS_PATH/backend/"
else
    sync_with_tar "./backend" "$VDS_PATH/backend"
fi

# Синхронизация frontend
echo -e "${YELLOW}📦 Синхронизация frontend...${NC}"
if [ "$USE_RSYNC" = true ]; then
    sync_with_rsync "./frontend/" "$VDS_USER@$VDS_HOST:$VDS_PATH/frontend/"
else
    sync_with_tar "./frontend" "$VDS_PATH/frontend"
fi

# Синхронизация shared
echo -e "${YELLOW}📦 Синхронизация shared...${NC}"
if [ "$USE_RSYNC" = true ]; then
    sync_with_rsync "./shared/" "$VDS_USER@$VDS_HOST:$VDS_PATH/shared/"
else
    sync_with_tar "./shared" "$VDS_PATH/shared"
fi

# Синхронизация docker-compose.prod.yml
echo -e "${YELLOW}📦 Синхронизация docker-compose.prod.yml...${NC}"
scp $SCP_OPTS ./webssh-agent/docker-compose.prod.yml "$VDS_USER@$VDS_HOST:$VDS_PATH/docker-compose.prod.yml"

# Синхронизация Dockerfile файлов (если они изменились)
echo -e "${YELLOW}📦 Синхронизация Dockerfile файлов...${NC}"
scp $SCP_OPTS ./backend/Dockerfile "$VDS_USER@$VDS_HOST:$VDS_PATH/backend/Dockerfile" 2>/dev/null || true
scp $SCP_OPTS ./frontend/Dockerfile "$VDS_USER@$VDS_HOST:$VDS_PATH/frontend/Dockerfile" 2>/dev/null || true
scp $SCP_OPTS ./frontend/nginx.Dockerfile "$VDS_USER@$VDS_HOST:$VDS_PATH/frontend/nginx.Dockerfile" 2>/dev/null || true

echo -e "${GREEN}✅ Синхронизация завершена!${NC}"

# Спрашиваем, нужно ли пересобрать образы
read -p "Пересобрать Docker образы на VDS? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🔨 Пересборка Docker образов на VDS (без кеша)...${NC}"
    echo -e "${YELLOW}⏳ Это может занять несколько минут...${NC}"
    
    # Пересобираем образы БЕЗ кеша для гарантированного применения изменений
    ssh $SSH_OPTS $VDS_USER@$VDS_HOST "cd $VDS_PATH && \
        docker compose -f docker-compose.prod.yml build --no-cache backend frontend frontend-nginx && \
        docker compose -f docker-compose.prod.yml up -d --force-recreate backend frontend frontend-nginx"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Образы пересобраны и контейнеры перезапущены!${NC}"
    else
        echo -e "${RED}❌ Ошибка при пересборке образов!${NC}"
        echo -e "${YELLOW}💡 Попробуйте пересобрать вручную:${NC}"
        echo -e "   ssh -p $VDS_PORT $VDS_USER@$VDS_HOST"
        echo -e "   cd $VDS_PATH"
        echo -e "   docker compose -f docker-compose.prod.yml build --no-cache backend frontend frontend-nginx"
        echo -e "   docker compose -f docker-compose.prod.yml up -d --force-recreate backend frontend frontend-nginx"
    fi
else
    echo -e "${YELLOW}💡 Для пересборки образов выполните:${NC}"
    echo -e "   ssh -p $VDS_PORT $VDS_USER@$VDS_HOST"
    echo -e "   cd $VDS_PATH"
    echo -e "   docker compose -f docker-compose.prod.yml build --no-cache backend frontend frontend-nginx"
    echo -e "   docker compose -f docker-compose.prod.yml up -d --force-recreate backend frontend frontend-nginx"
fi
