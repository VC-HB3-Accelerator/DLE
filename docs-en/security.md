# Security of Digital Legal Entity (DLE)

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Security Model](#security-model)
3. [Token-Based Access Control](#token-based-access-control)
4. [Smart Contract Security](#smart-contract-security)
5. [Wallet Hack Protection](#wallet-hack-protection)
6. [Web Application Security](#web-application-security)
7. [Module Management](#module-management)
8. [Audit and Monitoring](#audit-and-monitoring)
9. [Security Recommendations](#security-recommendations)
10. [Attack Scenarios and Protection](#attack-scenarios-and-protection)

---

## Introduction

Digital Legal Entity (DLE) is built with a focus on **security at all levels**:
- 🔐 Access control through blockchain tokens
- 🛡️ Smart contract protection from hacking
- 🔒 Impossible to steal tokens even if wallet is hacked
- ⚖️ Management only through voting with quorum

### Key Security Principles

1. **Security by default** - all actions are prohibited until explicitly allowed
2. **Least privilege** - everyone gets only necessary rights
3. **Transparency** - all actions recorded on blockchain
4. **Immutability** - impossible to forge history
5. **Collective control** - critical operations only through voting

---

## Security Model

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DLE Protection Levels                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 1: Blockchain (Immutable Base)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • DLE Smart Contract (audited, immutable)            │  │
│  │ • Governance Tokens (ERC20Votes)                     │  │
│  │ • History of all operations on blockchain            │  │
│  │ • Impossible to change rules without voting          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Level 2: Web Application (Backend)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Real-time token verification                        │  │
│  │ • Wallet authentication (SIWE)                        │  │
│  │ • Data encryption (AES-256)                           │  │
│  │ • Rate limiting and DDoS protection                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Level 3: Frontend (Vue.js)                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet connection                                   │  │
│  │ • Transaction signing                                 │  │
│  │ • XSS protection (DOMPurify)                          │  │
│  │ • CSRF tokens                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Level 4: User                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet private key (MetaMask, WalletConnect)       │  │
│  │ • Confirmation of each operation                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Threat Model

| Threat | Risk Level | Protection |
|--------|------------|------------|
| **Wallet hack** | 🟡 Medium | Tokens cannot be transferred without voting |
| **Web application hack** | 🟢 Low | All rights verified on blockchain, management via blockchain explorers |
| **Smart contract compromise** | 🟢 Low | Audit, OpenZeppelin, immutability |
| **DDoS attack** | 🟡 Medium | Rate limiting, CDN, backup servers |
| **Phishing** | 🟠 High | User education, domain verification |
| **Insider threat** | 🟢 Low | All actions through voting |

### ⚠️ Critical: Web Application is Only an Interface

**Key feature of DLE architecture:**

```
┌─────────────────────────────────────────────────────────┐
│              Web Application (Interface)                │
│                                                         │
│  Frontend + Backend = CONVENIENCE of use               │
│  • Beautiful UI                                        │
│  • Convenient navigation                               │
│  • Quick access to functions                           │
│                                                         │
│  ⚠️ Can be hacked/unavailable                          │
│  ✅ BUT! Business assets are protected                 │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│               Blockchain (Real Power)                   │
│                                                         │
│  Smart Contracts = REAL asset management               │
│  • Governance tokens                                   │
│  • Treasury with assets                                │
│  • Voting rules                                        │
│  • History of all decisions                            │
│                                                         │
│  🔒 Protected by cryptography                          │
│  ✅ Works independently of web application             │
└─────────────────────────────────────────────────────────┘
```

**What happens when web application is hacked:**

```
Web application hacked/unavailable:
├── ❌ Web interface doesn't work
├── ❌ Backend may show incorrect information
├── ❌ Frontend may be replaced
│
BUT:
├── ✅ All business assets remain on blockchain
├── ✅ Smart contracts continue to work
├── ✅ Tokens cannot be stolen
├── ✅ Can manage via Etherscan/Polygonscan/etc.
└── ✅ Can create new frontend and connect to same contracts
```

**Real example:**

1. Attacker hacks your server with web application
2. Tries to show fake token balances
3. **But**: Real balances on blockchain remain unchanged
4. You open Etherscan and see the truth
5. Create proposal via Etherscan for recovery
6. Vote and execute proposal
7. Restore web application
8. **Result**: Not a single token lost ✅

---

## Token-Based Access Control

### How It Works

**Without tokens, access to application is IMPOSSIBLE.**

```
Access attempt to DLE:
├── 1. User connects wallet
├── 2. Backend checks token balance in smart contract
├── 3. If NO tokens → Access DENIED
└── 4. If tokens EXIST → Access granted (level depends on amount)
```

### Access Levels

| Tokens on balance | Access Level | Rights |
|-------------------|--------------|--------|
| **0 tokens** | ❌ No access | Only "No access" page |
| **1+ tokens** | ✅ ReadOnly | View data |
| **100+ tokens** | ✅ Editor | Editing, creation |
| **Any amount** | 🗳️ Voting | 1 token = 1 vote |

### Real-Time Token Verification

**Backend** constantly checks token balance:

```javascript
// Every request checks tokens
async function checkAccess(req, res, next) {
    const address = req.session.address;
    
    // Get token balance from smart contract
    const dleContract = new ethers.Contract(dleAddress, dleAbi, provider);
    const balance = await dleContract.balanceOf(address);
    
    if (balance === 0n) {
        return res.status(403).json({ 
            error: 'Access denied: no tokens' 
        });
    }
    
    // Determine access level
    const accessLevel = determineAccessLevel(balance);
    req.user = { address, balance, accessLevel };
    
    next();
}
```

**Important**: Verification happens on **every request**, so:
- ✅ If tokens transferred → access instantly lost
- ✅ If tokens received → access instantly appears
- ✅ Impossible to bypass verification

### Initial Token Distribution

**Tokens are distributed by owner when deploying smart contract:**

```solidity
constructor(DLEConfig memory config) {
    // Create tokens
    _mint(address(this), totalSupply);
    
    // Distribute among partners
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
1. Wallet owner deploys DLE smart contract
2. Specifies partner addresses and token amounts for each
3. Tokens automatically distributed on deployment
4. After that, all changes only through voting

**Distribution example**:
```javascript
const config = {
    initialPartners: [
        '0xAlice...', // Founder 1
        '0xBob...',   // Founder 2
        '0xCarol...'  // Investor
    ],
    initialAmounts: [
        500000,  // 50% for Alice
        300000,  // 30% for Bob
        200000   // 20% for Carol
    ]
};
```

---

## Smart Contract Security

### Protection from Token Transfers

**CRITICAL**: Governance tokens **CANNOT** be transferred by normal means!

```solidity
// Transfers BLOCKED
function transfer(address to, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrTransfersDisabled();
}

// Approvals BLOCKED
function approve(address spender, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrApprovalsDisabled();
}

// TransferFrom BLOCKED
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
- ❌ Cannot send tokens to exchange
- ❌ Cannot sell tokens on DEX
- ❌ Cannot transfer tokens to another person directly
- ❌ Attacker CANNOT steal tokens even from hacked wallet

### Only Way to Transfer Tokens

**Only through voting with quorum:**

```solidity
// Transfer tokens (only through governance)
function _transferTokens(address recipient, uint256 amount) internal {
    require(msg.sender == address(this), "Only through governance");
    _transfer(address(this), recipient, amount);
}
```

**Transfer process**:
```
1. Proposal creation
   ├── "Transfer 1000 tokens to address 0xNew..."
   └── Required: minimum 1 token to create

2. Voting
   ├── Duration: 1-30 days (configurable)
   ├── Each token = 1 vote
   └── Required: quorum (e.g., 10% of all tokens)

3. Quorum check
   ├── If "For" > "Against" AND quorum reached
   └── → Proposal approved

4. Execution
   ├── Smart contract automatically transfers tokens
   └── Event recorded on blockchain forever
```

### Quorum Configuration

**Quorum is set on deployment** and can only be changed through voting:

```solidity
uint256 public quorumPercentage; // For example, 10%

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
        nonReentrant  // Reentrancy protection
    {
        // Proposal execution
    }
}
```

### Flash-Loan Protection

**Vote snapshots** prevent attacks with temporary token loans:

```solidity
// Votes taken from PREVIOUS block
uint256 public snapshotTimepoint = block.number - 1;

function vote(uint256 proposalId, bool support) external {
    // Use balance from previous block
    uint256 votingPower = getPastVotes(msg.sender, snapshotTimepoint);
    require(votingPower > 0, "No voting power");
    
    // Voting
}
```

**Why this is safe**:
1. Attacker takes flash-loan of 1,000,000 tokens
2. Tries to vote
3. Smart contract checks balance in **previous block**
4. In previous block attacker had 0 tokens
5. Voting rejected ❌

### Parameter Validation

```solidity
// Address check
if (address == address(0)) revert ErrZeroAddress();

// Token ownership check
if (balanceOf(msg.sender) == 0) revert ErrNotHolder();

// Voting duration check
if (duration < minVotingDuration) revert ErrTooShort();
if (duration > maxVotingDuration) revert ErrTooLong();

// Supported network check
if (!supportedChains[chainId]) revert ErrUnsupportedChain();
```

### Custom Errors for Gas Savings

```solidity
// Gas savings: custom errors instead of require
error ErrZeroAddress();
error ErrNotHolder();
error ErrAlreadyVoted();
error ErrTransfersDisabled();
error ErrApprovalsDisabled();
error ErrProposalMissing();
error ErrWrongChain();
```

---

## Wallet Hack Protection

### Scenario: Attacker Got Private Key

**What attacker can do:**

```
Attacker attempts:

1. ❌ Send tokens to own address
   └── BLOCKED: transfer() blocked

2. ❌ Sell tokens on DEX (Uniswap, etc.)
   └── BLOCKED: approve() blocked

3. ❌ Send via transferFrom
   └── BLOCKED: transferFrom() blocked

4. ❓ Create proposal "Transfer tokens to me"
   └── Requires voting by other token holders
   └── Quorum: 10%+ must vote "For"
   └── MOST LIKELY WILL FAIL
```

### Real Attack Example

```
Attacker hacked Alice's wallet (500,000 tokens):

1. Creates proposal:
   "Transfer 500,000 tokens to address 0xEvil..."
   
2. Votes "For" with own 500,000 votes (50%)

3. But quorum = 10% = 100,000 votes
   Already reached? YES ✅

4. "For" = 500,000 (50%)
   "Against" = 0
   
5. Result: Proposal APPROVED ❌

PROBLEM: If Alice has majority of tokens!
```

### Protection from Majority Token Attack

**Solution 1: Timelock Module**

```solidity
// Delayed execution (e.g., 3 days)
uint256 public constant TIMELOCK_DELAY = 3 days;

function scheduleProposal(uint256 proposalId) external {
    // Proposal approved, but executes only after 3 days
    executionTime = block.timestamp + TIMELOCK_DELAY;
}
```

**Advantage**: Other token holders see dangerous proposal and can:
- Vote "Against"
- Create counter-proposal
- Take measures (e.g., contact court)

**Solution 2: Multisignature**

```solidity
// Requires multiple signatures for critical operations
mapping(uint256 => mapping(address => bool)) public approvals;

function executeWithApprovals(
    uint256 proposalId,
    address[] calldata signers,
    bytes[] calldata signatures
) external {
    // Verify signatures of multiple token holders
    require(signers.length >= minSigners, "Not enough signers");
    
    for (uint i = 0; i < signers.length; i++) {
        // Signature verification
        verifySignature(proposalId, signers[i], signatures[i]);
    }
    
    // Execution
}
```

**Solution 3: Cold Wallet for Large Holders**

Recommended to keep tokens on:
- 🥶 **Hardware wallet** (Ledger, Trezor) - maximum protection
- 🔒 **Multisignature** (Gnosis Safe) - requires multiple signatures
- ❄️ **Cold storage** - offline, not connected to internet

### Suspicious Proposal Monitoring

**Backend automatically detects dangerous proposals:**

```javascript
// Suspicious proposal detector
function detectSuspiciousProposal(proposal) {
    const alerts = [];
    
    // Check 1: Transfer of large token amount
    if (proposal.operation.includes('_transferTokens')) {
        const amount = decodeAmount(proposal.operation);
        const percentage = (amount / totalSupply) * 100;
        
        if (percentage > 10) {
            alerts.push({
                level: 'HIGH',
                message: `Proposal transfers ${percentage}% of all tokens!`
            });
        }
    }
    
    // Check 2: Initiator votes with own tokens
    if (proposal.forVotes === proposal.initiatorBalance) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Initiator votes only with own tokens'
        });
    }
    
    // Check 3: Fast voting (< 24 hours)
    if (proposal.duration < 86400) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Voting less than 24 hours - little time for verification'
        });
    }
    
    // Send notifications to all token holders
    if (alerts.length > 0) {
        notifyAllTokenHolders(proposal, alerts);
    }
}
```

---

## Web Application Security

### SIWE Authentication

**Sign-In with Ethereum** - standard for secure authentication:

```javascript
// Generate nonce (one-time)
const nonce = crypto.randomBytes(32).toString('hex');

// Save to DB with encryption
await db.query(
    'INSERT INTO nonces (address_encrypted, nonce_encrypted, expires_at) VALUES ($1, $2, $3)',
    [encrypt(address), encrypt(nonce), expiresAt]
);

// Signature verification
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
- ✅ Private key **never** leaves wallet
- ✅ Each nonce used **once**
- ✅ Nonce expires in 5 minutes
- ✅ Impossible to forge signature without private key

### Data Encryption

```javascript
// AES-256 encryption
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
- 🔐 Wallet addresses in DB
- 🔐 Nonces for authentication
- 🔐 Session data
- 🔐 Private messages

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Request limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // maximum 100 requests
    message: 'Too many requests, try again later'
});

// Authentication limiting (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // maximum 5 authentication attempts
    skipSuccessfulRequests: true
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

### CSRF Protection

```javascript
const csrf = require('csurf');

// CSRF tokens for all forms
const csrfProtection = csrf({ cookie: true });

app.post('/api/action', csrfProtection, async (req, res) => {
    // CSRF token verification automatic
});
```

### XSS Protection

```javascript
import DOMPurify from 'dompurify';

// Clean HTML from dangerous code
function sanitizeHTML(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
        ALLOWED_ATTR: ['href']
    });
}

// Usage
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

**Automatic log cleanup from sensitive data:**

```javascript
function cleanLogs() {
    const sensitivePatterns = [
        /0x[a-fA-F0-9]{40}/g,  // Wallet addresses
        /pk_[a-zA-Z0-9]{64}/g,  // Private keys (if accidentally logged)
        /nonce:\s*[a-f0-9]{64}/gi,  // Nonces
    ];
    
    // Replace sensitive data with ***
    let cleanedLog = logContent;
    sensitivePatterns.forEach(pattern => {
        cleanedLog = cleanedLog.replace(pattern, '[REDACTED]');
    });
    
    return cleanedLog;
}
```

---

## Module Management

### Only DLE Smart Contract Manages Modules

**`onlyDLE` modifier** guarantees that only DLE smart contract can call module functions:

```solidity
// Module: TreasuryModule
contract TreasuryModule {
    address public immutable dleContract;
    
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE can call");
        _;
    }
    
    // Only DLE can transfer tokens from treasury
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
- ❌ Wallet owner **CANNOT** directly call module functions
- ❌ Backend **CANNOT** call module functions
- ❌ Attacker **CANNOT** interact with module
- ✅ **Only** DLE smart contract through voting

### Module Usage Process

```
1. Token holder creates proposal
   └── "Transfer 1000 USDC from Treasury to marketing"

2. Proposal contains encoded module function call
   └── operation = treasuryModule.transferTokens(USDC, marketing, 1000)

3. Voting

4. If approved, DLE contract calls module:
   └── TreasuryModule.transferTokens() ✅
   └── msg.sender = DLE contract ✅
   
5. Module verifies msg.sender and executes
```

### Adding New Module

**Only through voting:**

```solidity
// Module addition operation
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
1. Deploy new module
2. Create proposal: "Add module X at address 0x..."
3. Voting
4. If approved → module added
5. Module can be used

### Removing Compromised Module

If module turns out to be vulnerable:

```
1. Token holder creates emergency proposal
   └── "Remove compromised module X"
   └── Duration: 1 day (emergency voting)

2. Voting (accelerated)

3. Module removed
   └── Can no longer be called from DLE contract
```

---

## Audit and Monitoring

### Blockchain Transparency

**All actions recorded forever:**

```solidity
// Events for audit
event ProposalCreated(uint256 proposalId, address initiator);
event ProposalVoted(uint256 proposalId, address voter, bool support);
event ProposalExecuted(uint256 proposalId, bytes operation);
event ModuleAdded(bytes32 moduleId, address moduleAddress);
event TokensTransferred(address recipient, uint256 amount);
```

**Verification in blockchain explorer:**
```
https://etherscan.io/address/0xDLE_CONTRACT_ADDRESS
└── All transactions publicly visible
└── Impossible to hide or delete
```

### Real-Time Monitoring

**Backend tracks all events:**

```javascript
// Subscribe to smart contract events
dleContract.on('ProposalCreated', async (proposalId, initiator, event) => {
    logger.info(`New proposal #${proposalId} from ${initiator}`);
    
    // Get proposal details
    const proposal = await dleContract.proposals(proposalId);
    
    // Security analysis
    const risks = analyzeProposalRisks(proposal);
    
    // Notify token holders
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
// Critical events require immediate notification
const criticalEvents = [
    'ProposalCreated',     // New proposal
    'ModuleAdded',         // Module added
    'TokensTransferred'    // Tokens transferred
];

async function sendAlert(event, data) {
    // Email notifications
    await sendEmail({
        to: allTokenHolders,
        subject: `[DLE Alert] ${event}`,
        body: formatAlert(data)
    });
    
    // Telegram notifications
    await sendTelegram({
        chat: dleNotificationsChat,
        message: formatAlert(data)
    });
    
    // Log entry
    logger.warn(`ALERT: ${event}`, data);
}
```

---

## Security Recommendations

### For Token Holders

1. **🥶 Use hardware wallet** (Ledger, Trezor)
   - Private key never leaves device
   - Confirmation of each operation on physical device

2. **🔐 Store seed phrase securely**
   - Write on paper, don't store digitally
   - Use metal plates for durability
   - Store in safe or bank deposit box

3. **🚨 Enable notifications**
   - Email alerts on new proposals
   - Telegram bots for critical events

4. **👀 Check all proposals**
   - Read description before voting
   - Verify recipient addresses
   - Use timelock for critical operations

5. **❄️ Split tokens**
   - Hot wallet: 10-20% for daily use
   - Cold wallet: 80-90% for long-term storage

### For Administrators

1. **🔄 Regular updates**
   ```bash
   # Weekly update
   docker-compose pull
   docker-compose up -d
   ```

2. **💾 Backups**
   ```bash
   # Daily database backup
   docker exec dapp-postgres pg_dump -U user db > backup.sql
   ```

3. **📊 Log monitoring**
   ```bash
   # Check logs for suspicious activity
   docker logs dapp-backend | grep -i "error\|warning\|failed"
   ```

4. **🔑 Encryption key rotation**
   - Change encryption key once a year
   - Keep old keys for decrypting historical data

5. **🛡️ Firewall configuration**
   ```bash
   # Allow only necessary ports
   ufw allow 80/tcp   # HTTP
   ufw allow 443/tcp  # HTTPS
   ufw enable
   ```

### For Developers

1. **✅ Smart contract audits**
   - Use Slither for static analysis
   - Mythril for vulnerability search
   - Manual audit of critical code

2. **🧪 Testing**
   ```bash
   # Run tests
   cd backend
   yarn test
   
   # Code coverage
   yarn coverage
   ```

3. **📝 Code review**
   - All changes through pull requests
   - Minimum 2 reviewers for critical changes

4. **🔒 Secure dependencies**
   ```bash
   # Vulnerability check
   yarn audit
   npm audit fix
   ```

---

## Attack Scenarios and Protection

### Scenario 1: Phishing Attack

**Attack:**
```
1. Attacker creates fake site: dlle.com (instead of dle.com)
2. Sends phishing emails to token holders
3. Asks to connect wallet and sign transaction
```

**Protection:**
```javascript
// Backend verifies domain in SIWE message
const message = new SiweMessage({
    domain: req.get('host'), // Must be correct domain
    uri: req.get('origin')
});

// Frontend shows warning
if (window.location.hostname !== 'dle.app') {
    alert('⚠️ WARNING: This is NOT the official DLE site!');
}
```

**User recommendations:**
- ✅ Always verify URL before connecting wallet
- ✅ Use browser bookmarks
- ✅ Verify SSL certificate (green lock)

### Scenario 2: Backend Server Hack

**Attack:**
```
1. Attacker gains access to backend server
2. Tries to modify code to bypass token verification
3. Or completely takes web application offline
```

**Protection:**
```
✅ Token verification happens on blockchain (immutable)
✅ Backend can be compromised, but:
   ├── Cannot change token balance in smart contract
   ├── Cannot create fake tokens
   ├── Cannot change smart contract rules
   └── Users will see discrepancy between backend and blockchain
```

**Critical: Web Application is Only an Interface!**

Even with **complete hack** of web application:
- ✅ **All business assets protected** on blockchain
- ✅ **Smart contracts continue to work** independently of web application
- ✅ **Can manage via blockchain explorers** (Etherscan, Polygonscan, etc.)

### Management via Blockchain Explorers

**If web application unavailable, use blockchain explorers:**

#### 1. Check Token Balance

```
1. Open Etherscan: https://etherscan.io
2. Enter DLE smart contract address
3. Go to "Read Contract" tab
4. Call balanceOf(address) function
5. Enter your wallet address
6. Click "Query" - see token balance ✅
```

**Example**:
```
Contract Address: 0x1234...DLE
Function: balanceOf
Address: 0xYourWallet...
Result: 500000 (your token balance)
```

#### 2. Create Proposal via Etherscan

```
1. Open Etherscan and find DLE smart contract
2. Go to "Write Contract" tab
3. Connect MetaMask wallet
4. Find createProposal function
5. Fill parameters:
   - description: "Restore web application"
   - operation: encoded function call
   - votingDuration: 86400 (1 day in seconds)
6. Click "Write" and confirm transaction ✅
```

**Example proposal creation**:
```solidity
// Via Etherscan Write Contract
createProposal(
    "Transfer 10,000 USDT for infrastructure recovery",
    0x..., // encoded transferTokens call
    86400  // 1 day
)
```

#### 3. Vote via Etherscan

```
1. Open DLE smart contract on Etherscan
2. "Write Contract" tab
3. Connect wallet
4. Function vote(uint256 proposalId, bool support)
   - proposalId: proposal number (e.g., 5)
   - support: true (for) or false (against)
5. Click "Write" ✅
```

#### 4. Check Proposal Status

```
1. "Read Contract" tab on Etherscan
2. Function proposals(uint256)
3. Enter proposal ID
4. See all details:
   - Description
   - "For" and "Against" votes
   - Status (Active, Executed, Failed)
   - Voting end time
```

#### 5. Execute Approved Proposal

```
1. If proposal approved and time expired
2. Open "Write Contract"
3. Function execute(uint256 proposalId)
4. Enter proposal ID
5. Click "Write" - proposal executes ✅
```

### Popular Blockchain Explorers for DLE

| Network | Blockchain Explorer | URL |
|---------|---------------------|-----|
| **Ethereum Mainnet** | Etherscan | https://etherscan.io |
| **Polygon** | Polygonscan | https://polygonscan.com |
| **Binance Smart Chain** | BscScan | https://bscscan.com |
| **Arbitrum** | Arbiscan | https://arbiscan.io |
| **Optimism** | Optimistic Etherscan | https://optimistic.etherscan.io |
| **Avalanche** | SnowTrace | https://snowtrace.io |
| **Base** | BaseScan | https://basescan.org |

### Advantages of Management via Blockchain Explorers

**1. Complete independence from web application**
```
Web application hacked → Blockchain works ✅
Backend server down → Smart contracts work ✅
Frontend unavailable → Can manage via Etherscan ✅
```

**2. Impossible to forge data**
```
Attacker on backend → Blockchain explorer shows truth
Fake frontend → Etherscan shows real tokens
Modified logic → Smart contract works as intended
```

**3. Access 24/7 from anywhere in the world**
```
No server access → Etherscan always available
Application maintenance → Management via blockchain
DDoS attack on site → Blockchain unavailable for DDoS
```

**Response to hack:**
1. Users notice strange web application behavior
2. Check token balance directly via Etherscan ✅
3. Create proposal via Etherscan for recovery
4. Vote for infrastructure recovery
5. Administrators restore backend from backup
6. **No tokens or assets lost** ✅

**Conclusion**: Web application is just a convenient interface. Real power and assets are on blockchain, where they are protected by cryptography and impossible to change or steal through web application hack.

### Scenario 3: 51% Attack

**Attack:**
```
1. Attacker buys or gets >51% of all tokens
2. Creates proposal "Transfer all assets to me"
3. Votes with all own tokens "For"
4. Proposal approved
```

**Protection:**
```javascript
// Timelock Module gives time to react
const TIMELOCK = 7 days;

// Other token holders can:
1. Vote "Against" (if they still have 49%)
2. Create counter-proposal
3. Contact law enforcement
4. Cancel proposal via emergency function (if configured)
```

**Long-term protection:**
- Even token distribution among partners
- Multisignature for large operations
- Quadratic voting (option for future versions)

### Scenario 4: Social Engineering

**Attack:**
```
1. Attacker impersonates DLE support
2. Asks token holder "for verification" to sign message
3. Message is actually approval to transfer tokens
```

**Protection:**
```javascript
// Frontend always shows WHAT is being signed
function signMessage(message) {
    // Show user exact content
    const confirmation = confirm(`
        You are about to sign:
        ${message}
        
        ⚠️ NEVER sign messages at request of "support"!
        
        Continue?
    `);
    
    if (!confirmation) return;
    
    // Sign
}
```

**Recommendations:**
- ❌ Support **NEVER** asks to sign message
- ❌ Don't trust "urgent" requests
- ✅ Always verify what you're signing
- ✅ If in doubt - contact official support

---

## Conclusion

### Multi-Layer DLE Protection

```
┌─────────────────────────────────────────────────────┐
│           DLE Security Levels                      │
├─────────────────────────────────────────────────────┤
│  1️⃣ Blockchain                                      │
│     └── Tokens cannot be stolen even with hack      │
│                                                     │
│  2️⃣ Smart Contracts                                │
│     └── Audit, OpenZeppelin, immutability           │
│                                                     │
│  3️⃣ Voting with quorum                             │
│     └── Impossible to make unilateral decisions     │
│                                                     │
│  4️⃣ Timelock                                       │
│     └── Time to react in case of attack             │
│                                                     │
│  5️⃣ Backend verification                           │
│     └── Real-time token verification                │
│                                                     │
│  6️⃣ Frontend protection                            │
│     └── XSS, CSRF, rate limiting                    │
│                                                     │
│  7️⃣ Monitoring and alerts                          │
│     └── Detection of suspicious actions             │
└─────────────────────────────────────────────────────┘
```

### Key Security Advantages

1. **🔐 Token-based access control**
   - Without tokens access impossible
   - Real-time verification on blockchain

2. **🛡️ Protection from token theft**
   - Cannot transfer without voting
   - Even if wallet hacked, tokens protected

3. **🌐 Independence from web application**
   - Even if web application hacked, business assets protected on blockchain
   - Can manage via blockchain explorers (Etherscan, Polygonscan, etc.)
   - Smart contracts work independently of frontend/backend
   - Web application is only convenient interface, real power on blockchain

4. **⚖️ Collective governance**
   - Critical decisions only through voting
   - Quorum prevents unilateral actions

5. **🔒 Modules under smart contract control**
   - Only DLE contract can call modules
   - No direct access

6. **📊 Full transparency**
   - All actions on blockchain
   - Impossible to hide or forge

### Next Steps

1. 📖 [Study technical documentation](./blockchain-integration-technical.md)
2. 🔧 [Set up secure environment](./setup-instruction.md)
3. 📋 [Read FAQ](./FAQ.md)
4. 💬 [Get support](https://hb3-accelerator.com/)
---

**© 2024-2025 Tarabanov Alexander Viktorovich. All rights reserved.**

**Last update**: October 2025

