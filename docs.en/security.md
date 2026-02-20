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

Digital Legal Entity (DLE) is built with **security at every layer**:
- Access control via blockchain tokens
- Smart contract protection from compromise
- Tokens cannot be stolen even if wallet is compromised
- Governance only through voting with quorum

### Key Security Principles

1. **Secure by default** — all actions denied until explicitly allowed
2. **Least privilege** — each entity gets only required rights
3. **Transparency** — all actions recorded on blockchain
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
│  │ • Full operation history on blockchain                │  │
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

| Threat | Risk level | Mitigation |
|--------|------------|------------|
| **Wallet compromise** | Medium | Tokens cannot be transferred without voting |
| **Web app compromise** | Low | All rights checked on blockchain, governance via blockchain explorers |
| **Smart contract compromise** | Low | Audit, OpenZeppelin, immutability |
| **DDoS** | Medium | Rate limiting, CDN, backup servers |
| **Phishing** | High | User education, domain verification |
| **Insider threat** | Low | All actions through voting |

### Critical: Web Application Is Only an Interface

**Key DLE architecture point:**

The web app (frontend + backend) provides **convenience**. It may be compromised or unavailable — **but business assets remain protected**. Real control and assets are on the blockchain; you can manage via Etherscan/Polygonscan etc. and deploy a new frontend connected to the same contracts.

**If the web app is compromised:** assets stay on chain, contracts keep working, tokens cannot be stolen, governance is possible via blockchain explorers, and a new frontend can be deployed.

---

## Token-Based Access Control

**Without tokens, access to the application is NOT possible.**

Access flow: user connects wallet → backend checks token balance in smart contract → if no tokens → access denied; if tokens exist → access granted (level depends on amount).

### Access Levels

| Token balance | Access level | Rights |
|---------------|--------------|--------|
| **0 tokens** | ❌ No access | "No access" page only |
| **1+ tokens** | ✅ ReadOnly | View data |
| **100+ tokens** | ✅ Editor | Edit, create |
| **Any amount** | 🗳️ Voting | 1 token = 1 vote |

Token checks run on every request; balance is read from the contract. If tokens are transferred away, access is lost immediately; if received, access is granted. The check cannot be bypassed.

---

## Smart Contract Security

**CRITICAL:** Governance tokens **cannot** be transferred by normal means. `transfer`, `approve`, and `transferFrom` are disabled and revert. Tokens can only be moved through governance (voting with quorum). Transfers use snapshots for voting power to prevent flash-loan attacks. All parameters are validated; custom errors save gas.

---

## Wallet Compromise Protection

If an attacker obtains a private key: they cannot send tokens (transfer disabled), sell on DEX (approve disabled), or use transferFrom. They could only create a proposal to transfer tokens to themselves — which requires other token holders to vote and reach quorum, so it will usually fail.

Protections: Timelock (delayed execution so others can react), multisig for critical ops, and cold/hardware wallets for large holders.

---

## Web Application Security

- **SIWE (Sign-In with Ethereum):** nonce generated and stored encrypted; signature verified; private key never leaves wallet.
- **Data encryption:** AES-256 for wallet addresses, nonces, session data, private messages.
- **Rate limiting** on API and stricter limits on auth.
- **CSRF** and **XSS** (DOMPurify) protection.
- **Helmet.js** for secure headers.
- **Clean logs:** sensitive data (addresses, nonces) redacted.

---

## Module Management

Only the DLE smart contract can call module functions (`onlyDLE` modifier). Owner, backend, or attacker cannot call modules directly. Adding/removing modules is only through voting.

---

## Audit and Monitoring

All actions are recorded in contract events (ProposalCreated, ProposalVoted, ProposalExecuted, ModuleAdded, TokensTransferred). Backend subscribes to events and can alert token holders. Critical events can trigger email/Telegram and logging.

---

## Security Recommendations

**For token holders:** Use hardware wallet; store seed phrase safely; enable notifications; review every proposal; split tokens (hot 10–20%, cold 80–90%).

**For admins:** Regular updates; daily DB backups; log monitoring; encryption key rotation; firewall (only 80/443 if needed).

**For developers:** Audit contracts (Slither, Mythril); run tests and coverage; code review; `yarn audit` for dependencies.

---

## Attack Scenarios and Mitigation

**Phishing:** Backend validates domain in SIWE; frontend can warn if hostname is wrong. Users should check URL and use bookmarks.

**Backend compromise:** Token checks are on-chain; balances and rules cannot be changed by backend. Users can verify on Etherscan and manage via explorers.

**51% attack:** Timelock gives time to react; other holders can vote against or take legal action.

**Social engineering:** Frontend shows what is being signed; support never asks to sign messages. Users should never sign on request from “support”.

---

## Conclusion

DLE provides multi-layer protection: blockchain (tokens not stealable), audited contracts, quorum voting, timelock, backend checks, frontend hardening, and monitoring. Access is token-gated; tokens are protected even if wallet or web app is compromised; governance can continue via blockchain explorers.

### Next Steps

1. [Technical documentation](./back-docs/blockchain-integration-technical.md)
2. [Secure setup](./back-docs/setup-instruction.md)
3. [FAQ](../FAQ.md)
4. [Support](https://hb3-accelerator.com/)

---

**© 2024-2025 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** October 2025
