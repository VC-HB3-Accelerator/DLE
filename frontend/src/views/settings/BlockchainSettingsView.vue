<template>
  <div class="blockchain-settings settings-panel" style="position:relative">
    <button class="close-btn" @click="goBack">×</button>
    
    <!-- Панель Создать новое DLE (Digital Legal Entity) -->
    <div class="sub-settings-panel">
      <h3>Создать новое DLE (Digital Legal Entity)</h3>
      <div class="setting-form">
        <p>Настройка и деплой нового DLE (Digital Legal Entity) с токеном управления и контрактом Governor.</p>
        
        <!-- 1. Имя DLE -->
        <div class="form-group">
          <label class="form-label" for="dleName">Имя DLE (Digital Legal Entity) (и токена):</label>
          <input type="text" id="dleName" v-model="dleDeploymentSettings.name" class="form-control" placeholder="Например, My DLE">
        </div>

        <!-- 2. Символ токена -->
        <div class="form-group">
          <label class="form-label" for="dleSymbol">Символ токена управления (GT):</label>
          <input type="text" id="dleSymbol" v-model="dleDeploymentSettings.symbol" class="form-control" placeholder="Например, MDGT (3-5 символов)">
        </div>

        <!-- 3. Местонахождение -->
        <h4>Местонахождение</h4>
        <div class="address-grid">
            <div class="form-group address-index">
                <label class="form-label" for="locIndex">Индекс:</label>
                <div class="input-group">
                    <input type="text" id="locIndex" v-model="dleDeploymentSettings.locationIndex" @input="checkIndexInput" class="form-control">
                    <button class="btn btn-outline-secondary btn-sm" type="button" @click="fetchAddressByZipcode" :disabled="isFetchingByZipcode || !dleDeploymentSettings.locationIndex">
                        <i class="fas fa-search"></i> {{ isFetchingByZipcode ? 'Поиск...' : 'Найти по индексу' }}
                    </button>
                </div>
            </div>

            <template v-if="addressFieldsVisible">
                 <div class="form-group address-country">
                     <label class="form-label" for="locCountry">Страна:</label>
                     <input type="text" id="locCountry" v-model="dleDeploymentSettings.locationCountry" class="form-control">
                 </div>
                <div class="form-group address-city">
                     <label class="form-label" for="locCity">Населенный пункт:</label>
                     <input type="text" id="locCity" v-model="dleDeploymentSettings.locationCity" class="form-control">
                 </div>
                 <div class="form-group address-street">
                     <label class="form-label" for="locStreet">Улица:</label>
                     <input type="text" id="locStreet" v-model="dleDeploymentSettings.locationStreet" class="form-control">
                 </div>
                  <div class="form-group address-house">
                     <label class="form-label" for="locHouse">Дом:</label>
                     <input type="text" id="locHouse" v-model="dleDeploymentSettings.locationHouse" class="form-control">
                 </div>
                 <div class="form-group address-office">
                      <label class="form-label" for="locOffice">Офис/Кв.:</label>
                      <input type="text" id="locOffice" v-model="dleDeploymentSettings.locationOffice" class="form-control">
                 </div>
            </template>
        </div>
        
        <div class="address-verification-section" v-if="addressFieldsVisible">
          <button @click="verifyAddress" :disabled="isAddressVerifying" class="btn btn-info btn-sm">
            <i class="fas fa-search-location"></i> {{ isAddressVerifying ? 'Проверка адреса...' : 'Проверить адрес' }}
          </button>
          <div v-if="addressVerificationResult" class="verification-status alert mt-2">
            <p v-if="addressVerificationResult === 'verified_exact'" class="alert-success">✓ Адрес подтвержден (точный).</p>
            <p v-if="addressVerificationResult === 'verified_street'" class="alert-success">✓ Адрес подтвержден (улица найдена).</p>
            <p v-if="addressVerificationResult === 'verified_city'" class="alert-success">✓ Адрес подтвержден (город найден).</p>
            <p v-if="addressVerificationResult === 'verified_ambiguous'" class="alert-warning">⚠ Адрес найден, но требует уточнения.</p>
            <p v-if="addressVerificationResult === 'not_found'" class="alert-danger">✗ Адрес не найден.</p>
            <p v-if="addressVerificationResult === 'ambiguous'" class="alert-warning">⚠ Найденный адрес не полностью совпадает с введенным. Уточните запрос.</p>
            <p v-if="addressVerificationResult === 'error'" class="alert-danger">✗ Ошибка при проверке адреса.</p>
            
            <details v-if="verifiedAddressDetails" class="mt-2">
              <summary>Детали от Nominatim</summary>
              <pre class="code-block">{{ JSON.stringify(verifiedAddressDetails, null, 2) }}</pre>
            </details>
      </div>
    </div>
    
        <!-- 4. Код деятельности -->
        <h4>Код деятельности</h4>
        <div v-if="dleDeploymentSettings.selectedIsicCodes && dleDeploymentSettings.selectedIsicCodes.length > 0" class="isic-codes-list mt-3">
          <h5>Добавленные коды деятельности:</h5>
          <ul>
            <li v-for="(isic, index) in dleDeploymentSettings.selectedIsicCodes" :key="index" class="d-flex justify-content-between align-items-center mb-1">
              <span>{{ isic.text }} ({{ isic.code }})</span>
              <button @click="removeIsicCode(index)" class="btn btn-danger btn-xs">Удалить</button>
            </li>
          </ul>
        </div>

        <div class="form-group">
          <label class="form-label" for="isicSection">Выберите код деятельности:</label>
          <select id="isicSection" v-model="selectedSection" class="form-control" :disabled="isLoadingSections">
              <option value="">-- {{ isLoadingSections ? 'Загрузка секций...' : 'Выберите секцию' }} --</option>
              <option v-for="option in sectionOptions" :key="option.value" :value="option.value">
                  {{ option.text }}
              </option>
          </select>
        </div>

        <div class="form-group" v-if="selectedSection">
           <label class="form-label" for="isicDivision">Раздел:</label>
           <select id="isicDivision" v-model="selectedDivision" class="form-control" :disabled="isLoadingDivisions">
               <option value="">-- {{ isLoadingDivisions ? 'Загрузка разделов...' : 'Выберите раздел' }} --</option>
               <option v-for="option in divisionOptions" :key="option.value" :value="option.value">
                   {{ option.text }}
               </option>
           </select>
        </div>

        <div class="form-group" v-if="selectedDivision">
           <label class="form-label" for="isicGroup">Группа:</label>
           <select id="isicGroup" v-model="selectedGroup" class="form-control" :disabled="isLoadingGroups">
               <option value="">-- {{ isLoadingGroups ? 'Загрузка групп...' : 'Выберите группу' }} --</option>
               <option v-for="option in groupOptions" :key="option.value" :value="option.value">
                   {{ option.text }}
               </option>
           </select>
        </div>

        <div class="form-group" v-if="selectedGroup">
           <label class="form-label" for="isicClass">Класс:</label>
           <select id="isicClass" v-model="selectedClass" class="form-control" :disabled="isLoadingClasses">
               <option value="">-- {{ isLoadingClasses ? 'Загрузка классов...' : 'Выберите класс' }} --</option>
               <option v-for="option in classOptions" :key="option.value" :value="option.value">
                   {{ option.text }}
               </option>
           </select>
        </div>

        <div v-if="currentSelectedIsicText" class="current-isic-selection">
          <p><strong>Выбранный код:</strong> {{ currentSelectedIsicText }}</p>
          <button @click="addIsicCode" class="btn btn-success btn-sm" :disabled="!currentSelectedIsicCode">Добавить код деятельности</button>
        </div>

        <!-- 5. Первоначальное распределение токенов -->
        <h4>Первоначальное распределение токенов управления</h4>
        <div v-for="(partner, index) in dleDeploymentSettings.partners" :key="index" class="partner-entry">
          <div class="form-group">
            <label class="form-label">Адрес партнера {{ index + 1 }}:</label>
            <input type="text" v-model="partner.address" class="form-control" placeholder="0x...">
          </div>
          <div class="form-group">
            <label class="form-label">Сумма GT для партнера {{ index + 1 }}:</label>
            <input type="number" v-model="partner.amount" min="1" class="form-control">
          </div>
          <button class="btn btn-danger btn-sm" @click="removePartner(index)" :disabled="!isAdmin">Удалить партнера</button>
        </div>
        <button class="btn btn-secondary" @click="addPartner" :disabled="!isAdmin">Добавить партнера</button>
        <div class="form-group">
          <label class="form-label">Общее количество выпускаемых GT: {{ totalInitialSupply }}</label>
        </div>

        <!-- 6. Настройки Governor -->
        <h4>Настройки Governor</h4>
        <div class="form-group">
          <label class="form-label" for="proposalThreshold">Порог для создания предложений (кол-во GT):</label>
          <input type="number" id="proposalThreshold" v-model="dleDeploymentSettings.proposalThreshold" min="0" class="form-control">
        </div>

        <div class="form-group">
          <label class="form-label" for="quorumPercentGovernor">Кворум (% от общего числа голосов):</label>
          <input type="number" id="quorumPercentGovernor" v-model="dleDeploymentSettings.quorumPercent" min="1" max="100" class="form-control">
        </div>
        
        <div class="form-group">
          <label class="form-label" for="votingDelay">Задержка перед голосованием (в днях):</label>
          <input type="number" id="votingDelay" v-model="dleDeploymentSettings.votingDelayDays" min="0" class="form-control">
      </div>

        <div class="form-group">
          <label class="form-label" for="votingPeriod">Период голосования (в днях):</label>
          <input type="number" id="votingPeriod" v-model="dleDeploymentSettings.votingPeriodDays" min="1" class="form-control">
    </div>
    
        <div class="form-group">
          <label class="form-label" for="timelockMinDelay">Минимальная задержка Timelock (в днях):</label>
          <input type="number" id="timelockMinDelay" v-model="dleDeploymentSettings.timelockMinDelayDays" min="0" class="form-control">
        </div>

        <!-- 7. RPC Провайдеры -->
        <h4>RPC Провайдеры</h4>
        <p>Конфигурации RPC для сетей, которые будут использоваться в приложении.</p>
        
        <!-- Список добавленных RPC -->
        <div v-if="securitySettings.rpcConfigs.length > 0" class="rpc-list">
            <h5>Добавленные RPC конфигурации:</h5>
            <div v-for="(rpc, index) in securitySettings.rpcConfigs" :key="index" class="rpc-entry">
                <span><strong>ID Сети:</strong> {{ rpc.networkId }}</span>
                <span><strong>URL:</strong> {{ rpc.rpcUrlDisplay || rpc.rpcUrl }}</span>
                <div class="rpc-actions">
                  <button class="btn btn-info btn-sm" @click="testRpcHandler(rpc)" :disabled="testingRpc && testingRpcId === rpc.networkId">
                    <i class="fas" :class="testingRpc && testingRpcId === rpc.networkId ? 'fa-spinner fa-spin' : 'fa-check-circle'"></i>
                    {{ testingRpc && testingRpcId === rpc.networkId ? 'Проверка...' : 'Тест' }}
                  </button>
                  <button 
                    class="btn btn-sm" 
                    :class="isAdmin ? 'btn-danger' : 'btn-secondary'" 
                    @click="isAdmin ? removeRpcConfig(index) : null"
                    :disabled="!isAdmin"
                  >
                    <i class="fas fa-trash"></i> Удалить
                  </button>
                </div>
            </div>
        </div>
        <p v-else>Нет добавленных RPC конфигураций.</p>

        <!-- Форма добавления нового RPC -->
        <div class="setting-form add-rpc-form">
            <h5>Добавить новую RPC конфигурацию:</h5>
            <div class="form-group">
                <label class="form-label" for="newRpcNetworkId">ID Сети:</label>
                <select id="newRpcNetworkId" v-model="networkEntry.networkId" class="form-control">
                    <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
                        <option v-for="option in group.options" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </optgroup>
                </select>
                <div v-if="networkEntry.networkId === 'custom'" class="mt-2">
                    <label class="form-label" for="customNetworkId">Пользовательский ID:</label>
                    <input type="text" id="customNetworkId" v-model="networkEntry.customNetworkId" class="form-control" placeholder="Введите ID сети">
                    
                    <label class="form-label mt-2" for="customChainId">Chain ID:</label>
                    <input type="number" id="customChainId" v-model="networkEntry.customChainId" class="form-control" placeholder="Например, 1 для Ethereum">
                    <small>Chain ID - уникальный идентификатор блокчейн-сети (целое число)</small>
                </div>
                <small>ID сети должен совпадать со значением в выпадающем списке сетей при создании DLE</small>
            </div>
            <div class="form-group">
                <label class="form-label" for="newRpcUrl">RPC URL:</label>
                <input type="text" id="newRpcUrl" v-model="networkEntry.rpcUrl" class="form-control" placeholder="https://...">
                <!-- Предложение URL на основе выбранной сети -->
                <small v-if="defaultRpcUrlSuggestion" class="suggestion">
                    Предложение: {{ defaultRpcUrlSuggestion }}
                    <button class="btn-link" @click="useDefaultRpcUrl">Использовать</button>
                </small>
            </div>
            <button class="btn btn-secondary" @click="addRpcConfig" :disabled="!isAdmin">Добавить RPC</button>
        </div>

        <!-- 8. Выбор сети для деплоя -->
        <h4>Сеть для деплоя</h4>
        <div class="form-group">
          <label class="form-label" for="deployNetwork">Выберите сеть блокчейн для деплоя:</label>
          <select id="deployNetwork" v-model="dleDeploymentSettings.blockchainNetwork" class="form-control">
            <option v-if="loadingNetworks" disabled>Загрузка сетей...</option>
            <option v-for="network in networks" :key="network.value" :value="network.value">
              {{ network.label }}
            </option>
          </select>
          <small class="text-warning" v-if="!dleDeploymentSettings.blockchainNetwork.includes('testnet') && 
              !['sepolia', 'goerli', 'mumbai'].includes(dleDeploymentSettings.blockchainNetwork)">
            <i class="fas fa-exclamation-triangle"></i> 
            Внимание! Для тестирования рекомендуется использовать тестовые сети (Sepolia, Goerli, Mumbai).
          </small>
        </div>

        <!-- 9. Ключ Деплоера -->
        <h4>Ключ Деплоера</h4>
        <div class="form-group">
            <label class="form-label" for="deployerKey">Приватный ключ для деплоя:</label>
            <div class="input-group">
                <input :type="showDeployerKey ? 'text' : 'password'" id="deployerKey" v-model="securitySettings.deployerPrivateKey" class="form-control">
                <button class="btn btn-outline-secondary" @click="toggleShowDeployerKey">
                    <i :class="showDeployerKey ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
            </div>
        </div>
        
        <!-- 10. Газовые настройки -->
        <div class="form-group">
          <h4>Газовые настройки</h4>
          <div class="custom-control custom-checkbox">
            <input type="checkbox" class="custom-control-input" id="customGas" v-model="useCustomGas">
            <label class="custom-control-label" for="customGas">Использовать пользовательские настройки газа</label>
          </div>
          
          <div v-if="useCustomGas" class="gas-settings mt-3">
            <div class="form-group">
              <label for="gasLimit">Лимит газа (Gas Limit):</label>
              <input type="number" id="gasLimit" v-model="gasSettings.gasLimit" class="form-control">
            </div>
            <div class="form-group">
              <label for="maxFeePerGas">Максимальная комиссия (Max Fee, gwei):</label>
              <input type="number" id="maxFeePerGas" v-model="gasSettings.maxFeePerGas" class="form-control">
            </div>
            <div class="form-group">
              <label for="maxPriorityFee">Приоритетная комиссия (Priority Fee, gwei):</label>
              <input type="number" id="maxPriorityFee" v-model="gasSettings.maxPriorityFee" class="form-control">
            </div>
          </div>
        </div>

        <!-- 10. Кнопка деплоя DLE -->
        <div class="deployment-actions mt-4">
          <button class="btn btn-primary" @click="deployDLE" :disabled="!isAdmin || isDeploying">
            <i class="fas fa-rocket"></i> {{ isDeploying ? 'Создание DLE...' : 'Создать и задеплоить DLE (Digital Legal Entity)' }}
          </button>
          
          <!-- Результат деплоя -->
          <div v-if="deployResult" class="deploy-result mt-3 alert alert-success">
            <h5>DLE успешно создано!</h5>
            <p><strong>Адрес токена:</strong> {{ deployResult.data?.tokenAddress }}</p>
            <p><strong>Адрес таймлока:</strong> {{ deployResult.data?.timelockAddress }}</p>
            <p><strong>Адрес контракта Governor:</strong> {{ deployResult.data?.governorAddress }}</p>
          </div>
          
          <!-- Ошибка деплоя -->
          <div v-if="deployError" class="deploy-error mt-3 alert alert-danger">
            <h5>Ошибка при создании DLE</h5>
            <p>{{ deployError }}</p>
          </div>
        </div>
      </div>
    </div>

  </div>
  
  <!-- Модальное окно для результатов тестирования RPC -->
  <RpcTestModal 
    :show="showRpcTestModal" 
    :result="rpcTestResult" 
    @close="closeRpcTestModal" 
  />
