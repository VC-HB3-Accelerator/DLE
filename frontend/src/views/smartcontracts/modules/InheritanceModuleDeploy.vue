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
    <div class="module-deploy-page">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>🏛️ Деплой InheritanceModule</h1>
          <p>Модуль наследования токенов DLE - защита активов и автоматическая передача наследникам</p>
          <div v-if="selectedDle" class="dle-info">
            <span class="dle-name">{{ selectedDle.name }} ({{ selectedDle.symbol }})</span>
            <span class="dle-address">{{ selectedDle.dleAddress }}</span>
          </div>
        </div>
        <button class="close-btn" @click="router.push(`/management/modules?address=${route.query.address}`)">×</button>
      </div>

      <!-- Описание модуля -->
      <div class="module-description">
        <div class="description-card">
          <h3>📋 Описание InheritanceModule</h3>
          <div class="description-content">
            <p><strong>InheritanceModule</strong> - это модуль для автоматической передачи токенов DLE наследникам в случае смерти или недееспособности токенхолдера.</p>
            
            <h4>🔧 Основная функциональность:</h4>
            <ul>
              <li><strong>Назначение наследников:</strong> Токенхолдеры могут указать один или несколько наследников</li>
              <li><strong>Распределение долей:</strong> Настройка процентного распределения токенов между наследниками</li>
              <li><strong>Условия активации:</strong> Настройка условий для передачи токенов (смерть, недееспособность)</li>
              <li><strong>Временные ограничения:</strong> Установка минимального периода владения токенами</li>
              <li><strong>Множественные наследники:</strong> Поддержка сложных схем наследования</li>
              <li><strong>Отзыв и изменение:</strong> Возможность изменения наследников в любое время</li>
            </ul>

            <h4>🏛️ Юридические аспекты:</h4>
            <ul>
              <li><strong>Соответствие законам:</strong> Интеграция с юридическими системами наследования</li>
              <li><strong>Документооборот:</strong> Автоматическое создание юридических документов</li>
              <li><strong>Подтверждение смерти:</strong> Интеграция с государственными реестрами</li>
              <li><strong>Споры и оспаривание:</strong> Механизмы разрешения споров о наследстве</li>
              <li><strong>Налоговые обязательства:</strong> Автоматический расчет налогов на наследство</li>
            </ul>

            <h4>🔐 Безопасность и контроль:</h4>
            <ul>
              <li>Все изменения наследников требуют подтверждения через governance</li>
              <li>Криптографическая защита данных о наследниках</li>
              <li>Аудит всех операций наследования</li>
              <li>Возможность экстренной блокировки в случае споров</li>
              <li>Интеграция с системой идентификации для подтверждения личности</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Архитектура модуля -->
      <div class="module-architecture">
        <div class="architecture-card">
          <h3>🏗️ Архитектура InheritanceModule</h3>
          <div class="architecture-content">
            <div class="architecture-diagram">
              <div class="diagram-row">
                <div class="diagram-item tokenholder">
                  <h5>👤 Токенхолдер</h5>
                  <ul>
                    <li>Назначает наследников</li>
                    <li>Устанавливает доли</li>
                    <li>Управляет условиями</li>
                    <li>Может отозвать</li>
                  </ul>
                </div>
                <div class="diagram-arrow">→</div>
                <div class="diagram-item inheritance">
                  <h5>🏛️ InheritanceModule</h5>
                  <ul>
                    <li>Хранит данные наследников</li>
                    <li>Проверяет условия</li>
                    <li>Выполняет передачу</li>
                    <li>Ведет аудит</li>
                  </ul>
                </div>
                <div class="diagram-arrow">→</div>
                <div class="diagram-item heirs">
                  <h5>👥 Наследники</h5>
                  <ul>
                    <li>Получают токены</li>
                    <li>Подтверждают получение</li>
                    <li>Управляют наследством</li>
                    <li>Планируют налоги</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Типы наследования -->
      <div class="inheritance-types">
        <div class="types-card">
          <h3>📊 Типы наследования</h3>
          <div class="types-grid">
            <div class="type-item">
              <h4>👨‍👩‍👧‍👦 Семейное наследование</h4>
              <p>Передача токенов членам семьи согласно традиционным схемам</p>
              <ul>
                <li>Супруг/супруга (50%)</li>
                <li>Дети (равные доли)</li>
                <li>Родители (при отсутствии детей)</li>
                <li>Братья/сестры (при отсутствии родителей)</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>🏢 Корпоративное наследование</h4>
              <p>Передача токенов в рамках бизнес-структур и организаций</p>
              <ul>
                <li>Партнеры по бизнесу</li>
                <li>Ключевые сотрудники</li>
                <li>Дочерние компании</li>
                <li>Благотворительные фонды</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>🎯 Целевое наследование</h4>
              <p>Передача токенов для достижения конкретных целей</p>
              <ul>
                <li>Образовательные учреждения</li>
                <li>Исследовательские проекты</li>
                <li>Экологические инициативы</li>
                <li>Социальные программы</li>
              </ul>
            </div>
            
            <div class="type-item">
              <h4>⏰ Условное наследование</h4>
              <p>Передача токенов при выполнении определенных условий</p>
              <ul>
                <li>Достижение определенного возраста</li>
                <li>Завершение образования</li>
                <li>Создание семьи</li>
                <li>Достижение карьерных целей</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Примеры использования -->
      <div class="usage-examples">
        <div class="examples-card">
          <h3>💡 Примеры использования</h3>
          <div class="examples-content">
            <div class="example-item">
              <h4>👨‍👩‍👧‍👦 Семейное планирование</h4>
              <div class="example-code">
                <pre><code>// Назначение наследников для семьи
