# 🚀 Digital Legal Entity (DLE) - Шаблон приложения

**🌐 Language / Язык:** [🇷🇺 Русский](README.md) | [🇬🇧 English](README.en.md)

## 📖 Описание

**Digital Legal Entity (DLE)** — микросервисная платформа с веб-приложением для локальной установки на серверах компании. Включает инструменты настройки ИИ-агентов и систему смарт-контрактов с поддержкой налоговых, бухгалтерских, банковских и иных идентификаторов, установленных регулятором. Обеспечивает управление и автоматизацию бизнес-процессов, позволяет отказаться от разрозненных SaaS-сервисов с ежемесячными подписками и соответствует требованиям регуляторов к хранению и обработке данных.

Полный шаблон приложения Digital Legal Entity для развертывания на собственной инфраструктуре.

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
Скрипт автоматически скачивает последние артефакты из релиза и разворачивает `docker-data`.

### 📦 Релизы и артефакты
- [Релиз v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) (Latest) — содержит полный шаблон приложения с Docker образами, томами и ключом шифрования. Архив разделен на части (`dle-template.tar.gz.part-*`) для удобства загрузки.
- [Релиз v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — предыдущая версия.
- [Релиз v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — предыдущая версия.
- [Релиз v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — предыдущая версия.

### Запуск приложения
```bash
docker-compose up -d
```

### Доступ к приложению

#### Продакшн (production)
- **Frontend**: http://localhost:9000 (HTTP)

### Остановка
```bash
docker-compose-down
```

### 📞 **Контакты:**
- **Email:** info@hb3-accelerator.com
- **Сайт:** https://hb3-accelerator.com
- **GitHub:** https://github.com/VC-HB3-Accelerator
- **Поддержка:** https://hb3-accelerator.com/