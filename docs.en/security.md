**English** | [Русский](../docs.ru/security.md)

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

---

## Introduction

Digital Legal Entity (DLE) is built with a focus on **security at every layer**:
- Access control via blockchain tokens
- Smart contract protection from compromise
- Tokens cannot be stolen even if a wallet is compromised
- Governance only through voting with quorum

### Key Security Principles

1. **Secure by default** — all actions are denied until explicitly allowed
2. **Least privilege** — each party gets only the rights they need
3. **Transparency** — all actions are recorded on the blockchain
4. **Immutability** — history cannot be forged
5. **Collective control** — critical operations only through voting

---

## Security Model

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DLE Protection Layers                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Blockchain (Immutable Base)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • DLE smart contract (audited, immutable)             │  │
│  │ • Governance tokens (ERC20Votes)                       │  │
│  │ • Full operation history on the blockchain            │  │
│  │ • Rules cannot change without voting                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 2: Web Application (Backend)                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Real-time token checks                              │  │
│  │ • Wallet authentication (SIWE)                        │  │
│  │ • Data encryption (AES-256)                            │  │
│  │ • Rate limiting and DDoS protection                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 3: Frontend (Vue.js)                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet connection                                    │  │
│  │ • Transaction signing                                  │  │
│  │ • XSS protection (DOMPurify)                          │  │
│  │ • CSRF tokens                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↑                                 │
│  Layer 4: User                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ • Wallet private key (MetaMask, WalletConnect)        │  │
│  │ • Confirmation for each operation                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Threat Model

| Threat | Risk Level | Mitigation |
|--------|------------|------------|
| **Wallet compromise** | Medium | Tokens cannot be transferred without voting |
| **Web application compromise** | Low | All rights are checked on the blockchain; governance via blockchain explorers |
| **Smart contract compromise** | Low | Audit, OpenZeppelin, immutability |
| **DDoS attack** | Medium | Rate limiting, CDN, backup servers |
| **Phishing** | High | User education, domain verification |
| **Insider threat** | Low | All actions through voting |

### Critical: The Web Application Is Only an Interface

**Key DLE architecture characteristic:**

```
┌─────────────────────────────────────────────────────────┐
│              Web Application (Interface)                │
│                                                         │
│  Frontend + Backend = CONVENIENCE of use               │
│  • Polished UI                                         │
│  • Convenient navigation                               │
│  • Fast access to features                             │
│                                                         │
│  May be compromised / unavailable                      │
│  ✅ BUT! Business assets remain protected               │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│               Blockchain (Real Authority)               │
│                                                         │
│  Smart contracts = REAL asset control                  │
│  • Governance tokens                                   │
│  • Treasury with assets                                │
│  • Voting rules                                        │
│  • History of all decisions                            │
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
├── ❌ Frontend may be replaced
│
BUT:
├── ✅ All business assets remain on the blockchain
├── ✅ Smart contracts continue to operate
├── ✅ Tokens cannot be stolen
├── ✅ Governance is possible via Etherscan/Polygonscan/etc.
└── ✅ You can deploy a new frontend and connect it to the same contracts
```

**Real-world example:**

1. An attacker compromises your server that hosts the web application
2. They try to display fake token balances
3. **But**: Real balances on the blockchain remain unchanged
4. You open Etherscan and see the truth
5. You create a recovery proposal via Etherscan
6. You vote and execute the proposal
7. You restore the web application
8. **Result**: Not a single token is lost ✅

---

## Token-Based Access Control

### How It Works

**Without tokens, access to the application is IMPOSSIBLE.**

```
DLE access attempt:
├── 1. User connects a wallet
├── 2. Backend checks token balance in the smart contract
├── 3. If there are NO tokens → Access DENIED
└── 4. If tokens EXIST → Access granted (level depends on amount)
```

### Access Levels

| Token Balance | Access Level | Rights |
|---------------|--------------|--------|
| **0 tokens** | ❌ No access | "No access" page only |
| **1+ tokens** | ✅ ReadOnly | View data |
| **100+ tokens** | ✅ Editor | Edit, create |
| **Any amount** | 🗳️ Voting | 1 token = 1 vote |

