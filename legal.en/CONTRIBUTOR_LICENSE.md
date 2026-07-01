**English** | [Русский](../legal.ru/CONTRIBUTOR_LICENSE.md)

# Authorized Contributor License Agreement

**Software:** Digital Legal Entity (DLE)  
**Copyright holder:** Alexander Viktorovich Tarabanov  
**Email:** info@hb3-accelerator.com

---

## 1. Purpose

This agreement governs the relationship between the **Author** (copyright holder)
 and an **Authorized Contributor** — a legal entity or individual granted the
 right to sell licenses and modify DLE code.

End customers are governed by the [LICENSE](../LICENSE) and
 [service-terms.md](../docs.en/service-terms.md) (template versions) or
 **localized documents** from the Contributor in the customer’s country.
 The customer contract is drafted by the **Contributor’s lawyer** using
 [templates/client-license-contract.md](templates/client-license-contract.md).

### 1.1. Country localization

The Contributor **must** (within their territory):

- prepare a **local version** of service-terms and the customer contract
  compliant with local law;
- specify seller details, currency, taxes, refunds, and dispute resolution;
- **not reduce**, without the Author’s written consent: royalty 1,000 / 10,000
  USDT, source code resale ban, or the Author’s **right of first refusal** when
  the Contributor disposes of Updates.

Templates in the DLE repository are the **reference**; if a local customer
 contract conflicts on **local law matters**, the local contract prevails; on
 **IP and royalty**, CONTRIBUTOR_LICENSE and LICENSE prevail unless the local
 contract explicitly improves customer rights without harming the Author’s IP.

---

## 2. Grant to Contributor

Upon acceptance of this agreement (in writing or as part of a contract with
 the Author), the Author grants the Contributor a **non-exclusive** right.
 An individual contract is drafted by **lawyers** using
 [templates/contributor-author-contract.md](templates/contributor-author-contract.md);
 this CONTRIBUTOR_LICENSE is the template text (contract appendix).

**The Contributor may:**

1. **Sell** DLE license tokens to customers (Standard and Premium)
2. **Modify** DLE source code in full for deployment, support, and client work
3. **Deploy** the Software on customer infrastructure under a sold license
4. **Provide** setup, training, and support services based on DLE

---

## 3. Royalty to Author

### 3.1. Fixed amount per license sold

| Package | Royalty to Author (USDT) | License tokens |
|---------|--------------------------|----------------|
| Standard | **1,000** | 1 |
| Premium | **10,000** | 10 |

Royalty is independent of the price at which the Contributor sells to the customer.

### 3.2. Customer price

The Contributor **may** set a customer price **above** the royalty amount,
 including payment fees, taxes, duties, and the Contributor’s **margin**.

**Example (not a minimum or maximum price):**

| Package | Royalty to Author | Example customer price |
|---------|-------------------|------------------------|
| Standard | 1,000 USDT | 1,500 USDT |
| Premium | 10,000 USDT | 15,000 USDT |

The difference between customer price and royalty remains with the Contributor
 unless otherwise agreed in writing with the Author.

### 3.3. Accrual and payment

- Royalty **accrues** for **each** license transferred to a customer (Section 3.1)
- **Payment** of accrued royalty is made **upon the Author’s written request**
  (or the successor under Section 8)
- The Author may submit a payment request **at least once per calendar year**
- Payment due within **30 calendar days** of the request, unless an individual
  contract with the Author states otherwise
- Upon request, the Contributor provides a **sales report** and accrued royalty
  for the period

---

## 4. Code modification and derivative works

### 4.1. Permitted modifications

The Contributor may **fully modify** DLE code, including backend, frontend,
 smart contracts, and documentation, for clients and the accelerator program.

### 4.2. Copyright in Contributor Updates

The **initial (baseline) source code** of DLE is copyrighted by the **Author**
 (see LICENSE).

**Updates, enhancements, and modifications** (**Updates**) created by the
 Contributor based on DLE are copyrighted by the **Contributor**, unless
 otherwise agreed in a separate written contract.

The Contributor must:

