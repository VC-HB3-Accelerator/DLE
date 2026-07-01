**English** | [Русский](../../legal.ru/templates/README.md)

# Lawyer Templates (DLE)

## Purpose

Files in this folder are **not final contracts** and are **not tied to any single
 country**. They are **reference materials for lawyers**: mandatory clauses and
 recommended structure used to draft **local contracts**:

- **Author ↔ Contributor** — partnership, royalty, IP, territory;
- **Contributor ↔ customer** — B2B, regulators (see [client-license-contract.md](client-license-contract.md)).

**The lawyer determines locally** (for each party and jurisdiction):

- governing law and jurisdiction;
- taxes, currency, payment method;
- party details, signatures, public procurement (if any);
- privacy and sector-specific regulation;
- wording for customer type (company, government body).

**Global non-negotiables** (unless local law improves the customer’s position):
 see [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md), [LICENSE](../../LICENSE),
 [service-terms.md](../../docs.en/service-terms.md).

---

## Documents

| File | Audience | Content |
|------|----------|---------|
| [contributor-author-contract.md](contributor-author-contract.md) | **Author ↔ Contributor** lawyer | Royalty, IP, Updates, territory, successor |
| [client-license-contract.md](client-license-contract.md) | Contributor’s lawyer ↔ **customer** | Token, EULA, Sepolia, B2B/regulator |
| [../CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) | Base template text | Contributor agreement (contract appendix) |

---

## Contract hierarchy

```
Author ←—— contributor-author-contract
              │
              ▼
        Contributor ←—— client-license-contract
              │              ├── Appendix: LICENSE (EULA)
              │              └── Appendix: service-terms
              ▼
        Sepolia token = EULA acceptance with rights holder / successor
```

---

## Customer audience

Typical DLE customers are **B2B** and **regulated organizations**. Lawyers add
 sector appendices (security, audit, DPA, SLA, data residency) per customer and
 **local** law requirements.

---

**© 2024-2026 Alexander Viktorovich Tarabanov**

**Last updated:** July 2026
