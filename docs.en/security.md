**English** | [Русский](https://hb3-accelerator.com/gitea/VC-HB3-Accelerator/Docs/src/branch/main/docs.ru/security.md)

# Digital Legal Entity (DLE) Security

## Table of Contents

1. [Introduction](#introduction)
2. [Security Model](#security-model)
3. [Token-Based Access Control](#token-based-access-control)
4. [Smart Contract Security](#smart-contract-security)
5. [Wallet Compromise Protection](#wallet-compromise-protection)
6. [Web Application Security](#web-application-security)
7. [Module Management](#module-management)
8. [Audit and Monitoring](#audit-and-monitoring)
9. [Security Recommendations](#security-recommendations)
10. [Attack Scenarios and Mitigation](#attack-scenarios-and-mitigation)
11. [Personal Data Regulatory Alignment](#personal-data-regulatory-alignment)
12. [Conclusion](#conclusion)

---

## Introduction

Digital Legal Entity (DLE) is built with a focus on **security at every layer**:
- Access control via blockchain tokens
- Smart contract protection against compromise
- Tokens cannot be stolen even if a wallet is compromised
- Governance only through voting with quorum

### Key Security Principles

1. **Secure by default** - all actions are denied until explicitly allowed
2. **Least privilege** - everyone receives only the rights they need
3. **Transparency** - all actions are recorded on the blockchain
4. **Immutability** - history cannot be forged
5. **Collective control** - critical operations only through voting

---

## Security Model

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DLE Protection Layers                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Blockchain (Immutable Base)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • DLE smart contract (audited, immutable)             │  │
│  │ • Governance tokens (ERC20Votes)                      │  │
│  │ • History of all operations on-chain                  │  │
│  │ • Rules cannot change without voting                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 2: Web Application (Backend)                         │
│  � voting                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 2: Web Application (Backend)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Real-time token checks                              │  │
│  │ • Wallet authentication (SIWE)                        │  │
│  │ • Data encryption (AES-256)                           │  │
│  │ • Rate limiting and DDoS protection                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 3: Frontend (Vue.js)                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet connection                                   │  │
│  │ • Transaction signing                                 │  │
│  │ • XSS protection (DOMPurify)                          │  │
│  │ • CSRF tokens                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 4: User                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet private key (MetaMask, WalletConnect)        │  │
│  │ • Confirmation of every operation                     │  │
│  └───────────────────────────────────────────────────────�
│  │ • Wallet private key (MetaMask, WalletConnect)        │  │
│  │ • Confirmation of every operation                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Threat Model

| Threat | Risk Level | Protection |
|--------|------------|------------|
| **Wallet compromise** | Medium | Tokens cannot be transferred without voting |
| **Web application compromise** | Low | All rights checked on-chain; governance via block explorers |
| **Smart contract compromise** | Low | Audit, OpenZeppelin, immutability |
| **DDoS attack** | Medium | Rate limiting, CDN, backup servers |
| **Phishing** | High | User education, domain verification |
| **Insider threat** | Low | All actions through voting |

### Critically important: the web application is only an interface

**Key feature of the DLE architecture:**

```
┌─────────────────────────────────────────────────────────┐
│              Web application (interface)                │
│                                                         │
│  Frontend + Backend = CONVENIENCE of use                │
│  • Polished UI                                          │
│  • Convenient navigation                                │
│  • Fast access to features                              │
│                                                         │
│  Can be compromised / unavailable                       │
│  ✅ BUT! Business assets remain protected               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│               Blockchain (real authority)               │
│                                                         │
│  Smart contracts = REAL asset control                   │
│  • Governance tokens                                    │
│  • Treasury with assets                                 │
│  • Voting rules                                         │
│  • History of all decisions                             │
│                                                         │
│  Protected by cryptography                              │
│  ✅ Works independently of the web application          │
└─────────────────────────────────────────────────────────┘
```

**What happens if the web application is compromised:**

```
Web application compromised / unavailable:
├── ❌ Web interface does not work
├── ❌ Backend may show incorrect information
├── ❌ Frontend may be substituted
│
BUT:
├── ✅ All business assets remain on the blockchain
├── ✅ Smart contracts continue to work
├── ✅ Tokens cannot be stolen
├── ✅ Governance via Etherscan/Polygonscan/etc. is possible
└── ✅ A new frontend can be built and connected to the same contracts
```

**Real-world example:**

1. An attacker compromises your web application server
2. Tries to show forged token balances
3. **But**: Real balances on the blockchain remain unchanged
4. You open Etherscan and see the truth
5. Create a recovery proposal via Etherscan
6. Vote and execute the proposal
7. Restore the web application
8. **Result**: Not a single token is lost ✅

---

## Token-Based Access Control

### How It Works

**Without tokens, access to the application is IMPOSSIBLE.**

```
Attempt to access DLE:
├── 1. User connects a wallet
├── 2. Backend checks token balance in the smart contract
├── 3. If there are NO tokens → Access DENIED
└── 4. If tokens EXIST → Access granted (level depends on amount)
```

### Access Levels

| Tokens on balance | Access level | Rights |
|-------------------|--------------|--------|
| **0 tokens** | ❌ No access | Only the "No access" page |
| **1+ tokens** | ✅ ReadOnly | View data |
| **100+ tokens** | ✅ Editor | Edit, create |
| **Any amount** | 🗳️ Voting | 1 token = 1 vote |

### Real-Time Token Checks

The **Backend** continuously checks token balances:

```javascript
// Каждый запрос проверяет токены
async function checkAccess(req, res, next) {
    const address = req.session.address;
    
    // Получаем баланс токенов из смарт-контракта
    const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
    const balance = await dleContract.balanceOf(address);
    
    if (balance === 0n) {
        return res.status(403).json({ 
            error: 'Доступ запрещен: нет токенов' 
        });
    }
    
    // Определяем уровень доступа
    const accessLevel = determineAccessLevel(balance);
    req.user = { address, balance, accessLevel };
    
    next();
}
```

**Important**: The check runs on **every request**, therefore:
- ✅ If tokens are transferred → access is lost instantly
- ✅ If tokens are received → access appears instantly
- ✅ The check cannot be bypassed

### Initial Token Distribution

**Tokens are distributed by the owner at smart contract deploy time:**

```solidity
constructor(DLEConfig memory config) {
    // Создаем токены
    _mint(address(this), totalSupply);
    
    // Распределяем среди партнеров
    for (uint i = 0; i < config.initialPartners.length; i++) {
        _transfer(
            address(this), 
            config.initialPartners[i], 
            config.initialAmounts[i]
        );
    }
}
```

**Process**:
1. The wallet owner deploys the DLE smart contract
2. Specifies partner addresses and token amounts for each
3. Tokens are distributed automatically at deploy
4. After that, all changes only through voting

**Distribution example**:
```javascript
const config = {
    initialPartners: [
        '0xAlice...', // Основатель 1
        '0xBob...',   // Основатель 2
        '0xCarol...'  // Инвестор
    ],
    initialAmounts: [
        500000,  // 50% для Alice
        300000,  // 30% для Bob
        200000   // 20% для Carol
    ]
};
```

---

## Smart Contract Security

### Protection Against Token Transfers

**CRITICAL**: Governance tokens **CANNOT** be transferred by ordinary means!

```solidity
// Переводы ЗАБЛОКИРОВАНЫ
function transfer(address to, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrTransfersDisabled();
}

// Одобрения ЗАБЛОКИРОВАНЫ
function approve(address spender, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrApprovalsDisabled();
}

// TransferFrom ЗАБЛОКИРОВАН
function transferFrom(address from, address to, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrTransfersDisabled();
}
```

**What this means**:
- ❌ Impossible to send tokens to an exchange
- ❌ Impossible to sell tokens on a DEX
- ❌ Impossible to transfer tokens to another person directly
- ❌ An attacker CANNOT steal tokens even from a compromised wallet

### The Only Way to Transfer Tokens

**Only through voting with quorum:**

```solidity
// Перевод токенов (только через голосование)
function _transferTokens(address recipient, uint256 amount) internal {
    require(msg.sender == address(this), "Only through governance");
    _transfer(address(this), recipient, amount);
}
```

**Transfer process**:
```
1. Create a proposal
   ├── "Transfer 1000 tokens to address 0xNew..."
   └── Required: at least 1 token to create

2. Voting
   ├── Duration: 1–30 days (configurable)
   ├── Each token = 1 vote
   └── Required: quorum (e.g., 10% of all tokens)

3. Quorum check
   ├── If "For" > "Against" AND quorum is reached
   └── → Proposal approved

4. Execution
   ├── Smart contract transfers tokens automatically
   └── Event recorded on-chain forever
```

### Quorum Configuration

**Quorum is set at deploy** and can be changed only through voting:

```solidity
uint256 public quorumPercentage; // Например, 10%

function _hasQuorum(uint256 forVotes, uint256 againstVotes) 
    internal 
    view 
    returns (bool) 
{
    uint256 totalVotes = forVotes + againstVotes;
    uint256 required = (totalSupply() * quorumPercentage) / 100;
    return totalVotes >= required;
}
```

**Quorum examples**:
- 5% - easy to reach (for active organizations)
- 10% - standard (recommended)
- 20% - strict (for critical decisions)
- 51% - absolute majority

### Reentrancy Protection

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DLE is ReentrancyGuard {
    function execute(uint256 proposalId) 
        external 
        nonReentrant  // Защита от реентерабельности
    {
        // Исполнение предложения
    }
}
```

### Flash-Loan Protection

**Vote snapshots** prevent attacks with temporary token borrowing:

```solidity
// Голоса берутся из ПРОШЛОГО блока
uint256 public snapshotTimepoint = block.number - 1;

function vote(uint256 proposalId, bool support) external {
    // Используем баланс из прошлого блока
    uint256 votingPower = getPastVotes(msg.sender, snapshotTimepoint);
    require(votingPower > 0, "No voting power");
    
    // Голосование
}
```

**Why this is safe**:
1. Attacker takes a flash-loan of 1,000,000 tokens
2. Tries to vote
3. Smart contract checks balance in the **previous block**
4. In the previous block the attacker had 0 tokens
5. Vote rejected ❌

### Validation of All Parameters

```solidity
// Проверка адресов
if (address == address(0)) revert ErrZeroAddress();

// Проверка наличия токенов
if (balanceOf(msg.sender) == 0) revert ErrNotHolder();

// Проверка длительности голосования
if (duration < minVotingDuration) revert ErrTooShort();
if (duration > maxVotingDuration) revert ErrTooLong();

// Проверка поддерживаемых сетей
if (!supportedChains[chainId]) revert ErrUnsupportedChain();
```

### Custom Errors for Gas Savings

```solidity
// Экономия gas: custom errors вместо require
error ErrZeroAddress();
error ErrNotHolder();
error ErrAlreadyVoted();
error ErrTransfersDisabled();
error ErrApprovalsDisabled();
error ErrProposalMissing();
error ErrWrongChain();
```

---

## Wallet Compromise Protection

### Scenario: Attacker Obtained the Private Key

**What the attacker can do:**

```
Attacker attempts:

1. ❌ Send tokens to their address
   └── BLOCKED: transfer() is disabled

2. ❌ Sell tokens on a DEX (Uniswap, etc.)
   └── BLOCKED: approve() is disabled

3. ❌ Send via transferFrom
   └── BLOCKED: transferFrom() is disabled

4. ❓ Create a proposal "Transfer tokens to me"
   └── Requires voting by other token holders
   └── Quorum: 10%+ must vote "For"
   └── MOST LIKELY FAILS
```

### Real Attack Example

```
Attacker compromised Alice's wallet (500,000 tokens):

1. Creates a proposal:
   "Transfer 500,000 tokens to address 0xEvil..."
   
2. Votes "For" with their 500,000 votes (50%)

3. But quorum = 10% = 100,000 votes
   Already reached? YES ✅

4. "For" = 500,000 (50%)
   "Against" = 0
   
5. Result: Proposal APPROVED ❌

PROBLEM: If Alice holds a majority of tokens!
```

### Protection Against Majority-Token Attacks

**Solution 1: Timelock Module**

```solidity
// Отложенное исполнение (например, 3 дня)
uint256 public constant TIMELOCK_DELAY = 3 days;

function scheduleProposal(uint256 proposalId) external {
    // Предложение одобрено, но исполнится только через 3 дня
    executionTime = block.timestamp + TIMELOCK_DELAY;
}
```

**Advantage**: Other token holders see the dangerous proposal and can:
- Vote "Against"
- Create a counter-proposal
- Take measures (e.g., go to court)

**Solution 2: Multisignature**

```solidity
// Требуется несколько подписей для критичных операций
mapping(uint256 => mapping(address => bool)) public approvals;

function executeWithApprovals(
    uint256 proposalId,
    address[] calldata signers,
    bytes[] calldata signatures
) external {
    // Проверяем подписи нескольких токен-холдеров
    require(signers.length >= minSigners, "Not enough signers");
    
    for (uint i = 0; i < signers.length; i++) {
        // Проверка подписи
        verifySignature(proposalId, signers[i], signatures[i]);
    }
    
    // Исполнение
}
```

**Solution 3: Cold wallet for large holders**

It is recommended to keep tokens on:
- 🥶 **Hardware wallet** (Ledger, Trezor) - maximum protection
- **Multisig** (Gnosis Safe) — multiple signatures required
- ❄️ **Cold storage** - offline, not connected to the internet

### Monitoring Suspicious Proposals

**Backend automatically detects dangerous proposals:**

```javascript
// Детектор подозрительных предложений
function detectSuspiciousProposal(proposal) {
    const alerts = [];
    
    // Проверка 1: Перевод большого количества токенов
    if (proposal.operation.includes('_transferTokens')) {
        const amount = decodeAmount(proposal.operation);
        const percentage = (amount / totalSupply) * 100;
        
        if (percentage > 10) {
            alerts.push({
                level: 'HIGH',
                message: `Предложение переводит ${percentage}% всех токенов!`
            });
        }
    }
    
    // Проверка 2: Инициатор голосует своими токенами
    if (proposal.forVotes === proposal.initiatorBalance) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Инициатор голосует только своими токенами'
        });
    }
    
    // Проверка 3: Быстрое голосование (< 24 часов)
    if (proposal.duration < 86400) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Голосование менее 24 часов - мало времени на проверку'
        });
    }
    
    // Отправляем уведомления всем токен-холдерам
    if (alerts.length > 0) {
        notifyAllTokenHolders(proposal, alerts);
    }
}
```

---

## Web Application Security

### Authentication via SIWE

**Sign-In with Ethereum** - a standard for secure authentication:

```javascript
// Генерация nonce (одноразовый)
const nonce = crypto.randomBytes(32).toString('hex');

// Сохранение в БД с шифрованием
await db.query(
    'INSERT INTO nonces (address_encrypted, nonce_encrypted, expires_at) VALUES ($1, $2, $3)',
    [encrypt(address), encrypt(nonce), expiresAt]
);

// Проверка подписи
const message = new SiweMessage({
    domain: req.get('host'),
    address: ethers.getAddress(address),
    nonce: nonce,
    chainId: 1
});

const isValid = await verifySignature(
    message.prepareMessage(),
    signature,
    address
);
```

**Security**:
- ✅ The private key **never** leaves the wallet
- ✅ Each nonce is used **once**
- ✅ Nonce expires after 5 minutes
- ✅ Forging a signature is impossible without the private key

### Data Encryption

```javascript
// AES-256 шифрование
const crypto = require('crypto');

function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encrypted, key) {
    const parts = encrypted.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}
```

**What is encrypted**:
- Wallet addresses in the DB
- Nonces for authentication
- Session data
- Private messages

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Ограничение запросов
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов
    message: 'Слишком много запросов, попробуйте позже'
});

// Ограничение для аутентификации (более строгое)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // максимум 5 попыток аутентификации
    skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

### CSRF Protection

```javascript
const csrf = require('csurf');

// CSRF токены для всех форм
const csrfProtection = csrf({ cookie: true });

app.post('/api/action', csrfProtection, async (req, res) => {
    // Проверка CSRF токена автоматическая
});
```

### XSS Protection

```javascript
import DOMPurify from 'dompurify';

// Очистка HTML от опасного кода
function sanitizeHTML(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
        ALLOWED_ATTR: ['href']
    });
}

// Использование
const userInput = req.body.comment;
const safeHTML = sanitizeHTML(userInput);
```

### Helmet.js for Header Protection

```javascript
const helmet = require('helmet');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
```

### Clean Logs System

**Automatic log scrubbing of sensitive data:**

```javascript
function cleanLogs() {
    const sensitivePatterns = [
        /0x[a-fA-F0-9]{40}/g,  // Адреса кошельков
        /pk_[a-zA-Z0-9]{64}/g,  // Приватные ключи (если случайно залогированы)
        /nonce:\s*[a-f0-9]{64}/gi,  // Nonces
    ];
    
    // Замена чувствительных данных на ***
    let cleanedLog = logContent;
    sensitivePatterns.forEach(pattern => {
        cleanedLog = cleanedLog.replace(pattern, '[REDACTED]');
    });
    
    return cleanedLog;
}
```

---

## Module Management

### Only the DLE Smart Contract Controls Modules

The **`onlyDLE` modifier** guarantees that only the DLE smart contract can call module functions:

```solidity
// Модуль: TreasuryModule
contract TreasuryModule {
    address public immutable dleContract;
    
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE can call");
        _;
    }
    
    // Только DLE может переводить токены из казны
    function transferTokens(
        address token,
        address recipient,
        uint256 amount
    ) external onlyDLE {
        IERC20(token).transfer(recipient, amount);
    }
}
```

**What this means**:
- ❌ The wallet owner **cannot** call module functions directly
- ❌ The Backend **cannot** call module functions
- ❌ An attacker **cannot** interact with the module
- ✅ **Only** the DLE smart contract through voting

### Module Usage Process

```
1. Token holder creates a proposal
   └── "Transfer 1000 USDC from Treasury to marketing"

2. Proposal contains an encoded module function call
   └── operation = treasuryModule.transferTokens(USDC, marketing, 1000)

3. Voting

4. If approved, the DLE contract calls the module:
   └── TreasuryModule.transferTokens() ✅
   └── msg.sender = DLE contract ✅
   
5. Module checks msg.sender and executes
```

### Adding a New Module

**Only through voting:**

```solidity
// Операция добавления модуля
function _addModule(bytes32 moduleId, address moduleAddress) internal {
    require(msg.sender == address(this), "Only through voting");
    require(moduleAddress != address(0), "Invalid address");
    require(!activeModules[moduleId], "Module already exists");
    
    modules[moduleId] = moduleAddress;
    activeModules[moduleId] = true;
    
    emit ModuleAdded(moduleId, moduleAddress);
}
```

**Process**:
1. Deploy the new module
2. Create a proposal: "Add module X at address 0x..."
3. Voting
4. If approved → module is added
5. Module can be used

### Removing a Compromised Module

If a module turns out to be vulnerable:

```
1. Token holder creates an emergency proposal
   └── "Remove compromised module X"
   └── Duration: 1 day (emergency vote)

2. Voting (accelerated)

3. Module removed
   └── Can no longer be called from the DLE contract
```

---

## Audit and Monitoring

### On-Chain Transparency

**All actions are recorded forever:**

```solidity
// События для аудита
event ProposalCreated(uint256 proposalId, address initiator);
event ProposalVoted(uint256 proposalId, address voter, bool support);
event ProposalExecuted(uint256 proposalId, bytes operation);
event ModuleAdded(bytes32 moduleId, address moduleAddress);
event TokensTransferred(address recipient, uint256 amount);
```

**Check in a block explorer:**
```
https://etherscan.io/address/0xDLE_CONTRACT_ADDRESS
└── All transactions are publicly visible
└── Impossible to hide or delete
```

### Real-Time Monitoring

**Backend tracks all events:**

```javascript
// Подписка на события смарт-контракта
dleContract.on('ProposalCreated', async (proposalId, initiator, event) => {
    logger.info(`Новое предложение #${proposalId} от ${initiator}`);
    
    // Получаем детали предложения
    const proposal = await dleContract.proposals(proposalId);
    
    // Анализ безопасности
    const risks = analyzeProposalRisks(proposal);
    
    // Уведомление токен-холдеров
    if (risks.level === 'HIGH') {
        await notifyAllTokenHolders({
            type: 'SECURITY_ALERT',
            proposalId,
            risks
        });
    }
});
```

### Alert System

```javascript
// Критичные события требуют немедленного уведомления
const criticalEvents = [
    'ProposalCreated',     // Новое предложение
    'ModuleAdded',         // Добавлен модуль
    'TokensTransferred'    // Переведены токены
];

async function sendAlert(event, data) {
    // Email уведомления
    await sendEmail({
        to: allTokenHolders,
        subject: `[DLE Alert] ${event}`,
        body: formatAlert(data)
    });
    
    // Telegram уведомления
    await sendTelegram({
        chat: dleNotificationsChat,
        message: formatAlert(data)
    });
    
    // Запись в логи
    logger.warn(`ALERT: ${event}`, data);
}
```

---

## Security Recommendations

### For Token Holders

1. **Use a hardware wallet** (Ledger, Trezor)
   - Private key never leaves the device
   - Every operation confirmed on a physical device

2. **Store the seed phrase securely**
   - Write it on paper; do not store digitally
   - Use metal plates for durability
   - Keep in a safe or bank vault

3. **Enable notifications**
   - Email alerts for new proposals
   - Telegram bots for critical events

4. **Review all proposals**
   - Read the description before voting
   - Verify recipient addresses
   - Use timelock for critical operations

5. **Split your tokens**
   - Hot wallet: 10–20% for day-to-day use
   - Cold wallet: 80–90% for long-term storage

### For Administrators

1. **Regular updates**
   ```bash
   # Еженедельное обновление
   docker-compose pull
   docker-compose up -d
   ```

2. **Backups**
   ```bash
   # Ежедневный бэкап базы данных
   docker exec dapp-postgres pg_dump -U user db > backup.sql
   ```

3. **Log monitoring**
   ```bash
   # Проверка логов на подозрительную активность
   docker logs dapp-backend | grep -i "error\|warning\|failed"
   ```

4. **Encryption key rotation**
   - Change the encryption key once a year
   - Keep old keys to decrypt historical data

5. **Firewall configuration**
   ```bash
   # Разрешить только необходимые порты
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

### For Developers

1. **✅ Smart contract audits**
   - Use Slither for static analysis
   - Mythril for vulnerability discovery
   - Manual audit of critical code

2. **Testing**
   ```bash
   # Запуск тестов
   cd backend
   yarn test
   
   # Покрытие кода
   yarn coverage
   ```

3. **Code review**
   - All changes via pull requests
   - At least 2 reviewers for critical changes

4. **Secure dependencies**
   ```bash
   # Проверка уязвимостей
   yarn audit
   npm audit fix
   ```

---

## Attack Scenarios and Mitigation

### Scenario 1: Phishing Attack

**Attack:**
```
1. Attacker creates a fake site: dlle.com (instead of dle.com)
2. Sends phishing emails to token holders
3. Asks them to connect a wallet and sign a transaction
```

**Protection:**
```javascript
// Backend проверяет домен в SIWE сообщении
const message = new SiweMessage({
    domain: req.get('host'), // Должен быть правильный домен
    uri: req.get('origin')
});

// Frontend показывает предупреждение
if (window.location.hostname !== 'dle.app') {
    alert('ВНИМАНИЕ: Это НЕ официальный сайт DLE!');
}
```

**User recommendations:**
- ✅ Always check the URL before connecting a wallet
- ✅ Use browser bookmarks
- ✅ Verify the SSL certificate (green lock)

### Scenario 2: Backend Server Compromise

**Attack:**
```
1. Attacker gains access to the backend server
2. Tries to change code to bypass token checks
3. Or takes the web application completely offline
```

**Protection:**
```
✅ Token checks happen on the blockchain (immutable)
✅ Backend can be compromised, but:
   ├── Impossible to change token balances in the smart contract
   ├── Impossible to mint forged tokens
   ├── Impossible to change smart contract rules
   └── Users will see a mismatch between backend and blockchain
```

**Critical: The web application is only an interface!**

Even with a **full compromise** of the web application:
- ✅ **All business assets are protected** on the blockchain
- ✅ **Smart contracts continue to work** independently of the web application
- ✅ **Governance via block explorers is possible** (Etherscan, Polygonscan, etc.)

### Governance via Block Explorers

**If the web application is unavailable, use block explorers:**

#### 1. Checking token balance

```
1. Open Etherscan: https://etherscan.io
2. Enter the DLE smart contract address
3. Go to the "Read Contract" tab
4. Call the balanceOf(address) function
5. Enter your wallet address
6. Click "Query" - you will see the token balance ✅
```

**Example**:
```
Contract Address: 0x1234...DLE
Function: balanceOf
Address: 0xYourWallet...
Result: 500000 (your token balance)
```

#### 2. Creating a proposal via Etherscan

```
1. Open Etherscan and find the DLE smart contract
2. Go to the "Write Contract" tab
3. Connect MetaMask
4. Find the createProposal function
5. Fill in parameters:
   - description: "Restore web application"
   - operation: encoded function call
   - votingDuration: 86400 (1 day in seconds)
6. Click "Write" and confirm the transaction ✅
```

**Proposal creation example**:
```solidity
// Через Etherscan Write Contract
createProposal(
    "Перевести 10,000 USDT на восстановление инфраструктуры",
    0x..., // закодированный вызов transferTokens
    86400  // 1 день
)
```

#### 3. Voting via Etherscan

```
1. Open the DLE smart contract on Etherscan
2. "Write Contract" tab
3. Connect wallet
4. Function vote(uint256 proposalId, bool support)
   - proposalId: proposal number (e.g., 5)
   - support: true (for) or false (against)
5. Click "Write" ✅
```

#### 4. Checking proposal state

```
1. "Read Contract" tab on Etherscan
2. Function proposals(uint256)
3. Enter proposal ID
4. You will see all details:
   - Description
   - "For" and "Against" votes
   - Status (Active, Executed, Failed)
   - Voting end time
```

#### 5. Executing an approved proposal

```
1. If the proposal is approved and time has expired
2. Open "Write Contract"
3. Function execute(uint256 proposalId)
4. Enter proposal ID
5. Click "Write" - the proposal will execute ✅
```

### Popular Block Explorers for DLE

| Network | Block Explorer | URL |
|---------|----------------|-----|
| **Ethereum Mainnet** | Etherscan | https://etherscan.io |
| **Polygon** | Polygonscan | https://polygonscan.com |
| **Binance Smart Chain** | BscScan | https://bscscan.com |
| **Arbitrum** | Arbiscan | https://arbiscan.io |
| **Optimism** | Optimistic Etherscan | https://optimistic.etherscan.io |
| **Avalanche** | SnowTrace | https://snowtrace.io |
| **Base** | BaseScan | https://basescan.org |

### Advantages of Governance via Block Explorers

**1. Full independence from the web application**
```
Web application compromised → Blockchain works ✅
Backend server down → Smart contracts work ✅
Frontend unavailable → Governance via Etherscan ✅
```

**2. Data cannot be forged**
```
Attacker on backend → Block explorer shows the truth
Forged frontend → Etherscan shows real tokens
Altered logic → Smart contract works as designed
```

**3. 24/7 access from anywhere in the world**
```
No server access → Etherscan always available
App under maintenance → Governance via blockchain
DDoS on the site → Blockchain is not DDoS-able that way
```

**Response to a compromise:**
1. Users notice strange web application behavior
2. Check token balances directly via Etherscan ✅
3. Create a recovery proposal via Etherscan
4. Vote for infrastructure restoration
5. Administrators restore backend from backup
6. **No tokens or assets are lost** ✅

**Conclusion**: The web application is only a convenient interface. Real authority and assets live on the blockchain, where they are protected by cryptography and cannot be changed or stolen through a web application compromise.

### Scenario 3: 51% Attack

**Attack:**
```
1. Attacker buys or obtains >51% of all tokens
2. Creates a proposal "Transfer all assets to me"
3. Votes "For" with all their tokens
4. Proposal approved
```

**Protection:**
```javascript
// Timelock Module дает время на реакцию
const TIMELOCK = 7 days;

// Другие токен-холдеры могут:
1. Проголосовать "Против" (если у них еще 49%)
2. Создать контр-предложение
3. Обратиться в правоохранительные органы
4. Отменить предложение через emergency функцию (если настроена)
```

**Long-term protection:**
- Even distribution of tokens among partners
- Multisig for large operations
- Quadratic voting (option for future versions)

### Scenario 4: Social Engineering

**Attack:**
```
1. Attacker impersonates DLE support
2. Asks the token holder to sign a message "for verification"
3. The message is actually an approval to transfer tokens
```

**Protection:**
```javascript
// Frontend всегда показывает ЧТО подписывается
function signMessage(message) {
    // Показываем пользователю точное содержимое
    const confirmation = confirm(`
        Вы собираетесь подписать:
        ${message}
        
        НИКОГДА не подписывайте сообщения по просьбе «поддержки»!
        
        Продолжить?
    `);
    
    if (!confirmation) return;
    
    // Подпись
}
```

**Recommendations:**
- ❌ Support will **NEVER** ask you to sign a message
- ❌ Do not trust "urgent" requests
- ✅ Always verify what you are signing
- ✅ When in doubt — contact official support

---

## Personal Data Regulatory Alignment

The DLE template provides **technical and organizational means** for depersonalization, encryption, processing, and storage of personal data. Specific obligations are set by the **applicable regulator** in the country where the instance operator conducts business (GDPR, local data-protection acts, PIPL, and equivalents — by jurisdiction). Legal completeness of local compliance remains with the operator: document templates are adapted to local law.

### Instance placement in the country of activity

A widespread data-protection requirement is **localization**: processing and storing personal data on infrastructure **within the country** (or another territory defined by applicable law), not with a foreign SaaS vendor.

DLE is designed for that model: the instance is installed on the **operator’s own infrastructure** — a server, VPS, or local device **in the jurisdiction of activity**. Data and the encryption key stay under the operator’s control; the template rightsholder does not take personal data as a mandatory cloud host.

The operator chooses the hosting site so that it meets localization rules (and, where applicable, cross-border transfer restrictions) in their country.

Other mechanisms built into the product:

### 1. Wallet signature (SIWE) and consent

Authentication uses **Sign-In with Ethereum** (EIP-4361). The message statement records review of documents listed in `Resources` and consent to personal data processing (`shared/siweStatements.json`).

`Resources` include URLs of the instance’s published consent documents. A wallet signature is cryptographic confirmation of consent without sending the private key to the server.

Nonces and wallet identifiers in the `nonces` table are stored via PostgreSQL `encrypt_text` (see below). Consent journal: `consent_logs` (API: `/consent/documents`, `/consent/grant`, `/consent/revoke`).

### 2. Legal document package

UI: `/content/templates` (templates) and `/content/published` (published pages). Seed: `backend/scripts/seed/legalTemplatesSeed.js`.

**Public** (for data subjects):

| Document | Purpose |
| --- | --- |
| Personal data processing policy | Public PD processing policy |
| Privacy policy | Service privacy policy |
| Consent to personal data processing | End-user consent |
| Cookie consent | Cookies by category |
| Consent to cross-border PD transfer | Cross-border transfer |
| Consent to biometric PD processing | Biometrics (when needed) |
| Data subject rights and consent withdrawal | Rights and withdrawal |

**Internal** (`view_legal_docs`): appointment order and job description for the PD officer, processing and protection policy, request-handling procedures, retention and destruction policy, access segregation, authorized persons list and NDA, DPA template, processing operations register, PD information systems inventory, threat model and security plan, incident response, training, regulator notification template, cross-border transfer procedures, parental/guardian consent, cookie and third-party services policy.

The operator fills placeholders (`{{company_name}}`, `{{privacy_email}}`, etc.), publishes the required documents, and binds them to SIWE / consent flow.

### 3. PostgreSQL: encryption and storage

Sensitive fields are encrypted at the database layer with `encrypt_text` / `decrypt_text` (`pgcrypto`, AES-CBC). The key is held by the operator (`ENCRYPTION_KEY` or the instance key file); data stays on the **operator’s infrastructure in the chosen jurisdiction** (see [instance placement](#instance-placement-in-the-country-of-activity)).

Typical encrypted categories:

| Area | Examples |
| --- | --- |
| Profile / CRM | `users.first_name_encrypted`, `last_name_encrypted` |
| Identities | `user_identities` — email, telegram, wallet (`*_encrypted`) |
| Auth | `nonces` — address and nonce |
| Messages | content and related channel fields |
| User tables | names, cells (`user_tables` / `user_cell_values`) |

Depersonalization and data minimization are supported by the data model (separate identity providers, PII encryption at rest) and access rights; retention and destruction are defined by the operator in the published policy and internal procedures.

### 4. CRM and contacts

CRM surface (`/crm`, `/contacts-list`): contacts are `users` + `user_identities` records, decrypted by the service when the key and permissions are present. Deleting a contact cascades related user data (including guest messages — per the API deletion policy).

Client and staff personal data are processed **on the operator’s infrastructure in the country (jurisdiction) of activity**, without mandatory handover to a SaaS vendor.

### Responsibility boundaries

| Layer | DLE (template) | Instance operator |
| --- | --- | --- |
| Placement in the country of activity (PD localization) | On‑prem / own-host install | ✅ Choosing a site in the jurisdiction |
| Encryption at rest, SIWE, consent log, document package | ✅ | Key setup, publishing docs |
| Selecting and adapting texts to local law | Starter templates | ✅ Required |
| Regulator notification, DPAs with processors, retention | Templates | ✅ By jurisdiction |
| Hosting and encryption-key custody | Guidance | ✅ Operator control |

---

## Conclusion

### Multi-Layer DLE Protection

```
┌─────────────────────────────────────────────────────┐
│           DLE Security Layers                       │
├─────────────────────────────────────────────────────┤
│  1️⃣ Blockchain                                       │
│     └── Tokens cannot be stolen even if wallet is   │
│         compromised                                 │
│                                                     │
│  2️⃣ Smart contracts                                 │
│     └── Audit, OpenZeppelin, immutability           │
│                                                     │
│  3️⃣ Voting with quorum                              │
│     └── Unilateral decisions are impossible         │
│                                                     │
│  4️⃣ Timelock                                        │
│     └── Time to react during an attack              │
│                                                     │
│  5️⃣ Backend checks                                  │
│     └── Real-time token verification                │
│                                                     │
│  6️⃣ Frontend protection                             │
│     └── XSS, CSRF, rate limiting                    │
│                                                     │
│  7️⃣ Monitoring and alerts                           │
│     └── Detection of suspicious activity            │
└─────────────────────────────────────────────────────� limiting                    │
│                                                     │
│  7️⃣ Monitoring and alerts                           │
│     └── Detection of suspicious activity            │
└─────────────────────────────────────────────────────┘
```

### Key Security Advantages

1. **Token-based access control**
   - Without tokens, access is impossible
   - Real-time checks on the blockchain

2. **Protection against token theft**
   - Impossible to transfer without voting
   - Even if a wallet is compromised, tokens are protected

3. **🌐 Independence from the web application**
   - Even if the web application is compromised, business assets are protected on-chain
   - Governance via block explorers (Etherscan, Polygonscan, etc.) is possible
   - Smart contracts work independently of frontend/backend
   - The web application is only a convenient interface; real authority is on-chain

4. **Collective governance**
   - Critical decisions only through voting
   - Quorum prevents unilateral actions

5. **Modules under smart contract control**
   - Only the DLE contract can call modules
   - No direct access

6. **📊 Full transparency**
   - All actions on the blockchain
   - Impossible to hide or forge

### Next Steps

1. [Read the technical documentation](./back-docs/blockchain-integration-technical.md)
2. [Set up a secure environment](./back-docs/setup-instruction.md)
3. [Read the FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md)
4. [Get support](https://hb3-accelerator.com/)
---

**© 2024-2026 Tarabanov Aleksandr Viktorovich. All rights reserved.**

**Last updated**: July 2026
