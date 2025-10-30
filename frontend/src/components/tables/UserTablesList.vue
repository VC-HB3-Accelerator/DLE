<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
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
      <button class="create-btn" @click="createTable">Создать таблицу</button>
    </header>
    <ul class="tables-list-simple">
      <!-- Системная таблица tags -->
      <li>
        <!-- <button class="table-link" @click="goToTagsTable">Теги (tags)</button> -->
      </li>
      <!-- Пользовательские таблицы -->
      <li v-for="table in tables" :key="table.id">
        <button class="table-link" @click="selectTable(table)">{{ table.name }}</button>
      </li>
      <li v-if="!tables.length" class="empty-state">
        <span>Нет таблиц. Создайте первую!</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import tablesService from '../../services/tablesService';

const router = useRouter();
const route = useRoute();

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
  /* max-width: 600px; */
  /* margin: 2rem auto; */
  margin-top: 2rem;
  margin-left: 0;
  padding: 2rem 1.5rem 2rem 1.5rem;
  /* background: #fff; */
  /* border-radius: 18px; */
  /* box-shadow: 0 2px 16px rgba(0,0,0,0.07); */
}
.tables-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1.5rem;
}
.create-btn {
  background: #2ecc40;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.5em 1.2em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.create-btn:hover {
  background: #27ae38;
}
.tables-list-simple {
  list-style: none;
  padding: 0;
  margin: 0;
}
.tables-list-simple li {
  margin-bottom: 0.5em;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.5em;
}
.tables-list-simple li:last-child {
  border-bottom: none;
}
.table-link {
  background: none;
  border: none;
  color: #2ecc40;
  font-size: 1.1em;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  padding: 0.2em 0;
  transition: color 0.2s, background 0.2s;
  width: 100%;
  display: block;
  border-radius: 6px;
}
.table-link:hover {
  color: #138496;
  background: #f5f7fa;
  text-decoration: none;
}
.empty-state {
  text-align: center;
  color: #aaa;
  margin: 2em 0;
  font-size: 1.1em;
}
</style> 