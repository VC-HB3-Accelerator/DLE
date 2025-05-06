<template>
  <div class="blockchain-settings settings-panel">
    
    <!-- Панель Создать новое DLE (Digital Legal Entity) -->
    <div class="sub-settings-panel">
      <h3>Создать новое DLE (Digital Legal Entity)</h3>
      <div class="setting-form">
        <p>Настройка и деплой нового DLE (Digital Legal Entity) с токеном управления и контрактом Governor.</p>
        
        <div class="form-group">
          <label class="form-label" for="blockchainNetwork">Цепочка блокчейна для деплоя:</label>
          <select id="blockchainNetwork" v-model="dleDeploymentSettings.blockchainNetwork" class="form-control">
            <option value="polygon">Polygon (Matic)</option>
            <option value="ethereum_mainnet">Ethereum Mainnet</option>
            <option value="sepolia">Sepolia (Testnet)</option>
            <option value="goerli">Goerli (Testnet)</option>
            <!-- TODO: Добавить другие сети по мере необходимости -->
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="dleName">Имя DLE (Digital Legal Entity) (и токена):</label>
          <input type="text" id="dleName" v-model="dleDeploymentSettings.name" class="form-control" placeholder="Например, My DLE">
        </div>

        <div class="form-group">
          <label class="form-label" for="dleSymbol">Символ токена управления (GT):</label>
          <input type="text" id="dleSymbol" v-model="dleDeploymentSettings.symbol" class="form-control" placeholder="Например, MDGT (3-5 символов)">
        </div>

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
          <button class="btn btn-danger btn-sm" @click="removePartner(index)">Удалить партнера</button>
        </div>
        <button class="btn btn-secondary" @click="addPartner">Добавить партнера</button>
        <div class="form-group">
          <label class="form-label">Общее количество выпускаемых GT: {{ totalInitialSupply }}</label>
        </div>

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
    
        <h4>Настройки Timelock (если используется)</h4>
        <div class="form-group">
          <label class="form-label" for="timelockMinDelay">Минимальная задержка Timelock (в днях):</label>
          <input type="number" id="timelockMinDelay" v-model="dleDeploymentSettings.timelockMinDelayDays" min="0" class="form-control">
        </div>

        <button class="btn btn-primary btn-lg" @click="deployDLE">Создать и задеплоить DLE (Digital Legal Entity)</button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { reactive, onMounted, computed, ref, watch } from 'vue';
import axios from 'axios'; // Предполагаем, что axios доступен
// TODO: Импортировать API

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
  // TODO: Загрузить настройки блокчейна, если они есть
  // loadBlockchainSettings(); // Эта функция пока не актуальна, так как settings пустой
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

const deployDLE = async () => {
  console.log('[BlockchainSettingsView] Попытка деплоя DLE (Digital Legal Entity) с настройками:', JSON.parse(JSON.stringify(dleDeploymentSettings)));
  console.log('[BlockchainSettingsView] Выбранные коды ISIC:', JSON.parse(JSON.stringify(dleDeploymentSettings.selectedIsicCodes)));
  console.log('[BlockchainSettingsView] Общее начальное количество токенов:', totalInitialSupply.value);
  const addressString = [
    dleDeploymentSettings.locationIndex,
    dleDeploymentSettings.locationCountry,
    dleDeploymentSettings.locationCity,
    dleDeploymentSettings.locationStreet,
    dleDeploymentSettings.locationHouse,
    dleDeploymentSettings.locationOffice
  ].filter(Boolean).join(', '); // Собираем строку адреса для alert/log
  let finalIsicDisplay = 'Не выбраны';
  if (dleDeploymentSettings.selectedIsicCodes && dleDeploymentSettings.selectedIsicCodes.length > 0) {
    finalIsicDisplay = dleDeploymentSettings.selectedIsicCodes.map(c => c.code).join(', ');
  }
  alert(`Деплой DLE (Digital Legal Entity) инициирован (см. консоль). Имя: ${dleDeploymentSettings.name}, Символ: ${dleDeploymentSettings.symbol}, Сеть: ${dleDeploymentSettings.blockchainNetwork}, Коды деят: ${finalIsicDisplay}, Адрес: ${addressString || 'Не указан'}`);
  // TODO: Вызвать API бэкенда для деплоя контрактов
  // Передать dleDeploymentSettings.blockchainNetwork на бэкенд
  // Передать выбранный dleDeploymentSettings.selectedIsicCodes и детали адреса (dleDeploymentSettings.location...) (возможно, для метаданных контракта или внесения в реестр)
  // 1. Деплой ERC20Votes токена с параметрами:
  //    - name: dleDeploymentSettings.name
  //    - symbol: dleDeploymentSettings.symbol
  //    - initialSupply: totalInitialSupply.value (или как решит бэкенд по партнерам)
  //    - initialHolders: dleDeploymentSettings.partners (адреса и суммы)
  // 2. Деплой TimelockController (если используется, получить его адрес)
  //    - minDelay: dleDeploymentSettings.timelockMinDelayDays * 24 * 60 * 60 (конвертация в секунды)
  //    - proposers: [адрес будущего Governor]
  //    - executors: [0x0000...0000] (любой может исполнить) или [адрес будущего Governor]
  // 3. Деплой Governor контракта:
  //    - name: dleDeploymentSettings.name + " Governor" (или просто уникальное имя для Governor)
  //    - tokenAddress: адрес задеплоенного ERC20Votes
  //    - timelockAddress: адрес задеплоенного TimelockController (если используется)
  //    - quorumPercent: dleDeploymentSettings.quorumPercent
  //    - proposalThreshold: dleDeploymentSettings.proposalThreshold
  //    - votingPeriod: dleDeploymentSettings.votingPeriodDays * 24 * 60 * 60 (конвертация в секунды или блоки на бэкенде)
  //    - votingDelay: dleDeploymentSettings.votingDelayDays * 24 * 60 * 60 (конвертация в секунды или блоки на бэкенде)
  // 4. (Если Timelock) Передать права администратора Timelock самому Timelock'у (или DLE)
  // 5. (Опционально) Передать права на другие системные контракты Timelock'у
  // TODO: Передать dleDeploymentSettings.selectedIsicCodes (массив объектов) на бэкенд
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
</style> 