### Real-Time Token Checks

**Backend** continuously checks token balances:

```javascript
// Every request checks tokens
async function checkAccess(req, res, next) {
    const address = req.session.address;
    
    // Get token balance from the smart contract
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

**Important**: The check runs on **every request**, therefore:
- ✅ If tokens are transferred away → access is lost immediately
- ✅ If tokens are received → access appears immediately
- ✅ The check cannot be bypassed

### Initial Token Distribution

**Tokens are distributed by the owner at smart contract deployment:**

```solidity
constructor(DLEConfig memory config) {
    // Mint tokens
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
1. The wallet owner deploys the DLE smart contract
2. Specifies partner addresses and the token amount for each
3. Tokens are automatically distributed at deploy time
4. After that, all changes are only through voting

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

### Protection Against Token Transfers

**CRITICAL**: Governance tokens **CANNOT** be transferred by ordinary means!

```solidity
// Transfers are BLOCKED
function transfer(address to, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrTransfersDisabled();
}

// Approvals are BLOCKED
function approve(address spender, uint256 amount) 
    public 
    pure 
    override 
    returns (bool) 
{
    revert ErrApprovalsDisabled();
}

// TransferFrom is BLOCKED
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
// Token transfer (only through governance)
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
   ├── The smart contract automatically transfers tokens
   └── The event is recorded on the blockchain forever
```

### Quorum Configuration

**Quorum is set at deploy time** and can be changed only through voting:

```solidity
uint256 public quorumPercentage; // e.g., 10%

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
- 5% — easy to reach (for active organizations)
- 10% — standard (recommended)
- 20% — strict (for critical decisions)
- 51% — absolute majority

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

**Vote snapshots** prevent attacks that temporarily borrow tokens:

```solidity
// Votes are taken from a PAST block
uint256 public snapshotTimepoint = block.number - 1;

function vote(uint256 proposalId, bool support) external {
    // Use balance from the past block
    uint256 votingPower = getPastVotes(msg.sender, snapshotTimepoint);
    require(votingPower > 0, "No voting power");
    
    // Voting
}
```

**Why this is safe**:
1. An attacker takes a flash loan of 1,000,000 tokens
2. Tries to vote
3. The smart contract checks the balance in the **past block**
4. In the past block the attacker had 0 tokens
5. The vote is rejected ❌

### Validation of All Parameters

```solidity
// Address checks
if (address == address(0)) revert ErrZeroAddress();

// Token holding check
if (balanceOf(msg.sender) == 0) revert ErrNotHolder();

// Voting duration checks
if (duration < minVotingDuration) revert ErrTooShort();
if (duration > maxVotingDuration) revert ErrTooLong();

// Supported networks check
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

## Wallet Compromise Protection

### Scenario: An Attacker Obtained the Private Key

**What the attacker can do:**

```
Attacker attempts:

1. ❌ Send tokens to their own address
   └── BLOCKED: transfer() is disabled

2. ❌ Sell tokens on a DEX (Uniswap, etc.)
   └── BLOCKED: approve() is disabled

3. ❌ Send via transferFrom
   └── BLOCKED: transferFrom() is disabled

4. ❓ Create a proposal "Transfer tokens to me"
   └── Requires voting by other token holders
   └── Quorum: 10%+ must vote "For"
   └── WILL MOST LIKELY FAIL
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
// Delayed execution (e.g., 3 days)
uint256 public constant TIMELOCK_DELAY = 3 days;

function scheduleProposal(uint256 proposalId) external {
    // Proposal approved, but executes only after 3 days
    executionTime = block.timestamp + TIMELOCK_DELAY;
}
```

**Advantage**: Other token holders see the dangerous proposal and can:
- Vote "Against"
- Create a counter-proposal
- Take action (e.g., go to court)

**Solution 2: Multisignature**

```solidity
// Multiple signatures required for critical operations
mapping(uint256 => mapping(address => bool)) public approvals;

function executeWithApprovals(
    uint256 proposalId,
    address[] calldata signers,
    bytes[] calldata signatures
) external {
    // Verify signatures of several token holders
    require(signers.length >= minSigners, "Not enough signers");
    
    for (uint i = 0; i < signers.length; i++) {
        // Signature verification
        verifySignature(proposalId, signers[i], signatures[i]);
    }
    
    // Execution
}
```

**Solution 3: Cold Wallet for Large Holders**

It is recommended to keep tokens on:
- 🥶 **Hardware wallet** (Ledger, Trezor) — maximum protection
- **Multisig** (Gnosis Safe) — multiple signatures required
- ❄️ **Cold storage** — offline, not connected to the internet

### Monitoring Suspicious Proposals

**Backend automatically detects dangerous proposals:**

```javascript
// Suspicious proposal detector
function detectSuspiciousProposal(proposal) {
    const alerts = [];
    
    // Check 1: Transfer of a large amount of tokens
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
    
    // Check 2: Initiator votes only with their own tokens
    if (proposal.forVotes === proposal.initiatorBalance) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Initiator is voting only with their own tokens'
        });
    }
    
    // Check 3: Fast voting (< 24 hours)
    if (proposal.duration < 86400) {
        alerts.push({
            level: 'MEDIUM',
            message: 'Voting lasts less than 24 hours — little time to review'
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

### Authentication via SIWE

**Sign-In with Ethereum** — a standard for secure authentication:

```javascript
// Generate nonce (one-time)
const nonce = crypto.randomBytes(32).toString('hex');

// Store in DB with encryption
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
- ✅ The private key **never** leaves the wallet
- ✅ Each nonce is used **once**
- ✅ Nonce expires after 5 minutes
- ✅ Forging a signature is impossible without the private key

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
- Wallet addresses in the DB
- Authentication nonces
- Session data
- Private messages

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Request limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // maximum 100 requests
    message: 'Too many requests, please try again later'
});

