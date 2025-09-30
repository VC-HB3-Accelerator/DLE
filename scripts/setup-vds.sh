#!/bin/bash

# Упрощенный скрипт подготовки ISO образа для SSH туннелей
# Только то, что нужно для туннелей

set -e

echo "🚀 Начинаем подготовку ISO образа для SSH туннелей..."

# Обновляем систему
echo "📦 Обновляем систему..."
apt-get update && apt-get upgrade -y

# Устанавливаем только необходимые пакеты
echo "🔧 Устанавливаем необходимые пакеты..."
apt-get install -y \
    curl \
    wget \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban \
    nano \
    htop

# Создаем пользователя dle
echo "👤 Создаем пользователя dle..."
useradd -m -s /bin/bash dle
usermod -aG sudo dle

# Настраиваем Nginx
echo "🌐 Настраиваем Nginx..."
systemctl enable nginx
systemctl start nginx

# Настраиваем безопасность
echo "🛡️ Настраиваем безопасность..."

# Firewall
ufw --force enable
ufw allow ssh
ufw allow 80
ufw allow 443

# Fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Создаем SSH ключи для пользователя dle
echo "🔑 Создаем SSH ключи..."
sudo -u dle mkdir -p /home/dle/.ssh
sudo -u dle ssh-keygen -t rsa -b 4096 -f /home/dle/.ssh/id_rsa -N ""
sudo -u dle ssh-keygen -t ed25519 -f /home/dle/.ssh/id_ed25519 -N ""
chmod 700 /home/dle/.ssh
chmod 600 /home/dle/.ssh/id_rsa
chmod 644 /home/dle/.ssh/id_rsa.pub
chmod 600 /home/dle/.ssh/id_ed25519
chmod 644 /home/dle/.ssh/id_ed25519.pub

# Создаем базовую конфигурацию Nginx
echo "🌐 Создаем базовую конфигурацию Nginx..."
cat > /etc/nginx/sites-available/tunnel-default << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # Базовые заголовки безопасности
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Скрытие информации о сервере
    server_tokens off;
    
    # Заглушка
    location / {
        return 200 'Tunnel Server Ready - Configure your domain';
        add_header Content-Type text/plain;
    }
}
EOF

ln -sf /etc/nginx/sites-available/tunnel-default /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Создаем скрипт для настройки туннелей
echo "📝 Создаем скрипт для настройки туннелей..."
cat > /home/dle/setup-tunnel.sh << 'EOF'
#!/bin/bash

# Скрипт для настройки SSH туннелей

set -e

echo "🚀 Настройка SSH туннелей..."

# Проверяем параметры
if [ -z "$1" ]; then
    echo "Использование: $0 <domain> <email>"
    echo "Пример: $0 example.com admin@example.com"
    exit 1
fi

DOMAIN=$1
EMAIL=$2

# Создаем конфигурацию Nginx для домена
echo "🌐 Создаем конфигурацию Nginx для домена..."
cat > /etc/nginx/sites-available/$DOMAIN << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Базовые заголовки безопасности
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Скрытие информации о сервере
    server_tokens off;
    
    # Проксирование к SSH туннелю
    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API проксирование
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket поддержка
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_EOF

# Активируем конфигурацию
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Получаем SSL сертификат
echo "🔒 Получаем SSL сертификат..."
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL

echo "✅ SSH туннели настроены!"
echo "🌐 Домен: https://$DOMAIN"
echo "🔧 Frontend туннель: localhost:9000"
echo "🔧 Backend туннель: localhost:8000"
EOF

chmod +x /home/dle/setup-tunnel.sh

# Создаем README для пользователя
echo "📖 Создаем README..."
cat > /home/dle/README.md << 'EOF'
# Tunnel Server Ready

Этот сервер подготовлен для SSH туннелей.

## Установленные компоненты:
- ✅ Ubuntu 22.04 LTS
- ✅ Nginx
- ✅ Certbot (SSL)
- ✅ UFW Firewall
- ✅ Fail2ban
- ✅ SSH ключи

## Настройка туннелей:

1. Настройте DNS записи для вашего домена
2. Запустите скрипт настройки:
   ```bash
   ./setup-tunnel.sh example.com admin@example.com
   ```

## SSH туннели:

Для подключения туннелей используйте:

```bash
# Frontend туннель (порт 9000)
ssh -R 9000:localhost:5173 dle@<VDS_IP>

# Backend туннель (порт 8000)
ssh -R 8000:localhost:8000 dle@<VDS_IP>
```

## Полезные команды:
```bash
# Статус сервисов
sudo systemctl status nginx

# Перезапуск Nginx
sudo systemctl reload nginx

# Проверка SSL
sudo certbot certificates

# SSH ключи
cat ~/.ssh/id_rsa.pub
cat ~/.ssh/id_ed25519.pub
```
EOF

# Очищаем систему
echo "🧹 Очищаем систему..."
apt-get clean
apt-get autoremove -y
rm -rf /tmp/*
rm -rf /var/tmp/*
rm -rf /var/log/*.log
rm -rf /var/log/*.1
rm -rf /var/log/*.gz

# Создаем финальную информацию
echo "✅ ISO образ для туннелей готов!"
echo "📋 Установленные компоненты:"
echo "   - Ubuntu 22.04 LTS"
echo "   - Nginx"
echo "   - Certbot (SSL)"
echo "   - UFW Firewall"
echo "   - Fail2ban"
echo "   - SSH ключи"
echo ""
echo "👤 Пользователь: dle"
echo "📁 Проект: /home/dle"
echo "🚀 Скрипт настройки: /home/dle/setup-tunnel.sh"
echo ""
echo "🔧 Для создания ISO образа выполните:"
echo "   sudo dd if=/dev/sda of=tunnel-ubuntu-22.04.iso bs=4M"