</template>

<script setup>
import { reactive, onMounted, computed, ref, watch } from 'vue';
import axios from 'axios'; // Предполагаем, что axios доступен
import { useAuthContext } from '@/composables/useAuth'; // Импортируем composable useAuth
import dleService from '@/services/dleService';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks'; // Импортируем composable для работы с сетями
import { useRouter } from 'vue-router';
import RpcTestModal from '@/components/RpcTestModal.vue';
// TODO: Импортировать API

const { address, isAdmin, auth, user } = useAuthContext(); // Получаем объект адреса и статус админа

// Инициализация composable для работы с сетями блокчейн
const { 
  networkGroups, 
  networkEntry, 
  defaultRpcUrlSuggestion, 
  useDefaultRpcUrl,
  validateAndPrepareNetworkConfig,
  resetNetworkEntry,
  testRpcConnection,
  testingRpc,
  testingRpcId,
  networks,
  fetchNetworks,
  loadingNetworks
} = useBlockchainNetworks();

const router = useRouter();

// Добавляем настройки безопасности и подключения
const securitySettings = reactive({
  rpcConfigs: [], // Массив для хранения { networkId: string, rpcUrl: string, chainId: number }
  deployerPrivateKey: '', 
});

// Функция добавления новой RPC конфигурации
const addRpcConfig = () => {
  const result = validateAndPrepareNetworkConfig();
  
  if (!result.valid) {
    alert(result.error);
    return;
  }
  
  const { networkId, rpcUrl, chainId } = result.networkConfig;
  
  // Проверка на дубликат ID
  if (securitySettings.rpcConfigs.some(rpc => rpc.networkId === networkId)) {
    alert(`Ошибка: RPC конфигурация для сети с ID '${networkId}' уже существует.`);
    return;
  }
  
  securitySettings.rpcConfigs.push({ networkId, rpcUrl, chainId });
  
  // Очистка полей ввода
  resetNetworkEntry();
};

