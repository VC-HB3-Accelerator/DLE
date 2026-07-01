**English** | [Русский](../../legal.ru/templates/contributor-author-contract.md)

# Lawyer Brief: Author ↔ Authorized Contributor Agreement

**Status:** reference outline, not a contract. **Country:** any — localized by lawyers for the Author and/or Contributor.  
**Base template text:** [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) — **mandatory appendix** or incorporated by reference.  
**Related:** [README.md](README.md), [LICENSE](../../LICENSE), [service-terms.md](../../docs.en/service-terms.md), [client-license-contract.md](client-license-contract.md)

---

## A. Critical clauses (must appear in the contract)

If an **individual written contract** conflicts with CONTRIBUTOR_LICENSE,
 the **individual contract prevails** (CONTRIBUTOR_LICENSE § 7). This brief is
 the minimum lawyers **must not weaken** without the Author’s written consent.

### A.1. Parties and subject matter

| Element | Requirement |
|---------|-------------|
| **Author** | Alexander V. Tarabanov — rights holder of DLE **initial (baseline) code** |
| **Contributor** | Legal entity or individual **authorized** by the Author for a territory/country |
| **Subject** | Non-exclusive right: license sales, code modification, deployment, services |
| **Appendix** | [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) (version / date: `________`) |
| **Territory** | `[LOCAL: country/region, exclusive or non-exclusive]` |

### A.2. Royalty to Author

| Package | Accrual per license sold |
|---------|--------------------------|
| Standard | **1,000 USDT** (1 token) |
| Premium | **10,000 USDT** (10 tokens) |

| Rule | Content |
|------|---------|
| **Accrual** | For **each** license transferred to a customer; **independent** of customer price |
| **Customer price** | Set by Contributor (may exceed royalty — margin, taxes, fees) |
| **Payment** | Upon **written request** from Author (or successor) |
| **Request frequency** | Author may request **at least once per calendar year** |
| **Payment deadline** | **30 calendar days** from request (unless contract states otherwise) |
| **Reporting** | Sales and accrued royalty report **on Author’s request** |

```
[LOCAL: payment currency, USDT rate, Author payment details, VAT if applicable]
```

### A.3. Copyright: baseline code and Updates

| Object | Rights holder |
|--------|---------------|
| **Initial (baseline) code** | **Author** (may assign exclusive — see A.6) |
| **Updates** (Contributor enhancements) | **Contributor** |

**Contributor must:**

- retain Author copyright notices in modified baseline files;
- not claim exclusive rights to baseline code;
- grant customers use of Updates under sold licenses.

**Author’s right of first refusal** when Contributor sells Updates to a third party:

1. Written notice to Author (subject, price, counterparty).
2. Author may purchase on the same terms within **30 calendar days**.
3. Otherwise third-party deal **on terms no better** than offered to Author.

### A.4. Contributor prohibitions

- Resale/distribution of **source code** to third parties **except** via license token to end customer
- Publishing forks as freely downloadable standalone products
- Sublicensing code to other distributors **without Author’s written consent**
- **Permitted:** selling **license token** to end customer (service-terms)

### A.5. Contributor obligations toward customers

Contributor **must** (delegate in Author contract):

| # | Obligation |
|---|------------|
| 1 | Provide customers [LICENSE](../../LICENSE) and [service-terms.md](../../docs.en/service-terms.md) |
| 2 | Local customer contract per [client-license-contract.md](client-license-contract.md) |
| 3 | [ATTRIBUTION_REQUIREMENTS.md](../ATTRIBUTION_REQUIREMENTS.md), [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) |
| 4 | Sepolia token to customer wallet = EULA acceptance |
| 5 | Deploy **national network** and Sepolia → country migration (service-terms § 10.5) |
| 6 | Do not weaken in local docs: royalty, code resale ban, Author’s first refusal |

### A.6. Assignment by Author (successor)

Author may **assign in writing** to a third party:

- **exclusive rights** to baseline DLE code;
- **right to receive royalty** under Section A.2.

**For Contributor:**

- notice **before** next royalty payment;
- royalty to **successor** if assignment includes receipt rights;
- customer EULA from **successor** if exclusive code rights assigned;
- Contributor obligations (A.4–A.5) **remain**.

### A.7. Revocation of Contributor status

Author may revoke if:

- accrued royalty unpaid **60+ days** after deadline on **valid written request**;
- code resale ban breached;
- third-party copyright/license violated.

**After revocation:** no new sales or modification, except supporting existing licenses **as agreed** with Author.

### A.8. Localization (lawyer’s discretion)

- [ ] Governing law: `_________________________`
- [ ] Jurisdiction / arbitration: `_________________________`
- [ ] Source code confidentiality: `_________________________`
- [ ] Liability caps: `_________________________`
- [ ] Authorization term / renewal: `_________________________`

---

## B. Recommended contract structure

### B.1. Preamble and party details

```
[LOCAL: Author, Contributor, registration IDs, signatories, date]
```

### B.2. Definitions

DLE, baseline code, Updates, license token, Standard/Premium, Sepolia,
 national network, royalty, territory, successor

### B.3. Grant to Contributor

Non-exclusive: token sales, modification, deployment, services  
`[LOCAL: territorial exclusivity if agreed]`

### B.4. Royalty and reporting

1,000 / 10,000 USDT table; accrual; payment on request; reports  
`[LOCAL: payment details, taxes]`

### B.5. IP: baseline and Updates

Section A.3; Author’s first refusal

### B.6. Restrictions and prohibitions

Section A.4

### B.7. Contributor obligations

Section A.5; reference client-license-contract.md

### B.8. Assignment by Author

Section A.6; notice procedure

### B.9. Termination and effects

Section A.7; `[LOCAL: return of materials, customer data]`

### B.10. Appendices

| # | Document |
|---|----------|
| 1 | [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) |
| 2 | [LICENSE](../../LICENSE) (customer reference) |
| 3 | [service-terms.md](../../docs.en/service-terms.md) (customer reference) |
| 4+ | `[LOCAL: NDA, Author–Contributor SLA, etc.]` |

---

## C. Relationship to Contributor ↔ customer contract

```
Author ←—— contributor-author-contract ——→ Contributor ←—— client-license-contract ——→ Customer
         (this brief)                                    (separate brief)
```

Royalty and baseline IP — **Author ↔ Contributor**.  
Customer price, Sepolia, EULA — **Contributor ↔ customer** (do not mix in one contract).

---

## D. Pre-signature checklist

- [ ] CONTRIBUTOR_LICENSE appended with version
- [ ] Contributor territory defined
- [ ] 1,000 / 10,000 USDT royalty and payment-on-request documented
- [ ] Updates — Contributor copyright; Author first refusal — 30 days
- [ ] Source code resale ban without Author consent
- [ ] Exclusive/royalty assignment to successor — notice procedure
- [ ] Customer obligations (token, national network) delegated
- [ ] **Local** law review for both parties

---

**© 2024-2026 Alexander Viktorovich Tarabanov. Reference for Author and Contributor lawyers.**
