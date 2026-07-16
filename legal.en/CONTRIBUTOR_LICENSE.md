**English** | [Русский](../legal.ru/CONTRIBUTOR_LICENSE.md)

# MODEL LICENSE AGREEMENT  
# OF AUTHORIZED CONTRIBUTOR  
## (Author ↔ Authorized Contributor) — Digital Legal Entity (DLE)

**Template version:** 2026-07-16  
**Status:** model agreement (Model Agreement / Template).  
Does not automatically become a binding contract until the parties complete the `[LOCAL]` fields, attach details, and sign.

---

## How to use this document (for counsel)

1. This file is the **single template** for **Author ↔ Contributor** relations. A separate “companion” document is not required.
2. Marking:
   - **[CORE]** — do not weaken without the Author’s written consent (IP, royalty, ban on resale of source code, right of first refusal on Updates).
   - **[LOCAL]** — counsel fills in / adapts for the country, tax and corporate law, currency, disputes.
3. The Contributor’s clients are **not** parties to this Agreement. For clients: [contributor-client-agreement.md](templates/contributor-client-agreement.md) (+ Specification, Act) with appendices [LICENSE](../LICENSE) and [service-terms.md](service-terms.md) (or localized versions approved by the Author).
4. Recommended order: complete Parties and Appendix A → check the checklist at the end → sign → store version/date together with the file hash if needed.

---

## Parties

**Author (Licensor / rightsholder of the baseline source code):**  
Alexander Viktorovich Tarabanov  
Email: info@hb3-accelerator.com  
Website: https://hb3-accelerator.com  

`[LOCAL: passport/identification, notice address, bank / USDT details for royalty, tax status]`

**Authorized Contributor (Licensee):**  

| Field | Value |
|-------|-------|
| Full legal name | `[LOCAL]` |
| Registration number / OGRN / Company No. | `[LOCAL]` |
| Jurisdiction of incorporation | `[LOCAL]` |
| Address | `[LOCAL]` |
| Representative / basis of authority | `[LOCAL]` |
| Email for notices | `[LOCAL]` |

collectively referred to as the **Parties**.

**Agreement Date:** `[LOCAL: DD.MM.YYYY]`  
**Agreement Number (optional):** `[LOCAL]`

---

## Preamble

(A) The Author is the rightsholder of the **baseline (initial) source code** of the Digital Legal Entity software (**DLE** / **Software**).  
(B) The Contributor wishes to obtain the right to sell to clients licenses to use DLE, modify the code, deploy the Software, and provide related services in the agreed Territory.  
(C) The Parties enter into this Agreement on the terms below.

---

## 1. Definitions

| Term | Meaning |
|------|---------|
| **Software / DLE** | Digital Legal Entity — software and related documentation |
| **Baseline Source Code** | The baseline (initial) DLE code, rights in which belong to the Author |
| **Updates** | Updates, improvements, and modifications created by the Contributor based on DLE |
| **License Token** | ERC20 governance token (1 — Standard; 10 — Premium) evidencing the client’s license |
| **Sepolia** | Test network of primary token issuance to the client |
| **National Network** | DLE blockchain contour deployed by the Contributor in the Territory country (service-terms § 10.5) |
| **Territory** | Country / region under Section 3 |
| **Client** | End user (B2B / organization) purchasing a license from the Contributor |
| **Successor** | Person to whom the Author has in writing assigned exclusive rights in the Baseline Source Code and/or the right to royalty |
| **EULA** | [LICENSE](../LICENSE) (or an agreed localized version) |
| **Service Terms** | [service-terms.md](service-terms.md) (or a localized version **approved by the Author**) |

---

## 2. Subject Matter and Grant of Rights **[CORE]**

2.1. The Author grants the Contributor a **non-exclusive** (unless otherwise agreed in Section 3) right in the Territory to:

1. **sell** to Clients DLE license tokens (Standard and Premium packages);
2. **modify** the DLE source code in full (including backend, frontend, smart contracts, and documentation) for implementation, support, and customization for Clients and accelerator tasks;
3. **deploy** the Software on Clients’ infrastructure under a sold license;
4. **provide services** of setup, training, and support based on DLE.

2.2. This Agreement does **not** transfer to the Contributor exclusive rights in the Baseline Source Code.

2.3. Relations with Clients are documented in a **separate** local agreement between the Contributor and the Client. Royalty and IP in the Baseline Source Code are **not** the subject of the agreement with the Client.