// Функция удаления RPC конфигурации
const removeRpcConfig = (index) => {
  securitySettings.rpcConfigs.splice(index, 1);
};

const settings = reactive({
  // contractAddress: '', // Удалено
  // quorumPercent: 51, // Удалено
  // rwaEnabled: false // Удалено
});

const dleDeploymentSettings = reactive({
  name: '',
  symbol: '',
  partners: [{ address: '', amount: 1 }], // Начинаем с одного партнера для примера
  proposalThreshold: 0, // Голосов для создания предложения
  quorumPercent: 4, // Процент для кворума Governor
  votingDelayDays: 1, // в днях
  votingPeriodDays: 7, // в днях
  timelockMinDelayDays: 2, // в днях
  blockchainNetwork: 'polygon', // Значение по умолчанию
  locationIndex: '',
  locationCountry: '',
  locationCity: '',
  locationStreet: '',
  locationHouse: '',
  locationOffice: '',
  selectedIsicCodes: [], // <<< Для хранения массива выбранных кодов ISIC
});

// Добавляем переменную useCustomGas для управления отображением пользовательских настроек газа
const useCustomGas = ref(false);

// Объявляем gasSettings как ref для корректного реактивного доступа в шаблоне
const gasSettings = reactive({
  gasLimit: 3000000,
  maxFeePerGas: 30,
  maxPriorityFee: 2
});

