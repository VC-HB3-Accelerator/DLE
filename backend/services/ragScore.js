/**
 * Выбор лучшего RAG-хита.
 * pgvector: cosine similarity в [0, 1], больше = лучше.
 * Legacy FAISS L2: отрицательная дистанция, меньше abs = лучше.
 */
function pickBestRagHit(filtered, { relevanceThreshold = 0.1, l2Threshold = 300 } = {}) {
  const rows = Array.isArray(filtered) ? filtered : [];
  const cosine = rows.length > 0 && rows.every((r) => {
    const s = Number(r.score);
    return Number.isFinite(s) && s >= -0.05 && s <= 1.05;
  });
  return rows.reduce((acc, row) => {
    const s = Number(row.score);
    if (!Number.isFinite(s)) return acc;
    if (cosine) {
      if (s < relevanceThreshold) return acc;
      if (acc === null || s > Number(acc.score)) return row;
      return acc;
    }
    if (Math.abs(s) <= l2Threshold && (acc === null || Math.abs(s) < Math.abs(acc.score))) {
      return row;
    }
    return acc;
  }, null);
}

/**
 * Нормализация скоров в [0, 1] без инверсии.
 * Cosine similarity и отрицательный L2: больший исходный score → ближе к 1.
 */
function normalizeScores(results) {
  const rows = Array.isArray(results) ? results : [];
  if (!rows.length) return [];

  const scores = rows.map((r) => Number(r.score) || 0);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const range = maxScore - minScore;

  return rows.map((result) => ({
    ...result,
    score: range > 0 ? ((Number(result.score) || 0) - minScore) / range : 1
  }));
}

module.exports = { pickBestRagHit, normalizeScores };
