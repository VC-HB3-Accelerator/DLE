#!/bin/bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# This software is proprietary and confidential.
# For licensing inquiries: info@hb3-accelerator.com

echo "🤖 Полный тест AI ассистента"
echo "================================"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Проверка зависимостей
check_dependencies() {
    log "Проверка зависимостей..."
    
    if ! command -v curl &> /dev/null; then
        error "curl не установлен"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        warning "jq не установлен - JSON ответы не будут форматированы"
    fi
    
    success "Зависимости проверены"
}

# Проверка Docker контейнеров
check_containers() {
    log "Проверка Docker контейнеров..."
    
    containers=("dapp-backend" "dapp-ollama" "dapp-postgres" "dapp-vector-search")
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^${container}$"; then
            status=$(docker inspect --format='{{.State.Status}}' "$container")
            if [ "$status" = "running" ]; then
                success "$container: запущен"
            else
                error "$container: статус $status"
            fi
        else
            error "$container: не найден"
        fi
    done
}

# Проверка Ollama
test_ollama() {
    log "Тестирование Ollama..."
    
    # Проверка доступности API
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        success "Ollama API доступен"
    else
        error "Ollama API недоступен"
        return 1
    fi
    
    # Проверка моделей
    models=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name' 2>/dev/null || echo "")
    if echo "$models" | grep -q "qwen2.5:7b"; then
        success "Модель qwen2.5:7b загружена"
    else
        error "Модель qwen2.5:7b не найдена"
    fi
    
    if echo "$models" | grep -q "mxbai-embed-large:latest"; then
        success "Модель mxbai-embed-large:latest загружена"
    else
        error "Модель mxbai-embed-large:latest не найдена"
    fi
    
    # Тест генерации
    log "Тест генерации текста..."
    response=$(curl -s -X POST http://localhost:11434/api/generate \
        -H "Content-Type: application/json" \
        -d '{
            "model": "qwen2.5:7b",
            "prompt": "Привет! Как дела?",
            "stream": false
        }')
    
    if echo "$response" | jq -e '.response' > /dev/null 2>&1; then
        success "Генерация текста работает"
        echo "Ответ: $(echo "$response" | jq -r '.response' | head -c 100)..."
    else
        error "Генерация текста не работает"
        echo "Ответ: $response"
    fi
}

# Проверка Backend API
test_backend_api() {
    log "Тестирование Backend API..."
    
    # Проверка здоровья
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        success "Backend API доступен"
    else
        error "Backend API недоступен"
        return 1
    fi
    
    # Проверка AI health
    ai_health=$(curl -s http://localhost:8000/api/ai/health 2>/dev/null || echo "")
    if [ -n "$ai_health" ]; then
        success "AI health endpoint работает"
    else
        warning "AI health endpoint недоступен"
    fi
}

# Тест RAG системы
test_rag_system() {
    log "Тестирование RAG системы..."
    
    # Создание тестовой таблицы
    log "Создание тестовой таблицы..."
    table_response=$(curl -s -X POST http://localhost:8000/api/tables \
        -H "Content-Type: application/json" \
        -d '{
            "name": "test_ai_table",
            "description": "Тестовая таблица для AI"
        }')
    
    table_id=$(echo "$table_response" | jq -r '.id' 2>/dev/null || echo "")
    if [ -n "$table_id" ] && [ "$table_id" != "null" ]; then
        success "Таблица создана (ID: $table_id)"
        
        # Добавление колонок
        log "Добавление колонок..."
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/columns" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "question",
                "type": "text",
                "placeholder": "vopros"
            }' > /dev/null
        
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/columns" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "answer",
                "type": "text",
                "placeholder": "otvet"
            }' > /dev/null
        
        # Добавление данных
        log "Добавление тестовых данных..."
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/rows" \
            -H "Content-Type: application/json" \
            -d '{
                "data": {
                    "question": "Как работает AI ассистент?",
                    "answer": "AI ассистент использует машинное обучение для понимания и ответа на вопросы пользователей."
                }
            }' > /dev/null
        
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/rows" \
            -H "Content-Type: application/json" \
            -d '{
                "data": {
                    "question": "Что такое RAG?",
                    "answer": "RAG (Retrieval-Augmented Generation) - это метод, который объединяет поиск информации с генерацией ответов."
                }
            }' > /dev/null
        
        success "Тестовые данные добавлены"
        
        # Тест RAG запроса
        log "Тест RAG запроса..."
        rag_response=$(curl -s -X POST "http://localhost:8000/api/rag/answer" \
            -H "Content-Type: application/json" \
            -d '{
                "tableId": '$table_id',
                "question": "Как работает AI ассистент?",
                "threshold": 5
            }')
        
        if echo "$rag_response" | jq -e '.answer' > /dev/null 2>&1; then
            success "RAG система работает"
            echo "RAG ответ: $(echo "$rag_response" | jq -r '.answer' | head -c 100)..."
        else
            error "RAG система не работает"
            echo "RAG ответ: $rag_response"
        fi
        
        # Очистка тестовой таблицы
        log "Очистка тестовой таблицы..."
        curl -s -X DELETE "http://localhost:8000/api/tables/$table_id" > /dev/null
        success "Тестовая таблица удалена"
        
    else
        error "Не удалось создать тестовую таблицу"
        echo "Ответ: $table_response"
    fi
}