// --- Состояние для загрузки и опций ISIC ---
const sectionOptions = ref([]);
const divisionOptions = ref([]);
const groupOptions = ref([]);
const classOptions = ref([]);
const isLoadingSections = ref(false);
const isLoadingDivisions = ref(false);
const isLoadingGroups = ref(false);
const isLoadingClasses = ref(false);

// --- Состояние для проверки адреса Nominatim ---
const isAddressVerifying = ref(false);
const addressVerificationResult = ref(null); // null, 'verified_exact', 'verified_street', 'verified_city', 'verified_ambiguous', 'not_found', 'ambiguous', 'error'
const verifiedAddressDetails = ref(null);
const isFetchingByZipcode = ref(false);
const addressFieldsVisible = ref(false);

// --- Состояние для выбранных значений на каждом уровне ISIC --- 
const selectedSection = ref('');
const selectedDivision = ref('');
const selectedGroup = ref('');
const selectedClass = ref('');

// --- Для хранения текущего самого детализированного выбора ISIC до добавления в список ---
const currentSelectedIsicCode = ref('');
const currentSelectedIsicText = ref('');

// --- Отслеживание изменения страны --- 
watch(() => dleDeploymentSettings.locationCountry, (newCountry, oldCountry) => {
  if (newCountry !== oldCountry) {
    console.log(`[BlockchainSettingsView] Страна изменена на: ${newCountry}. Очистка кодов деятельности.`);
    selectedSection.value = ''; // Это вызовет каскадную очистку и сброс currentSelectedIsicCode
    dleDeploymentSettings.selectedIsicCodes = []; // Очищаем также список уже добавленных кодов
    fetchIsicCodes({ level: 1 }, sectionOptions, isLoadingSections);
  }
});

// --- Функция для загрузки кодов ISIC из API ---
const fetchIsicCodes = async (params = {}, optionsRef, loadingRef) => {
  if (!optionsRef || !loadingRef) {
      console.error('[BlockchainSettingsView] fetchIsicCodes requires optionsRef and loadingRef');
      return;
  }
  loadingRef.value = true;
  optionsRef.value = []; // Очищаем перед загрузкой
  try {
    const queryParams = new URLSearchParams(params).toString();
    console.debug(`[BlockchainSettingsView] Fetching ISIC codes with params: ${queryParams}`);
    
    // Убедитесь, что базовый URL настроен правильно (например, через axios interceptors или .env)
    const response = await axios.get(`/api/isic/codes?${queryParams}`); 
    
    if (response.data && Array.isArray(response.data.codes)) {
       optionsRef.value = response.data.codes.map(code => ({
           value: code.code,
           // Отображаем код и описание для ясности
           text: `${code.code} - ${code.description}` 
       }));
       console.debug(`[BlockchainSettingsView] Loaded ISIC codes for level ${params.level || ('parent: '+params.parent_code)}, count:`, optionsRef.value.length);
    } else {
        console.error('[BlockchainSettingsView] Invalid response structure for ISIC codes:', response.data);
    }
  } catch (error) {
    console.error('[BlockchainSettingsView] Error fetching ISIC codes:', error.response?.data || error.message);
    // TODO: Показать пользователю уведомление об ошибке
  } finally {
    loadingRef.value = false;
  }
};