- retain the Author’s copyright notices in modified baseline source files
- **not claim** exclusive rights to the **initial (baseline) code** of DLE
- grant customers use of Updates under the sold license

### 4.3. Author’s right of first refusal on Updates

The Contributor may **sell or otherwise transfer** rights in Updates to a third
 party only subject to the **Author’s right of first refusal**:

1. The Contributor sends the Author a **written notice** with the proposed
   terms (subject matter, price, counterparty).
2. The Author may **acquire** those rights on the same terms within
   **30 calendar days** of the notice.
3. If the Author declines or does not respond, the Contributor may complete
   the third-party deal **on terms no more favorable** than offered to the Author.

### 4.4. No code resale to third parties

The Contributor **may NOT**:

- resell or distribute **source code** to third parties except through
  selling a license token to an end customer
- publish DLE forks as a standalone freely downloadable product
- sublicense code to other distributors without the Author’s written consent

Selling a **license token** to a customer is the permitted channel for
 granting use rights (see service-terms).

---

## 5. Contributor obligations

1. Ensure customers receive the [LICENSE](../LICENSE) terms
2. Enter into a **local purchase or license contract** with each customer;
   **appendices** to the contract — [LICENSE](../LICENSE) and
   [service-terms.md](../docs.en/service-terms.md) (or localized versions)
3. Comply with [ATTRIBUTION_REQUIREMENTS.md](ATTRIBUTION_REQUIREMENTS.md)
4. Include [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) in distributions
5. Not remove copyright or proprietary notices
6. Pay royalty on time (Section 3)
7. Issue the customer a **license token** on Sepolia to their wallet —
   token credit constitutes customer acceptance of the EULA (see LICENSE, Acceptance)
8. Deploy the national network and facilitate token migration (service-terms § 10.5)

---

## 6. Termination

The Author may revoke Authorized Contributor status if:

- failure to pay **accrued** royalty within **60 calendar days** after the
  deadline under Section 3.3 following a **valid written request** from the Author
- breach of the code resale ban (Section 4.4)
- third-party copyrights or licenses are violated

After termination the Contributor stops selling new licenses and modifying code,
 **except** supporting existing customer licenses as agreed with the Author.

---

## 7. Relationship to other documents

| Document | Applies to |
|----------|------------|
| [CONTRIBUTOR_LICENSE.md](CONTRIBUTOR_LICENSE.md) | Contributor ↔ Author |
| [LICENSE](../LICENSE) | Contributor ↔ customer (via token) |
| [service-terms.md](../docs.en/service-terms.md) | Customer commercial terms |

If this agreement conflicts with an individual **written contract** with the
 Author, the individual contract prevails.

---

## 8. Assignment of exclusive rights by the Author

8.1. The Author may **fully or partially assign** in writing to a third party
 (**successor**):

- **exclusive rights** to the **initial (baseline) source code** of DLE;
- the **right to receive royalty** under this agreement (Section 3).

8.2. Upon effective assignment:

- the licensor under [LICENSE](../LICENSE) for end users is the **successor**
  (if exclusive code rights are assigned) or the Author, as stated in notice;
- the Contributor pays royalty to the **successor** if the right to receive
  royalty was assigned;
- the Contributor must honor this agreement toward the successor.

8.3. The Author (or successor) **notifies** Authorized Contributors of the
 assignment and royalty payment details **before** the next payment cycle
 under Section 3.3.

8.4. Assignment by the Author **does not release** the Contributor from
 obligations under Sections 4–5 and **does not expand** the Contributor’s
 right to resell source code without the rights holder’s consent.

---

## 9. Contacts

**Copyright holder:** Alexander Viktorovich Tarabanov  
**Email:** info@hb3-accelerator.com  
**Website:** https://hb3-accelerator.com

**Example Authorized Contributor (Russia):** LLC "ERAITI" — see
 [service-terms.md § 11](../docs.en/service-terms.md#11-payment-and-contributors)

---

**© 2024-2026 Alexander Viktorovich Tarabanov. All rights reserved.**

**Last updated:** July 2026