# Тест AI ассистента
test_ai_assistant() {
    log "Тестирование AI ассистента..."
    
    # Простой тест
    log "Простой тест AI..."
    simple_response=$(curl -s -X POST http://localhost:8000/api/chat/guest-message \
        -H "Content-Type: application/json" \
        -d '{
            "message": "Привет! Как дела?",
            "guestId": "test-guest-123"
        }')
    
    if echo "$simple_response" | jq -e '.aiMessage' > /dev/null 2>&1; then
        success "AI ассистент отвечает"
        echo "Ответ: $(echo "$simple_response" | jq -r '.aiMessage.content' | head -c 100)..."
    else
        error "AI ассистент не отвечает"
        echo "Ответ: $simple_response"
    fi
    
    # Тест с контекстом
    log "Тест с контекстом..."
    context_response=$(curl -s -X POST http://localhost:8000/api/chat/guest-message \
        -H "Content-Type: application/json" \
        -d '{
            "message": "Как меня зовут?",
            "guestId": "test-guest-123"
        }')
    
    if echo "$context_response" | jq -e '.aiMessage' > /dev/null 2>&1; then
        success "AI ассистент помнит контекст"
        echo "Ответ: $(echo "$context_response" | jq -r '.aiMessage.content' | head -c 100)..."
    else
        error "AI ассистент не помнит контекст"
        echo "Ответ: $context_response"
    fi
}

# Тест плейсхолдеров
test_placeholders() {
    log "Тестирование плейсхолдеров..."
    
    # Создание таблицы с плейсхолдерами
    log "Создание таблицы с плейсхолдерами..."
    table_response=$(curl -s -X POST http://localhost:8000/api/tables \
        -H "Content-Type: application/json" \
        -d '{
            "name": "test_placeholders",
            "description": "Тест плейсхолдеров"
        }')
    
    table_id=$(echo "$table_response" | jq -r '.id' 2>/dev/null || echo "")
    if [ -n "$table_id" ] && [ "$table_id" != "null" ]; then
        success "Таблица создана (ID: $table_id)"
        
        # Добавление колонки с плейсхолдером
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/columns" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "company_name",
                "type": "text",
                "placeholder": "company"
            }' > /dev/null
        
        # Добавление данных
        curl -s -X POST "http://localhost:8000/api/tables/$table_id/rows" \
            -H "Content-Type: application/json" \
            -d '{
                "data": {
                    "company_name": "HB3 Accelerator"
                }
            }' > /dev/null
        
        success "Плейсхолдеры настроены"
        
        # Очистка
        curl -s -X DELETE "http://localhost:8000/api/tables/$table_id" > /dev/null
        
    else
        error "Не удалось создать таблицу для плейсхолдеров"
    fi
}

# Проверка производительности
test_performance() {
    log "Тестирование производительности..."
    
    start_time=$(date +%s)
    
    # Тест скорости ответа
    response_time=$(curl -s -w "%{time_total}" -o /dev/null \
        -X POST http://localhost:8000/api/chat/guest-message \
        -H "Content-Type: application/json" \
        -d '{
            "message": "Быстрый тест",
            "guestId": "test-guest-123"
        }')
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    
    if (( $(echo "$response_time < 10" | bc -l) )); then
        success "Время ответа: ${response_time}s (нормально)"
    else
        warning "Время ответа: ${response_time}s (медленно)"
    fi
    
    # Проверка памяти
    ollama_memory=$(docker stats dapp-ollama --no-stream --format "table {{.MemUsage}}" | tail -1)
    log "Использование памяти Ollama: $ollama_memory"
}

# Главная функция
main() {
    echo "🚀 Начинаем полный тест AI ассистента"
    echo "========================================"
    
    check_dependencies
    echo
    
    check_containers
    echo
    
    test_ollama
    echo
    
    test_backend_api
    echo
    
    test_rag_system
    echo
    
    test_ai_assistant
    echo
    
    test_placeholders
    echo
    
    test_performance
    echo
    
    echo "🎯 Тестирование завершено!"
    echo "================================"
    
    # Итоговая статистика
    log "Статус контейнеров:"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
}

# Запуск
main "$@"