// Auth limiting (stricter)
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
    // CSRF token check is automatic
});
```

### XSS Protection

```javascript
import DOMPurify from 'dompurify';

// Sanitize HTML from dangerous code
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

**Automatic log scrubbing of sensitive data:**

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

### Only the DLE Smart Contract Manages Modules

The **`onlyDLE` modifier** ensures that only the DLE smart contract can call module functions:

```solidity
// Module: TreasuryModule
contract TreasuryModule {
    address public immutable dleContract;
    
    modifier onlyDLE() {
        require(msg.sender == dleContract, "Only DLE can call");
        _;
    }
    
    // Only DLE can transfer tokens from the treasury
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
- ❌ The wallet owner **CANNOT** call module functions directly
- ❌ Backend **CANNOT** call module functions
- ❌ An attacker **CANNOT** interact with the module
- ✅ **Only** the DLE smart contract through voting

### Module Usage Process

```
1. Token holder creates a proposal
   └── "Transfer 1000 USDC from Treasury to marketing"

2. The proposal contains an encoded module function call
   └── operation = treasuryModule.transferTokens(USDC, marketing, 1000)

3. Voting

4. If approved, the DLE contract calls the module:
   └── TreasuryModule.transferTokens() ✅
   └── msg.sender = DLE contract ✅
   
5. The module checks msg.sender and executes
```

### Adding a New Module

**Only through voting:**

```solidity
// Add-module operation
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
4. If approved → the module is added
5. The module can be used

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

### Transparency on the Blockchain

**All actions are recorded forever:**

```solidity
// Events for audit
event ProposalCreated(uint256 proposalId, address initiator);
event ProposalVoted(uint256 proposalId, address voter, bool support);
event ProposalExecuted(uint256 proposalId, bytes operation);
event ModuleAdded(bytes32 moduleId, address moduleAddress);
event TokensTransferred(address recipient, uint256 amount);
```

**Verification in a blockchain explorer:**
```
https://etherscan.io/address/0xDLE_CONTRACT_ADDRESS
└── All transactions are publicly visible
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
    
    // Write to logs
    logger.warn(`ALERT: ${event}`, data);
}
```

---

## Security Recommendations

### For Token Holders

