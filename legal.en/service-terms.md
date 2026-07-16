**English** | [Русский](../legal.ru/service-terms.md)

# Digital Legal Entity — Terms of Purchase and Service

## Table of Contents

1. [Licensing Model](#1-licensing-model)
2. [Pricing](#2-pricing)
3. [Voting System](#3-voting-system)
4. [Updates and Maintenance](#4-updates-and-maintenance)
5. [Technical Support and Training](#5-technical-support-and-training)
6. [Refunds and Warranties](#6-refunds-and-warranties)
7. [Liability of the Parties](#7-liability-of-the-parties)
8. [Terms of Use](#8-terms-of-use)
9. [Security and Privacy](#9-security-and-privacy)
10. [Governance Smart Contract](#10-governance-smart-contract)
11. [Payment and Contributors](#11-payment-and-contributors)
12. [Policy on Changes to Terms](#12-policy-on-changes-to-terms)
13. [Contacts](#13-contacts)

**Legal documents:** [legal.en/README.md](README.md) — license, copyright, attribution requirements.

### Document Hierarchy (End User)

| Document | Purpose |
|----------|---------|
| [LICENSE](../LICENSE) | EULA: IP, license scope, prohibitions, non-revocation / termination (§ 6.4, § 14) |
| **service-terms.md** (this file) | Purchase, token, updates, support, refunds, liability |
| [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md) | Authorized Contributors only (sales, royalty, modification) |

In case of conflict on **commercial terms** for paying licensees,
 **service-terms.md prevails**, **unless otherwise stated in a local agreement**
 with an Authorized Contributor.

On **copyright, license scope, non-revocation, and termination of the right of use**,
 [LICENSE](../LICENSE) prevails (EULA § 6.4, § 14).

### Template Nature and Localization

This file is the rightsholder’s **standard terms** (base version).
 For customers in a **specific country**, the version adapted by that country’s
 **Authorized Contributor** applies, together with the **purchase /
 license agreement** concluded with that Contributor.

The local agreement governs: currency and payment method, taxes, timelines,
 claims, governing law, and jurisdiction — within local legislation.

Core license terms (perpetuity, token, 5 years of updates, Author royalty
 1,000 / 10,000 USDT, ban on SaaS and code resale) remain in effect,
 unless the local agreement improves the customer’s position.

**Example contributor:** for the Russian Federation — LLC “ERAYTI” (see [§ 11](#11-payment-and-contributors)).  
**Contributor ↔ Client agreement templates** (international): [legal.en/templates/](templates/).

---

## 1. Licensing Model

### 1.1. Core Principles

| Parameter | Value |
|-----------|-------|
| License type | Perpetual License |
| Term | Unlimited |
| Updates and support | Free for 5 years; thereafter — only the right to use versions already obtained (§ 4.3) |
| Software instance | After installation — a **Client asset** (copy, deployment artifacts, Client data); exclusive rights in the code — with the rightsholder / contributor per the EULA |
| Revocation / termination | The rightsholder does **not** revoke the license unilaterally and does **not** terminate it on its own initiative (change of successor, policy, end of support). Termination — **only** upon a material breach of the EULA by the Client ([LICENSE](../LICENSE) § 6.4, § 14) |

Consistency with the EULA: the perpetual right to use versions already delivered and the status of the instance as a Client asset are governed by [LICENSE](../LICENSE) § 6.4 and § 14; this document does not narrow them.

### 1.2. License and Tokens

Each DLE license is linked to a **governance token on the blockchain**. The token evidences the right to use the operating system and grants a vote in product development.

| Parameter | 1 token | 10 tokens |
|-----------|---------|-----------|
| Number of licenses | 1 | 1 |
| Lines of business | 1 | 1 |
| Votes in voting | 1 | 10 |
| Service terms | Same | Same |

**Voting:** 1 token = 1 vote. Decisions are made by majority (51%+) via a blockchain smart contract.

Upon purchase the token is issued on the **Sepolia** network; after the Contributor deploys the national network it may be exchanged 1:1 via governance (see [§ 10.5](#105-token-migration-sepolia--country-network)).

### 1.3. Line of Business

- One license — one line of business
- Separate licenses are required for multiple lines of business

---

## 2. Pricing

### 2.1. Licenses

**Baseline royalty to the Author** (fixed amount per license, independent of
 the price charged by the Contributor):

| Package | Royalty to Author | Tokens | Votes |
|---------|-------------------|--------|-------|
| Standard | **1,000 USDT** | 1 | 1 |
| Premium | **10,000 USDT** | 10 | 10 |

**Customer price** is set by the **Authorized Contributor** and may
 be **higher** than the royalty amount. In the customer price the Contributor includes fees,
 taxes, and its margin.

| Package | Example customer price |
|---------|------------------------|
| Standard | from 1,500 USDT (example) |
| Premium | from 15,000 USDT (example) |

Recommended indicative price (excluding taxes and fees): **1,000 /
 10,000 USDT** — for direct sale by the Author.

Taxes and charges — as agreed with the seller; the parties’ liability
 is determined by the purchase agreement with the Contributor.

### 2.2. What Is Included in Both Licenses

- Perpetual right to use the operating system; the installed instance — a Client asset (EULA § 6.4)
- Full source code with documentation
- Free updates and support for 5 years (for token holders); thereafter — right to use versions already obtained (§ 4.3)
- Technical support (SLA by issue priority)
- Governance tokens on the blockchain
- Right to vote on product development
- Access to online training sessions
- Ready document pack for the regulator

The only difference between packages is the number of tokens and, accordingly, votes.

### 2.3. Payment Methods

- **Cryptocurrency (USDT)** — directly or through authorized partners
- **Bank transfer** — in local currency through authorized dealers
- **Credit cards** — through partners’ payment systems

All fees for transfers, conversion, and payment processing are borne by the buyer.

### 2.4. Purchase Process

1. Choose an **Authorized Contributor** (see [§ 11](#11-payment-and-contributors))
   or direct purchase from the Author
2. Agree the **customer price** (may be above the baseline royalty)
3. Obtain payment details
4. Pay the Contributor or the Author
5. Confirmation and payment document
6. Receive the **license token** on the **Sepolia** test network and access to the operating system
7. The Contributor **accrues** to the Author royalty of 1,000 / 10,000 USDT per license;
   **payment** — upon the Author’s written request (see [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md) § 5)

### 2.5. Acceptance of Terms and License

Purchase of a DLE license is effected by **two related actions**:

1. A **local agreement** with an Authorized Contributor in your country
   (purchase / license agreement). **Appendices** to the agreement
   are [LICENSE](../LICENSE) and this service-terms (or their
   localized versions). The agreement defines price, payment, taxes, refunds,
   and governing law.

2. **Receipt of the license token** to your wallet on the **Sepolia** network —
   this is **acceptance of the EULA** (LICENSE) in relation to the rightsholder.
   The address and date of credit are recorded on the blockchain.

The local agreement and LICENSE do **not** contradict each other: the agreement — commerce
 with the seller; the token — confirmation of rights to use the Software from the Author.
 The local agreement may not worsen the IP restrictions of LICENSE, except where
 the law expressly improves your position.

---

## 3. Voting System

### 3.1. Process

1. **Proposal** — the community proposes a new feature
2. **Registration** — a vote is created in the blockchain smart contract
3. **Voting** — each token = 1 vote, “For” or “Against”
4. **Decision** — at 51%+ “For” votes the feature is taken into development

### 3.2. Cadence

- Voting is open continuously (asynchronous)
- Quarterly analysis of results
- Development by priority (number of votes)

### 3.3. Voting Portal

**Address:** https://hb3-accelerator.com/

Available: create proposals, vote, view results, track development status, voting history.

**Requirements:** a wallet with tokens (MetaMask, WalletConnect, etc.).

---

## 4. Updates and Maintenance

### 4.1. Free Updates (5 Years)

For all holders of license tokens from the token-transfer date recorded on the blockchain:

- Bug fixes
- Performance improvements
- New features (approved by voting)
- Security updates

**Frequency:**

| Type | Cadence |
|------|---------|
| Security Patches | Immediately upon discovery |
| Regular Updates | Weekly (Wednesdays) |
| Major Features | Per voting results |

### 4.2. OS updates contour

**Address:** https://hb3-accelerator.com/

License holders may: download all versions, read Release Notes, receive notifications of new versions, study migration documentation.

**Access requirements:** a license token on the wallet at the time of the request.

### 4.3. After 5 Years

Upon expiry of **5 years** from the on-chain transfer date of the license token:

- The perpetual right to use **Software versions** obtained during the update-obligation period (including the latest available at the end of the 5-year term) is **preserved**. Expiry of the update period does **not** give the rightsholder the right to revoke the license or demand destruction of the instance ([LICENSE](../LICENSE) § 6.4, § 14).
- The rightsholder’s obligation to provide new updates, fixes, security patches, and basic technical support under these terms is **terminated**.
- The right to vote via the token is **preserved** (unless otherwise changed by governance).

---

## 5. Technical Support and Training

For **5 years** from the on-chain token-transfer date, all license holders receive access to support and training via the portal: https://hb3-accelerator.com/

After expiry of the 5-year term, the support and training obligation **does not apply** (see [§ 4.3](#43-after-5-years)).

Detailed support terms, training, online sessions, and OS setup — within the [accelerator program](https://github.com/VC-HB3-Accelerator/.github/blob/main/%D0%92%D0%B5%D1%80%D1%81%D0%B8%D1%8F%20%D0%BD%D0%B0%20%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%BE%D0%BC/accelerator-program.md).

---

## 6. Refunds and Warranties

### 6.1. General Principle

The license is perpetual — a standard refund is not provided.

### 6.2. 70% Refund Program

**Debtor:** the **Author** (rightsholder) or **Successor** under [LICENSE](../LICENSE).

**Calculation base:** **70% of the amount actually paid by the client to the Authorized Contributor** for the license (excluding taxes and payment-system fees, unless otherwise stated in the local agreement with the Contributor).

A refund is possible within **5 years** from purchase if all of the following conditions are met simultaneously:

1. More than **51% negative votes** in a token-holder vote
2. Complaints concern **absence of update releases**
3. The vote was conducted **via a blockchain smart contract**
4. The request was filed **within 5 years** of the licensing date

**Process:** request on hb3-accelerator.com → confirmation on the smart contract → payment by the **Author** of 70% within 30 days.

### 6.3. Payment Claim

Within 30 days of payment — for calculation error, double payment, or other justified reasons.

---

## 7. Liability of the Parties

### 7.1. Author Warranties

- The license is perpetual (right of use is not time-limited)
- The installed instance and the right to use it — a **Client asset**; the rightsholder does not revoke the license unilaterally ([LICENSE](../LICENSE) § 6.4, § 14)
- Updates, patches, and basic maintenance free of charge **for 5 years** from the on-chain token-transfer date
- After 5 years — right to use **existing versions** of the Software without obligation for new updates and support (see [§ 4.3](#43-after-5-years))
- Baseline functionality of existing versions remains available
- Right to vote on product development

### 7.2. What Is Not Guaranteed

- Specific new features (depends on voting)
- A definite release schedule
- Updates, patches, and support **after expiry of the 5-year term**
- Support when the source code is modified
- Performance when recommended limits are exceeded

### 7.3. Limitation of the Author’s Liability

The Author is not liable for: lost profit, indirect damages, data loss, business interruption, reputational harm, fines and sanctions.

**Maximum liability:** not more than the amount of the paid license. Only direct damages for a direct breach of contract are covered.

### 7.4. User Liability

The user is responsible for:
- Data backup
- Use in accordance with the license terms
- Protection of the wallet’s private keys
- Compliance with applicable laws
- Timely updating of the application

---

## 8. Terms of Use

### Permitted

- Use to manage one’s own business
- Deployment on one’s own infrastructure
- Data backup
- Local modification of **configuration** (not source code)
- Voting on product development
- Transfer of the license via the **license token** (blockchain, see § 10.4),
  including to heirs

### Prohibited

- Resale or sublicensing of the **source code**
- Use of more than one line of business under one license
- Reverse engineering and modification of the **source code** (code modification —
  only by [Authorized Contributors](CONTRIBUTOR_LICENSE.md))
- Removal of copyright and license notices
- Shared use between independent organizations
- Use for educational purposes without permission
- Deployment of SaaS based on the operating system

A material breach of the prohibitions of this Section and [LICENSE](../LICENSE)
 may result in **license termination** only under EULA § 14 (not on the
 rightsholder’s initiative without such breach).

---

## 9. Security and Privacy

| Mechanism | Description |
|-----------|-------------|
| TLS 1.3 | Encryption of all connections |
| AES-256 | Encryption of critical data at rest |
| Key management | The user controls encryption keys |
| GDPR | Compliance (with DPA) |

Details: [DLE Security](../docs.en/security.md)

---

## 10. Governance Smart Contract

### 10.1. Architecture

DLE uses a blockchain smart contract to manage licenses and voting:

- **ERC20** — each license is represented by governance tokens (1 or 10)
- **ERC20Votes** — built-in voting system
- **ERC20Permit** — signatures for transfers without gas fees
- **Multichain** — support for voting on multiple networks simultaneously

### 10.2. Voting via Smart Contract

**Creating a proposal:** token holders only. Voting duration: from 1 hour to 30 days.

**Process:** proposal → voting (1 token = 1 vote) → quorum 51%+ → execution.

**Execution:** via a direct call in the voting chain or via signatures on other networks.

### 10.3. Contract Security

- Reentrancy protection (ReentrancyGuard)
- Tokens are transferred only via governance
- Vote snapshots to protect against flash loans
- EIP-712 signatures for contract wallets
- Validation of all parameters before execution

### 10.4. License Transfer

License = tokens bound to a wallet address. Transfer — sending tokens to a new address via governance. The new owner automatically receives the right to vote.

### 10.5. Token Migration: Sepolia → Country Network

**Global stage.** Upon license purchase the client receives a governance token on the **Sepolia** test network. The token evidences the right to use DLE and grants a vote in product development until the national network is deployed.

**National stage.** Each **Authorized Contributor** deploys an instance of the DLE blockchain contour in its country (national network with its own chainId and governance smart contract).

**1:1 exchange after deploy.** After the Contributor deploys the national network, a Sepolia-token holder may exchange it for a token on the country network **at a 1:1 ratio** (1 Standard token → 1 token; 10 Premium tokens → 10 tokens).

**Exchange process** — exclusively via governance:

1. The Contributor or holder creates a **migration proposal** in the national-network smart contract.
2. **Voting** by token holders with achievement of **quorum** (51%+ “For”).
3. **Execution** of the proposal: issuance of the token on the country network to the holder’s address; the Sepolia token is locked or burned (one Sepolia token — one token on the country network).

**Loss protection.** Direct transfers (`transfer`, `transferFrom`) are blocked in the DLE contract. Any movement of tokens — including migration and license transfer — is possible **only through a vote with quorum**. Accidental or unauthorized transfer to third parties is excluded.

**Timelines.** The Contributor notifies holders of national-network readiness and the migration procedure. Until migration is complete, the Sepolia token retains license force and update rights (see § 4).

---

## 11. Payment and Contributors

### 11.1. Authorized Contributors

Licenses are sold **through Authorized Contributors** who have accepted
 [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md).

**Contributor rights:** sale of license tokens, full code modification,
 deployment at clients, implementation and support services.

**Obligations:** accrual to the Author of a fixed royalty of **1,000 / 10,000 USDT**
 per each sold license and **payment upon written request** (the Author may request
 at least once a year); ban on resale of source code to third parties;
 delivery to the client of LICENSE and service-terms; deployment of the DLE national network
 and organization of Sepolia → country-network token migration (see [§ 10.5](#105-token-migration-sepolia--country-network)).

**Requirements:** legal entity or individual, acceptance of CONTRIBUTOR_LICENSE,
 inclusion in the list on hb3-accelerator.com (when published).

### 11.2. Seller for the Russian Federation

**LLC "ERAYTI"**
- OGRN: 1222600014383
- INN: 2636220809
- Address: 355007, Stavropol Territory, Stavropol, Burmistrova St., 65B, premises 2
- Contacts: 18900@эрайти.рф, +7 (968) 269-92-64
- Client agreement templates: [legal.en/templates/](templates/)

### 11.3. Direct Purchase from the Author

- Email: info@hb3-accelerator.com
- Website: https://hb3-accelerator.com
- GitHub: https://github.com/VC-HB3-Accelerator

---

## 12. Policy on Changes to Terms

### For New Licenses

- Terms may change for new purchases
- Notice 60 days before effective date
- Apply only to licenses purchased after the change date

### For Existing Licenses

- The terms of your license **do not change** after purchase
- Fixed rights apply perpetually
- The right to use versions already delivered is **not revoked** by a change
  to these terms or the rightsholder’s policy ([LICENSE](../LICENSE) § 6.4, § 14)
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

- [AI Agents](../docs.en/ai-assistant.md) — system for creating specialized agents
- [Blockchain for Business](../docs.en/blockchain-for-business.md) — digital asset registration and practical cases
- [DLE Security](../docs.en/security.md) — multi-layer protection
- [FAQ](https://github.com/VC-HB3-Accelerator/.github/blob/main/ru/FAQ.md) — frequently asked questions
- [Product README](../README.md) — installation and login to DLE

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** July 2026
