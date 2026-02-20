**English** | [Русский](../docs.ru/service-terms.md)

# Digital Legal Entity — Terms of Purchase and Service

## Table of Contents

1. [Licensing Model](#1-licensing-model)
2. [Pricing](#2-pricing)
3. [Voting System](#3-voting-system)
4. [Updates and Maintenance](#4-updates-and-maintenance)
5. [Technical Support and Training](#5-technical-support-and-training)
6. [Refunds and Warranties](#6-refunds-and-warranties)
7. [Liability](#7-liability)
8. [Terms of Use](#8-terms-of-use)
9. [Security and Privacy](#9-security-and-privacy)
10. [Governance Smart Contract](#10-governance-smart-contract)
11. [Payment and Sellers](#11-payment-and-sellers)
12. [Changes to Terms](#12-changes-to-terms)
13. [Contacts](#13-contacts)

**Legal documents:** [legal.en/README.md](../legal.en/README.md) — license, copyright, attribution requirements.

---

## 1. Licensing Model

### 1.1. Core Principles

| Parameter | Value |
|-----------|-------|
| License type | Perpetual |
| Term | Unlimited |
| Updates | Free for 5 years for token holders |
| Revocation | License cannot be revoked by the company |

### 1.2. License and Tokens

Each DLE license is tied to a **governance token on the blockchain**. The token confirms the right to use the platform and grants a vote in product development.

| Parameter | 1 token | 10 tokens |
|-----------|---------|-----------|
| Number of licenses | 1 | 1 |
| Lines of business | 1 | 1 |
| Votes in voting | 1 | 10 |
| Service terms | Same | Same |

**Voting:** 1 token = 1 vote. Decisions are made by majority (51%+) via smart contract on the blockchain.

### 1.3. Line of Business

- One license — one line of business.
- Separate licenses required for multiple lines of business.

---

## 2. Pricing

### 2.1. Licenses

| Package | Price | Tokens | Votes |
|---------|-------|--------|-------|
| Standard | $1,000 USDT (one-time) | 1 | 1 |
| Premium | $10,000 USDT (one-time) | 10 | 10 |

All prices are **excluding taxes**. Taxes are the buyer’s responsibility (VAT, Sales Tax, Income Tax, etc. as per jurisdiction).

### 2.2. What’s Included in Both Licenses

- Perpetual right to use the platform
- Full source code and documentation
- Free updates for 5 years (for token holders)
- Technical support (SLA by issue priority)
- Governance tokens on the blockchain
- Vote in product development
- Access to online training sessions
- Ready document pack for the regulator

The only difference between packages is the number of tokens and thus votes.

### 2.3. Payment Methods

- **Cryptocurrency (USDT)** — directly or via authorized partners
- **Bank transfer** — in local currency via authorized dealers
- **Credit cards** — via partners’ payment systems

All transfer, conversion, and payment processing fees are borne by the buyer.

### 2.4. Purchase Process

1. Choose seller (authorized dealer or author directly)
2. Agree price in USDT or local currency equivalent
3. Receive payment details
4. Send payment
5. Confirmation and payment document
6. Receive token and platform access

---

## 3. Voting System

### 3.1. Process

1. **Proposal** — community proposes a new feature
2. **Registration** — vote is created in the smart contract on the blockchain
3. **Voting** — each token = 1 vote, For or Against
4. **Decision** — with 51%+ For, the feature is taken into development

### 3.2. Frequency

- Voting is open continuously (asynchronous)
- Quarterly review of results
- Development by priority (vote count)

### 3.3. Voting Portal

**URL:** https://hb3-accelerator.com/

Available: create proposals, vote, view results, track development status, voting history.

**Requirements:** wallet with tokens (MetaMask, WalletConnect, etc.).

---

## 4. Updates and Maintenance

### 4.1. Free Updates (5 Years)

For all license token holders from the token transfer date recorded on the blockchain:

- Bug fixes
- Performance improvements
- New features (approved by voting)
- Security updates

**Frequency:**

| Type | Frequency |
|------|------------|
| Security patches | As soon as found |
| Regular updates | Weekly (Wednesdays) |
| Major features | Per voting results |

### 4.2. Update Platform

**URL:** https://hb3-accelerator.com/

License holders can: download all versions, read release notes, get new version notifications, read migration documentation.

**Access requirement:** license token on wallet at request time.

---

## 5. Technical Support and Training

All license holders get access to support and training via the portal: https://hb3-accelerator.com/

Detailed support terms, training, online sessions, and platform setup are in the [accelerator program](https://github.com/VC-HB3-Accelerator/.github/blob/main/Версия%20на%20русском/accelerator-program.md).

---

## 6. Refunds and Warranties

### 6.1. General

License is perpetual — standard refund is not provided.

### 6.2. 70% Refund Program

**70% of the license price** may be refunded within **5 years** of purchase if all of the following are met:

1. More than **51% negative votes** in token holder voting
2. Complaints concern **lack of update releases**
3. Voting is conducted **via smart contract on the blockchain**
4. Request is submitted **within 5 years** of the license date

**Process:** request at hb3-accelerator.com → confirmation on smart contract → 70% refund within 30 days.

### 6.3. Payment Dispute

Within 30 days of payment — in case of calculation error, double payment, or other justified reasons.

---

## 7. Liability

### 7.1. Author’s Warranties

- License is perpetual (right to use not limited in time)
- Updates and basic maintenance free for 5 years
- Core functionality remains available
- Vote in product development

### 7.2. Not Guaranteed

- Specific new features (depend on voting)
- Specific release schedule
- Support when modifying source code
- Performance beyond recommended limits

### 7.3. Limitation of Author’s Liability

Author is not liable for: lost profit, indirect damages, data loss, business interruption, reputational harm, fines, or sanctions.

**Maximum liability:** not more than the license fee paid. Only direct damages from direct breach of contract are covered.

### 7.4. User Responsibility

User is responsible for: data backup, use in accordance with the license, protecting wallet private keys, compliance with applicable law, timely application updates.

---

## 8. Terms of Use

### Allowed

- Use for managing own business
- Deployment on own infrastructure
- Data backup
- Local configuration changes
- Voting on product development
- Transfer of license to heirs

### Prohibited

- Resale or sublicensing
- Using one license for more than one line of business
- Reverse engineering and source code modification
- Removal of copyright and license notices
- Sharing between independent organizations
- Educational use without permission
- Deploying SaaS based on the platform

---

## 9. Security and Privacy

| Mechanism | Description |
|-----------|-------------|
| TLS 1.3 | All connections encrypted |
| AES-256 | Critical data encrypted at rest |
| Key management | User controls encryption keys |
| GDPR | Compliance (with DPA) |

More: [DLE Security](./security.md)

---

## 10. Governance Smart Contract

### 10.1. Architecture

DLE uses an on-chain smart contract for licenses and voting:

- **ERC20** — each license is represented by governance tokens (1 or 10)
- **ERC20Votes** — built-in voting
- **ERC20Permit** — signatures for gasless transfers
- **Multichain** — voting supported across multiple networks

### 10.2. Voting via Smart Contract

**Creating proposals:** token holders only. Voting duration: 1 hour to 30 days.

**Process:** proposal → voting (1 token = 1 vote) → quorum 51%+ → execution.

**Execution:** via direct call on the voting chain or via signatures on other chains.

### 10.3. Contract Security

- ReentrancyGuard
- Tokens transfer only through governance
- Vote snapshots vs flash-loans
- EIP-712 signatures for contract wallets
- All parameters validated before execution

### 10.4. License Transfer

License = tokens tied to wallet address. Transfer = moving tokens to a new address through governance. New owner automatically gets voting rights.

---

## 11. Payment and Sellers

### 11.1. Authorized Sellers

Licenses are sold **only through companies** with official written authorization from the author.

**Seller requirements:** legal entity, signed contract, listed on hb3-accelerator.com, compliance with licensing terms.

### 11.2. Seller for Russian Federation

**LLC "ERAYTI"**
- OGRN: 1222600014383
- INN: 2636220809
- Address: 355007, Stavropol Krai, Stavropol, ul. Burmistrova, 65B, premises 2
- Contacts: 18900@эрайти.рф, +7 (968) 269-92-64

### 11.3. Direct Purchase from Author

- Email: info@hb3-accelerator.com
- Website: https://hb3-accelerator.com
- GitHub: https://github.com/VC-HB3-Accelerator

---

## 12. Changes to Terms

### For New Licenses

- Terms may change for new purchases
- 60 days’ notice before changes take effect
- Applies only to licenses purchased after the change date

### For Existing Licenses

- Your license terms **do not change** after purchase
- Fixed rights apply perpetually
- Backward compatibility is maintained

---

## 13. Contacts

- **Support portal:** https://hb3-accelerator.com/
- **Email:** info@hb3-accelerator.com
- **GitHub:** https://github.com/VC-HB3-Accelerator/DLE
- **Legal status:** Proprietary software (see [LICENSE](../LICENSE))
- **Legal documentation:** [legal.en/README.md](../legal.en/README.md)

---

## Additional Documentation

- [Platform description](./application-description.md)
- [AI Agents](./ai-assistant.md) — specialized agent system
- [Blockchain for Business](./blockchain-for-business.md) — digital asset registration and business use cases
- [DLE Security](./security.md) — multi-layer protection
- [FAQ](./FAQ.md) — frequently asked questions

---

**© 2024-2025 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** February 2026