1. **Use a hardware wallet** (Ledger, Trezor)
   - The private key never leaves the device
   - Every operation is confirmed on a physical device

2. **Store the seed phrase securely**
   - Write it on paper; do not store it digitally
   - Use metal plates for durability
   - Keep it in a safe or bank safe-deposit box

3. **Enable notifications**
   - Email alerts for new proposals
   - Telegram bots for critical events

4. **Review every proposal**
   - Read the description before voting
   - Verify recipient addresses
   - Use timelock for critical operations

5. **Split your tokens**
   - Hot wallet: 10–20% for everyday use
   - Cold wallet: 80–90% for long-term storage

### For Administrators

1. **Regular updates**
   ```bash
   # Weekly update
   docker-compose pull
   docker-compose up -d
   ```

2. **Backups**
   ```bash
   # Daily database backup
   docker exec dapp-postgres pg_dump -U user db > backup.sql
   ```

3. **Log monitoring**
   ```bash
   # Check logs for suspicious activity
   docker logs dapp-backend | grep -i "error\|warning\|failed"
   ```

4. **Encryption key rotation**
   - Change the encryption key once a year
   - Keep old keys to decrypt historical data

5. **Firewall configuration**
   ```bash
   # Allow only necessary ports
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
   # Run tests
   cd backend
   yarn test
   
   # Code coverage
   yarn coverage
   ```

3. **Code review**
   - All changes via pull requests
   - At least 2 reviewers for critical changes

4. **Secure dependencies**
   ```bash
   # Vulnerability check
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

**Mitigation:**
```javascript
// Backend checks the domain in the SIWE message
const message = new SiweMessage({
    domain: req.get('host'), // Must be the correct domain
    uri: req.get('origin')
});

// Frontend shows a warning
if (window.location.hostname !== 'dle.app') {
    alert('WARNING: This is NOT the official DLE website!');
}
```

**Recommendations for users:**
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

**Mitigation:**
```
✅ Token checks happen on the blockchain (immutable)
✅ Backend may be compromised, but:
   ├── Impossible to change token balances in the smart contract
   ├── Impossible to create fake tokens
   ├── Impossible to change smart contract rules
   └── Users will see discrepancies between backend and blockchain
```

**Critical: The web application is only an interface!**

Even with a **full compromise** of the web application:
- ✅ **All business assets remain protected** on the blockchain
- ✅ **Smart contracts continue to operate** independently of the web application
- ✅ **Governance is possible via blockchain explorers** (Etherscan, Polygonscan, etc.)

### Governance via Blockchain Explorers

**If the web application is unavailable, use blockchain explorers:**

#### 1. Checking Token Balance

```
1. Open Etherscan: https://etherscan.io
2. Enter the DLE smart contract address
3. Go to the "Read Contract" tab
4. Call the balanceOf(address) function
5. Enter your wallet address
6. Click "Query" — you will see the token balance ✅
```

**Example**:
```
Contract Address: 0x1234...DLE
Function: balanceOf
Address: 0xYourWallet...
Result: 500000 (your token balance)
```

#### 2. Creating a Proposal via Etherscan

```
1. Open Etherscan and find the DLE smart contract
2. Go to the "Write Contract" tab
3. Connect your MetaMask wallet
4. Find the createProposal function
5. Fill in the parameters:
   - description: "Restore the web application"
   - operation: encoded function call
   - votingDuration: 86400 (1 day in seconds)
6. Click "Write" and confirm the transaction ✅
```

**Proposal creation example**:
```solidity
// Via Etherscan Write Contract
createProposal(
    "Transfer 10,000 USDT for infrastructure recovery",
    0x..., // encoded transferTokens call
    86400  // 1 day
)
```

#### 3. Voting via Etherscan

```
1. Open the DLE smart contract on Etherscan
2. "Write Contract" tab
3. Connect your wallet
4. Function vote(uint256 proposalId, bool support)
   - proposalId: proposal number (e.g., 5)
   - support: true (for) or false (against)
