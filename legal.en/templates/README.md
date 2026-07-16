[English](README.md) | **[Русский](../../legal.ru/templates/README.md)**

# DLE contract templates (contributor)

## Purpose

Ready **model documents** for an authorized contributor selling a DLE license to a client in **any jurisdiction**. Fill in `[…]`; do not weaken the EULA or service-terms.

| Layer | Document |
|-------|----------|
| Author ↔ Contributor | [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md) |
| Contributor ↔ Client | templates below |
| Client ↔ Rightsholder (IP) | [LICENSE](../../LICENSE) / [LICENSE.ru](../../LICENSE.ru) + on-chain token |
| Product commercial terms | [service-terms](../service-terms.md) (or approved localized version) |

```
Author ── CONTRIBUTOR_LICENSE ──► Contributor
                                       │
                                       ├── Agreement + Specification + Act
                                       │         ├── Annex EULA
                                       │         └── Annex service-terms
                                       ▼
                                  Client + Sepolia token = EULA acceptance
```

---

## Contributor ↔ Client documents

| File | Purpose |
|------|---------|
| [contributor-client-agreement.md](contributor-client-agreement.md) | Model license supply agreement |
| [contributor-client-specification.md](contributor-client-specification.md) | Specification / order / invoice |
| [contributor-client-acceptance-act.md](contributor-client-acceptance-act.md) | Acceptance act and Tx record |

IDs: **CCA / CCS / CAA-DLE-2026-07-16**.

---

## Fill in locally

- Party details, currency, taxes, payment method  
- Governing law and court / arbitration (Agreement § 10)  
- Privacy / DPA documents  
- If needed: SLA, security, public procurement  

**Do not weaken (unless mandatory law favors the client):** self-hosted; seller ≠ source-code owner; Sepolia for EULA acceptance; non-revocation / instance as asset per EULA §§ 6.4, 14; 70% refund debtor = author.

---

## Superseded

Removed (2026-07-16): `client-license-contract.md`, `contributor-author-contract.md`.  
Author ↔ Contributor → [CONTRIBUTOR_LICENSE.md](../CONTRIBUTOR_LICENSE.md).  
Contributor ↔ Client → `contributor-client-*` files above.

---

**© 2024-2026 Aleksandr Viktorovich Tarabanov**  
**Updated:** 2026-07-16
