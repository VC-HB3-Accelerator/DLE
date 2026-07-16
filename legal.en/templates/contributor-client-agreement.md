[English](contributor-client-agreement.md) | **[Русский](../../legal.ru/templates/contributor-client-agreement.md)**

# MODEL AGREEMENT  
## Supply of Digital Legal Entity (DLE) License  
### Contributor (Seller) ↔ Client (Customer)

**Template ID:** CCA-DLE-2026-07-16  
**Status:** Ready international template. Fill in `[…]`.  
**Do not weaken:** [LICENSE](../../LICENSE) / [LICENSE.ru](../../LICENSE.ru) (EULA), [service-terms](../service-terms.md) (or approved localized version).

---

**Agreement No.** `[number]` **dated** `[date]`

---

## Parties

**Contractor (Seller / Contributor):**  
`[full legal name]`  
Registration / company ID: `[…]`  
Tax ID: `[…]`  
Address: `[…]`  
Email: `[…]`  
Representative: `[name, authority]`

**Customer (Client):**  
`[full legal name]`  
Registration / company ID: `[…]`  
Tax ID: `[…]`  
Address: `[…]`  
Email: `[…]`  
Representative: `[name, authority]`

The Contractor is an **authorized contributor** of the Rightsholder under [CONTRIBUTOR_LICENSE](../CONTRIBUTOR_LICENSE.md) and is **not** the owner of the DLE source code. The source-code Rightsholder is Aleksandr Viktorovich Tarabanov or a Successor under the EULA.

This Agreement is intended for **B2B / organizations**. Mandatory consumer rights (if any) remain to the extent they cannot be waived.

---

## 1. Subject matter

1.1. The Contractor grants the Customer a **non-exclusive, perpetual license** to Digital Legal Entity (DLE) software for the selected package and provides related services (delivery of the distribution / access to the author’s repository, on-chain transfer of the license token, and other work under the Specification). The Customer accepts and pays.

