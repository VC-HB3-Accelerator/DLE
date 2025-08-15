#!/bin/bash

/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

# Простой скрипт для запуска мониторинга безопасности
# Использование: ./start-security-monitor.sh

echo "🔒 Запуск мониторинга безопасности DLE..."

# Проверяем, не запущен ли уже мониторинг
if pgrep -f "security-monitor.sh" > /dev/null; then
    echo "⚠️  Мониторинг уже запущен!"
    echo "PID: $(pgrep -f 'security-monitor.sh')"
    echo ""
    echo "Команды управления:"
    echo "  Остановить: pkill -f 'security-monitor.sh'"
    echo "  Статус: ps aux | grep security-monitor"
    echo "  Логи: tail -f /tmp/suspicious_domains.txt"
    exit 1
fi

# Запускаем мониторинг в фоне
nohup ./security-monitor.sh > security-monitor.log 2>&1 &

echo "✅ Мониторинг запущен в фоне"
echo "PID: $!"
echo ""
echo "Команды управления:"
echo "  Остановить: pkill -f 'security-monitor.sh'"
echo "  Статус: ps aux | grep security-monitor"
echo "  Логи: tail -f security-monitor.log"
echo "  Подозрительные домены: tail -f /tmp/suspicious_domains.txt"
echo "  Заблокированные IP: tail -f /tmp/blocked_ips.txt" 