// --- Функция для обновления информации о текущем полном выбранном коде ISIC ---
const updateCurrentIsicSelection = () => {
  let code = '';
  let text = '';
  let optionsToSearch = [];
  let valueToFind = '';

  if (selectedClass.value) {
    code = selectedClass.value;
    optionsToSearch = classOptions.value;
    valueToFind = selectedClass.value;
  } else if (selectedGroup.value) {
    code = selectedGroup.value;
    optionsToSearch = groupOptions.value;
    valueToFind = selectedGroup.value;
  } else if (selectedDivision.value) {
    code = selectedDivision.value;
    optionsToSearch = divisionOptions.value;
    valueToFind = selectedDivision.value;
  } else if (selectedSection.value) {
    code = selectedSection.value;
    optionsToSearch = sectionOptions.value;
    valueToFind = selectedSection.value;
  }

  if (code && optionsToSearch.length > 0 && valueToFind) {
    const foundOption = optionsToSearch.find(opt => opt.value === valueToFind);
    if (foundOption) {
      text = foundOption.text;
    }
  }
  currentSelectedIsicCode.value = code;
  currentSelectedIsicText.value = text;
};

// --- Наблюдатели для каскадной загрузки и обновления текущего выбора --- 
watch(selectedSection, (newVal) => {
  selectedDivision.value = ''; divisionOptions.value = [];
  selectedGroup.value = ''; groupOptions.value = [];
  selectedClass.value = ''; classOptions.value = [];
  if (newVal) {
    fetchIsicCodes({ parent_code: newVal }, divisionOptions, isLoadingDivisions);
  }
  updateCurrentIsicSelection();
});

watch(selectedDivision, (newVal) => {
  selectedGroup.value = ''; groupOptions.value = [];
  selectedClass.value = ''; classOptions.value = [];
  if (newVal) {
    fetchIsicCodes({ parent_code: newVal }, groupOptions, isLoadingGroups);
  }
  updateCurrentIsicSelection();
});

watch(selectedGroup, (newVal) => {
  selectedClass.value = ''; classOptions.value = [];
  if (newVal) {
    fetchIsicCodes({ parent_code: newVal }, classOptions, isLoadingClasses);
  }
  updateCurrentIsicSelection();
});

watch(selectedClass, () => {
  updateCurrentIsicSelection();
});

// --- Начальная загрузка данных ---
onMounted(() => {
  fetchIsicCodes({ level: 1 }, sectionOptions, isLoadingSections);
  fetchNetworks(); // Загружаем список сетей для деплоя
  
  // Автоподстановка адреса авторизированного пользователя в первого партнера, если есть права админа
  if (address.value && isAdmin.value && dleDeploymentSettings.partners.length > 0) {
    dleDeploymentSettings.partners[0].address = address.value;
  }
  
  // Слушаем изменения адреса авторизированного пользователя
  watch(address, (newAddress) => {
    if (newAddress && isAdmin.value && dleDeploymentSettings.partners.length > 0) {
      dleDeploymentSettings.partners[0].address = newAddress;
    }
  });
  
  // Загрузка настроек RPC с сервера
  loadRpcSettings();
});

const totalInitialSupply = computed(() => {
  return dleDeploymentSettings.partners.reduce((sum, partner) => sum + (Number(partner.amount) || 0), 0);
});

const addPartner = () => {
  dleDeploymentSettings.partners.push({ address: '', amount: 1 });
};

const removePartner = (index) => {
  dleDeploymentSettings.partners.splice(index, 1);
};

const loadBlockchainSettings = async () => {
  console.log('[BlockchainSettingsView] Загрузка настроек блокчейна...');
  // TODO: API call - Больше нет общих настроек для загрузки в 'settings'.
  // Возможно, потребуется загрузить dleDeploymentSettings, если они сохраняются.
};

const saveSettings = async (section) => {
  console.log(`[BlockchainSettingsView] Сохранение настроек раздела: ${section}`);
  // TODO: API call - Функция saveSettings, вероятно, больше не нужна в текущем виде,
  // так как нет общих настроек для сохранения. Деплой DLE обрабатывается отдельно.
  // Если настройки DLE (dleDeploymentSettings) нужно сохранять без деплоя, нужна другая логика.
};

const isDeploying = ref(false);
const deployResult = ref(null);
const deployError = ref(null);

const formattedDLEParams = computed(() => {
  // Преобразуем партнеров в формат для API
  const partners = dleDeploymentSettings.partners.map(p => p.address);
  const amounts = dleDeploymentSettings.partners.map(p => p.amount.toString());
  
  // Формируем полный адрес
  const location = [
    dleDeploymentSettings.locationIndex,
    dleDeploymentSettings.locationCountry,
    dleDeploymentSettings.locationCity,
    dleDeploymentSettings.locationStreet,
    dleDeploymentSettings.locationHouse,
    dleDeploymentSettings.locationOffice
  ].filter(Boolean).join(', ');
  
  // Формируем коды ISIC
  const isicCodes = dleDeploymentSettings.selectedIsicCodes.map(isic => isic.code);
  
  return {
    name: dleDeploymentSettings.name,
    symbol: dleDeploymentSettings.symbol,
    location,
    isicCodes,
    partners,
    amounts,
    network: dleDeploymentSettings.blockchainNetwork, // Добавляем выбранную сеть в параметры
    minTimelockDelay: dleDeploymentSettings.timelockMinDelayDays,
    votingDelay: Math.round(dleDeploymentSettings.votingDelayDays * 24 * 60 * 60 / 13), // конвертируем дни в блоки (13 секунд на блок)
    votingPeriod: Math.round(dleDeploymentSettings.votingPeriodDays * 24 * 60 * 60 / 13), // конвертируем дни в блоки
    proposalThreshold: dleDeploymentSettings.proposalThreshold,
    quorumPercentage: dleDeploymentSettings.quorumPercent,
    privateKey: securitySettings.deployerPrivateKey
  };
});

