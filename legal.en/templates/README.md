**English** | [Русский](../../legal.ru/templates/README.md)

# DLE Contract Templates (Contributor)

## Purpose

Ready **model documents** for an Authorized Contributor when selling a DLE license to a client in **any jurisdiction**. Fill in the `[…]` fields; do not weaken the EULA or service-terms.

| Layer | Document |
|-------|----------|
| Author ↔ Contributor | [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) |
| Contributor ↔ Client | templates below |
| Client ↔ Rightsholder (IP) | [LICENSE](../../LICENSE) + on-chain token |
| Product commercial terms | [service-terms.md](../service-terms.md) |

```
Author ── CONTRIBUTOR_LICENSE ──► Contributor
                                      │
                                      ├── Agreement + Specification + Act (templates)
                                      │         ├── App. EULA
                                      │         └── App. service-terms
                                      ▼
                                 Client + Sepolia token = EULA acceptance
```

---

## Contributor ↔ Client Documents

| File | Purpose |
|------|---------|
| [contributor-client-agreement.md](contributor-client-agreement.md) | Model license supply agreement |
| [contributor-client-specification.md](contributor-client-specification.md) | Specification / order / invoice |
| [contributor-client-acceptance-act.md](contributor-client-acceptance-act.md) | Acceptance act and Tx record |

Identifiers: **CCA / CCS / CAA-DLE-2026-07-16**.

---

## What Is Filled Locally

- Party details, currency, taxes, payment method  
- Governing law and court / arbitration (clause 10 of the agreement)  
- Personal data / DPA documents  
- As needed: SLA, information security, public procurement  

**Unchanged (unless law improves the client’s position):** self-hosted; seller ≠ source-code rightsholder; Sepolia for EULA acceptance; non-revocation / instance-as-asset under EULA § 6.4, § 14; 70% refund — debtor is the Author.

---

## Obsolete Files

Removed (2026-07-16): `client-license-contract.md`, `contributor-author-contract.md`.  
Author ↔ Contributor → [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md).  
Contributor ↔ Client → the `contributor-client-*` files above.

---

**© 2024-2026 Alexander Viktorovich Tarabanov**  
**Updated:** 2026-07-16
