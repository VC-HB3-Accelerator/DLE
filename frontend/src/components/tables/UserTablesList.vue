<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="tables-container">
    <header class="tables-header">
      <button type="button" class="btn btn-primary" @click="createTable">{{ t('tables.common.createTable') }}</button>
    </header>
    <ul class="tables-list-simple">
      <li v-for="table in tables" :key="table.id">
        <button type="button" class="table-link" @click="selectTable(table)">{{ table.name }}</button>
      </li>
      <li v-if="!tables.length" class="empty-state">
        <span>{{ t('tables.list.empty') }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import tablesService from '../../services/tablesService';

const { t } = useI18n();
const router = useRouter();

const tables = ref([]);

async function fetchTables() {
  tables.value = await tablesService.getTables();
}
onMounted(fetchTables);

function selectTable(table) {
  router.push({ name: 'user-table-view', params: { id: table.id } });
}
function createTable() {
  router.push({ name: 'create-table' });
}
</script>

<style scoped>
.tables-container {
  margin-top: var(--spacing-lg);
  max-width: 100%;
  box-sizing: border-box;
}

.tables-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.tables-list-simple {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tables-list-simple li {
  margin-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--theme-border);
  padding-bottom: var(--spacing-sm);
}

.tables-list-simple li:last-child {
  border-bottom: none;
}

.table-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  padding: var(--spacing-xs) 0;
  transition: color var(--transition-fast), background var(--transition-fast);
  width: 100%;
  display: block;
  border-radius: var(--radius-md);
}

.table-link:hover {
  color: var(--color-primary-dark);
  background: var(--theme-surface);
  text-decoration: none;
}

.empty-state {
  text-align: center;
  color: var(--theme-text-muted);
  margin: var(--spacing-xl) 0;
  font-size: var(--font-size-lg);
}

@media (max-width: 768px) {
  .tables-header {
    justify-content: stretch;
  }

  .tables-header .btn {
    width: 100%;
  }
}
</style>
