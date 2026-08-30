<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.

  Сводка аналитики на карточке DLE хаба `/management`:
  кворум, запас/холдеры, адрес сети и баланс казны — отдельно по каждой сети книги.
-->

<template>
  <div v-if="dleAddress && insightChains.length" class="dle-insights" :aria-busy="isLoading">
    <div v-if="isLoading" class="dle-insights__loading">
      <UiGlyph name="sync" :spin="true" :size="18" />
      <span>{{ t('smartcontracts.management.insights.loading') }}</span>
    </div>

    <template v-else>
      <div class="dle-insights__nets">
        <section v-for="col in columnsView" :key="`net-${col.chainId}`" class="dle-insights__panel">
          <h4 class="dle-insights__title">{{ col.name }}</h4>
          <a
            v-if="col.address"
            :href="`${explorerBase(col.chainId)}/address/${col.address}`"
            target="_blank"
            rel="noopener noreferrer"
            class="dle-insights__addr"
            :title="col.address"
            @click.stop
          >
            {{ shortenHash(col.address) }}
            <UiGlyph name="external-link" :size="16" />
          </a>
          <p v-else class="dle-insights__muted">Адрес ещё не записан (деплой не завершён)</p>
          <div class="dle-insights__rings">
            <div class="dle-insights__dial">
              <p class="dle-insights__dial-caption">{{ t('smartcontracts.management.insights.quorum') }}</p>
              <div class="dle-insights__ring-wrap">
                <svg class="dle-insights__ring" viewBox="0 0 36 36" aria-hidden="true">
                  <circle class="dle-insights__ring-track" cx="18" cy="18" r="15.915" />
                  <circle
                    class="dle-insights__ring-value dle-insights__ring-value--quorum"
                    cx="18"
                    cy="18"
                    r="15.915"
                    pathLength="100"
                    :stroke-dasharray="`${quorumPct} ${100 - quorumPct}`"
                  />
                </svg>
                <span class="dle-insights__ring-center">{{ quorumPct }}%</span>
              </div>
            </div>

            <div class="dle-insights__dial">
              <p class="dle-insights__dial-caption">{{ t('smartcontracts.management.insights.holderShare') }}</p>
              <div v-if="col.geom.length" class="dle-insights__ring-wrap">
                <svg
                  class="dle-insights__ring"
                  viewBox="0 0 36 36"
                  role="img"
                  :aria-label="t('smartcontracts.management.insights.holderShare')"
                >
                  <circle class="dle-insights__ring-track" cx="18" cy="18" r="15.915" />
                  <circle
                    v-for="slice in col.geom"
                    :key="slice.key"
                    class="dle-insights__ring-value"
                    cx="18"
                    cy="18"
                    r="15.915"
                    pathLength="100"
                    :stroke="slice.color"
                    :stroke-dasharray="slice.dash"
                    :stroke-dashoffset="slice.dashOffset"
                  />
                </svg>
                <span class="dle-insights__ring-center dle-insights__ring-center--supply">{{ col.compactSupply }}</span>
              </div>
              <p v-else class="dle-insights__muted">{{ t('smartcontracts.analytics.noHoldersData') }}</p>
            </div>
          </div>

          <p class="dle-insights__sub">{{ t('smartcontracts.analytics.treasuryTitle') }}</p>
          <p v-if="col.treasuryError" class="dle-insights__muted">{{ col.treasuryError }}</p>
          <p v-else-if="col.treasury.length === 0" class="dle-insights__muted">
            {{ t('smartcontracts.analytics.treasuryNoTokens') }}
          </p>
          <ul v-else class="dle-insights__tokens">
            <li v-for="tok in col.treasury" :key="tok.key" class="dle-insights__token">
              <span class="dle-insights__token-symbol">{{ tok.symbol || '—' }}</span>
              <span class="dle-insights__token-bal">{{ tok.balanceHuman }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/axios';
import UiGlyph from '@/components/UiGlyph.vue';

const props = defineProps({
  dleAddress: { type: String, default: '' },
  networks: { type: Array, default: () => [] },
  quorumPercentage: { type: [Number, String], default: 0 },
  tokenSymbol: { type: String, default: '' },
});

const emit = defineEmits(['loading', 'loaded']);

let loadGen = 0;

const { t, locale } = useI18n();

const isLoading = ref(true);
const columns = ref([]);

const HOLDER_COLORS = ['#2563eb', '#14b8a6', '#fd7e14', '#8b5cf6', '#e11d48'];

const insightChains = computed(() => {
  const rows = (props.networks || [])
    .map((n) => ({
      chainId: Number(n.chainId),
      address: n.address || props.dleAddress,
    }))
    .filter((n) => Number.isFinite(n.chainId) && n.chainId > 0);
  const seen = new Set();
  return rows
    .filter((n) => {
      if (seen.has(n.chainId)) return false;
      seen.add(n.chainId);
      return true;
    })
    .sort((a, b) => a.chainId - b.chainId);
});

const quorumPct = computed(() => {
  const n = Number(props.quorumPercentage);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n));
});

