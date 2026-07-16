**English** | [Русский](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/Docs/src/branch/main/README.ru.md)

---

# Digital Legal Entity (DLE) — Application Template

## Product definition

**Digital Legal Entity (DLE)** is a microservices platform with a web application for on-premise deployment on company servers.

**Includes:**
- AI agent configuration tools
- Smart contract system with support for:
  - Tax, accounting, banking, and other identifiers set by the regulator

**Benefits:**
- Business process management and automation
- Replacement of fragmented SaaS services with monthly subscriptions
- Compliance with regulator requirements for data storage and processing

## Documentation (English)

| Document | Description |
|----------|-------------|
| [LICENSE](LICENSE) | EULA — license, IP, non-revocation |
| [service-terms.md](legal.en/service-terms.md) | Terms of purchase and service |
| [contributor-client-agreement.md](legal.en/templates/contributor-client-agreement.md) | Contributor ↔ client agreement template |
| [contributor-client-specification.md](legal.en/templates/contributor-client-specification.md) | Specification / invoice |
| [contributor-client-acceptance-act.md](legal.en/templates/contributor-client-acceptance-act.md) | Acceptance act and token Tx record |
| [ai-assistant.md](docs.en/ai-assistant.md) | AI agents: architecture, examples, setup |
| [blockchain-for-business.md](docs.en/blockchain-for-business.md) | Blockchain for business and practical cases |
| [security.md](docs.en/security.md) | Security and regulatory compliance |
| [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md) | Frequently asked questions |

### Technical and backend docs

- [Setup guide](docs.en/back-docs/setup-instruction.md) — full application setup
- [AI assistant setup](docs.en/back-docs/setup-ai-assistant.md) — RAG and Ollama
- [Blockchain integration](docs.en/back-docs/blockchain-integration-technical.md) — smart contracts and multichain
- [Tables system](docs.en/back-docs/tables-system.md) — spreadsheets and RAG
- [Multi-agent architecture](docs.en/back-docs/multi-agent-architecture.md)

### Related

- [Legal documents (EN)](legal.en/README.md) — license, copyright, attribution
- [Юридические документы (RU)](legal.ru/README.md) — лицензия, авторские права

---

## Full Digital Legal Entity application template for on-premise deployment

## Requirements

- Docker and Docker Compose

## Quick start

### Automated install (recommended)

**Linux/macOS/WSL:**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash
```
The script downloads the latest release artifacts and deploys `docker-data`.

### Releases and artifacts

- [Release v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) (Latest) — full application template with Docker images, volumes, and encryption key. Archive split into parts (`dle-template.tar.gz.part-*`) for easier download.
- [Release v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — previous version.
- [Release v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — previous version.
- [Release v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — previous version.

### Run the application

```bash
docker-compose up -d
```

### Access

#### Production
- **Frontend:** http://localhost:9000 (HTTP)

### Stop

```bash
docker-compose down
```

### Contacts

- **Email:** info@hb3-accelerator.com
- **Support:** https://hb3-accelerator.com/

---
