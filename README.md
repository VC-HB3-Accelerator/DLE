# 🚀 Digital Legal Entity (DLE) - Шаблон приложения

**🌐 Language / Язык:** [🇷🇺 Русский](README.md) | [🇬🇧 English](README.en.md)

## Описание
Полный шаблон приложения Digital Legal Entity

## 📋 Требования
- Docker и Docker Compose

## 📚 Документация
- [Общие материалы и инструкции](docs/README.md) | [English](docs-en/README.md)
- [Юридические документы](legal/README.md) | [English](legal-en/README.md)
- [Коммерческое предложение для предпринимателей](docs/commercial-proposal-entrepreneurs.md) | [English](docs-en/commercial-proposal-entrepreneurs.md)

## 🚀 Быстрый запуск

### Автоматическая установка (рекомендуется)

**Для Linux/macOS/WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```

**Для Windows PowerShell:**
```powershell
# Используйте WSL или Git Bash
wsl bash -c "curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash"
```

**Альтернатива для Windows (Git Bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```

Скрипт автоматически скачивает последние артефакты из релиза и разворачивает `docker-data`.

### 📦 Релизы и артефакты
- [Релиз v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — содержит архив, разбитый на части (`dle-template.tar.gz.part-*`), который устанавливается вместе со скриптом.

### Запуск приложения
```bash
docker-compose up -d
```

### Доступ к приложению

#### Продакшн (production)
- **Frontend**: http://localhost:9000 (HTTP) или https://localhost:9443 (HTTPS)

### Остановка
```bash
docker-compose-down
```

### 📞 **Контакты:**
- **Email:** info@hb3-accelerator.com
- **Сайт:** https://hb3-accelerator.com
- **GitHub:** https://github.com/VC-HB3-Accelerator
- **Поддержка:** https://hb3-accelerator.com/