function setFamilyInheritance() {
    setHeir(spouse, 50);           // Супруг 50%
    setHeir(son, 25);              // Сын 25%
    setHeir(daughter, 25);         // Дочь 25%
    setActivationCondition("death");
}</code></pre>
              </div>
            </div>
            
            <div class="example-item">
              <h4>🏢 Бизнес-преемственность</h4>
              <div class="example-code">
                <pre><code>// Передача бизнеса партнеру
function setBusinessInheritance() {
    setHeir(businessPartner, 100); // Партнер 100%
    setActivationCondition("death");
    setTimeLock(365 days);         // Минимум 1 год владения
}</code></pre>
              </div>
            </div>
            
            <div class="example-item">
              <h4>🎯 Благотворительное наследование</h4>
              <div class="example-code">
                <pre><code>// Передача в благотворительный фонд
function setCharityInheritance() {
    setHeir(environmentalFund, 70); // Экологический фонд 70%
    setHeir(educationFund, 30);     // Образовательный фонд 30%
    setActivationCondition("death");
}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Юридические аспекты -->
      <div class="legal-aspects">
        <div class="legal-card">
          <h3>⚖️ Юридические аспекты</h3>
          <div class="legal-content">
            <div class="legal-section">
              <h4>📜 Соответствие законодательству</h4>
              <ul>
                <li><strong>Гражданский кодекс:</strong> Соответствие нормам наследования</li>
                <li><strong>Налоговый кодекс:</strong> Правильный расчет налогов на наследство</li>
                <li><strong>Семейный кодекс:</strong> Учет семейных обязательств</li>
                <li><strong>Международное право:</strong> Наследование в разных юрисдикциях</li>
              </ul>
            </div>
            
            <div class="legal-section">
              <h4>🔍 Процедура подтверждения</h4>
              <ul>
                <li><strong>Свидетельство о смерти:</strong> Официальное подтверждение</li>
                <li><strong>Медицинское заключение:</strong> При недееспособности</li>
                <li><strong>Судебное решение:</strong> При спорах о наследстве</li>
                <li><strong>Нотариальное заверение:</strong> Документов о наследниках</li>
              </ul>
            </div>
            
            <div class="legal-section">
              <h4>💰 Налоговые обязательства</h4>
              <ul>
                <li><strong>Налог на наследство:</strong> Автоматический расчет</li>
                <li><strong>НДФЛ:</strong> При получении токенов</li>
                <li><strong>Отчетность:</strong> Автоматическая подача деклараций</li>
                <li><strong>Льготы:</strong> Учет налоговых льгот для наследников</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Статус разработки -->
      <div class="development-status">
        <div class="status-card">
          <h3>🚧 Статус разработки</h3>
          <div class="status-content">
            <p><strong>InheritanceModule находится в стадии планирования.</strong></p>
            <p>Модуль будет включать:</p>
            <ul>
              <li>✅ Систему назначения наследников</li>
              <li>✅ Управление долями и условиями</li>
              <li>✅ Интеграцию с юридическими системами</li>
              <li>✅ Автоматическую передачу токенов</li>
              <li>✅ Налоговые расчеты</li>
              <li>✅ Аудит и мониторинг</li>
              <li>✅ Разрешение споров</li>
            </ul>
            <p><em>Модуль будет доступен в следующих обновлениях DLE.</em></p>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';