const deployDLE = async () => {
  isDeploying.value = true;
  deployResult.value = null;
  deployError.value = null;
  
  try {
    // Проверяем валидность формы
    if (!validateDLEForm()) {
      isDeploying.value = false;
      return;
    }

    // Сначала сохраняем настройки RPC
    const rpcSaved = await saveRpcSettings();
    if (!rpcSaved) {
      // Если не удалось сохранить, спрашиваем пользователя, хочет ли он продолжить
      if (!confirm('Не удалось сохранить RPC настройки. Продолжить деплой DLE?')) {
        isDeploying.value = false;
        return;
      }
    }
    
    // Отправляем запрос на создание DLE
    const result = await dleService.createDLE(formattedDLEParams.value);
    
    deployResult.value = result;
    alert('DLE успешно создано!');
  } catch (error) {
    console.error('Ошибка при деплое DLE:', error);
    deployError.value = error.response?.data?.message || error.message || 'Произошла ошибка при деплое DLE';
    alert(deployError.value);
  } finally {
    isDeploying.value = false;
  }
};

const validateDLEForm = () => {
  // Проверяем обязательные поля
  if (!dleDeploymentSettings.name) {
    alert('Необходимо указать имя DLE');
    return false;
  }
  
  if (!dleDeploymentSettings.symbol) {
    alert('Необходимо указать символ токена');
    return false;
  }
  
  // Проверяем выбрана ли сеть для деплоя
  if (!dleDeploymentSettings.blockchainNetwork) {
    alert('Необходимо выбрать сеть для деплоя');
    return false;
  }
  
  // Проверяем адреса партнеров
  for (const partner of dleDeploymentSettings.partners) {
    if (!partner.address || !partner.address.startsWith('0x') || partner.address.length !== 42) {
      alert('Некорректный адрес партнера');
      return false;
    }
    
    if (!partner.amount || partner.amount <= 0) {
      alert('Сумма токенов должна быть больше 0');
      return false;
    }
  }
  
  return true;
};

// --- Функция для поиска адреса по индексу через Nominatim ---
const fetchAddressByZipcode = async () => {
  const zipcode = dleDeploymentSettings.locationIndex.trim();
  if (!zipcode) {
    return;
  }

  isFetchingByZipcode.value = true;
  addressVerificationResult.value = null; 
  verifiedAddressDetails.value = null;

  try {
    const params = new URLSearchParams();
    params.append('postalcode', zipcode);
    params.append('format', 'jsonv2');
    params.append('addressdetails', '1');
    params.append('limit', '1');

    const countryInput = dleDeploymentSettings.locationCountry.trim();
    if (countryInput) {
      if (countryInput.length === 2) {
        params.append('countrycodes', countryInput.toUpperCase()); 
      } else {
        params.append('country', countryInput); 
      }
    }

    console.log(`[FetchByZipcode] Querying backend proxy for Nominatim with: ${params.toString()}`);
    const response = await axios.get(`/api/geocoding/nominatim-search?${params.toString()}`);

    if (response.data && response.data.length > 0) {
      const bestMatch = response.data[0];
      console.log('[FetchByZipcode] Nominatim result:', bestMatch);

      if (bestMatch.address) {
        if (bestMatch.address.country) {
          dleDeploymentSettings.locationCountry = bestMatch.address.country;
        }
        if (bestMatch.address.city) {
          dleDeploymentSettings.locationCity = bestMatch.address.city;
        } else if (bestMatch.address.town) {
          dleDeploymentSettings.locationCity = bestMatch.address.town;
        } else if (bestMatch.address.village) {
          dleDeploymentSettings.locationCity = bestMatch.address.village;
        } else {
          // Город не найден четко, можно оставить поле пустым или сообщить
        }
        // Можно также попробовать заполнить регион/область, если есть такое поле
        // dleDeploymentSettings.locationState = bestMatch.address.state;
        addressFieldsVisible.value = true;
      } else {
        addressFieldsVisible.value = false;
      }
    } else {
      addressFieldsVisible.value = false;
    }
  } catch (error) {
    console.error('[FetchByZipcode] Error fetching address by zipcode:', error.response?.data || error.message);
    addressFieldsVisible.value = false;
  } finally {
    isFetchingByZipcode.value = false;
  }
};

// Дополнительная функция для скрытия полей, если индекс очищен
const checkIndexInput = () => {
  if (!dleDeploymentSettings.locationIndex.trim()) {
    addressFieldsVisible.value = false;
    // Опционально: также можно очистить dleDeploymentSettings.locationCountry, city и т.д.
    // dleDeploymentSettings.locationCountry = '';
    // dleDeploymentSettings.locationCity = '';
  }
};

// --- Функция для сборки строки адреса для Nominatim (для кнопки "Проверить адрес") ---
const buildAddressQuery = () => {
  const parts = [];
  let streetHouse = '';

  const street = dleDeploymentSettings.locationStreet.trim();
  const house = dleDeploymentSettings.locationHouse.trim().toLowerCase(); // Приводим номер дома к нижнему регистру

  if (street) {
    streetHouse += street;
  }
  if (house) {
    streetHouse += (streetHouse ? ' ' : '') + house;
  }
  if (streetHouse) {
    parts.push(streetHouse);
  }

  const city = dleDeploymentSettings.locationCity.trim();
  if (city) {
    parts.push(city);
  }

  const country = dleDeploymentSettings.locationCountry.trim();
  if (country) {
    parts.push(country);
  }
  
  return parts.join(', ');
};

