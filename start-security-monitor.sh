#!/bin/bash

# Copyright (c) 2024-2025 Тарабанов Александр Викторович
# All rights reserved.
# 
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
# 
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/VC-HB3-Accelerator

# Простой скрипт для запуска мониторинга безопасности
# Использование: ./start-security-monitor.sh

echo "🔒 Запуск мониторинга безопасности DLE..."

# Останавливаем старые процессы мониторинга
echo "🛑 Остановка старых процессов мониторинга..."
pkill -f 'security-monitor.sh' 2>/dev/null || true
sleep 2

# Запускаем мониторинг в фоне
nohup ./security-monitor.sh > security-monitor.log 2>&1 &

echo "✅ Мониторинг запущен в фоне"
echo "PID: $!"
echo ""
echo "Команды управления:"
echo "  Остановить: pkill -f 'security-monitor.sh'"
echo "  Статус: ps aux | grep security-monitor"
echo "  Логи: tail -f security-monitor.log"
echo "  Подозрительные домены: tail -f /var/log/security-monitor/suspicious_domains.txt"
echo "  Заблокированные IP: tail -f /var/log/security-monitor/blocked_ips.txt" 