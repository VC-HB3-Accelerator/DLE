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
  <BaseLayout>
    <div class="list-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Настройки контента</h1>
          <p>Юр. реквизиты и параметры подстановки переменных</p>
        </div>
      </div>
      <div class="content-block">
        <div class="section-header">
          <h2>Юр. реквизиты (переменные)</h2>
        </div>
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-cog"></i></div>
          <h3>Скоро здесь появится настройка переменных</h3>
          <p>Редактор сможет заполнить реквизиты для подстановки во все шаблоны</p>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '../../components/BaseLayout.vue';
</script>

<style scoped>
.list-page { padding: 20px; width: 100%; }
.page-header { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0; }
.header-content h1 { color: var(--color-primary); font-size: 2.2rem; margin: 0 0 8px 0; }
.header-content p { color: var(--color-grey-dark); margin: 0; }
.content-block { background: #f8f9fa; border-radius: var(--radius-lg); padding: 25px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.section-header { display:flex; justify-content: space-between; align-items:center; margin-bottom: 20px; }
.section-header h2 { color: var(--color-primary); margin: 0; }
.empty-state { text-align:center; padding: 60px 20px; }
.empty-icon { font-size: 3rem; color: var(--color-grey-dark); margin-bottom: 10px; }
</style> 