// --- Функция для проверки адреса через Nominatim ---
const verifyAddress = async () => {
  const addressQuery = buildAddressQuery();
  if (!addressQuery.trim()) {
    addressVerificationResult.value = null; 
    verifiedAddressDetails.value = null;
    return;
  }

  isAddressVerifying.value = true;
  addressVerificationResult.value = null;
  verifiedAddressDetails.value = null;

  try {
    const params = new URLSearchParams({
      q: addressQuery,
      format: 'jsonv2',
      addressdetails: 1,
      limit: 5, 
      // countrycodes параметр убран, т.к. страна теперь свободный текстовый ввод
      // Nominatim попытается определить ее из 'q'
    });

    console.log(`[VerifyAddress] Querying backend proxy for Nominatim with: ${params.toString()}`);
    // Запрос теперь идет на ваш бэкенд-прокси
    const response = await axios.get(`/api/geocoding/nominatim-search?${params.toString()}`);

    // Ответ от бэкенд-прокси должен иметь ту же структуру, что и прямой ответ от Nominatim
    if (response.data && Array.isArray(response.data)) { // Проверяем, что это массив (как отвечает Nominatim)
      if (response.data.length > 0) {
        const bestMatch = response.data[0];
        verifiedAddressDetails.value = bestMatch;
        console.log('[VerifyAddress] Nominatim best match via proxy:', bestMatch);

        let countryMatches = true;
        if (dleDeploymentSettings.locationCountry && bestMatch.address.country_code) {
            if (dleDeploymentSettings.locationCountry.trim().toUpperCase() !== bestMatch.address.country_code.toUpperCase()) {
                if (dleDeploymentSettings.locationCountry.length === 2) countryMatches = false; 
            }
        } else if (dleDeploymentSettings.locationCountry && !bestMatch.address.country_code) {
            countryMatches = false;
        }

        if (countryMatches) { 
          if (bestMatch.address.house_number && bestMatch.address.road) {
               addressVerificationResult.value = 'verified_exact';
          } else if (bestMatch.address.road) {
              addressVerificationResult.value = 'verified_street';
          } else if (bestMatch.address.city || bestMatch.address.town || bestMatch.address.village) {
              addressVerificationResult.value = 'verified_city';
          } else {
              addressVerificationResult.value = 'verified_ambiguous';
          }
        } else {
          addressVerificationResult.value = 'ambiguous';
        }
      } else {
        // Nominatim вернул пустой массив - адрес не найден
        addressVerificationResult.value = 'not_found';
      }
    } else {
        // Ответ от бэкенд-прокси не в ожидаемом формате (не массив)
        console.error('[VerifyAddress] Invalid response structure from backend proxy:', response.data);
        addressVerificationResult.value = 'error'; // или более специфичная ошибка
        verifiedAddressDetails.value = response.data; // Сохраняем то, что пришло, для отладки
    }
  } catch (error) {
    console.error('[VerifyAddress] Error verifying address via backend proxy:', error.response?.data || error.message);
    verifiedAddressDetails.value = error.response?.data; // Сохраняем детали ошибки для отладки
    addressVerificationResult.value = 'error';
  } finally {
    isAddressVerifying.value = false;
  }
};

// --- Функции для управления списком выбранных кодов ISIC ---
const addIsicCode = () => {
  if (currentSelectedIsicCode.value && currentSelectedIsicText.value) {
    const alreadyExists = dleDeploymentSettings.selectedIsicCodes.find(c => c.code === currentSelectedIsicCode.value);
    if (!alreadyExists) {
      dleDeploymentSettings.selectedIsicCodes.push({ 
        code: currentSelectedIsicCode.value, 
        text: currentSelectedIsicText.value 
      });
      // Сбрасываем селекторы для выбора следующего кода
      selectedSection.value = ''; // Это вызовет каскадную очистку 
      // currentSelectedIsicCode.value = ''; // Уже сбросится через watch(selectedSection)
      // currentSelectedIsicText.value = '';
    } else {
      alert('Этот код уже добавлен.');
    }
  } else {
    alert('Код не выбран полностью.');
  }
};

const removeIsicCode = (index) => {
  dleDeploymentSettings.selectedIsicCodes.splice(index, 1);
};

const showDeployerKey = ref(false);
const toggleShowDeployerKey = () => {
  showDeployerKey.value = !showDeployerKey.value;
};

// Функция загрузки настроек RPC с сервера
const loadRpcSettings = async () => {
  try {
    const response = await axios.get('/api/settings/rpc');
    console.log('Ответ сервера на /api/settings/rpc:', response.data);
    if (response.data && response.data.success) {
      securitySettings.rpcConfigs = (response.data.data || []).map(rpc => ({
        networkId: rpc.network_id,
        rpcUrl: rpc.rpc_url, // Реальный URL для функциональности
        rpcUrlDisplay: rpc.rpc_url_display, // Маскированный URL для отображения (если есть)
        chainId: rpc.chain_id
      }));
      console.log('[BlockchainSettingsView] RPC конфигурации успешно загружены:', securitySettings.rpcConfigs);
    }
  } catch (error) {
    console.error('[BlockchainSettingsView] Ошибка при загрузке RPC конфигураций:', error);
  }
};

// Функция сохранения настроек RPC на сервер
const saveRpcSettings = async () => {
  try {
    console.log('Отправляемые RPC:', securitySettings.rpcConfigs);
    const response = await axios.post('/api/settings/rpc', { 
      rpcConfigs: JSON.parse(JSON.stringify(securitySettings.rpcConfigs)) 
    });
    
    if (response.data && response.data.success) {
      console.log('[BlockchainSettingsView] RPC конфигурации успешно сохранены');
      return true;
    } else {
      console.error('[BlockchainSettingsView] Ошибка при сохранении RPC конфигураций:', response.data);
      return false;
    }
  } catch (error) {
    console.error('[BlockchainSettingsView] Ошибка при сохранении RPC конфигураций:', error);
    return false;
  }
};

const isSavingRpc = ref(false);

// Состояние для модального окна тестирования RPC
const showRpcTestModal = ref(false);
const rpcTestResult = ref({});