const columnsView = computed(() => columns.value.map((col) => {
  const slices = holderSlicesFor(col);
  return {
    ...col,
    compactSupply: formatCompactSupply(col.supply),
    geom: holderGeomFor(slices),
  };
}));

function holderSlicesFor(col) {
  const sorted = [...(col.holders || [])].sort(
    (a, b) => Number(b.percentage || 0) - Number(a.percentage || 0),
  );
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const slices = top
    .map((h, i) => ({
      key: h.address,
      label: shortenHash(h.address),
      explorerUrl: h.address ? `${explorerBase(col.chainId)}/address/${h.address}` : '',
      pct: Number(h.percentage) || 0,
      amountCompact: formatCompactSupply(h.balance),
      color: HOLDER_COLORS[i % HOLDER_COLORS.length],
    }))
    .filter((s) => s.pct >= 0.5);
  const restPct = rest.reduce((sum, h) => sum + (Number(h.percentage) || 0), 0);
  if (restPct > 0.5) {
    slices.push({
      key: 'others',
      label: t('smartcontracts.management.insights.holdersOthers'),
      explorerUrl: '',
      pct: restPct,
      amountCompact: formatCompactSupply(Number(col.supply) * (restPct / 100)),
      color: '#9ca3af',
    });
  }
  if (!slices.length && Number(col.supply) > 0) {
    return [{
      key: 'supply',
      label: t('smartcontracts.management.insights.holderShare'),
      explorerUrl: '',
      pct: 100,
      amountCompact: formatCompactSupply(col.supply),
      color: HOLDER_COLORS[0],
    }];
  }
  return slices;
}

function holderGeomFor(slices) {
  let acc = 0;
  return slices.map((slice) => {
    const offset = acc;
    acc += slice.pct;
    return {
      ...slice,
      dash: `${slice.pct} ${Math.max(0, 100 - slice.pct)}`,
      dashOffset: -offset,
    };
  });
}

function getChainName(chainId) {
  const map = {
    1: t('smartcontracts.analytics.chains.ethereum'),
    11155111: t('smartcontracts.analytics.chains.sepolia'),
    17000: t('smartcontracts.analytics.chains.holesky'),
    84532: t('smartcontracts.analytics.chains.baseSepolia'),
    80002: t('smartcontracts.analytics.chains.polygonAmoy'),
    421614: t('smartcontracts.analytics.chains.arbitrumSepolia'),
    137: t('smartcontracts.analytics.chains.polygon'),
    56: t('smartcontracts.analytics.chains.bsc'),
    42161: t('smartcontracts.analytics.chains.arbitrum'),
  };
  return map[chainId] || t('smartcontracts.analytics.chains.unknown', { id: chainId });
}

function explorerBase(chainId) {
  const explorers = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    17000: 'https://holesky.etherscan.io',
    421614: 'https://sepolia.arbiscan.io',
    84532: 'https://sepolia.basescan.org',
    137: 'https://polygonscan.com',
    56: 'https://bscscan.com',
    42161: 'https://arbiscan.io',
  };
  return explorers[chainId] || 'https://etherscan.io';
}