1.2. The exact scope (Standard / Premium package, extra services, timelines) is set in the **Specification / Order / Invoice** ([contributor-client-specification.md](contributor-client-specification.md), forming part of this Agreement.

1.3. Delivery is **self-hosted**: the Customer installs the web-application template on **its own (controlled) infrastructure**. This Agreement does **not** create multi-tenant SaaS by the Contractor for unrelated third parties and does not weaken the EULA SaaS prohibition.

1.4. To issue the license, the Customer provides a wallet address on the **Sepolia** test network. The Contractor transfers the license token on-chain to that address. Other networks only if expressly stated in the Specification **and** consistent with the EULA / service-terms (primary issuance for EULA acceptance is Sepolia).

1.5. The license token evidences the right to use and governance votes under the service-terms; it enables administrative rights in the template installed on the Customer’s device, obtained from the author-developer repository / distribution (or a Rightsholder-approved channel).

1.6. While the token is on the Customer’s address, the holder is entitled to updates for the period in the service-terms (baseline: **5 years** from the on-chain transfer date).

1.7. The license token is **non-financial**: not a means of payment, security, or other financial instrument.

1.8. After EULA acceptance and installation of the delivered instance, that instance and the right to use it are the **Customer’s asset**; the Rightsholder may not unilaterally revoke the license except for material EULA breach (EULA §§ 6.4, 14; service-terms § 1.1).

---

## 2. Annexes and hierarchy

| No. | Document | Role |
|-----|----------|------|
| 1 | EULA ([LICENSE.ru](../../LICENSE.ru) / approved EN text), version ID: `[EULA-DLE-… / date / hash]` | IP, license scope, restrictions, non-revocation (Customer ↔ Rightsholder) |
| 2 | service-terms (or Rightsholder-approved localized version), version/date: `[…]` | Tokens, updates, support, refunds, liability |
| 3 | Specification / Invoice | Price, package, wallet, extra services |
| 4+ | `[DPA / privacy / SLA / security — as needed]` | Local requirements |

**Hierarchy:** commercial terms of this sale → this Agreement and Specification; IP and termination of use rights → **Annex 1 (EULA)**; updates, 70% refund, voting → **Annex 2**, unless this Agreement improves the Customer’s position. This Agreement shall not weaken EULA IP restrictions except where mandatory law favors the Customer.

**Dual acceptance:** signing this Agreement is the deal with the Contractor; credit of the token to the Customer’s Sepolia wallet is acceptance of the EULA with the Rightsholder.

---

## 3. Price and payment

3.1. Price, currency, taxes, payment terms — in the **Invoice / Specification**.

3.2. The Contractor’s royalty duties to the Rightsholder (CONTRIBUTOR_LICENSE) are **not** subject matter of this Agreement and are not charged to the Customer beyond the agreed Invoice price.

3.3. Payment-rail and network (gas) fees — `[Customer / Contractor / per Specification]`.

---

## 4. Delivery and acceptance

4.1. After payment (or as scheduled in the Specification), the Contractor shall:  
(a) provide access to the distribution / repository for the package;  
(b) transfer the license token to the stated Sepolia wallet;  
(c) deliver Annexes 1 and 2 (or links to fixed versions).

4.2. License transfer is recorded in an **Acceptance Act** ([contributor-client-acceptance-act.md](contributor-client-acceptance-act.md)) stating wallet address and Tx/Hash. The Act confirms delivery of the license / agreed one-off services and does **not** terminate update obligations for the full 5-year term.

4.3. Acceptance criteria and on-chain fixation also follow Annex 2 (service-terms).

---

## 5. Updates, support, and refunds

5.1. Updates, support, timelines, and refunds — per **Annex 2**.

5.2. **70% refund** program (service-terms § 6.2): debtor is the **Rightsholder (author) or Successor**, not the Contractor, unless expressly agreed in writing. Base — amount actually paid by the Customer to the Contractor for the license.

5.3. Payment chargeback / billing error claims within service-terms § 6.3 — against the **Contractor**.

---

## 6. Personal data

6.1. Personal data processing — under applicable law and the Contractor’s documents:  
`[privacy policy / DPA / consent / cookies — list or annex]`.

6.2. Hosting and protection of data on the Customer’s infrastructure — Customer’s responsibility unless otherwise in a data annex. The license token is not a personal-data registry (EULA § 11).

---

## 7. Liability

7.1. Commercial liability caps — Annex 2 and mandatory law.  
7.2. Rightsholder IP liability — EULA / service-terms.  
7.3. The Customer shall safeguard wallet keys and comply with the EULA.

---

## 8. Notices

8.1. Notices: emails above and/or channels in the Specification.  
8.2. Rightsholder public templates: https://hb3-accelerator.com

---

## 9. Term, amendments, assignment

9.1. Effective from signing / payment per Specification (`[specify]`); perpetual as to the delivered license; update duties per Annex 2.

9.2. Amendments in writing (including signed PDF / qualified e-signature where recognized).

9.3. Customer assignment of the license — only with token transfer via governance and EULA acceptance by the assignee (EULA § 8; service-terms § 10.4).

---

## 10. Governing law and disputes

10.1. **Contractor ↔ Customer** relations are governed by:  
`[e.g. law of Contractor’s country / England and Wales / other]`.

10.2. Disputes under this Agreement:  
`[court at Contractor’s seat / arbitration …; language …]`.

10.3. EULA (IP) disputes — per Annex 1 (EULA § 19), independent of clauses 10.1–10.2.

---

## 11. Language

Authentic text: `[English / Russian / other]`. Translations are for convenience; the authentic text prevails unless otherwise agreed.

---

## 12. Miscellaneous

12.1. Severability.  
12.2. This Agreement with Annexes and Specification is the entire agreement on the commercial deal with the Contractor.  
12.3. Electronic signatures and scanned copies are allowed if recognized under applicable law.

---

## Details and signatures

**Contractor:** `[name, address, tax ID, payment details — per Specification]`  
**Customer:** `[name, address, tax ID]`

| | Contractor | Customer |
|---|------------|----------|
| Signature | _________________ | _________________ |
| Name | | |
| Date | | |
| Seal (if any) | | |

---

**Related templates:** [Specification](contributor-client-specification.md) · [Acceptance Act](contributor-client-acceptance-act.md)  
**© 2024-2026 Aleksandr Viktorovich Tarabanov.** Template for authorized DLE contributors.
