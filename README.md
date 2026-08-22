**English** | [Русский](README.ru.md)

---

# Digital Legal Entity (DLE) — download the OS template to create a digital legal entity profile

An operating system for online registration of a digital legal entity profile in the country where commercial activity is actually carried out.

**Start serving local clients in about 15 minutes.**

## Automated install (recommended)

Minimum requirements: 4 CPU cores, 16 GB RAM, 100 GB SSD.  
This command installs the OS from **this** repository and its release (clone + artifacts from the same storage). The script downloads release artifacts and unpacks `docker-data`.

### Linux

**Step 1.** Open a terminal.

**Step 2.** Copy and paste the command into the terminal — **install the DLE template** (the script installs Docker automatically if missing):

```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh \
  | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE
```

### macOS

**Step 1.** Open Terminal.

**Step 2.** Copy and paste the command into the terminal — **install Docker Desktop**:

```bash
brew install --cask docker
```

**Step 3.** Copy and paste the command into the terminal — **start Docker Desktop**:

```bash
open -a Docker
```

Wait until Docker Desktop is running.

**Step 4.** Copy and paste the command into the terminal — **install the DLE template**:

```bash
curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh \
  | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE
```

### Windows

**Step 1.** Open PowerShell as Administrator.

**Step 2.** Copy and paste the command into the terminal — **install WSL**:

```powershell
wsl --install
```

**Step 3.** **Reboot Windows.**

**Step 4.** Copy and paste the command into the terminal — **install Docker Desktop**:

```powershell
winget install -e --id Docker.DockerDesktop
```

**Step 5.** Copy and paste the command into the terminal — **install the DLE template**:

```powershell
wsl bash -c "cd ~ && curl -fsSL https://raw.githubusercontent.com/VC-HB3-Accelerator/DLE/main/setup.sh | bash -s -- --base-url=https://github.com/VC-HB3-Accelerator/DLE"
```

Install goes to the WSL home directory (`~/DLE`), not the `C:` drive.

## What it is

**DLE** is a personal operating system template for a legal entity. Install on your own infrastructure (including locally **in the country of activity**); the core is **EVM** and **AI**. Perpetual license: the installed instance is **your asset**, not renting someone else’s cabinet ([LICENSE](LICENSE)). Data and operations stay with you; the template includes depersonalization, encryption, and personal-data storage aligned with your country’s regulator, including localization on your site ([security.md](docs.en/security.md#personal-data-regulatory-alignment)).

## Why

The usual path after registering a business is a stack of paid subscriptions for automation, accounting, and payments: vendor lock-in, manual data transfer, rising costs, and weak control over your assets.

If you want a business on **one OS you own** — a system that becomes a **digital asset**, not a pile of services — download the template and sign with an authorized contributor: license, updates, and support (baseline 5 years).

Full narrative for owners and operators: [DLE OS presentation](docs.en/os-dle-presentation.md).

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
| [os-dle-presentation.md](docs.en/os-dle-presentation.md) | DLE OS — business presentation (framework) |
| [ai-assistant.md](docs.en/ai-assistant.md) | AI agents: architecture, examples, setup |
| [blockchain-for-business.md](docs.en/blockchain-for-business.md) | Blockchain for business and practical cases |
| [security.md](docs.en/security.md) | Security and regulatory alignment |
| [FAQ](https://github.com/VC-HB3-Accelerator/Docs/blob/main/en/FAQ.md) | Frequently asked questions |

### Releases and artifacts

Latest **v1.0.7** — full application template with Docker images, volumes, and encryption key; archive is split into parts (`dle-template.tar.gz.part-*`).

- [Release v1.0.7](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.7) (Latest)
- [Release v1.0.6](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.6) — previous version
- [Release v1.0.3](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.3) — previous version
- [Release v1.0.2](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.2) — previous version
- [Release v1.0.1](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.1) — previous version
- [Release v1.0.0](https://github.com/VC-HB3-Accelerator/DLE/releases/tag/v1.0.0) — previous version

### Command to run the OS

After the install block above, the OS directory is **`DLE`** in the home folder (`~/DLE`): that is where `setup.sh` clones the repository. Start Docker and wait until it is ready, then in the terminal go to that folder and start the stack.

#### Linux

Copy and paste into the terminal:

```bash
sudo systemctl start docker
cd ~/DLE
docker-compose up -d
```

#### macOS

Copy and paste into Terminal (wait for the Docker Desktop whale, then run `cd` and start if Desktop is still launching):

```bash
open -a Docker
cd ~/DLE
docker-compose up -d
```

#### Windows

Step 5 of the install puts the OS in the WSL home directory: `~/DLE` (not the `C:` drive).

**1.** Start the Docker Desktop app — copy into PowerShell:

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Wait for the green tray icon.

**2.** Start the OS — copy into PowerShell:

```powershell
wsl bash -c "cd ~/DLE && docker-compose up -d"
```

### Application access

#### Production
- **Frontend**: http://localhost:9000 (HTTP)

### Command to stop the OS

From the same `~/DLE` folder. The script stops **this** instance (`dev` profile and orphans of this compose file). It does not remove containers that belong to another folder.

#### Linux and macOS

```bash
cd ~/DLE
./docker-compose-down
```

#### Windows

```powershell
wsl bash -c "cd ~/DLE && ./docker-compose-down"
```

### Contacts
- **Email:** info@hb3-accelerator.com
- **Support:** https://hb3-accelerator.com/
