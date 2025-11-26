# 🚀 Digital Legal Entity (DLE) - Application Template

**🌐 Language / Язык:** [🇷🇺 Русский](README.md) | [🇬🇧 English](README.en.md)

## Description
Complete Digital Legal Entity application template

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

**For Windows PowerShell:**
```powershell
# Use WSL or Git Bash
wsl bash -c "curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash"
```

**Alternative for Windows (Git Bash):**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```

The script automatically downloads the latest artifacts from the release and deploys `docker-data`.

### 📦 Releases and artifacts
- [Release v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — contains an archive split into parts (`dle-template.tar.gz.part-*`) that is installed together with the script.

### Running the application
```bash
docker-compose up -d
```

### Access to the application

#### Production
- **Frontend**: http://localhost:9000 (HTTP) or https://localhost:9443 (HTTPS)

### Stopping
```bash
docker-compose down
```

### 📞 **Contacts:**
- **Email:** info@hb3-accelerator.com
- **Website:** https://hb3-accelerator.com
- **GitHub:** https://github.com/VC-HB3-Accelerator
- **Support:** https://hb3-accelerator.com/

