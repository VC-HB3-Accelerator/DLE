<template>
  <div class="interface-settings settings-panel" style="position:relative;min-height:120px">
    <button class="close-btn" @click="goBack">×</button>
    <h2>Подключить домен</h2>
    <div class="domain-connect-block">
      <p>Для подключения домена и настройки Cloudflare нажмите кнопку ниже.</p>
      <button class="btn-primary" @click="goToCloudflareDetails">Подробнее</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
const router = useRouter();
const goBack = () => router.push('/settings');
const goToCloudflareDetails = () => router.push('/settings/interface/cloudflare-details');
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}
h2 {
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--color-grey-light);
  padding-bottom: var(--spacing-md);
}
.domain-connect-block {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
}
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.btn-primary:hover {
  background: var(--color-primary-dark);
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}
.close-btn:hover {
  color: #333;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style> 