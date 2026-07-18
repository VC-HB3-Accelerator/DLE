**English** | [Русский](README.ru.md)

---

# Digital Legal Entity (DLE) — download the OS template to create a digital legal entity profile

An operating system for online registration of a digital legal entity profile in the country where commercial activity is actually carried out.

**Start serving local clients in about 15 minutes.**

## Automated install (recommended)

**For Linux/macOS/WSL.**  
Minimum server requirements: 4 CPU cores, 16 GB RAM, 100 GB SSD.

Install from **the same mirror** you opened this page on: `setup.sh` clones the repo and downloads release artifacts **from that mirror’s storage**.

**GitHub**
```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh \
  | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE
```

**HB3 Gitea** ([hb3-accelerator.com](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE))
```bash
BASE=https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE
curl -fsSL "$BASE/raw/branch/main/setup.sh" | bash -s -- --base-url="$BASE"
```

**Erayti Gitea** ([эрайти.рф](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE))
```bash
BASE=https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE
curl -fsSL "$BASE/raw/branch/main/setup.sh" | bash -s -- --base-url="$BASE"
```

The script downloads artifacts from the chosen mirror and unpacks `docker-data`.  
Next: [releases, run, access](#releases-and-artifacts).

## What it is

**DLE** is a personal operating system template for a legal entity: install on your own infrastructure (including a local device **in the country of activity**); the technology core is EVM and AI. Perpetual license; the installed instance and the right to use it are your asset (see [LICENSE](LICENSE)). The template includes mechanisms for depersonalization, encryption, processing, and storage of personal data — aligned with the applicable data-protection regulator’s requirements in the country where you operate, including the ability to keep personal data localized on your own site (see [security.md — personal data](docs.en/security.md#personal-data-regulatory-alignment)).

## Why

The usual path — after registering a business you start taking out paid subscriptions to services for automation, control, accounting, and payments. In practice that means vendor dependency, manual data transfer between services, rising costs, and no full control over your own assets.

If you need a business on **one OS you own** for automation — a system that becomes a **digital asset**, not a stack of subscriptions — download the template and sign an agreement with an authorized contributor to get the license, updates, and support (baseline 5 years under the service terms).

### Case studies

Illustrative DLE application scenarios. Mentions of well-known companies and brands are a **model demonstration**, not a description of real collaboration, pilots, or deployments at those organizations.

- [Case: two paths to organize a business](docs.en/case-traditional-vs-dle.md)
- [Case: OpenAI on DLE](docs.en/case-vc-fund-traditional-vs-dle.md)
- [Case: Coca-Cola on DLE](docs.en/case-coca-cola-on-dle.md)

## How to start

1. **Install the template** on your infrastructure (command above). In about 15 minutes the OS runtime is up.

2. **Sign an agreement** with an authorized contributor (agreement, specification, and acceptance act templates are under [Documents](#documents)). The agreement records price, package (Standard / Premium), and your wallet address.

3. **Receive a license token** on that wallet (Sepolia network). The token is the on-chain record of your license. It is used to:
   - record the license and bind it to your wallet;
   - accept the EULA with the rightsholder;
   - obtain admin rights in the installed template;
   - receive updates and support (while the token is on your address; baseline 5 years);
   - vote on product development (1 token = 1 vote).

   The token is non-financial: not a means of payment and not a security.


## Documents

| File | Description |
| --- | --- |
| [LICENSE](LICENSE) | EULA — license, IP, non-revocation |
| [service-terms.md](legal.en/service-terms.md) | Purchase and service terms |
| [contributor-client-agreement.md](legal.en/templates/contributor-client-agreement.md) | Contributor agreement template |
| [contributor-client-specification.md](legal.en/templates/contributor-client-specification.md) | Specification / invoice |
| [contributor-client-acceptance-act.md](legal.en/templates/contributor-client-acceptance-act.md) | Acceptance act and token recording |
| [ai-assistant.md](docs.en/ai-assistant.md) | AI agents: architecture, examples, setup |
| [blockchain-for-business.md](docs.en/blockchain-for-business.md) | Blockchain for business and practical cases |
| [security.md](docs.en/security.md) | Security and regulatory alignment |
| [FAQ](https://github.com/VC-HB3-Accelerator/Docs/blob/main/en/FAQ.md) ([HB3](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/Docs/src/branch/main/en/FAQ.md) · [Erayti](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/Docs/src/branch/main/en/FAQ.md)) | Frequently asked questions |

### Releases and artifacts

Latest **v1.0.3** — full application template with Docker images, volumes, and encryption key; archive is split into parts (`dle-template.tar.gz.part-*`). Use the release on **the same mirror** you install from:

| Mirror | v1.0.3 (Latest) | Previous |
| --- | --- | --- |
| GitHub | [v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) | [v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) · [v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) · [v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) |
| HB3 Gitea | [v1.0.3](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) | [v1.0.2](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) · [v1.0.1](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) · [v1.0.0](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) |
| Erayti Gitea | [v1.0.3](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) | [v1.0.2](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) · [v1.0.1](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) · [v1.0.0](https://xn--80aqc0am6d.xn--p1ai/gitea/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) |

### Command to run the OS
```bash
docker-compose up -d
```

### Application access

#### Production
- **Frontend**: http://localhost:9000 (HTTP)

### Command to stop the OS
```bash
docker-compose-down
```

### Contacts
- **Email:** info@hb3-accelerator.com
- **Support:** https://hb3-accelerator.com/
