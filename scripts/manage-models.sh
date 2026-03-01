#!/bin/bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Функции
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Проверка статуса моделей
check_models_status() {
    log "Проверка статуса моделей..."
    
    # Проверяем какие модели загружены в память
    loaded_models=$(docker exec dapp-ollama ollama ps 2>/dev/null | grep -v "NAME" | wc -l)
    
    if [ "$loaded_models" -gt 0 ]; then
        success "Модели в памяти: $loaded_models активных"
        docker exec dapp-ollama ollama ps
    else
        warning "Модели не загружены в память"
    fi
    
    # Проверяем доступные модели
    available_models=$(docker exec dapp-ollama ollama list 2>/dev/null | grep -v "NAME" | wc -l)
    success "Доступных моделей: $available_models"
}

# Предзагрузка моделей
preload_models() {
    log "Предзагрузка моделей в память..."
    
    # Проверяем что Ollama готов
    until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
        log "Ожидание запуска Ollama..."
        sleep 2
    done
    
    success "Ollama готов!"
    
    # Загружаем основные модели
    log "Загрузка qwen2.5:7b..."
    docker exec dapp-ollama ollama run qwen2.5:7b "Инициализация" > /dev/null 2>&1 &
    
    log "Загрузка mxbai-embed-large:latest..."
    docker exec dapp-ollama ollama run mxbai-embed-large:latest "Инициализация" > /dev/null 2>&1 &
    
    # Ждем загрузки
    sleep 10
    
    success "Модели загружены!"
    check_models_status
}

# Поддержание моделей в памяти
keep_alive() {
    log "Запуск поддержания моделей в памяти..."
    
    while true; do
        # Проверяем статус каждые 5 минут
        loaded_models=$(docker exec dapp-ollama ollama ps 2>/dev/null | grep -v "NAME" | wc -l)
        
        if [ "$loaded_models" -eq 0 ]; then
            log "Модели выгружены, перезагружаем..."
            preload_models
        else
            log "Модели в памяти: $loaded_models активных"
        fi
        
        sleep 300  # 5 минут
    done
}

# Очистка моделей из памяти
clear_memory() {
    log "Очистка моделей из памяти..."
    
    # Останавливаем все модели
    docker exec dapp-ollama ollama ps | grep -v "NAME" | awk '{print $1}' | xargs -I {} docker exec dapp-ollama ollama stop {} 2>/dev/null || true
    
    success "Память очищена"
    check_models_status
}

# Главное меню
show_help() {
    echo "🤖 Управление моделями Ollama"
    echo "================================"
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  status    - Показать статус моделей"
    echo "  preload   - Предзагрузить модели в память"
    echo "  keep      - Поддерживать модели в памяти"
    echo "  clear     - Очистить память"
    echo "  test      - Протестировать скорость ответа"
    echo "  help      - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 status    # Проверить статус"
    echo "  $0 preload   # Загрузить модели"
    echo "  $0 keep      # Держать в памяти"
}

# Тест производительности
test_performance() {
    log "Тест производительности..."
    
    # Тест с холодным стартом
    log "Тест холодного старта..."
    start_time=$(date +%s.%N)
    docker exec dapp-ollama ollama run qwen2.5:7b "Тест" > /dev/null 2>&1
    end_time=$(date +%s.%N)
    cold_time=$(echo "$end_time - $start_time" | bc)
    
    # Тест с горячим стартом
    log "Тест горячего старта..."
    start_time=$(date +%s.%N)
    docker exec dapp-ollama ollama run qwen2.5:7b "Тест" > /dev/null 2>&1
    end_time=$(date +%s.%N)
    hot_time=$(echo "$end_time - $start_time" | bc)
    
    echo "📊 Результаты теста:"
    echo "   Холодный старт: ${cold_time}s"
    echo "   Горячий старт:  ${hot_time}s"
    
    if (( $(echo "$hot_time < $cold_time" | bc -l) )); then
        success "Модели работают быстрее из памяти!"
    else
        warning "Модели не остаются в памяти"
    fi
}

# Обработка аргументов
case "${1:-help}" in
    "status")
        check_models_status
        ;;
    "preload")
        preload_models
        ;;
    "keep")
        keep_alive
        ;;
    "clear")
        clear_memory
        ;;
    "test")
        test_performance
        ;;
    "help"|*)
        show_help
        ;;
esac
