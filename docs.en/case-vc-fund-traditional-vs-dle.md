**English** | [Русский](../docs.ru/case-vc-fund-traditional-vs-dle.md)

# Case: OpenAI on the DLE operating system

## Essence

OpenAI — 900 million weekly users, 50 million paid subscribers, 9 million business customers, 170+ countries. Revenue $13 billion (2025). Valuation $840 billion.

Business model: cloud subscription $20/month (Plus), $200/month (Pro), $8/month (Go). Customers pay via bank cards, local payment systems, Apple Pay.

What if the customer buys not a subscription, but a **token** for the same $20 or $200 — and payments go through blockchain, not banks?

Same business model. Same prices. Same product. Only the settlement and governance infrastructure changes.

---

## 1. Payment infrastructure: 50 million subscribers × 170 countries

### Traditional model (OpenAI today)

| Cost item | Details |
|----------------|--------|
| Payment processor (Stripe) | 2.9% + $0.30 per transaction (US), up to 3.9% + $0.30 international |
| Currency conversion | +1% on each converted transaction |
| Local payment methods | UPI (India), GoPay (Indonesia), Pix (Brazil), Kakao Pay (Korea) — separate integration per country |
| Disputes and chargebacks | $15 per dispute + amount refund |
| Regional pricing | Cancelled in 2025 — too hard to maintain different prices through the banking system |
| Restrictions | Unavailable in China, Iran, and dozens of other countries. Workarounds: Apple Gift Cards ($26/month instead of $20) |

**Fee estimate on 50 million subscribers:**

| Plan | Subscribers (estimate) | Payment/month | Fee ~3.5% | Loss/year |
|-------|---------------------|-----------|----------------|-----------|
| Go ($8) | 20,000,000 | $8 | $0.58 | $139,200,000 |
| Plus ($20) | 25,000,000 | $20 | $1.00 | $300,000,000 |
| Pro ($200) | 5,000,000 | $200 | $7.30 | $438,000,000 |
| **Total** | **50,000,000** | | | **~$877,000,000/year** |

Almost **$900 million per year** goes to banks and payment processors.

### Tokenized model (DLE)

| Cost item | Details |
|----------------|--------|
| Blockchain transaction | $0.001–$0.10 (Polygon, Solana, Tron) |
| Currency conversion | Not needed — settlements in stablecoins (USDT/USDC) |
| Per-country integration | Not needed — single protocol, works in any country |
| Disputes | Terms in the smart contract, automatic refund |
| Restrictions | None — access from any internet-connected location |

**Estimate:**

| Plan | Subscribers | Token/month | Fee ~$0.01 | Cost/year |
|-------|------------|----------|-----------------|-------------|
| Go ($8) | 20,000,000 | 8 USDT | $0.01 | $2,400,000 |
| Plus ($20) | 25,000,000 | 20 USDT | $0.01 | $3,000,000 |
| Pro ($200) | 5,000,000 | 200 USDT | $0.01 | $600,000 |
| **Total** | **50,000,000** | | | **~$6,000,000/year** |

### Comparison

| | Banking infrastructure | Blockchain |
|-|--------------------------|----------|
| Transaction fee | 2.9–3.9% + $0.30 | $0.001–$0.10 (fixed) |
| Cost for 50M subscribers | ~$877,000,000/year | ~$6,000,000/year |
| Savings | — | **$871,000,000/year** |
| Country coverage | 170 (with restrictions) | Unlimited |
| Per-country integration | Separate for each payment method | Single protocol |
| Availability | Unavailable in dozens of countries | Available everywhere |

---

## 2. Subscription management vs token management

| Parameter | Subscription (OpenAI) | Token (DLE) |
|----------|-------------------|-------------|
| What the customer buys | Access right for a month. Cancelled = access lost | A license token. Owns it until sold or transferred |
| Recurring payments | Monthly card charge, declines, delinquencies | Customer buys a token when they want. No auto-charges |
| Resale | Impossible | Token can be sold or transferred to another user |
| Regional prices | OpenAI cancelled discounts — too hard via banking | Token price is uniform; a contributor may discount from their margin |
| Corporate customers | Separate plans, contracts, invoices | Bulk token purchase, no extra contracts |
| Accounting | Subscription model — deferred revenue, complex accounting | Token sale = completed on-chain transaction |

---

## 3. Corporate structure

| Parameter | OpenAI (fact) | On DLE |
|----------|---------------|--------|
| Legal structure | Nonprofit → capped-profit → PBC. Changed 3 times. Lawsuits, investigations | Company smart contract. Structure set at deploy |
| Raising $175 billion | 20 rounds, lawyers, side letters, months of negotiation | LPs buy governance tokens via the contract. Any amount, instantly |
| Minimum investor check | $1 billion+ (latest rounds) | $1,000 (1 token) |
| Board of directors | Nov 2023 crisis: CEO fired, returned in 5 days | On-chain voting. Decisions transparent and immutable |
| Financial transparency | Private company. Data via press leaks | All transactions on-chain. Token holders see everything |
| Conflict of interest | Microsoft: $13B invested, 49% of profit, but no control | Each investor’s rights are coded in the contract, proportional to share |

---

## 4. Scaling to 170+ countries

| Parameter | OpenAI (fact) | On DLE |
|----------|---------------|--------|
| Payment infrastructure | Stripe (40 countries natively) + local providers. Separate integrations: UPI, GoPay, Pix, Kakao Pay | Single smart contract. Works in any country |
| Legal presence | Legal entities or offices in key countries | Contributors in jurisdictions. No company legal entities required |
| Compliance | Separate per jurisdiction: GDPR (Europe), RBI (India), PIPL (China) | Data on the client’s server. Compliance is on the client’s side |
| Sanctions restrictions | Unavailable in China, Iran, Russia, etc. | Blockchain transactions do not depend on banking restrictions |
| Cost to enter a new market | Lawyers, licenses, payment integration — $50K–$500K per country | Contributor + node install = VPS cost |

---

## 5. What does not change

This case does **not** propose changing OpenAI’s product. Models, training, R&D, compute — all stay.

What changes:
- **How the customer pays**: token instead of bank subscription → ~$870M/year savings
- **How the company operates in 170 countries**: single blockchain protocol instead of dozens of payment integrations
- **How governance works**: transparent smart contract instead of 3 legal-structure changes in 9 years
- **How capital is raised**: governance tokens instead of 20 lawyer-heavy rounds

What does not change:
- Product (GPT, DALL·E, API)
- Prices ($8, $20, $200)
- Business model (subscription / usage-based)
- Technology stack (models, inference, training)

---

## Additional materials

- [Case: two paths to organize a business](case-traditional-vs-dle.md) — general comparison
- [README.md](../README.md) — how to start

---

**Last updated:** 2026-03-26