// Функция сохранения настроек RPC с обратной связью
const saveRpcSettingsWithFeedback = async () => {
  isSavingRpc.value = true;
  try {
    const success = await saveRpcSettings();
    if (success) {
      alert('RPC настройки успешно сохранены.');
    } else {
      alert('Ошибка при сохранении RPC настроек.');
    }
  } catch (error) {
    console.error('[BlockchainSettingsView] Ошибка при сохранении RPC настроек:', error);
    alert(`Ошибка при сохранении: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    isSavingRpc.value = false;
  }
};

// Определяем группы сетей для деплоя (исключаем локальные и пользовательские)
const deployNetworkGroups = computed(() => {
  // Фильтруем группы, оставляя только основные и тестовые сети
  return networkGroups.filter(group => 
    group.label === 'Основные сети' || group.label === 'Тестовые сети'
  );
});

const testingRpcIndex = ref(-1);

// Функция-обработчик для тестирования RPC соединения
const testRpcHandler = async (rpc) => {
  try {
    const result = await testRpcConnection(rpc.networkId, rpc.rpcUrl);
    
    // Подготавливаем данные для модального окна
    rpcTestResult.value = {
      success: result.success,
      networkId: rpc.networkId,
      message: result.message,
      blockNumber: result.blockNumber,
      error: result.error
    };
    
    // Показываем модальное окно
    showRpcTestModal.value = true;
  } catch (error) {
    console.error('[BlockchainSettingsView] Ошибка при тестировании RPC:', error);
    
    // Показываем ошибку в модальном окне
    rpcTestResult.value = {
      success: false,
      networkId: rpc.networkId,
      error: error.message || 'Неизвестная ошибка'
    };
    
    showRpcTestModal.value = true;
  }
};

// Функция для закрытия модального окна тестирования RPC
const closeRpcTestModal = () => {
  showRpcTestModal.value = false;
  rpcTestResult.value = {};
};

const goBack = () => router.push('/settings');

</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}
h3 {
  margin-bottom: var(--spacing-md);
  color: var(--color-primary);
}
.sub-settings-panel {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px dashed var(--color-grey-light);
}
.sub-settings-panel:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}
.setting-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.form-group {
  margin-bottom: 0;
}
.form-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.form-control {
  max-width: 500px;
}
.btn-primary {
 align-self: flex-start;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.partner-entry {
  border: 1px solid var(--color-grey-light);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.partner-entry .form-group {
  margin-bottom: 0; /* Убираем лишний отступ у вложенных групп */
}

.btn-danger.btn-sm {
  align-self: flex-start;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.875rem; /* Меньший размер для кнопки удаления */
}

.btn-secondary {
  align-self: flex-start;
  margin-bottom: var(--spacing-md); /* Отступ после кнопки "Добавить партнера" */
}

.btn-lg {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: 1.125rem;
}

.address-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); /* Адаптивная сетка */
    gap: var(--spacing-md);
    /* margin-bottom: var(--spacing-lg); Убрано, т.к. есть блок верификации */
}

/* Можно добавить специфичные стили для полей адреса, если нужно */
.address-grid .form-group {
    margin-bottom: 0; /* Убрать лишний отступ у полей в сетке */
}

.code-list {
    margin-bottom: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
}

.code-entry {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--color-grey-light);
    border-radius: var(--radius-sm);
    background-color: white;
}

.code-entry .btn-danger {
    flex-shrink: 0;
    margin-left: var(--spacing-md);
}

.add-code-form {
    margin-top: var(--spacing-sm); /* Меньше отступ, т.к. он под списком */
}

.add-code-form .btn-secondary {
    align-self: flex-start;
}

.address-verification-section {
  margin-top: var(--spacing-xs); /* Небольшой отступ сверху */
  margin-bottom: var(--spacing-lg); /* Отступ после секции верификации */
}

.verification-status p {
  margin-bottom: var(--spacing-xs);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
}
.verification-status .alert-success {
    background-color: var(--color-success-light, #e6fffa); /* Добавлены цвета по умолчанию */
    color: var(--color-success-dark, #006d5b);
    border: 1px solid var(--color-success-dark, #006d5b);
}
.verification-status .alert-warning {
    background-color: var(--color-warning-light, #fff8e1);
    color: var(--color-warning-dark, #8a6d3b);
    border: 1px solid var(--color-warning-dark, #8a6d3b);
}
.verification-status .alert-danger {
    background-color: var(--color-danger-light, #fdecea);
    color: var(--color-danger-dark, #a94442);
    border: 1px solid var(--color-danger-dark, #a94442);
}

.code-block {
  background-color: #f5f5f5;
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-grey-light, #e0e0e0);
}

.current-isic-selection {
  padding: var(--spacing-sm);
  background-color: var(--color-grey-x-light);
  border-radius: var(--radius-sm);
  margin-top: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.isic-codes-list ul {
  list-style-type: none;
  padding-left: 0;
}

.isic-codes-list li {
  background-color: var(--color-background);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-sm);
}

.btn-xs {
  padding: 0.2rem 0.4rem;
  font-size: 0.75rem;
}

.rpc-list {
  margin-bottom: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.rpc-entry {
  background-color: var(--color-background);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-grey-light);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
}

.rpc-entry span {
  flex-grow: 1;
}

.add-rpc-form {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px dashed var(--color-grey-light);
}

.add-rpc-form h5 {
  margin-bottom: var(--spacing-sm);
}

.deployment-actions {
  margin-top: var(--spacing-md);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.deploy-result {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-success-light);
  color: var(--color-success-dark);
  border: 1px solid var(--color-success-dark);
}

.deploy-error {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
  background-color: var(--color-danger-light);
  color: var(--color-danger-dark);
  border: 1px solid var(--color-danger-dark);
}

.suggestion {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 3px solid var(--color-primary, #4caf50);
  padding: 6px 10px;
  margin-top: 8px;
  border-radius: 0 4px 4px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4caf50);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-link:hover {
  color: var(--color-primary-dark, #388e3c);
  text-decoration: none;
}

.mt-2 {
  margin-top: 10px;
}

.text-warning {
  color: #f57c00; /* оранжевый для предупреждений */
  margin-top: 5px;
  display: block;
}

.rpc-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn-info:disabled {
  background-color: #a0d2dc;
  cursor: not-allowed;
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

.btn[disabled], .btn:disabled {
  background: #e0e0e0 !important;
  color: #aaa !important;
  border-color: #ccc !important;
  cursor: not-allowed !important;
  opacity: 1 !important;
}
</style> 