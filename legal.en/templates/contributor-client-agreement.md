**English** | [Русский](../../legal.ru/templates/contributor-client-agreement.md)

# MODEL AGREEMENT  
## Supply of Digital Legal Entity (DLE) License  
### Contributor (Seller) ↔ Client (Customer)

**Template ID:** CCA-DLE-2026-07-16  
**Status:** Ready international template. Fill in `[…]`.  
**Do not weaken:** [LICENSE](../../LICENSE) (EULA), [service-terms.md](../service-terms.md).

---

**Agreement No.** `[number]` **dated** `[date]`

---

## Parties

**Contractor (Seller / Contributor):**  
`[full legal name]`  
Registration number / ID: `[…]`  
Tax ID: `[…]`  
Address: `[…]`  
Email: `[…]`  
Representative: `[full name, basis of authority]`

**Customer (Client):**  
`[full legal name]`  
Registration number / ID: `[…]`  
Tax ID: `[…]`  
Address: `[…]`  
Email: `[…]`  
Representative: `[full name, basis of authority]`

The Contractor is an **Authorized Contributor** of the Rightsholder under [CONTRIBUTOR_LICENSE](../CONTRIBUTOR_LICENSE.md) and is **not** the owner of the DLE source code. The source-code Rightsholder is Alexander Viktorovich Tarabanov or a Successor under the EULA.

This Agreement is intended for supply to **B2B / organizations**. Mandatory consumer rights (if applicable) remain to the extent they cannot be waived.

---

## 1. Subject Matter

1.1. The Contractor grants the Customer a **non-exclusive perpetual license** to the Digital Legal Entity (DLE) software in the scope of the selected package and provides related services (delivery of the distribution / access to the Author’s repository, on-chain transfer of the license token, and other work per the Specification). The Customer accepts and pays.

1.2. The specific scope (Standard / Premium package, additional services, timelines) is set out in the **Specification / Order / Invoice** ([contributor-client-specification.md](contributor-client-specification.md)), which form an integral part of the Agreement.

1.3. Delivery is a **self-hosted** model: the Customer installs the web-application template on **its own (controlled) infrastructure**. This Agreement does **not** create multi-tenant SaaS by the Contractor for unrelated third parties and does not weaken the SaaS prohibition in the EULA.

1.4. For license issuance, the Customer provides a crypto-wallet address on the **Sepolia** test network. The Contractor performs on-chain transfer of the license token to that address. Other networks — only if expressly stated in the Specification **and** not inconsistent with the EULA / service-terms (primary issuance for EULA acceptance — Sepolia).

1.5. The license token confirms the right of use and grants a vote in governance per service-terms; it enables the holder to obtain administrative rights in the template installed on the Customer’s device, obtained from the author-developer’s repository / distribution (or a channel approved by the Rightsholder).

1.6. While the token is on the Customer’s address, the holder is entitled to updates for the period set by service-terms (baseline — **5 years** from the on-chain transfer date).

1.7. The license token is **non-financial** in nature; it is not a means of payment, a security, or any other financial instrument.

1.8. After acceptance of the EULA and installation of the delivered instance, the software instance and the right to use it are a **Customer asset**; the Rightsholder does not revoke the license unilaterally except upon a material breach of the EULA (EULA § 6.4, § 14; service-terms § 1.1).

---

## 2. Appendices and Hierarchy

Integral appendices:

| No. | Document | Role |
|-----|----------|------|
| 1 | [LICENSE](../../LICENSE) — EULA, version ID: `[EULA-DLE-… / date / hash]` | IP, license scope, prohibitions, non-revocation (Customer ↔ Rightsholder) |
| 2 | [service-terms.md](../service-terms.md) (or a localized version approved by the Rightsholder), date/version: `[…]` | Tokens, updates, support, refunds, liability |
| 3 | Specification / Invoice | Price, package, wallet, additional services |
| 4+ | `[DPA / personal data policy / SLA / information security — as needed]` | Local requirements |

**Hierarchy:**  
- commerce of this deal (price, taxes, distribution delivery, Contractor↔Customer disputes) — this Agreement and the Specification;  
- IP and termination of the right of use — **Appendix 1 (EULA)**;  
- updates, 70% refund, voting — **Appendix 2**, unless the Agreement improves the Customer’s position.  
The Agreement does not weaken the IP restrictions of the EULA, except mandatory norms in favor of the Customer.

**Dual acceptance:** signing the Agreement — the deal with the Contractor; crediting the token to the Customer’s wallet on Sepolia — acceptance of the EULA in relation to the Rightsholder.