2.4. **Engaging contractors for code modification.** The Contributor may engage **contractor companies** (and other performers) to modify DLE code **only** if all of the following conditions are met:

1. there is **prior written consent of the Author** (or Successor) for the specific contractor and scope of work;
2. a **written contract** for performance of the work is concluded with the contractor;
3. the price of the work is **not below market** for comparable services in the Territory (or another base agreed by the Parties), unless otherwise expressly agreed with the Author in writing;
4. the contractor is bound by confidentiality obligations no weaker than Section 9 and does not receive the right to resell the Baseline Source Code or act as a DLE distributor;
5. **copyright in the work results (Updates)** created by the contractor under such contract **vests in the Contributor** (work made for hire / assignment / other form permitted by local law), so that Section 6.1 and the right of first refusal (Section 6.3) apply to those Updates without gaps.

2.5. Clause 2.4 does **not** mean a sublicense of the code to other distributors and does **not** cancel the prohibitions of Section 7. The Author’s consent to a contractor ≠ consent to resale of the Baseline Source Code or appointment of a second contributor.

---

## 3. Territory **[LOCAL + CORE boundaries]**

3.1. **Territory:** `[LOCAL: state / region]`.

3.2. Nature of rights in the Territory (check one):

- [ ] **Non-exclusive** — the Author may appoint other contributors in the same Territory;
- [ ] **Exclusive** — for the term and on conditions: `[LOCAL: exclusivity term, exceptions (Author’s direct sales, public procurement, etc.)]`.

3.3. Outside the Territory the Contributor shall not sell licenses or hold itself out as an Authorized Contributor without the Author’s written consent.

---

## 4. Term **[LOCAL]**

4.1. The Agreement is effective from the Agreement Date for: `[LOCAL: e.g., 5 years / perpetual until termination]`.

4.2. Renewal: `[LOCAL: automatic renewal for N years / by written consent]`.

4.3. Provisions on IP, royalty (accrued), confidentiality, liability, and disputes survive termination to the extent necessary for their performance.

---

## 5. Royalty **[CORE]**

### 5.1. Rates

| Package | Royalty to Author | License Token |
|---------|-------------------|---------------|
| Standard | **1,000 USDT** | 1 |
| Premium | **10,000 USDT** | 10 |

5.2. Royalty **accrues** for **each** license transferred to a Client and does **not** depend on the sale price to the Client.

5.3. The Contributor may set a customer price **above** the royalty amount (margin, taxes, fees). The difference remains with the Contributor unless otherwise agreed in writing.

5.4. **Payment:** upon **written request** of the Author (or Successor). The Author may request payment **at least once per calendar year**. Payment deadline: **30 calendar days** from the request, unless Appendix A states otherwise.

5.5. Upon the Author’s request the Contributor shall provide a **sales report** and the amount of accrued royalty for the period.

5.6. **[LOCAL — Appendix A]:** settlement currency / USDT rate; bank or USDT details; VAT/taxes; invoicing procedure.

---

## 6. Intellectual Property **[CORE]**

### 6.1. Baseline Source Code and Updates

| Object | Rightsholder |
|--------|--------------|
| Baseline (initial) DLE source code | **Author** (may assign exclusive rights to a Successor — Section 12) |
| Updates (updates, improvements, modifications released by the Contributor) | **Contributor** — **copyright (exclusive rights)** in those Updates vest in the Contributor from creation, unless otherwise agreed in writing |

6.1.1. **Copyright in Updates.** For each Update created and released by the Contributor based on DLE, the Contributor acquires and retains **copyright** (including exclusive right to the extent permitted by applicable law), separate from the Author’s rights in the Baseline Source Code. The Contributor does not acquire copyright in the Baseline Source Code itself.

6.1.2. Clients receive a right of **use** of Updates only under the DLE license sold to them; this does not transfer to the Client the Contributor’s copyright in Updates.

### 6.2. Contributor’s IP Obligations

- preserve the Author’s copyright notices in modified baseline-code files;
- not claim exclusive / copyright in the **Baseline Source Code**;
- grant Clients a right to use Updates under the sold license;
- comply with [ATTRIBUTION_REQUIREMENTS.md](ATTRIBUTION_REQUIREMENTS.md);
- retain [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) in deliveries;
- not remove proprietary notices.

### 6.3. Right of First Refusal to Purchase Copyright in Updates

