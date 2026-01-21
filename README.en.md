# 🚀 Digital Legal Entity (DLE) - Application Template

**🌐 Language / Язык:** [🇷🇺 Русский](README.md) | [🇬🇧 English](README.en.md)

## 📖 Description

**Digital Legal Entity (DLE)** is a microservices IT infrastructure with a web application for on-premises deployment on company servers. It includes AI agent configuration tools and a smart contract system supporting legal entity credentials and regulatory identifiers for financial operations. Provides business process management and automation, replaces fragmented SaaS services with monthly subscriptions, and complies with regulatory requirements for data storage and processing.

Complete Digital Legal Entity application template for deployment on your own infrastructure.

## 📋 Requirements
- Docker and Docker Compose

## 📚 Documentation
- [General materials and instructions](docs-en/README.md) | [Русский](docs/README.md)
- [Legal documents](legal-en/README.md) | [Русский](legal/README.md)
- [Commercial proposal for entrepreneurs](docs-en/commercial-proposal-entrepreneurs.md) | [Русский](docs/commercial-proposal-entrepreneurs.md)

## 🚀 Quick Start

### Automatic installation (recommended)

**For Linux/macOS/WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```

The script automatically downloads the latest artifacts from the release and deploys `docker-data`.

### 📦 Releases and artifacts
- [Release v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) (Latest) — contains the complete application template with Docker images, volumes, and encryption key. Archive is split into parts (`dle-template.tar.gz.part-*`) for easy download.
- [Release v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — previous version.
- [Release v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — previous version.
- [Release v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — previous version.

### Running the application
```bash
docker-compose up -d
```

### Access to the application

#### Production
- **Frontend**: http://localhost:9000 (HTTP)

### Stopping
```bash
docker-compose down
```

### 📞 **Contacts:**
- **Email:** info@hb3-accelerator.com
- **Website:** https://hb3-accelerator.com
- **GitHub:** https://github.com/VC-HB3-Accelerator
- **Support:** https://hb3-accelerator.com/