---

## 3. Price and Settlements

3.1. Price, currency, taxes, payment procedure and deadline — in the **Invoice / Specification**.

3.2. The Contractor’s royalty obligations to the Rightsholder (CONTRIBUTOR_LICENSE) are **not** the subject of this Agreement and do not increase the price for the Customer beyond what is agreed in the Invoice.

3.3. Payment-system and network (gas) fees — `[at whose expense: Customer / Contractor / per Specification]`.

---

## 4. Delivery and Acceptance

4.1. After payment (or within the period per the Specification) the Contractor:  
(a) provides the Customer with access to the distribution / repository within the package scope;  
(b) transfers the license token to the stated wallet on Sepolia;  
(c) delivers the texts of Appendices 1 and 2 (or links to fixed versions).

4.2. The fact of license transfer is recorded in an **Act** ([contributor-client-acceptance-act.md](contributor-client-acceptance-act.md)) stating the wallet address and Tx/Hash. The Act confirms delivery of the license / agreed one-off services, and does **not** early-terminate update obligations for the full 5-year term.

4.3. Acceptance procedure and criteria, and on-chain recording — also per Appendix 2 (service-terms).

---

## 5. Updates, Support, and Refunds

5.1. Updates, maintenance, timelines, and refund procedures — per **Appendix 2**.

5.2. The **70%** refund program (service-terms § 6.2): the debtor is the **Rightsholder (Author) or Successor**, not the Contractor, unless otherwise expressly agreed in writing. The base is the amount actually paid by the Customer to the Contractor for the license.

5.3. Payment claims (error, double payment) within the period of service-terms § 6.3 — against the **Contractor**.

---

## 6. Personal Data

6.1. Processing of personal data — in accordance with applicable law and the Contractor’s documents:  
`[Privacy policy / DPA / consent / cookies — list or attach]`.

6.2. Placement and protection of data on the Customer’s infrastructure — the Customer’s responsibility, unless otherwise in a personal-data Appendix. The license token is not a personal-data registry (EULA § 11).

---

## 7. Liability

7.1. Limits of liability for the commercial deal — Appendix 2 and mandatory law.  
7.2. The Rightsholder’s liability for IP — EULA / service-terms.  
7.3. The Customer shall safeguard wallet keys and comply with the EULA.

---

## 8. Communications

8.1. Notices: the parties’ emails stated above and/or channels in the Specification.  
8.2. Public standard documents of the Rightsholder: https://hb3-accelerator.com

---

## 9. Term, Amendment, Assignment

9.1. The Agreement enters into force on the date of signing / payment per the Specification (`[specify]`) and continues perpetually as to the delivered license; update obligations — per Appendix 2.

9.2. Amendments — in writing (including exchange of signed PDFs / qualified electronic signature, if permitted by applicable law).

9.3. Assignment of the license by the Customer — only with transfer of the token via governance and acceptance of the EULA by the successor (EULA § 8; service-terms § 10.4).

---

## 10. Governing Law and Disputes

10.1. Relations between **Contractor ↔ Customer** are governed by the law of:  
`[specify: e.g., law of the Contractor’s country / England and Wales / other]`.

10.2. Disputes arising from the Agreement:  
`[specify: court at the Contractor’s seat / arbitration …; language …]`.

10.3. Disputes arising from the EULA (IP) — per Appendix 1 (EULA § 19), independently of clauses 10.1–10.2.

---

## 11. Language

Authentic text of the Agreement: `[Russian / English / other]`. In case of discrepancy between translations, the authentic text prevails, unless the parties state otherwise.

---

## 12. Final Provisions

12.1. Invalidity of a separate provision does not affect the others.  
12.2. The Agreement together with the Appendices and Specification constitutes the entire agreement on the subject of the deal with the Contractor.  
12.3. Electronic signatures and exchange of scans are permitted if recognized by applicable law.

---

## Details and Signatures

**Contractor:**  
`[name, address, tax ID, bank / crypto for payment — per Specification]`  
Email: `[…]` Tel.: `[…]`

**Customer:**  
`[name, address, tax ID]`  
Email: `[…]` Tel.: `[…]`

| | Contractor | Customer |
|---|-------------|----------|
| Signature | _________________ | _________________ |
| Full name | | |
| Date | | |
| Seal (if applicable) | | |

---

**Related templates:** [Specification](contributor-client-specification.md) · [Act](contributor-client-acceptance-act.md)  
**© 2024-2026 Alexander Viktorovich Tarabanov.** Template for Authorized Contributors of DLE.