6.3.1. The subject of the right of first refusal is specifically the **Contributor’s copyright (exclusive rights) in Updates** (Section 6.1), not the Author’s rights in the Baseline Source Code.

6.3.2. The right of first refusal belongs to the **Author** or, if the Author has assigned the corresponding right under Section 12, the **Successor** (in this section — the **ROFR Beneficiary**).

6.3.3. The Contributor may sell, assign, or otherwise dispose of copyright in Updates to a third party **only** subject to the ROFR Beneficiary’s right of first refusal:

1. The Contributor sends the ROFR Beneficiary a **written notice** with the terms of the proposed transaction (object — which Updates / which rights; price; counterparty);
2. The ROFR Beneficiary may **purchase** those copyrights in Updates on the same terms within **30 calendar days** from the notice date;
3. upon refusal or non-response the Contributor may conclude the transaction with a third party **not on terms more favorable to the third party** than those offered to the ROFR Beneficiary.

6.3.4. While the right of first refusal is in effect, the Contributor shall not dispose of copyright in Updates bypassing the procedure in 6.3.3.

---

## 7. Prohibitions **[CORE]**

The Contributor shall **not**:

- resell or distribute the **Baseline Source Code** to third parties outside the sale of a license token to an end Client;
- publish forks of DLE as a standalone product for free download;
- sublicense the code to other distributors without the Author’s written consent;
- hold itself out as the rightsholder of the Baseline Source Code before Clients or regulators.

**Permitted:** sale of a **license token** to an end Client (see Service Terms); engaging contractors for code modification under **Section 2.4**.

---

## 8. Contributor’s Obligations Toward Clients **[CORE]**

The Contributor shall:

1. Conclude with the Client a **local** purchase / licensing agreement; appendices — **EULA** and **Service Terms** (or localized versions approved by the Author).
2. Not weaken in the Client’s local documents without the Author’s written consent: Author royalty 1,000 / 10,000 USDT (as an ecosystem condition), ban on resale of Baseline Source Code, Author’s right of first refusal on Updates, ban on multi-tenant SaaS, and other EULA IP restrictions.
3. Issue to the Client a license token on **Sepolia** to the Client’s wallet; crediting the token = the Client’s acceptance of the EULA.
4. Deploy the **National Network** and organize migration of Sepolia tokens → country network (Service Terms § 10.5).
5. Prepare a local version of Service Terms and the Client agreement (seller details, currency, taxes, refunds, disputes) taking into account the law of the Territory.

8.1. In case of conflict between the local Client agreement and the EULA / this Agreement on **IP and royalty** — the EULA and this Agreement prevail (unless a mandatory norm of the Territory expressly improves the Client’s position). On **purely commercial** Client terms (price, taxes, venue of the Client deal) — the local Client agreement.

---

## 9. Confidentiality **[LOCAL + CORE minimum]**

9.1. The Contributor shall keep confidential the Baseline Source Code, know-how, non-public materials of the Author, and commercial royalty terms, except: disclosure to the Client to the extent necessary for licensed use; legal requirement; Author’s consent.

9.2. **[LOCAL]:** confidentiality term after termination — `[e.g., 5 years]`; a separate NDA as Appendix C is permitted.

---

## 10. Representations **[LOCAL]**

10.1. Each Party represents that it has the right to enter into the Agreement and perform its obligations.

10.2. The Contributor represents that in the Territory it may act as a seller of software / IT services under local law (including founder residency requirements, if applicable).

10.3. **[LOCAL]:** additional representations (sanctions, anti-corruption, export control) — as needed for the jurisdiction.

---

## 11. Liability **[LOCAL]**

11.1. **[LOCAL]:** liability cap of each Party — `[e.g., royalty amount for 12 months / other formula]`.

11.2. **[LOCAL]:** exclusion of indirect damages — yes / no / with exceptions (willful misconduct, gross negligence, breach of confidentiality / IP).

11.3. Nothing in this Section relieves the Contributor of the obligation to pay **accrued** royalty.

---

## 12. Author’s Successor **[CORE]**

12.1. The Author may in writing assign to a third party (**Successor**):

- exclusive rights in the Baseline Source Code; and/or
- the right to receive royalty under Section 5; and/or
- the **right of first refusal to purchase the Contributor’s copyright in Updates** (Section 6.3).

12.2. Consequences from notice to the Contributor:

