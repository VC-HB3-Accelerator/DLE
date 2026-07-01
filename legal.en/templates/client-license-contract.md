**English** | [Русский](../../legal.ru/templates/client-license-contract.md)

# Lawyer Brief: Contributor ↔ Customer License Agreement (DLE)

**Status:** reference outline, not a contract. **Country:** any — localization by the Contributor’s lawyer.  
**Typical customers:** B2B, regulators, and similar organizations (not mass B2C).  
**Related:** [README.md](README.md), [LICENSE](../../LICENSE), [service-terms.md](../../docs.en/service-terms.md), [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md)

---

## A. Critical clauses (must appear in the local contract)

The lawyer **must not weaken** the following (unless mandatory local law improves
 the customer’s position):

### A.1. Document bundle

| Element | Requirement |
|---------|-------------|
| **Appendix 1** | [LICENSE](../../LICENSE) (EULA) — IP, restrictions, perpetual license |
| **Appendix 2** | [service-terms.md](../../docs.en/service-terms.md) (or Author-approved localized version) |
| **Hierarchy** | Local contract — commercial terms; LICENSE — IP; on commercial conflict, local contract prevails if it does not harm the customer |
| **Seller** | **Authorized Contributor** only; must not represent itself as baseline code rights holder |

### A.2. License and token

| Element | Requirement |
|---------|-------------|
| **Packages** | Standard: 1 token / Premium: 10 tokens; one license = one line of business |
| **Sepolia** | Initial token issuance on **Sepolia** testnet |
| **EULA acceptance** | Token credit to customer wallet = **LICENSE acceptance** with rights holder (on-chain record) |
| **Dual acceptance** | Local contract + token **complement** each other |
| **License transfer** | **Governance only** (direct `transfer` disabled) |
| **Migration** | Sepolia → Contributor’s **national network** **1:1** via governance after deploy (service-terms § 10.5) |

### A.3. Customer rights and restrictions (from LICENSE)

- Perpetual use on **own infrastructure**, B2B
- **Prohibited:** source code resale, source modification (except configuration), multi-tenant SaaS for unrelated third parties
- Updates and support: **5 years**; thereafter — right to use existing versions (service-terms § 4.3)
- **70% refund** — **debtor: Author**; base — amount paid to Contributor (service-terms § 6.2)

### A.4. Do not include in the customer contract

- Contributor obligations to the **Author** (1,000 / 10,000 USDT royalty, CONTRIBUTOR_LICENSE) — separate Author ↔ Contributor relationship
- **Baseline code** (Author) vs **Contributor Updates** (Contributor) — see CONTRIBUTOR_LICENSE § 4

### A.5. Localization (lawyer’s discretion)

- [ ] Governing law: `_________________________`
- [ ] Jurisdiction / arbitration: `_________________________`
- [ ] Currency and taxes: `_________________________`
- [ ] Privacy / DPA: `_________________________`
- [ ] Regulator: security, audit, SLA, data residency: `_________________________`
- [ ] Public procurement / tender (if applicable): `_________________________`

---

## B. Recommended local contract structure

Logical sections only — wording and numbering are for the lawyer.

### B.1. Preamble and party details

```
[LOCAL: names, registration IDs, addresses, bank, signatories, authority, date]
```

### B.2. Definitions

Minimum set: Software/DLE, Rights Holder, License, License Token, Sepolia,
 National Network, customer wallet `0x…`

### B.3. Subject matter

- Contributor grants use rights for Standard/Premium package
- Contributor issues token and provides distribution access
- Customer pays and complies with Appendices 1 and 2

### B.4. Price and payment

```
[LOCAL: amount, currency, tax, payment terms, fees]
```

Note: Contributor royalty to Author is **not** part of the customer contract (CONTRIBUTOR_LICENSE).

### B.5. License delivery and token

1. Software access — `[method]`
2. Token credit on **Sepolia**
3. Appendices 1 and 2 delivered
4. **Token credit = EULA acceptance**
5. Customer secures wallet keys

### B.6. National network and migration

- Contributor deploys national DLE network in **their country**
- Customer may exchange **1:1** via governance
- Sepolia token valid until migration completes

### B.7. Updates, support, voting

- Per **Appendix 2**: updates and support **for 5 years** from on-chain token transfer
- After 5 years — right to use **existing versions** only (service-terms § 4.3)
- Portal hb3-accelerator.com, 1 token = 1 vote

### B.8. Refunds

- Perpetual license; no standard refund after token issuance
- § 6.2 exception: **70% paid by the Author** (not the Contributor); base — amount
  **actually paid to the Contributor**; conditions — on-chain voting
- § 6.3 payment dispute — **Contributor** (seller)
- `[LOCAL: refund procedure, currency, Author payment details for 70%]`

### B.9. IP and restrictions

- Reference **Appendix 1**; do not weaken LICENSE IP terms
- `[LOCAL: mandatory customer-protective law if applicable]`

### B.10. Liability

- Limits per **Appendix 2** § 6–7
- Contributor — commercial obligations; Rights Holder — per LICENSE/EULA

### B.11. Personal data

```
[LOCAL: privacy law, policy, DPA, cross-border transfer, on-chain wallet ID]
```

### B.12. Governing law and disputes

```
[LOCAL: law, claims process, court/arbitration]
```

Copyright contact: info@hb3-accelerator.com

### B.13. Appendices and signatures

| # | Document |
|---|----------|
| 1 | LICENSE (version / date / hash: `________`) |
| 2 | service-terms (version / date: `________`) |
| 3+ | `[LOCAL: DPA, SLA, security, etc.]` |

---

## C. Optional: token delivery record

| Field | Value |
|-------|-------|
| Contract # / date | `________` |
| Customer wallet | `0x…` |
| Network | Sepolia (chainId 11155111) |
| Package | Standard / Premium |
| Token count | 1 / 10 |
| Tx hash | `0x…` |
| UTC time / block | `________` |

*Credit confirms EULA (LICENSE) acceptance.*

---

## D. Pre-signature checklist

- [ ] LICENSE and service-terms appended with version
- [ ] Customer wallet verified
- [ ] Package and price agreed
- [ ] Sepolia token timing defined
- [ ] Regulator appendices added if required
- [ ] LICENSE IP terms not weakened
- [ ] **Local** law review completed

---

**© 2024-2026 Alexander Viktorovich Tarabanov. Reference for Contributors’ lawyers.**
