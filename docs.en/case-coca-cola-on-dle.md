**English** | [Русский](../docs.ru/case-coca-cola-on-dle.md)

# Case: Coca-Cola on the DLE platform

## Essence

Coca-Cola is a physical product. 200+ countries, 65,900 employees, a network of independent bottler franchisees, $47.9 billion revenue (2025). Advertising — $5.4 billion/year. SG&A — $14.5 billion/year.

Business model: sell concentrate (syrup) to bottlers → bottlers produce, fill, deliver → retail sells to the end customer.

What changes if every bottle is a token? If the bottler contract is a smart contract? If the buyer pays with a token, not through a bank?

Same business model. Same product. Same price. What changes is the infrastructure for accounting, settlements, quality control, and partner relationships.

---

## 1. Supply chain: from concentrate to shelf

### Traditional model (Coca-Cola today)

```
Coca-Cola Company (concentrate)
       ↓ syrup sale
Bottler franchisee (200+ partners in 200+ countries)
       ↓ production, filling, packaging
Distributors and wholesalers
       ↓ logistics
Retail (stores, restaurants, vending)
       ↓ sale
Buyer
```

Each stage is a separate contract, separate accounting, separate bookkeeping. Quality control — sampling checks. Counterfeiting is a real problem (fake plants in Mexico and elsewhere).

### On the DLE platform

```
Coca-Cola Company (concentrate + brand smart contract)
       ↓ on-chain transaction: syrup lot = token
Bottler (franchisee smart contract, connected to the production line)
       ↓ each bottle = product passport token (composition, date, line, lot)
Distributor (transaction: transfer of passport tokens)
       ↓ movement tracked on-chain
Retail (receives tokens, scans at sale)
       ↓ payment with token or stablecoin
Buyer (can verify authenticity by token)
```

Each stage is an on-chain transaction. Accounting is automatic. Counterfeiting is excluded: no token = no authentic product.

---

## 2. Production accounting and counterfeits

| Parameter | Coca-Cola today | On DLE |
|----------|-----------------|--------|
| Produced goods accounting | ERP at each plant. SAP, Oracle — licenses millions $/year | Smart contract connected to the production line. Each bottle = token with data: date, line, lot, composition |
| Barcode / QR | Identifies SKU (product type), not a specific bottle | Token identifies a specific product unit |
| Counterfeits | Fake plants, bottle refills, forged labels. Losses unknown but material | Impossible: no on-chain token = counterfeit. Buyer verifies in a second |
| Lot recall | Trace via document chain, days–weeks | Instant: token linked to lot, line, date. All bottles of the lot are on-chain |
| Shelf life | On the label. Control depends on retail | In the token. Smart contract can auto-deactivate expired tokens |
| Plant audit | Sampling checks, inspectors, reports | All data on-chain in real time. Audit — automatic |

---

## 3. Bottler relationships: 200+ franchisees in 200+ countries

| Parameter | Coca-Cola today | On DLE |
|----------|-----------------|--------|
| Bottler contract | Individual agreement, lawyers, months of negotiation | Franchisee smart contract: terms, territory, volumes, rates — in code |
| Volume control | Bottler reports, reconciliations, audits | Automatic: each produced unit = token. Volume = token count |
| Settlements with bottlers | Bank wires, invoices, reconciliation, FX across 200+ countries | Stablecoin transactions via smart contract. No banks, no FX conversion |
| Royalties / concentrate payment | Monthly payments, accounting, reconciliations | Automatic deduction from each sale via smart contract |
| Disputes | Arbitration, courts, lawyers | Terms in the contract, automatic execution |
| Transparency | Coca-Cola sees bottler reports. Bottlers see only their data | All participants see their transactions on-chain. Coca-Cola sees the full chain |

The **5 largest bottlers** (Coca-Cola FEMSA, CCEP, CCHBC, Arca Continental, Swire) = 44% of global volume. On DLE their contracts are 5 smart contracts instead of thousands of pages of legal documents.

---

## 4. Settlements: $47.9B revenue via banks vs blockchain

| Parameter | Banking infrastructure | Blockchain |
|----------|--------------------------|----------|
| Transaction fees (B2B, bottlers) | Wire fees: $15–$50 per transaction, SWIFT, correspondent banks | $0.001–$0.10 per transaction |
| FX conversion (200+ countries) | FX spread 1–3% per conversion. Coca-Cola 10-K: FX reduced revenue by 2% = ~$960M | Settlements in stablecoins (USDT/USDC). No FX risk |
| Settlement time | International transfer: 1–5 business days | Seconds |
| Reconciliation | Thousands of counterparties, dozens of currencies, monthly reconciliation — large teams | Not needed — on-chain data matches automatically |
| Bank accounts | Hundreds of accounts in dozens of countries, per legal entity | Smart contract wallets. No bank dependency |