- royalty is paid to the Successor if the right to receive royalty has been assigned;
- the EULA for Clients may be provided by the Successor if exclusive rights in the code have been assigned;
- the Contributor’s obligations under Sections 6–8 **remain**.

12.3. Notice — **before** the next payment deadline under a request.

12.4. Assignment of rights by the Author does not expand the Contributor’s right to resell the Baseline Source Code.

---

## 13. Termination and Consequences **[CORE + LOCAL]**

13.1. The Author may terminate Authorized Contributor status upon:

- non-payment of accrued royalty within **60 calendar days** after the deadline under a **current** written request;
- breach of Section 7 (ban on code resale / forks / sublicenses);
- infringement of third-party copyrights or licenses;
- **[LOCAL]:** other material breaches with a cure period of `[N days]`.

13.2. The Contributor may terminate: `[LOCAL: conditions]`.

13.3. **After termination:**

- new license sales and code modification for new Clients — **prohibited**;
- support of already sold client licenses — only **by written agreement** with the Author;
- **[LOCAL]:** return / deletion of Author materials; procedure regarding Client data (taking into account local personal-data law and Client agreements).

---

## 14. Governing Law and Disputes **[LOCAL]**

14.1. Governing law: `[LOCAL: law of ________]`.

14.2. Dispute procedure: `[LOCAL: negotiations → claim N days → court / arbitration (institution, seat, language, number of arbitrators)]`.

14.3. Counsel shall verify enforceability of the choice of law and forum for both Parties (including where the Author is a natural person non-resident relative to the Territory).

---

## 15. General Provisions

15.1. **Entire agreement.** This Agreement (including Appendices) constitutes the entire understanding of the Parties on the subject matter and supersedes prior negotiations thereon.  
15.2. **Amendments** — only in writing signed by the Parties.  
15.3. **Notices** — to the Parties’ emails above; **[LOCAL:** registered mail / courier`]**.  
15.4. **Language.** Authentic text: `[LOCAL: Russian / English / both; in case of discrepancy priority: ________]`.  
15.5. **Severability.** Invalidity of a separate provision does not affect the others.  
15.6. **Assignment.** The Contributor shall not assign the Agreement without the Author’s consent; the Author may assign to a Successor under Section 12.

---

## 16. Appendices

| No. | Document | Status |
|-----|----------|--------|
| **A** | Payment and tax details for royalty | `[LOCAL — complete]` |
| **B** | EULA ([LICENSE](../LICENSE)) — reference for Clients | mandatory |
| **C** | Service Terms ([service-terms.md](service-terms.md)) — reference for Clients | mandatory |
| **D** | NDA / SLA Author↔Contributor | `[LOCAL — optional]` |
| **E** | Other | `[LOCAL]` |

---

## 17. Signatures

| Author | Contributor |
|--------|-------------|
| Full name: Alexander Viktorovich Tarabanov | Full name / title: `[LOCAL]` |
| Signature: __________ | Signature: __________ |
| Date: __________ | Date: __________ |

---

## Counsel Checklist Before Signing

- [ ] Party details and Date completed
- [ ] Territory and exclusive / non-exclusive defined
- [ ] Term and renewal completed
- [ ] Royalty 1,000 / 10,000 USDT and payment-on-request procedure not weakened
- [ ] Appendix A (details / taxes / currency) completed
- [ ] Updates: copyright — with Contributor; right of first refusal on those rights — with Author or Successor (30 days)
- [ ] Contractors for code modification — only with Author’s written consent, under contract and at market prices (Section 2.4); IP in Updates remains with Contributor
- [ ] Ban on resale of Baseline Source Code preserved
- [ ] Client obligations (EULA, Service Terms, Sepolia, national network) included
- [ ] Confidentiality / NDA agreed
- [ ] Liability caps completed under local law
- [ ] Governing law and disputes enforceable for both Parties
- [ ] Contract language and text priority stated
- [ ] IT-seller residency requirements in the Territory checked (if any)
- [ ] Template version and date recorded in the file

---

**Relation to Client Documents**

```
Author  ←—— this Agreement ——→  Contributor  ←—— local agreement ——→  Client
                                              appendices: EULA + Service Terms
                                              Sepolia token = EULA acceptance
```

**Example Contributor in the Russian Federation:** LLC “ERAYTI” — see [service-terms.md § 11](service-terms.md#11-payment-and-contributors).

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** 2026-07-16
