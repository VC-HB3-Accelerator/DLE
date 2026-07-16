**English** | [Русский](../legal.ru/service-terms.md)

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
11. [Payment and Contributors](#11-payment-and-contributors)
12. [Changes to Terms](#12-changes-to-terms)
13. [Contacts](#13-contacts)

**Legal documents:** [legal.en/README.md](README.md) — license, copyright, attribution requirements.

### Document hierarchy (End User)

| Document | Purpose |
|----------|---------|
| [LICENSE](../LICENSE) | Copyright, restrictions, EULA |
| **service-terms.md** (this file) | Purchase, token, updates, support, refunds, liability |
| [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md) | Authorized Contributors only (sales, royalty, modification) |

If LICENSE conflicts with this document on **commercial terms** for paying
 Licensees, **service-terms.md prevails**, **unless a local contract** with
 the Authorized Contributor in your country states otherwise.

### Template nature and localization

This file is a **standard terms template** (base version). For customers in a
 **specific country**, the version adapted by that country’s **Authorized
 Contributor** applies, together with the **purchase / license agreement**
 signed with that Contributor.

The local contract governs: currency and payment method, taxes, timelines,
 claims, governing law, and jurisdiction — as required by local law.

Core license terms (perpetual use, token, 5 years of updates, Author royalty
 1,000 / 10,000 USDT, SaaS and code resale bans) remain in effect unless the
 local contract grants the customer additional rights.

**Example contributor (Russia):** LLC "ERAYTI" — see [§ 11](#11-payment-and-contributors).  
**Contributor ↔ Client contract templates** (international): [legal.en/templates/](templates/).

---

## 1. Licensing Model

### 1.1. Core Principles

| Parameter | Value |
|-----------|-------|
| License type | Perpetual |
| Term | Unlimited |
| Updates and support | Free for 5 years; thereafter — right to use existing versions only (§ 4.3) |
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

On purchase, the token is issued on **Sepolia**; after the Contributor deploys the national network, it may be exchanged 1:1 through governance (see [§ 10.5](#105-token-migration-sepolia--national-network)).

### 1.3. Line of Business

- One license — one line of business.
- Separate licenses required for multiple lines of business.

---

## 2. Pricing

### 2.1. Licenses

**Base royalty to Author** (fixed per license sold, regardless of Contributor’s
 customer price):

| Package | Royalty to Author | Tokens | Votes |
|---------|-------------------|--------|-------|
| Standard | **1,000 USDT** | 1 | 1 |
| Premium | **10,000 USDT** | 10 | 10 |

**Customer price** is set by the **Authorized Contributor** and may be **higher**
 than royalty. The customer price may include fees, taxes, and the Contributor’s
 margin.

| Package | Example customer price |
|---------|------------------------|
| Standard | from 1,500 USDT (example) |
| Premium | from 15,000 USDT (example) |

Recommended reference price (excluding taxes and fees): **1,000 / 10,000 USDT**
 when purchasing directly from the Author.

Taxes and duties are as agreed with the seller; liability is defined in the
 purchase contract with the Contributor.

### 2.2. What’s Included in Both Licenses

- Perpetual right to use the platform
- Full source code and documentation
- Free updates and support for 5 years (for token holders); thereafter — right to use existing versions (§ 4.3)
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

1. Choose an **Authorized Contributor** (see [§ 11](#11-payment-and-contributors))
   or direct purchase from the Author
2. Agree **customer price** (may exceed base royalty)
3. Receive payment details
4. Pay the Contributor or Author
5. Confirmation and payment document
6. Receive **license token** on the **Sepolia** testnet and platform access
7. The Contributor **accrues** Author royalty of 1,000 / 10,000 USDT per license;
   **payment** is upon the Author’s **written request** (see
   [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md) § 3)

### 2.5. Acceptance of Terms and License

A DLE license purchase involves **two linked steps**:

1. A **local contract** with an Authorized Contributor in your country
   (purchase or license agreement). **Appendices** to that contract are
   [LICENSE](../LICENSE) and this service-terms (or localized versions).
   The contract defines price, payment, taxes, refunds, and governing law.

2. **Receipt of a license token** on your wallet on **Sepolia** —
   this **constitutes acceptance of the EULA** (LICENSE) with the copyright
   holder. Wallet address and credit date are recorded on-chain.

The local contract and LICENSE **do not conflict**: the contract covers
 commercial terms with the seller; the token confirms software use rights
 with the Author. The local contract may not weaken LICENSE IP restrictions,
 except where law explicitly improves your position.

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

### 4.3. After 5 Years

After **5 years** from the on-chain license token transfer date:

- The **perpetual right to use versions** of the Software received during the update obligation period (including the latest version available at the end of the 5-year term) **remains in effect**.
- The rights holder’s obligation to provide new updates, fixes, security patches, and basic technical support under these terms **ends**.
- The **right to vote** via the token **remains** (unless changed by governance).

---

## 5. Technical Support and Training

For **5 years** from the on-chain token transfer date, all license holders get access to support and training via the portal: https://hb3-accelerator.com/

After the 5-year term, support and training obligations **do not apply** (see [§ 4.3](#43-after-5-years)).

Detailed support terms, training, online sessions, and platform setup are in the [accelerator program](https://github.com/VC-HB3-Accelerator/.github/blob/main/Версия%20на%20русском/accelerator-program.md).

---

## 6. Refunds and Warranties

### 6.1. General

License is perpetual — standard refund is not provided.

### 6.2. 70% Refund Program

**Debtor:** the **Author** (copyright holder) or **successor** under [LICENSE](../LICENSE).

**Calculation base:** **70% of the amount actually paid by the customer to the Authorized Contributor** for the license (excluding taxes and payment processing fees, unless otherwise stated in the local contract with the Contributor).

Refund may be made within **5 years** of purchase if all of the following are met:

1. More than **51% negative votes** in token holder voting
2. Complaints concern **lack of update releases**
3. Voting is conducted **via smart contract on the blockchain**
4. Request is submitted **within 5 years** of the license date

**Process:** request at hb3-accelerator.com → confirmation on smart contract → **Author** pays 70% within 30 days.

### 6.3. Payment Dispute

Within 30 days of payment — in case of calculation error, double payment, or other justified reasons.

---

## 7. Liability

### 7.1. Author’s Warranties

- License is perpetual (right to use not limited in time)
- Updates, patches, and basic maintenance free **for 5 years** from on-chain token transfer
- After 5 years — right to use **existing versions** of the Software with no obligation for new updates or support (see [§ 4.3](#43-after-5-years))
- Core functionality of existing versions remains available
- Vote in product development

### 7.2. Not Guaranteed

- Specific new features (depend on voting)
- Specific release schedule
- Updates, patches, and support **after the 5-year term**
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
- Local **configuration** changes (not source code)
- Voting on product development
- License transfer via **license token** (blockchain, see § 10.4),
  including to heirs

### Prohibited

- Resale or sublicensing of **source code**
- Using one license for more than one line of business
- Reverse engineering and **source code** modification (code changes —
  only by [Authorized Contributors](CONTRIBUTOR_LICENSE.md))
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

More: [DLE Security](../docs.en/security.md)

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

### 10.5. Token Migration: Sepolia → National Network

**Global phase.** On purchase, the customer receives a governance token on the **Sepolia** testnet. The token confirms the right to use DLE and grants a vote in product development until the national network is deployed.

**National phase.** Each **Authorized Contributor** deploys a DLE blockchain instance in their country (national network with its own chainId and governance smart contract).

**1:1 exchange after deployment.** After the Contributor deploys the national network, the Sepolia token holder may exchange it for a token on the national network **at a 1:1 ratio** (1 Standard token → 1 token; 10 Premium tokens → 10 tokens).

**Exchange process** — exclusively through governance:

1. The Contributor or token holder creates a **migration proposal** in the national network smart contract.
2. **Voting** by token holders with **quorum** reached (51%+ For).
3. **Execution:** national-network token is issued to the holder’s address; the Sepolia token is locked or burned (one Sepolia token — one national-network token).

**Loss protection.** Direct transfers (`transfer`, `transferFrom`) are disabled in the DLE contract. Any token movement — including migration and license transfer — is possible **only through quorum-governed voting**. Accidental or unauthorized transfer to third parties is excluded.

**Timing.** The Contributor notifies holders when the national network is ready and how to migrate. Until migration is complete, the Sepolia token retains license validity and update rights (see § 4).

---

## 11. Payment and Contributors

### 11.1. Authorized Contributors

Licenses are sold through **Authorized Contributors** who have accepted
 [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md).

**Contributor rights:** sell license tokens, full code modification,
 customer deployment, implementation and support services.

**Obligations:** accrue fixed royalty **1,000 / 10,000 USDT** per license sold
 and **pay upon written request** (Author may request at least once per year);
 no resale of source code to third parties; provide LICENSE and
 service-terms to customers; deploy the national DLE network and facilitate
 Sepolia → national network token migration (see [§ 10.5](#105-token-migration-sepolia--national-network)).

**Requirements:** legal entity or individual, acceptance of CONTRIBUTOR_LICENSE,
 listing on hb3-accelerator.com (when published).

### 11.2. Seller for Russian Federation

**LLC "ERAYTI"**
- OGRN: 1222600014383
- INN: 2636220809
- Address: 355007, Stavropol Krai, Stavropol, ul. Burmistrova, 65B, premises 2
- Contacts: 18900@эрайти.рф, +7 (968) 269-92-64
- Contributor ↔ Client contract templates: [legal.en/templates/](templates/)

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
- **Legal documentation:** [legal.en/README.md](README.md)

---

## Additional Documentation

- [AI Agents](../docs.en/ai-assistant.md) — specialized agent system
- [Blockchain for Business](../docs.en/blockchain-for-business.md) — digital asset registration and practical cases
- [DLE Security](../docs.en/security.md) — multi-layer protection
- [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/en/FAQ.md) — frequently asked questions
- [Product README](../README.md) — install and entry to DLE

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** July 2026