**FX impact (from 10-K):** in 2025, FX moves reduced Coca-Cola revenue by 2% (~$960M). In stablecoins that risk disappears.

---

## 5. Governance and transparency

| Parameter | Coca-Cola today | On DLE |
|----------|-----------------|--------|
| Corporate governance | Board, proxy voting, annual shareholder meeting | On-chain voting: 1 token = 1 vote. Result on the blockchain |
| Shares | NYSE: KO. 4.3B shares. Trading via exchange, brokers, T+1 settlement | Governance tokens. Transfer — instant, no intermediaries |
| Dividends | Quarterly, via depositories, brokers, banks | Automatic distribution from the smart contract treasury |
| Reporting | 10-K, 10-Q, SEC filings. Built by accounting and audit teams | All transactions on-chain. Reporting generated automatically |
| SG&A | $14.5B/year (2025) | A material share of SG&A — accounting, reconciliations, legal — is automated by smart contracts |
| Audit | Deloitte / PwC / EY / KPMG — millions $/year | Blockchain = immutable audit. Automatic, free |

---

## 6. Customer data: Coca-Cola’s black hole

Coca-Cola sells 2.2 billion servings a day. And does not know a single buyer by name.

| Parameter | Coca-Cola today | On DLE |
|----------|-----------------|--------|
| Buyer contacts | None. Data sits with retailers (Walmart, Carrefour, 7-Eleven). Coca-Cola does not know who bought the bottle | Buyer receives a product passport token. On optional registration — contact enters company CRM |
| Purchase history | None. Coca-Cola sees shipments to bottlers, not end sales | Each purchase = on-chain transaction. Full history: what, when, where, how often |
| Interaction history | No direct buyer channel. Feedback via social media and hotlines | Built-in CRM: chat, email, Telegram bot. Full negotiation and ticket history in one place |
| Segmentation | Based on market research (Nielsen, Euromonitor) — millions $/year | Based on real purchase data from the blockchain. No research spend |
| Loyalty programs | Separate apps, cards, points — per country, not linked | Buyer token: single program across 200+ countries, history on-chain |
| Personalization | Practically impossible: Coca-Cola does not know the end buyer | With buyer consent — personalized offers from purchase history |
| Research cost | Hundreds of millions $/year on market research and third-party data | Data collected automatically from transactions. Cost — 0 |

**This is not mere “convenience.”** For an FMCG company, direct contact with billions of buyers is a strategic advantage no manufacturer has today. Data sits with retailers, and they do not share it.

---

## 7. Subscriptions that disappear

Beyond banking costs, DLE replaces dozens of corporate products with paid subscriptions.

| Product / subscription | What Coca-Cola pays today | On DLE |
|--------------------|----------------------------|--------|
| ERP (SAP, Oracle) | Licenses + implementation + support: $100M–$500M/year system-wide | Product accounting — from line tokens. Financial accounting — from on-chain transactions |
| CRM (Salesforce and analogues) | Tens of millions $/year for licenses, implementation, integration | Built-in CRM: contacts, purchase history, negotiations — one contour |
| Marketing data (Nielsen, Euromonitor, IRI) | Hundreds of millions $/year on market research | Real data from blockchain transactions — free |
| Warehouse accounting (WMS) | Separate system per warehouse / bottler | Passport-token movement = warehouse accounting |
| Compliance and audit (Deloitte, PwC, EY, KPMG) | Millions $/year on external audit | Blockchain = automatic, immutable audit |
| Reconciliation systems | Thousands of counterparties × dozens of currencies = huge teams | Not needed — on-chain transactions match automatically |
| Loyalty programs (build, support) | Separate app per country, tens of millions $/year | Single tokenized program across 200+ countries |
| Bottler communications (corporate portals, EDI) | Tens of millions $/year on corporate data exchange | All data on-chain, available to chain participants |

**Coca-Cola SG&A = $14.5B/year.** A material share of that amount services the listed subscriptions and processes that DLE automates or replaces.

---

## 8. What does not change

- Product: Coca-Cola, Fanta, Sprite and hundreds more brands
- Production: bottler plants, filling lines
- Logistics: trucks, warehouses, distribution
- Retail: stores, restaurants, vending
- Prices: the same
- Advertising: $5.4B — remains

**What changes:**
- Each bottle gets a digital passport (token) — counterfeits excluded
- Coca-Cola for the first time gets buyer contacts and purchase history directly
- Settlements with 200+ bottlers via blockchain — no banks, no FX risk
- Franchisee contracts — smart contracts instead of thousands of pages
- Product accounting — automatic, from the production line
- Buyer verifies authenticity in a second
- FX losses ~$960M/year — disappear
- Dozens of corporate subscriptions (ERP, CRM, WMS, audit, data, reconciliation) — replaced by the platform

---

## Additional materials

- [Case: two paths to organize a business](case-traditional-vs-dle.md) — general comparison
- [README.md](../README.md) — how to start

---

**Last updated:** 2026-03-26