import api from '../../../api/axios';

// Props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['auth-action-completed']);

// Router
const route = useRoute();
const router = useRouter();

// Состояние
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Получаем адрес DLE из URL
const dleAddress = computed(() => route.query.address);

// Загрузка данных DLE
const loadDleData = async () => {
  if (!dleAddress.value) return;
  
  try {
    isLoadingDle.value = true;
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
    }
  } catch (error) {
    console.error('Ошибка загрузки данных DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
};

// Загружаем данные при монтировании
onMounted(() => {
  loadDleData();
});
</script>

<style scoped>
.module-deploy-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.header-content p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0 0 15px 0;
}

.dle-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.dle-name {
  font-weight: 600;
  color: var(--color-primary);
}

.dle-address {
  font-family: monospace;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-grey-dark);
  cursor: pointer;
  padding: 5px;
}

.close-btn:hover {
  color: var(--color-primary);
}

.module-description,
.module-architecture,
.inheritance-types,
.usage-examples,
.legal-aspects,
.development-status {
  margin-bottom: 30px;
}

.description-card,
.architecture-card,
.types-card,
.examples-card,
.legal-card,
.status-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.description-card h3,
.architecture-card h3,
.types-card h3,
.examples-card h3,
.legal-card h3,
.status-card h3 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
}

.description-content h4 {
  color: var(--color-grey-dark);
  margin: 20px 0 10px 0;
}

.description-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.description-content li {
  margin: 5px 0;
  line-height: 1.5;
}

/* Архитектурная диаграмма */
.architecture-diagram {
  margin: 20px 0;
}

.diagram-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.diagram-item {
  flex: 1;
  padding: 20px;
  border-radius: var(--radius-sm);
  text-align: center;
  min-height: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.diagram-item.tokenholder {
  background: #e8f5e8;
  border: 2px solid #4caf50;
}

.diagram-item.inheritance {
  background: #fff3e0;
  border: 2px solid #ff9800;
}

.diagram-item.heirs {
  background: #f3e5f5;
  border: 2px solid #9c27b0;
}

.diagram-item h5 {
  margin: 0 0 15px 0;
  font-weight: 600;
}

.diagram-item ul {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.diagram-item li {
  margin: 5px 0;
}

.diagram-arrow {
  font-size: 2rem;
  color: var(--color-primary);
  font-weight: bold;
}

/* Типы наследования */
.types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.type-item {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.type-item h4 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.type-item p {
  color: var(--color-grey-dark);
  margin: 0 0 15px 0;
  font-size: 0.9rem;
}

.type-item ul {
  margin: 0;
  padding-left: 20px;
  font-size: 0.9rem;
}

.type-item li {
  margin: 5px 0;
  color: var(--color-grey-dark);
}

/* Примеры использования */
.examples-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.example-item {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.example-item h4 {
  color: var(--color-primary);
  margin: 0 0 15px 0;
}

.example-code {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-sm);
  padding: 15px;
  overflow-x: auto;
}

.example-code pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: #333;
}

.example-code code {
  background: none;
  padding: 0;
}

/* Юридические аспекты */
.legal-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.legal-section {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.legal-section h4 {
  color: var(--color-primary);
  margin: 0 0 15px 0;
}

.legal-section ul {
  margin: 0;
  padding-left: 20px;
}

.legal-section li {
  margin: 8px 0;
  line-height: 1.5;
  color: var(--color-grey-dark);
}

/* Статус разработки */
.status-content {
  background: white;
  padding: 20px;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.status-content p {
  margin: 0 0 15px 0;
  line-height: 1.6;
}

.status-content ul {
  margin: 15px 0;
  padding-left: 20px;
}

.status-content li {
  margin: 5px 0;
  color: var(--color-grey-dark);
}

.status-content em {
  color: var(--color-primary);
  font-style: italic;
}

@media (max-width: 768px) {
  .diagram-row {
    flex-direction: column;
    gap: 15px;
  }
  
  .diagram-arrow {
    transform: rotate(90deg);
  }
  
  .types-grid {
    grid-template-columns: 1fr;
  }
  
  .legal-content {
    grid-template-columns: 1fr;
  }
  
  .dle-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>
