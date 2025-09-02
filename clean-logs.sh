#!/bin/bash
# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

echo "🧹 Очистка логов DApp..."

# 1. Очистка всех файловых логов в проекте
echo "📂 Очистка всех файловых логов..."

# Очистка логов backend
if [ -d "backend/logs" ]; then
    echo "  🧹 Очистка логов backend..."
    rm -f backend/logs/*.log
    echo "  ✅ Логи backend очищены"
fi

# Очистка логов frontend
if [ -d "frontend/logs" ]; then
    echo "  🧹 Очистка логов frontend..."
    rm -f frontend/logs/*.log
    echo "  ✅ Логи frontend очищены"
fi

# Очистка корневых логов проекта
echo "  🧹 Очистка корневых логов проекта..."
rm -f *.log
echo "  ✅ Корневые логи очищены"

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

# 4. Автоматическая очистка при остановке контейнеров
echo "🔄 Настройка автоматической очистки..."
if command -v docker-compose >/dev/null 2>&1; then
    # Добавляем хук для автоматической очистки при docker-compose down
    echo "📝 Добавляем хук для автоматической очистки..."
    echo "alias docker-compose-down='docker-compose down && ./clean-logs.sh'" >> ~/.bashrc
    echo "✅ Теперь используйте 'docker-compose-down' вместо 'docker-compose down'"
fi

# 4. Очистка неиспользуемых образов (опционально)
echo "🖼️  Очистка неиспользуемых образов..."
docker image prune -f

echo "✨ Очистка логов завершена!"
echo ""
echo "📊 Использование Docker после очистки:"
docker system df 