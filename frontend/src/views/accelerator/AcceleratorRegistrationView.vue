<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="accelerator-registration-container">
      <div class="page-header">
        <h1>Программы акселератора HB3</h1>
        <p class="page-description">
          Выберите подходящую программу для развития вашего бизнеса
        </p>
      </div>

      <div class="program-selection">
        <div class="form-section">
          <h2>Выберите вид деятельности</h2>
          <div class="form-group">
            <label for="activityType">Вид деятельности *</label>
            <select 
              id="activityType"
              v-model="selectedActivity" 
              @change="onActivityChange"
              class="form-select"
            >
              <option value="">Выберите вид деятельности</option>
              <option value="fintech">Финансовые технологии (FinTech)</option>
              <option value="blockchain">Блокчейн и Web3</option>
              <option value="ai">Искусственный интеллект</option>
              <option value="ecommerce">Электронная коммерция</option>
              <option value="healthtech">Медицинские технологии</option>
              <option value="edtech">Образовательные технологии</option>
              <option value="realestate">Недвижимость и PropTech</option>
              <option value="logistics">Логистика и транспорт</option>
              <option value="greentech">Зеленые технологии</option>
              <option value="agritech">Агротехнологии</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <!-- Кнопка подключиться появляется при выборе деятельности -->
          <div v-if="selectedActivity" class="connect-section">
            <div class="selected-activity-info">
              <h3>{{ getActivityInfo(selectedActivity).title }}</h3>
              <p>{{ getActivityInfo(selectedActivity).description }}</p>
            </div>
            <button 
              @click="goToProgramDescription" 
              class="btn btn-primary btn-connect"
            >
              Подключиться
            </button>
          </div>
        </div>

        <!-- Кнопка назад -->
        <div class="form-actions">
          <button 
            @click="goBack" 
            class="btn btn-secondary"
          >
            Назад к CRM
          </button>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const selectedActivity = ref('');

// Информация о видах деятельности
const activityInfo = {
  fintech: {
    title: 'Финансовые технологии (FinTech)',
    description: 'Развитие инновационных решений в сфере финансовых услуг, платежных систем и банкинга.'
  },
  blockchain: {
    title: 'Блокчейн и Web3',
    description: 'Создание децентрализованных приложений, смарт-контрактов и Web3 решений.'
  },
  ai: {
    title: 'Искусственный интеллект',
    description: 'Разработка AI-решений, машинного обучения и автоматизации бизнес-процессов.'
  },
  ecommerce: {
    title: 'Электронная коммерция',
    description: 'Создание и развитие онлайн-магазинов, маркетплейсов и платформ для продаж.'
  },
  healthtech: {
    title: 'Медицинские технологии',
    description: 'Инновационные решения в сфере здравоохранения, телемедицины и биотехнологий.'
  },
  edtech: {
    title: 'Образовательные технологии',
    description: 'Разработка платформ для онлайн-обучения, образовательных приложений и EdTech решений.'
  },
  realestate: {
    title: 'Недвижимость и PropTech',
    description: 'Инновации в сфере недвижимости, платформы для аренды и продажи недвижимости.'
  },
  logistics: {
    title: 'Логистика и транспорт',
    description: 'Оптимизация цепей поставок, транспортных маршрутов и логистических процессов.'
  },
  greentech: {
    title: 'Зеленые технологии',
    description: 'Решения для экологии, возобновляемой энергетики и устойчивого развития.'
  },
  agritech: {
    title: 'Агротехнологии',
    description: 'Инновации в сельском хозяйстве, точное земледелие и агротехнические решения.'
  },
  other: {
    title: 'Другое',
    description: 'Инновационные проекты в других сферах деятельности.'
  }
};

// Обработка изменения выбранной деятельности
const onActivityChange = () => {
  console.log('Выбрана деятельность:', selectedActivity.value);
};

// Получение информации о выбранной деятельности
const getActivityInfo = (activity) => {
  return activityInfo[activity] || { title: 'Неизвестная деятельность', description: '' };
};

// Переход к описанию программы
const goToProgramDescription = () => {
  router.push({ 
    name: 'accelerator-program-description', 
    params: { activity: selectedActivity.value } 
  });
};

// Навигация назад
const goBack = () => {
  router.push({ name: 'crm' });
};
</script>

<style scoped>
.accelerator-registration-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--color-light);
}

.page-header h1 {
  color: var(--color-dark);
  margin-bottom: 10px;
  font-size: 2rem;
  font-weight: 600;
}

.page-description {
  color: var(--color-text-secondary);
  font-size: 1.1rem;
  margin: 0;
}

.program-selection {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.form-section {
  background: #f8fafc;
  padding: 24px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.form-section h2 {
  color: var(--color-dark);
  margin: 0 0 20px 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-dark);
  font-weight: 500;
  font-size: 0.9rem;
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: white;
  cursor: pointer;
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.connect-section {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 2px solid var(--color-primary);
  text-align: center;
}

.selected-activity-info h3 {
  color: var(--color-dark);
  margin: 0 0 10px 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.selected-activity-info p {
  color: var(--color-text-secondary);
  margin: 0 0 20px 0;
  font-size: 1rem;
  line-height: 1.5;
}

.btn-connect {
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 600;
  min-width: 200px;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-start;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
  text-align: center;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .accelerator-registration-container {
    margin: 10px;
    padding: 15px;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
  
  .btn-connect {
    width: 100%;
    min-width: auto;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
  
  .page-description {
    font-size: 1rem;
  }
  
  .connect-section {
    padding: 15px;
  }
}
</style>
