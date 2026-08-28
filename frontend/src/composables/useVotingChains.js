/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import { computed, onMounted, ref, unref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getAllModules, getNetworksInfo } from '@/services/modulesService.js';

export function buildHubQuery(dleAddress, votingChain, extra = {}) {
  const query = { ...extra };
  const addr = String(dleAddress || '').trim();
  if (addr) query.address = addr;
  const cid = Number(votingChain);
  if (Number.isFinite(cid) && cid > 0) query.votingChain = String(cid);
  return query;
}

export function useVotingChains(dleAddressSource) {
  const route = useRoute();
  const chains = ref([]);
  const isLoading = ref(false);
  const votingChain = ref(0);

  function applyQueryPrefill() {
    if (Number(votingChain.value) > 0) return;
    const q = Number(route.query.votingChain || route.query.chainId);
    if (Number.isFinite(q) && q > 0 && chains.value.some((c) => Number(c.chainId) === q)) {
      votingChain.value = q;
    }
  }

  async function loadVotingChains() {
    const addr = String(unref(dleAddressSource) || '').trim();
    if (!addr) {
      chains.value = [];
      return;
    }
    isLoading.value = true;
    try {
      const response = await getNetworksInfo(addr);
      let nets = response?.data?.networks || response?.networks || [];
      if (!nets.length) {
        const mods = await getAllModules(addr);
        nets = mods?.data?.supportedNetworks || [];
      }
      chains.value = nets
        .map((n) => ({
          chainId: Number(n.chainId),
          name: n.networkName || n.name || `Chain ${n.chainId}`,
        }))
        .filter((n) => Number.isFinite(n.chainId) && n.chainId > 0);
      applyQueryPrefill();
    } catch (e) {
      console.error('[useVotingChains]', e);
      chains.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(loadVotingChains);
  watch(() => unref(dleAddressSource), loadVotingChains);
  watch(() => [route.query.votingChain, route.query.chainId], applyQueryPrefill);

  const hasVotingChain = computed(() => Number(votingChain.value) > 0);

  function hubQuery(extra = {}) {
    return buildHubQuery(unref(dleAddressSource), votingChain.value, extra);
  }

  return { chains, votingChain, isLoading, hasVotingChain, loadVotingChains, hubQuery };
}