function shortenHash(hash) {
  if (!hash || hash.length < 12) return hash || '';
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function formatCompactSupply(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return '0';
  const loc = locale.value === 'en' ? 'en-US' : 'ru-RU';
  if (n >= 1e6) {
    const v = (n / 1e6).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return locale.value === 'en' ? `${v} M` : `${v} млн`;
  }
  if (n >= 1e3) {
    const v = (n / 1e3).toLocaleString(loc, { maximumFractionDigits: 2 });
    return locale.value === 'en' ? `${v} K` : `${v} тыс`;
  }
  return n.toLocaleString(loc, { maximumFractionDigits: 2 });
}

async function loadInsights() {
  const gen = ++loadGen;
  const nets = insightChains.value;
  emit('loading', props.dleAddress);
  if (!props.dleAddress || !nets.length) {
    if (gen !== loadGen) return;
    columns.value = [];
    isLoading.value = false;
    emit('loaded', props.dleAddress);
    return;
  }
  isLoading.value = true;

  try {
    const tokenJobs = nets.flatMap((n) => {
      const body = { dleAddress: props.dleAddress, chainId: n.chainId };
      return [
        api.post('/dle-tokens/get-token-holders', { ...body, limit: 50 }).catch(() => null),
        api.post('/dle-tokens/get-total-supply', body).catch(() => null),
      ];
    });
    const [treasuryRes, ...tokenRes] = await Promise.all([
      api.post('/dle-modules/get-treasury-holdings', { dleAddress: props.dleAddress })
        .catch((err) => ({ error: err })),
      ...tokenJobs,
    ]);
    if (gen !== loadGen) return;

    const treasuryFail = treasuryRes?.error;
    const treasuryChains = treasuryRes?.data?.success ? (treasuryRes.data.data.chains || []) : [];

    columns.value = nets.map((n, i) => {
      const cid = n.chainId;
      let treasuryError = '';
      let treasury = [];
      if (treasuryFail) {
        const status = treasuryFail.response?.status;
        treasuryError = status === 404
          ? t('smartcontracts.analytics.treasuryBackendStale')
          : (treasuryFail.response?.data?.error || t('smartcontracts.analytics.treasuryEmpty'));
      } else {
        const row = treasuryChains.find((c) => Number(c.chainId) === cid);
        if (row) {
          treasuryError = row.error || '';
          treasury = (row.tokens || []).map((tok, iTok) => ({
            key: `${cid}-${tok.address || tok.symbol || iTok}`,
            symbol: tok.symbol,
            balanceHuman: tok.balanceHuman,
          }));
        }
      }
      const holdersRes = tokenRes[i * 2];
      const supplyRes = tokenRes[i * 2 + 1];
      return {
        chainId: cid,
        address: n.address,
        name: getChainName(cid),
        treasury,
        treasuryError,
        holders: holdersRes?.data?.success ? (holdersRes.data.data.holders || []) : [],
        supply: supplyRes?.data?.success ? (Number(supplyRes.data.data.totalSupply) || 0) : 0,
      };
    });
  } catch (error) {
    if (gen !== loadGen) return;
    console.error('[DleHubInsights] Ошибка загрузки сводки:', error);
    columns.value = nets.map((n) => ({
      chainId: n.chainId,
      address: n.address,
      name: getChainName(n.chainId),
      treasury: [],
      treasuryError: t('smartcontracts.analytics.treasuryEmpty'),
      holders: [],
      supply: 0,
    }));
  } finally {
    if (gen !== loadGen) return;
    isLoading.value = false;
    emit('loaded', props.dleAddress);
  }
}

const loadKey = computed(() => {
  const ids = insightChains.value.map((n) => n.chainId).join(',');
  return `${props.dleAddress}|${ids}`;
});

watch(loadKey, loadInsights, { immediate: true });
</script>

<style scoped>
.dle-insights,
.dle-insights__nets {
  display: contents;
}

.dle-insights__loading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 4rem;
  grid-column: 1 / -1;
  color: var(--theme-text-muted, #666);
  font-size: 0.85rem;
}

.dle-insights__panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 0.75rem 0.85rem 0.85rem;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  min-width: 0;
}

.dle-insights__title {
  margin: 0 0 0.15rem 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-dark, #1f2937);
}

.dle-insights__addr {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.45rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--color-primary, #4a7c59);
  text-decoration: none;
}

.dle-insights__addr:hover {
  text-decoration: underline;
}

.dle-insights__rings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  align-items: start;
  margin-bottom: 0.35rem;
}

.dle-insights__dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.dle-insights__dial-caption {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  text-align: center;
}

.dle-insights__sub {
  margin: auto 0 0.2rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--theme-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.dle-insights__meta {
  margin: 0 0 0.25rem;
  font-size: 0.8rem;
  color: var(--color-dark, #1f2937);
}

.dle-insights__ring-wrap {
  position: relative;
  width: 5.5rem;
  height: 5.5rem;
  flex-shrink: 0;
}

.dle-insights__ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.dle-insights__ring-track {
  fill: none;
  stroke: #e5e7eb;
  stroke-width: 3.2;
}

.dle-insights__ring-value {
  fill: none;
  stroke-width: 3.2;
  stroke-linecap: butt;
}

.dle-insights__ring-value--quorum {
  stroke: #fd7e14;
}

.dle-insights__ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-dark, #1f2937);
}

.dle-insights__ring-center--supply {
  font-size: 0.72rem;
  line-height: 1.15;
  text-align: center;
  padding: 0 0.4rem;
}

.dle-insights__muted {
  margin: 0;
  font-size: 0.78rem;
  color: var(--theme-text-muted, #666);
}

.dle-insights__tokens {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dle-insights__token {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0;
  border-bottom: 1px solid #eef0f3;
  min-width: 0;
  font-size: 0.8rem;
}

.dle-insights__token:last-child {
  border-bottom: none;
}

.dle-insights__token-symbol {
  font-weight: 600;
  color: var(--color-dark, #1f2937);
}

.dle-insights__token-bal {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary, #4a7c59);
  font-weight: 600;
}

</style>
