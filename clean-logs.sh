#!/bin/bash
# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

echo "🧹 Очистка логов DApp..."

# 1. Очистка файловых логов приложения
if [ -d "backend/logs" ]; then
    echo "📂 Очистка файловых логов backend..."
    rm -f backend/logs/*.log
    echo "✅ Файловые логи backend очищены"
else
    echo "ℹ️  Папка backend/logs не найдена"
fi

if [ -d "frontend/logs" ]; then
    echo "📂 Очистка файловых логов frontend..."
    rm -f frontend/logs/*.log
    echo "✅ Файловые логи frontend очищены"
else
    echo "ℹ️  Папка frontend/logs не найдена"
fi

# 2. Очистка логов Docker контейнеров (без удаления контейнеров)
echo "🐳 Очистка логов Docker контейнеров..."
docker system prune -f

# 3. Очистка логов конкретных контейнеров (без удаления)
containers=("dapp-backend" "dapp-frontend" "dapp-postgres" "dapp-ollama")
for container in "${containers[@]}"; do
    if docker ps -a --format "table {{.Names}}" | grep -q "^${container}$"; then
        echo "🧹 Очистка логов контейнера ${container}..."
        docker logs --since 0s "${container}" > /dev/null 2>&1 || true
    fi
done

# 4. Очистка неиспользуемых образов (опционально)
echo "🖼️  Очистка неиспользуемых образов..."
docker image prune -f

echo "✨ Очистка логов завершена!"
echo ""
echo "📊 Использование Docker после очистки:"
docker system df 