/**
 * Число предложений DLE: getProposalsCount() есть не на всех задеплоенных книгах.
 * Fallback — allProposalIds(i) или scan getProposalSummary(i).
 */

const LEGACY_MAX = 500;

async function resolveProposalsCount(dle) {
  try {
    const countBn = await dle.getProposalsCount();
    const n = Number(countBn);
    if (Number.isFinite(n) && n >= 0) return n;
  } catch (_) {
    /* legacy book */
  }

  try {
    let count = 0;
    while (count < LEGACY_MAX) {
      await dle.allProposalIds(count);
      count += 1;
    }
    if (count > 0) return count;
  } catch (_) {
    /* no allProposalIds */
  }

  let count = 0;
  while (count < LEGACY_MAX) {
    try {
      await dle.getProposalSummary(count);
      count += 1;
    } catch {
      break;
    }
  }
  return count;
}

module.exports = { resolveProposalsCount };