5. Click "Write" ✅
```

#### 4. Checking Proposal State

```
1. "Read Contract" tab on Etherscan
2. Function proposals(uint256)
3. Enter the proposal ID
4. You will see all details:
   - Description
   - "For" and "Against" votes
   - Status (Active, Executed, Failed)
   - Voting end time
```

#### 5. Executing an Approved Proposal

```
1. If the proposal is approved and the time has expired
2. Open "Write Contract"
3. Function execute(uint256 proposalId)
4. Enter the proposal ID
5. Click "Write" — the proposal will execute ✅
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

### Advantages of Governance via Blockchain Explorers

**1. Full independence from the web application**
```
Web application compromised → Blockchain works ✅
Backend server down → Smart contracts work ✅
Frontend unavailable → Manage via Etherscan ✅
```

**2. Data cannot be forged**
```
Attacker on backend → Blockchain explorer shows the truth
Fake frontend → Etherscan shows real tokens
Altered logic → Smart contract works as designed
```

**3. 24/7 access from anywhere in the world**
```
No access to the server → Etherscan is always available
Application under maintenance → Governance via blockchain
DDoS attack on the site → Blockchain is not available for DDoS
```

**Response to a compromise:**
1. Users notice strange web application behavior
2. Check token balances directly via Etherscan ✅
3. Create a recovery proposal via Etherscan
4. Vote to restore infrastructure
5. Administrators restore the backend from a backup
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

**Mitigation:**
```javascript
// Timelock Module gives time to react
const TIMELOCK = 7 days;

// Other token holders can:
1. Vote "Against" (if they still hold 49%)
2. Create a counter-proposal
3. Contact law enforcement
4. Cancel the proposal via an emergency function (if configured)
```

**Long-term protection:**
- Even distribution of tokens among partners
- Multisig for large operations
- Quadratic voting (option for future versions)

### Scenario 4: Social Engineering

**Attack:**
```
1. Attacker poses as DLE support
2. Asks a token holder to sign a message "for verification"
3. The message is actually an approval to transfer tokens
```

**Mitigation:**
```javascript
// Frontend always shows WHAT is being signed
function signMessage(message) {
    // Show the user the exact content
    const confirmation = confirm(`
        You are about to sign:
        ${message}
        
        NEVER sign messages at the request of "support"!
        
        Continue?
    `);
    
    if (!confirmation) return;
    
    // Sign
}
```

**Recommendations:**
- ❌ Support will **NEVER** ask you to sign a message
- ❌ Do not trust "urgent" requests
- ✅ Always verify what you are signing
- ✅ When in doubt — contact official support

---

## Conclusion

### Multi-Layer DLE Protection

```
┌─────────────────────────────────────────────────────┐
│           DLE Security Layers                       │
├─────────────────────────────────────────────────────┤
│  1️⃣ Blockchain                                       │
│     └── Tokens cannot be stolen even with a breach  │
│                                                     │
│  2️⃣ Smart Contracts                                 │
│     └── Audit, OpenZeppelin, immutability           │
│                                                     │
│  3️⃣ Quorum Voting                                   │
│     └── Unilateral decisions are impossible         │
│                                                     │
│  4️⃣ Timelock                                        │
│     └── Time to react during an attack              │
│                                                     │
│  5️⃣ Backend Checks                                  │
│     └── Real-time token verification                │
│                                                     │
│  6️⃣ Frontend Protection                             │
│     └── XSS, CSRF, rate limiting                    │
│                                                     │
│  7️⃣ Monitoring and Alerts                           │
│     └── Detection of suspicious actions             │
└─────────────────────────────────────────────────────┘
```

### Key Security Advantages

1. **Token-based access control**
   - Without tokens, access is impossible
   - Real-time checks on the blockchain

2. **Protection against token theft**
   - Impossible to transfer without voting
   - Even if a wallet is compromised, tokens remain protected

3. **🌐 Independence from the web application**
   - Even if the web application is compromised, business assets remain protected on the blockchain
   - Governance is possible via blockchain explorers (Etherscan, Polygonscan, etc.)
   - Smart contracts operate independently of frontend/backend
   - The web application is only a convenient interface; real authority is on the blockchain

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

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated**: February 2026
