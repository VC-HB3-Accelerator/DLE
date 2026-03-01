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
  <div class="dle-form-container">
    <!-- Форма -->
    <div class="form-content">
      <!-- Выбор страны -->
      <div class="form-group">
        <label class="form-label" for="jurisdiction">Выберите страну:</label>
        <select 
          id="jurisdiction" 
          v-model="dleSettings.jurisdiction" 
          class="form-control"
          :disabled="isLoadingCountries"
        >
          <option value="">{{ isLoadingCountries ? 'Загрузка стран...' : '-- Выберите страну --' }}</option>
          <option 
            v-for="country in countriesOptions" 
            :key="country.numeric" 
            :value="country.numeric"
          >
            {{ country.title }} ({{ country.code }})
          </option>
        </select>
      </div>

          <!-- Классификаторы видов деятельности -->
      <div v-if="dleSettings.jurisdiction">
        <div v-if="isLoadingRussianClassifiers" class="loading-section">
          <p><i class="fas fa-spinner fa-spin"></i> Загрузка российских классификаторов...</p>
        </div>
        
        <div v-else>


              <!-- Форма ручного заполнения адреса -->
              <div class="address-form-section">
                <h4>Юридический адрес</h4>
                <p class="form-help">Введите почтовый индекс → нажмите "Поиск" → поля заполнятся автоматически → дозаполните при необходимости → нажмите "Проверить адрес"</p>
                
                <div class="address-fields">
                  <!-- Поиск по почтовому индексу -->
                  <div class="postal-search-section">
                    <div class="form-row">
                      <div class="form-group flex-grow">
                        <label class="form-label" for="postalCode">Почтовый индекс:</label>
                        <input 
                          type="text" 
                          id="postalCode" 
                          v-model="postalCodeInput" 
                          class="form-control" 
                          placeholder="101000"
                          @keyup.enter="searchByPostalCode"
                        >
                      </div>
                      <div class="form-group">
                        <label class="form-label">&nbsp;</label>
                        <button 
                          type="button" 
                          @click="searchByPostalCode" 
                          class="btn btn-primary"
                          :disabled="!postalCodeInput || postalCodeInput.length < 5"
                        >
                          Поиск
                        </button>
                      </div>
                    </div>

                    <!-- Индикатор поиска -->
                    <div v-if="isSearchingAddress" class="searching-indicator">
                      <i class="fas fa-spinner fa-spin"></i> Поиск данных по индексу...
                    </div>

                    <!-- Результаты поиска -->
                    <div v-if="searchResults.length > 0 && !isSearchingAddress" class="search-results">
                      <h5>Найденные данные (первый автоматически выбран):</h5>
                      <div class="results-list">
                        <div 
                          v-for="(result, index) in searchResults" 
                          :key="index"
                          @click="fillFromSearchResult(result)"
                          :class="['search-result-item', { 'selected': index === 0 }]"
                        >
                          <div class="result-address">
                            <span v-if="index === 0" class="auto-selected">✓ Выбрано:</span>
                            {{ result.fullAddress }}
                          </div>
                          <div class="result-details">
                            <span v-if="result.region">{{ result.region }}</span>
                            <span v-if="result.city">{{ result.city }}</span>
                            <span v-if="result.street">{{ result.street }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Ручное дозаполнение полей -->
                  <div class="manual-fields-section">
                    <h5>Дозаполните данные для точного юридического адреса:</h5>
                    
                    <!-- Регион и город -->
                    <div class="form-row">
                      <div class="form-group flex-grow">
                        <label class="form-label" for="region">Регион/область:</label>
                        <input 
                          type="text" 
                          id="region" 
                          v-model="dleSettings.addressData.region" 
                          class="form-control" 
                          placeholder="Московская область"
                        >
                      </div>
                      <div class="form-group flex-grow">
                        <label class="form-label" for="city">Город/населенный пункт:</label>
                        <input 
                          type="text" 
                          id="city" 
                          v-model="dleSettings.addressData.city" 
                          class="form-control" 
                          placeholder="Москва"
                        >
                      </div>
                    </div>

                    <!-- Улица и дом -->
                  <div class="form-row">
                    <div class="form-group flex-grow">
                      <label class="form-label" for="street">Улица:</label>
                      <input 
                        type="text" 
                        id="street" 
                        v-model="dleSettings.addressData.street" 
                        class="form-control" 
                        placeholder="Тверская улица"
                      >
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="building">Дом:</label>
                      <input 
                        type="text" 
                        id="building" 
                        v-model="dleSettings.addressData.building" 
                        class="form-control" 
                        placeholder="1"
                      >
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="apartment">Кв./офис:</label>
                      <input 
                        type="text" 
                        id="apartment" 
                        v-model="dleSettings.addressData.apartment" 
                        class="form-control" 
                        placeholder="101"
                      >
                    </div>
                  </div>

                  <!-- Поиск подсказок (если есть) -->
                  <div v-if="isSearchingAddress" class="searching-indicator">
                    <i class="fas fa-spinner fa-spin"></i> Поиск подсказок адреса...
                  </div>
                  


                  <!-- Кнопка проверки -->
                  <div class="address-actions">
                    <button 
                      type="button" 
                      @click="verifyAddress" 
                      class="btn btn-primary"
                      :disabled="!canVerifyAddress"
                    >
                      Проверить адрес
                    </button>
                    <button 
                      v-if="dleSettings.addressData.isVerified" 
                      type="button" 
                      @click="clearAddress" 
                      class="btn btn-secondary"
                    >
                      Очистить
                    </button>
                  </div>
                </div>
              </div>

              <!-- Виды экономической деятельности -->
              <div class="form-group okved-section">
                <label class="form-label okved-title">
                  {{ dleSettings.jurisdiction === '643' ? 'ОКВЭД (виды экономической деятельности)' : 'ISIC (виды экономической деятельности)' }}:
                </label>
                
                <!-- Форма для России (ОКВЭД) -->
                <div v-if="dleSettings.jurisdiction === '643'" class="okved-cascade">
                  <!-- Уровень 1: Класс (01.11, 01.12...) -->
                  <div class="form-group">
                    <label class="form-label-small">Выберите класс деятельности:</label>
                    <select v-model="selectedOkvedLevel1" class="form-control" :disabled="isLoadingOkvedLevel1">
                      <option value="">-- {{ isLoadingOkvedLevel1 ? 'Загрузка классов...' : 'Выберите класс' }} --</option>
                      <option 
                        v-for="option in okvedLevel1Options" 
                        :key="option.value" 
                        :value="option.value"
                      >
                        {{ option.text }}
                      </option>
                    </select>
                  </div>

                  <!-- Уровень 2: Подкласс (01.11.1, 01.11.2...) -->
                  <div class="form-group" v-if="selectedOkvedLevel1">
                    <label class="form-label-small">Подкласс (необязательно):</label>
                    <select v-model="selectedOkvedLevel2" class="form-control" :disabled="isLoadingOkvedLevel2">
                      <option value="">-- {{ isLoadingOkvedLevel2 ? 'Загрузка подклассов...' : 'Выберите подкласс или оставьте пустым' }} --</option>
                      <option 
                        v-for="option in okvedLevel2Options" 
                        :key="option.value" 
                        :value="option.value"
                      >
                        {{ option.text }}
                      </option>
                    </select>
                  </div>

                  <!-- Выбранный код ОКВЭД -->
                  <div v-if="currentSelectedOkvedText" class="current-okved-selection">
                    <p><strong>Выбранный код:</strong> {{ currentSelectedOkvedText }}</p>
                    <button @click="addOkvedCode" class="btn btn-success btn-sm" :disabled="!currentSelectedOkvedCode">
                      Добавить код деятельности
                    </button>
                  </div>
                </div>

                <!-- Форма для других стран (ISIC) -->
                <div v-else class="isic-cascade">
                  <!-- Уровень 1: Раздел (A, B, C...) -->
                  <div class="form-group">
                    <label class="form-label-small">Выберите раздел деятельности:</label>
                    <select v-model="selectedIsicLevel1" class="form-control" :disabled="isLoadingIsicLevel1">
                      <option value="">-- {{ isLoadingIsicLevel1 ? 'Загрузка разделов...' : 'Выберите раздел' }} --</option>
                      <option 
                        v-for="option in isicLevel1Options" 
                        :key="option.value" 
                        :value="option.value"
                      >
                        {{ option.text }}
                      </option>
                    </select>
                  </div>

             <!-- Уровень 2: Группа (01, 02, 03...) -->
             <div class="form-group" v-if="selectedIsicLevel1">
               <label class="form-label-small">Выберите группу деятельности:</label>
               <select v-model="selectedIsicLevel2" class="form-control" :disabled="isLoadingIsicLevel2">
                 <option value="">-- {{ isLoadingIsicLevel2 ? 'Загрузка групп...' : 'Выберите группу' }} --</option>
                 <option 
                   v-for="option in isicLevel2Options" 
                   :key="option.value" 
                   :value="option.value"
                 >
                   {{ option.text }}
                 </option>
               </select>
             </div>

             <!-- Уровень 3: Класс (011, 012, 013...) -->
             <div class="form-group" v-if="selectedIsicLevel2">
               <label class="form-label-small">Выберите класс деятельности:</label>
               <select v-model="selectedIsicLevel3" class="form-control" :disabled="isLoadingIsicLevel3">
                 <option value="">-- {{ isLoadingIsicLevel3 ? 'Загрузка классов...' : 'Выберите класс' }} --</option>
                 <option 
                   v-for="option in isicLevel3Options" 
                   :key="option.value" 
                   :value="option.value"
                 >
                   {{ option.text }}
                 </option>
               </select>
             </div>

             <!-- Уровень 4: Подкласс (0111, 0112, 0113...) -->
             <div class="form-group" v-if="selectedIsicLevel3">
               <label class="form-label-small">Выберите подкласс деятельности:</label>
               <select v-model="selectedIsicLevel4" class="form-control" :disabled="isLoadingIsicLevel4">
                 <option value="">-- {{ isLoadingIsicLevel4 ? 'Загрузка подклассов...' : 'Выберите подкласс' }} --</option>
                 <option 
                   v-for="option in isicLevel4Options" 
                   :key="option.value" 
                   :value="option.value"
                 >
                   {{ option.text }}
                 </option>
               </select>
             </div>

             <!-- Выбранный код ISIC -->
             <div v-if="currentSelectedIsicText" class="current-isic-selection">
               <p><strong>Выбранный код:</strong> {{ currentSelectedIsicText }}</p>
               <button @click="addIsicCode" class="btn btn-success btn-sm" :disabled="!currentSelectedIsicCode">
                 Добавить код деятельности
               </button>
             </div>
                </div>

                <!-- Основной код ОКВЭД (оставляем для совместимости) -->
                <div class="okved-main" style="display: none;">
                  <select v-model="dleSettings.mainOkvedCode" class="form-control">
                    <option value="">-- Выберите основной код ОКВЭД --</option>
                    <option 
                      v-for="okved in russianClassifiers.okved" 
                      :key="okved.code" 
                      :value="okved.code"
                    >
                      {{ okved.code }} - {{ okved.title }}
                    </option>
                  </select>
                </div>

                <!-- Список добавленных кодов ОКВЭД -->
                <div v-if="dleSettings.selectedOkved.length" class="selected-okved-codes">
                  <h5>Добавленные коды ОКВЭД:</h5>
                  <ul class="codes-list">
                    <li v-for="(code, index) in dleSettings.selectedOkved" :key="index" class="code-item">
                                              <span>{{ code }}</span>
                      <button 
                        type="button" 
                        class="btn btn-danger btn-sm" 
                        @click="removeOkvedCode(index)"
                      >
                        Удалить
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- КПП - Код причины постановки на учет -->
              <div class="form-group kpp-section">
                <label class="form-label">КПП (код причины постановки на учет):</label>
                <select 
                  v-model="dleSettings.kppCode" 
                  class="form-control" 
                  :disabled="isLoadingKppCodes"
                >
                  <option value="">-- {{ isLoadingKppCodes ? 'Загрузка КПП кодов...' : 'Выберите КПП код' }} --</option>
                  <option 
                    v-for="kpp in kppCodes" 
                    :key="kpp.code" 
                    :value="kpp.code"
                  >
                    {{ kpp.code }} - {{ kpp.title }}
                  </option>
                </select>
                <div v-if="selectedKppInfo" class="selected-kpp-info">
                  <p><strong>Выбранный КПП:</strong> {{ selectedKppInfo.code }} - {{ selectedKppInfo.title }}</p>
            </div>
          </div>

              <!-- Имя DLE -->
              <div class="form-group">
                <label class="form-label" for="dleName">Имя DLE (Digital Legal Entity):</label>
                <input 
                  type="text" 
                  id="dleName" 
                  v-model="dleSettings.name" 
                  class="form-control" 
                  placeholder="Например: My Digital Company"
                  maxlength="100"
                >
                <small class="form-help">Название вашего цифрового юридического лица</small>
              </div>

              <!-- Символ токена -->
              <div class="form-group">
                <label class="form-label" for="tokenSymbol">Символ токена управления:</label>
                <input 
                  type="text" 
                  id="tokenSymbol" 
                  v-model="dleSettings.tokenSymbol" 
                  class="form-control" 
                  placeholder="Например: MDGT"
                  maxlength="10"
                  style="text-transform: uppercase;"
                  @input="formatTokenSymbol"
                >
                <small class="form-help">3-10 символов для токена управления (Governance Token)</small>
              </div>

              <!-- Логотип токена -->
              <div class="form-group">
                <label class="form-label" for="tokenLogo">Логотип токена (изображение):</label>
                <input
                  id="tokenLogo"
                  type="file"
                  accept="image/*"
                  class="form-control"
                  @change="onLogoSelected"
                >
                <small class="form-help">Поддерживаются PNG/JPG/GIF/WEBP, до 5MB</small>
                <div v-if="logoPreviewUrl" class="logo-preview" style="margin-top:8px;display:flex;gap:10px;align-items:center;">
                  <img :src="logoPreviewUrl" alt="logo preview" style="width:48px;height:48px;border-radius:6px;object-fit:contain;border:1px solid #e9ecef;" />
                  <span class="address">{{ logoFile?.name || 'Предпросмотр' }}</span>
                </div>
              </div>

              <!-- ENS домен для логотипа -->
              <div class="form-group">
                <label class="form-label" for="ensDomain">ENS‑домен для логотипа (опционально):</label>
                <input
                  id="ensDomain"
                  type="text"
                  v-model="ensDomain"
                  placeholder="например: vc-hb3-accelerator.eth"
                  class="form-control"
                  @blur="resolveEnsAvatar"
                >
                <small class="form-help">Если указан, попытаемся получить аватар ENS и использовать его как logoURI</small>
                <div v-if="ensResolvedUrl" style="margin-top:8px;display:flex;gap:10px;align-items:center;">
                  <img :src="ensResolvedUrl" alt="ens avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid #e9ecef;" />
                  <span class="address">{{ ensResolvedUrl }}</span>
                </div>
              </div>





              <!-- Партнеры и распределение токенов -->
              <div class="partners-section">
                <h4>Партнеры и распределение токенов</h4>
                
                <div v-for="(partner, index) in dleSettings.partners" :key="index" class="partner-entry">
                  <div class="partner-header">
                    <span class="partner-title">Партнер {{ index + 1 }}</span>
                    <button 
                      v-if="dleSettings.partners.length > 1" 
                      @click="removePartner(index)" 
                      type="button" 
                      class="btn btn-danger btn-sm"
                    >
                      Удалить
                    </button>
                  </div>
                  
                  <div class="form-row">
                    <div class="form-group flex-grow">
                      <label class="form-label">Адрес кошелька:</label>
                      <div class="address-input-group">
                        <input 
                          type="text" 
                          v-model="partner.address" 
                          class="form-control" 
                          placeholder="0x..."
                          @input="validateEthereumAddress(partner, index)"
                        >
                        <button 
                          v-if="index === 0 && address" 
                          @click="useMyWalletAddress" 
                          type="button" 
                          class="btn btn-outline-primary btn-sm"
                          title="Использовать мой адрес кошелька"
                        >
                          <i class="fas fa-wallet"></i> Мой кошелек
                        </button>
                      </div>
                    </div>
                    <div class="form-group">
                      <label class="form-label">Количество токенов:</label>
                      <input 
                        type="number" 
                        v-model.number="partner.amount" 
                        class="form-control" 
                        min="1"
                        placeholder="1"
                      >
                    </div>
                  </div>
                </div>
                
                <div class="partners-actions">
                  <button 
                    @click="addPartner" 
                    type="button" 
                    class="btn btn-secondary"
                  >
                    <i class="fas fa-plus"></i> Добавить партнера
                  </button>
                  
                  <div class="total-tokens">
                    <strong>Общее количество токенов: {{ totalTokens }}</strong>
                  </div>
                </div>

                <!-- Кворум голосования -->
                <div class="quorum-section">
                  <h5>Настройки голосования</h5>
                  <div class="form-group">
                    <label class="form-label" for="governanceQuorum">Кворум подписей партнеров для принятия решений (%):</label>
                    <input 
                      type="number" 
                      id="governanceQuorum" 
                      v-model.number="dleSettings.governanceQuorum" 
                      class="form-control" 
                      min="1"
                      max="100"
                      placeholder="51"
                    >
                    <small class="form-help">
                      Минимальный процент токенов для принятия решений. Рекомендуется 51% или выше.
                    </small>
                  </div>
                </div>
              </div>

              <!-- Мульти-чейн деплой -->
              <div class="multichain-deploy-section">
                <h4>🔗 Мульти-чейн деплой</h4>
                <p class="section-description">
                  Выберите сети для деплоя DLE. Адрес будет одинаковым во всех сетях.
                </p>
                
                <!-- Индикатор загрузки -->
                <div v-if="isLoadingNetworks" class="networks-loading">
                  <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Загрузка доступных сетей...</p>
                  </div>
                </div>
                
                <!-- Чекбоксы сетей -->
                <div v-else-if="availableNetworks.length > 0" class="networks-grid">
                  <div 
                    v-for="network in availableNetworks" 
                    :key="network.chainId"
                    class="network-option"
                    :class="{ 'selected': selectedNetworks.includes(network.chainId) }"
                  >
                    <label class="network-label">
                      <input 
                        type="checkbox" 
                        :value="network.chainId"
                        v-model="selectedNetworks"
                        @change="updateDeployCost"
                      >
                      <div class="network-info">
                        <div class="network-header">
                          <h5>{{ network.name }}</h5>
                          <span class="chain-id">Chain ID: {{ network.chainId }}</span>
                        </div>
                        <p class="network-description">{{ network.description }}</p>
                        <div class="network-cost">
                          <span class="cost">~${{ network.estimatedCost }}</span>
                          <span class="gas-info">{{ network.estimatedGas }} gas</span>
                        </div>
                        <div v-if="network.isLimited" class="network-limited">
                          <small class="text-muted">
                            <i class="fas fa-eye-slash"></i> RPC URL скрыт для безопасности
                          </small>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
                
                <!-- Сообщение об отсутствии сетей -->
                <div v-else-if="!isLoadingNetworks && availableNetworks.length === 0" class="no-networks-message">
                  <div class="empty-state">
                    <i class="fas fa-network-wired"></i>
                    <h5>Нет доступных сетей</h5>
                    <p>Добавьте RPC провайдеры в настройках, чтобы начать работу с мульти-чейн деплоем.</p>
                    <button @click="openRpcSettings" class="btn btn-primary">
                      <i class="fas fa-plus"></i> Добавить RPC провайдера
                    </button>
                  </div>
                </div>
                
                
                <!-- Кнопки управления RPC -->
                <div class="rpc-settings-actions">
                  <button 
                    @click="openRpcSettings" 
                    type="button" 
                    class="btn btn-secondary btn-sm"
                  >
                    <i class="fas fa-plus"></i> Добавить RPC провайдера
                  </button>
                  
                  <button 
                    @click="refreshNetworks" 
                    type="button" 
                    class="btn btn-outline-primary btn-sm"
                    :disabled="isLoadingNetworks"
                  >
                    <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingNetworks }"></i> 
                    {{ isLoadingNetworks ? 'Обновление...' : 'Обновить список' }}
                  </button>
                </div>
              </div>

              

              <!-- Приватный ключ для деплоя -->
              <div class="private-keys-section">
                <h4>🔐 Приватный ключ для деплоя</h4>
                <p class="section-description">
                  Один ключ будет использован для деплоя DLE во всех выбранных сетях
                </p>
                
                <!-- Предупреждение если сети не выбраны -->
                <div v-if="selectedNetworks.length === 0" class="networks-warning">
                  <div class="warning-card">
                    <div class="warning-icon">
                      <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="warning-content">
                      <h5>⚠️ Сначала выберите сети</h5>
                      <p>Для деплоя DLE необходимо выбрать хотя бы одну сеть выше. После выбора сетей здесь появится форма для ввода приватного ключа.</p>
                    </div>
                  </div>
                </div>
                

                
                <!-- Ввод приватного ключа -->
                <div v-if="selectedNetworks.length > 0" class="key-input-section">
                  <div class="form-group">
                    <div class="input-icon-wrapper">
                      <input 
                        :type="showUnifiedKey ? 'text' : 'password'"
                        v-model="unifiedPrivateKey" 
                        class="form-control" 
                        placeholder="Введите приватный ключ (0x... или без префикса)"

                        @input="validatePrivateKey('unified')"
                        @keyup="validatePrivateKey('unified')"
                        @change="validatePrivateKey('unified')"
                      >
                      <span class="input-icon" @click="showUnifiedKey = !showUnifiedKey">
                        <i :class="showUnifiedKey ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                      </span>
                    </div>

                  </div>
                  
                  <!-- Валидация ключа -->
                  <div v-if="keyValidation.unified" class="key-validation">
                    <div v-if="keyValidation.unified.isValid" class="validation-success">
                      <i class="fas fa-check-circle"></i>
                      <span>Адрес кошелька: {{ keyValidation.unified.address }}</span>
                    </div>
                    <div v-else class="validation-error">
                      <i class="fas fa-exclamation-circle"></i>
                      <span>{{ keyValidation.unified.error }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- Ключ блокчейн-скана (Etherscan V2) -->
                <div v-if="selectedNetworks.length > 0" class="preview-item explorer-keys-inline">
                  <div class="explorer-unified-key">
                    <label class="explorer-key-label">Ключ блокчейн-скана (Etherscan V2, единый для всех сетей)</label>
                    <div class="explorer-key-input">
                      <input
                        :type="unifiedScanKeyVisible ? 'text' : 'password'"
                        class="form-control"
                        placeholder="Введите единый API‑ключ Etherscan V2"
                        v-model="etherscanApiKey"
                        autocomplete="off"
                      />
                      <button type="button" class="btn btn-secondary btn-sm"
                        @click="unifiedScanKeyVisible = !unifiedScanKeyVisible">
                        {{ unifiedScanKeyVisible ? 'Скрыть' : 'Показать' }}
                      </button>
                    </div>
                    <div class="explorer-keys-actions">
                      <label><input type="checkbox" v-model="autoVerifyAfterDeploy" /> Авто-верификация после деплоя</label>
                    </div>
                  </div>
                </div>

                <!-- Требования к балансу -->
                <div v-if="selectedNetworks.length > 0" class="balance-requirements">
                  <h5>Требования к балансу:</h5>
                  <div class="balance-grid">
                    <div 
                      v-for="network in selectedNetworkDetails" 
                      :key="network.chainId"
                      class="balance-item"
                    >
                      <div class="network-name">{{ network.name }}</div>
                      <div class="balance-amount">~{{ network.estimatedCost }}</div>
                      <div class="balance-note">для оплаты газа</div>
                    </div>
                  </div>
                  <div class="total-balance">
                    <strong>Общая стоимость деплоя: ~${{ totalDeployCost.toFixed(2) }}</strong>
                  </div>
                </div>
                
                <!-- Рекомендации безопасности -->
                <div v-if="selectedNetworks.length > 0" class="security-recommendations">
                  <div class="security-card">
                    <div class="security-icon">
                      <i class="fas fa-shield-alt"></i>
                    </div>
                    <div class="security-content">
                      <h5>Рекомендации по безопасности:</h5>
                      <ul>
                        <li>Используйте отдельный кошелек только для деплоя DLE</li>
                        <li>Убедитесь, что на кошельке достаточно средств для оплаты газа</li>
                        <li>После успешного деплоя можете передать управление на основной кошелек</li>
                        <li>Храните приватный ключ в безопасном месте</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    <!-- Превью данных под формой -->
    <div class="preview-section-below" v-if="selectedCountryInfo">
      <div class="data-preview">
        <div class="preview-header">
          <h3>Выбранные данные</h3>
        </div>
        
        <!-- Выбранная страна -->
        <div v-if="selectedCountryInfo" class="preview-section">
          <h4>Юрисдикция</h4>
          <div class="preview-item">
            <strong>Страна:</strong> {{ selectedCountryInfo.title }}
          </div>
          <div class="preview-item">
            <strong>Код:</strong> {{ selectedCountryInfo.code }}
          </div>
          <div class="preview-item">
            <strong>Числовой код:</strong> {{ selectedCountryInfo.numeric }}
          </div>
        </div>

        <!-- Основная информация DLE -->
        <div v-if="dleSettings.name || dleSettings.tokenSymbol || logoPreviewUrl" class="preview-section">
          <h4>Основная информация DLE</h4>
          
          <div v-if="logoPreviewUrl" class="preview-item">
            <strong>Логотип:</strong>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
              <img :src="logoPreviewUrl" alt="Logo preview" style="width: 48px; height: 48px; border-radius: 6px; object-fit: contain; border: 1px solid #e9ecef;" />
              <span style="color: #666; font-size: 0.9em;">{{ logoFile?.name || 'ENS аватар' || 'Дефолтный логотип' }}</span>
            </div>
          </div>
          
          <div v-if="dleSettings.name" class="preview-item">
            <strong>Название:</strong> {{ dleSettings.name }}
          </div>
          
          <div v-if="dleSettings.tokenSymbol" class="preview-item">
            <strong>Токен:</strong> {{ dleSettings.tokenSymbol }}
          </div>
          

        </div>



        <!-- Партнеры и токены -->
        <div v-if="dleSettings.partners.length > 0 && dleSettings.partners.some(p => p.address || p.amount > 1) && selectedCountryInfo" class="preview-section">
          <h4>Партнеры и токены</h4>
          
          <div v-for="(partner, index) in dleSettings.partners" :key="index">
            <div v-if="partner.address || partner.amount > 1" class="preview-item">
              <strong>Партнер {{ index + 1 }}:</strong>
              <div class="partner-details">
                <div v-if="partner.address" class="partner-address">
                  Адрес: {{ partner.address.substring(0, 10) }}...{{ partner.address.substring(partner.address.length - 8) }}
                </div>
                <div class="partner-tokens">
                  Токенов: {{ partner.amount }}
                </div>
              </div>
            </div>
          </div>
          
          <div class="preview-item">
            <strong>Общий эмиссия:</strong> {{ totalTokens }} токенов
          </div>
          
          <div class="preview-item">
            <strong>Кворум подписей партнеров:</strong> {{ dleSettings.governanceQuorum }}%
          </div>
        </div>

        <!-- Мульти-чейн деплой -->
        <div v-if="hasSelectedNetworks" class="preview-section">
          <h4>🔗 Мульти-чейн деплой</h4>
          
          <!-- <div class="preview-item">
            <strong> Адрес DLE:</strong> {{ predictedAddress || 'Вычисляется...' }}
          </div> -->
          
          <div class="preview-item">
            <strong>Выбранные сети:</strong>
            <ul class="networks-list">
              <li v-for="network in selectedNetworkDetails" :key="network.chainId">
                {{ network.name }} (Chain ID: {{ network.chainId }}) - ~${{ network.estimatedCost }}
              </li>
            </ul>
          </div>
          
          <div class="preview-item">
            <strong>Общая стоимость:</strong> ~${{ totalDeployCost.toFixed(2) }}
          </div>

          <!-- Предсказанные адреса скрыты, чтобы не создавать шум при отсутствии данных -->
        </div>

        

        <!-- Приватный ключ -->
        <div v-if="hasSelectedNetworks && unifiedPrivateKey" class="preview-section">
          <h4>🔐 Приватный ключ</h4>
          
          <div class="preview-item">
            <strong>Ключ:</strong> ***{{ unifiedPrivateKey.slice(-4) }}
          </div>
          
          <div v-if="keyValidation.unified && keyValidation.unified.isValid" class="preview-item">
            <strong>📍 Адрес кошелька:</strong> {{ keyValidation.unified.address.substring(0, 10) }}...{{ keyValidation.unified.address.substring(keyValidation.unified.address.length - 8) }}
          </div>
          
          
          
          <div class="preview-item">
            <strong>💰 Требуемый баланс:</strong> ~${{ totalDeployCost.toFixed(2) }}
          </div>
        </div>

        <!-- Данные для смарт-контракта -->
        <div v-if="dleSettings.jurisdiction === '643'" class="preview-section">
          <h4>Данные адреса</h4>
          
          <!-- Данные адреса (компактно) -->
          <div v-if="hasAddressData" class="preview-item">
            <div class="compact-address">
              <div class="address-line">{{ compactAddressString }}</div>
              <div v-if="lastApiResult && lastApiResult.coordinates && dleSettings.addressData.isVerified" class="coordinates-line">
                {{ lastApiResult.coordinates.lat }} {{ lastApiResult.coordinates.lon }}
              </div>
              <div v-if="dleSettings.selectedOktmo" class="oktmo-line">
                ОКТМО: {{ dleSettings.selectedOktmo }}
              </div>
            </div>
          </div>


          
          <!-- Основной ОКВЭД -->
          <div v-if="selectedMainOkvedInfo" class="preview-item">
            <strong>📊 Основной ОКВЭД:</strong> {{ selectedMainOkvedInfo.code }} - {{ selectedMainOkvedInfo.title }}
          </div>
          
          <!-- Дополнительные ОКВЭД -->
          <div v-if="dleSettings.selectedOkved.length > 0" class="preview-item">
            <strong>📋 Дополнительные ОКВЭД:</strong>
            <ul class="okved-list">
              <li v-for="code in dleSettings.selectedOkved" :key="code">
                {{ code }}
              </li>
            </ul>
          </div>

          <!-- КПП код -->
          <div v-if="selectedKppInfo" class="preview-item">
            <strong>🏢 КПП:</strong> {{ selectedKppInfo.code }} - {{ selectedKppInfo.title }}
          </div>
          
          <!-- Координаты -->
          <div v-if="dleSettings.coordinates" class="preview-item">
            <strong>📍Координаты:</strong> {{ dleSettings.coordinates }}
          </div>
          
          <!-- Кнопка деплоя смарт-контрактов -->
          <div class="deploy-section">
            <!-- Информация о поэтапном деплое -->
            <div class="deployment-info">
              <h4>🚀 Поэтапный деплой DLE</h4>
              <p class="deployment-description">
                Автоматический деплой DLE контракта и всех модулей с проверками, верификацией и инициализацией во всех выбранных сетях
              </p>
              <div class="deployment-features">
                <div class="feature-item">
                  <i class="fas fa-check-circle"></i>
                  <span>Деплой DLE контракта во всех сетях</span>
                </div>
                <div class="feature-item">
                  <i class="fas fa-check-circle"></i>
                  <span>Автоматическая верификация контрактов</span>
                </div>
                <div class="feature-item">
                  <i class="fas fa-check-circle"></i>
                  <span>Деплой и инициализация всех модулей</span>
                </div>
                <div class="feature-item">
                  <i class="fas fa-check-circle"></i>
                  <span>Повторы при ошибках сети</span>
                </div>
              </div>
            </div>

            <div class="deploy-buttons">
              <button 
                @click="deploySmartContracts" 
                type="button" 
                class="btn btn-primary btn-lg deploy-btn"
                :disabled="!isFormValid || !canManageSettings || adminTokenCheck.isLoading"
                :title="`isFormValid: ${isFormValid}, canManageSettings: ${canManageSettings}, isLoading: ${adminTokenCheck.isLoading}`"
              >
                <i class="fas fa-cogs"></i> 
                Поэтапный деплой DLE
              </button>
              <button 
                v-if="hasSelectedData" 
                @click="clearAllData" 
                class="btn btn-danger btn-lg clear-btn"
                title="Очистить все данные"
                :disabled="false"
              >
                Удалить все
              </button>
            </div>


          </div>
        </div>

        <!-- Заглушка если ничего не выбрано -->
        <div v-if="!selectedCountryInfo" class="preview-empty">
          <p>Выберите страну, чтобы увидеть данные здесь</p>
        </div>
      </div>
    </div>

    <!-- Мастер поэтапного деплоя -->
    <div v-if="showDeploymentWizard" class="deployment-wizard-overlay">
      <div class="wizard-container">
        <DeploymentWizard
          :private-key="unifiedPrivateKey"
          :selected-networks="selectedNetworks"
          :dle-data="dleSettings"
          :logo-uri="getLogoURI()"
          :etherscan-api-key="etherscanApiKey"
          :auto-verify-after-deploy="autoVerifyAfterDeploy"
          @deployment-completed="handleDeploymentCompleted"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { usePermissions } from '@/composables/usePermissions';
import api from '@/api/axios';
import DeploymentWizard from '@/components/deployment/DeploymentWizard.vue';
import eventBus from '@/utils/eventBus';

const router = useRouter();
// Нормализация приватного ключа: убираем пробелы/"0x", посторонние символы,
// приводим к нижнему регистру и дополняем ведущими нулями до 64 символов
function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let pk = raw.trim().replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (pk.length === 64) return '0x' + pk;
  if (pk.length > 64) return '';
  if (/^[0-9a-fA-F]*$/.test(pk)) return '0x' + pk.padStart(64, '0');
  return '';
}


// Получаем контекст авторизации для адреса кошелька
const { address } = useAuthContext();
const { canManageSettings } = usePermissions();

// Обработчики событий будут определены после функций clearAllData и resetUIState

// Подписка на события авторизации (как в других файлах проекта)
let unsubscribe = null;

// Состояние для проверки админских токенов
const adminTokenCheck = ref({
  isLoading: false,
  canManageSettings: false,
  error: null
});

// Обработка события изменения авторизации
const handleAuthEvent = (eventData) => {
  console.log('[DleDeployFormView] Получено событие изменения авторизации:', eventData);
  
  // Если пользователь отключился, сбрасываем все данные формы
  if (!eventData.authenticated) {
    console.log('[DleDeployFormView] User disconnected, clearing form data');
    clearAllData();
    resetUIState();
  } else {
    // При подключении обновляем проверку токенов
    checkAdminTokens();
  }
};

// Watcher для отслеживания изменений в правах доступа
watch(canManageSettings, (newValue, oldValue) => {
  console.log('[DleDeployFormView] canManageSettings changed:', { oldValue, newValue });
  // При изменении прав обновляем локальное состояние
  adminTokenCheck.value.canManageSettings = newValue;
}, { immediate: true });

// Основные настройки DLE
const dleSettings = reactive({
  // Юрисдикция
  jurisdiction: '',
  
  // Российские классификаторы (только для РФ)
  selectedOktmo: '',      // ОКТМО - муниципальные образования
  kppCode: '',            // КПП - код причины постановки на учет
  
  // Адресные данные для ручного заполнения
  addressData: {
    postalCode: '',       // Почтовый индекс
    region: '',           // Регион/область  
    city: '',             // Город
    street: '',           // Улица
    building: '',         // Номер дома
    apartment: '',        // Квартира/офис
    fullAddress: '',      // Итоговый проверенный адрес
    isVerified: false     // Прошел ли проверку
  },
  
  mainOkvedCode: '',      // Основной код ОКВЭД
  selectedOkved: [],      // ОКВЭД - дополнительные коды деятельности
  name: '',                // Имя DLE
  tokenSymbol: '',        // Символ токена
  partners: [{ address: '', amount: 1 }], // Партнеры и их доли токенов
  governanceQuorum: 51,   // Кворум для принятия решений (%)
  
  // Мульти-чейн настройки
  selectedNetworks: [],   // Выбранные сети для деплоя [chainId1, chainId2...]
  tokenStandard: 'ERC20', // Стандарт токена (ERC20, ERC721, ERC1155, ERC4626)
  predictedAddress: '',   // Предсказанный адрес DLE
  
  // Устаревшие поля (для совместимости)
  deployNetwork: '',      // Заменено на selectedNetworks
  privateKey: '',         // Заменено на privateKeys объект
  coordinates: '',        // Координаты для DLE
});

// Состояние UI (минимально необходимое)

// Состояние для работы со странами
const countriesOptions = ref([]);
const isLoadingCountries = ref(false);

// Состояние для российских классификаторов
const russianClassifiers = reactive({
  oktmo: [],
  okved: []
});
const isLoadingRussianClassifiers = ref(false);

// Состояние для поиска адресов
const postalCodeInput = ref('');     // Поле ввода индекса
const searchResults = ref([]);       // Результаты поиска по индексу
const isSearchingAddress = ref(false);
const autoSelectedOktmo = ref(false); // Флаг автоматического выбора ОКТМО
const lastApiResult = ref(null);     // Последний результат от API
let searchTimeout = null;

// ==================== МУЛЬТИ-ЧЕЙН СОСТОЯНИЕ ====================

// Мульти-чейн состояние для сетей
const selectedNetworks = ref([]);
const availableNetworks = ref([]);
const isLoadingNetworks = ref(false);
const totalDeployCost = ref(0);
// const predictedAddress = ref('');
// const predictedAddresses = reactive({}); // { chainId: address }
// const isPredicting = ref(false);

// Ключ блокчейн-скана (единый Etherscan V2)
// Единый ключ Etherscan V2 и авто-верификация
const etherscanApiKey = ref('');
const unifiedScanKeyVisible = ref(false);
const autoVerifyAfterDeploy = ref(true);

// Состояние для приватных ключей
const useSameKeyForAllChains = ref(true);
const unifiedPrivateKey = ref('');

// Состояние мастера деплоя
const showDeploymentWizard = ref(false);
const deployedDLEAddress = ref('');
const privateKeys = reactive({});
const privateKeyVisibility = reactive({});
const keyValidation = reactive({});
const showUnifiedKey = ref(false);

// ==================== СТАНДАРТ ТОКЕНОВ DLE ====================

// DLE использует стандарт ERC-20
const DLE_TOKEN_STANDARD = 'ERC20';

// Устаревшие состояния (для совместимости)
const showPrivateKey = ref(false);

// Вычисляемые свойства для превью данных
const selectedCountryInfo = computed(() => {
  if (!dleSettings.jurisdiction) return null;
  return countriesOptions.value.find(country => country.numeric === dleSettings.jurisdiction);
});



const selectedMainOkvedInfo = computed(() => {
  if (!dleSettings.mainOkvedCode) return null;
  return russianClassifiers.okved.find(okved => okved.code === dleSettings.mainOkvedCode);
});

// Информация о выбранном КПП коде
const selectedKppInfo = computed(() => {
  if (!dleSettings.kppCode) return null;
  return kppCodes.value.find(kpp => kpp.code === dleSettings.kppCode);
});

// Общее количество токенов
const totalTokens = computed(() => {
  return dleSettings.partners.reduce((sum, partner) => sum + (Number(partner.amount) || 0), 0);
});

// ==================== МУЛЬТИ-ЧЕЙН COMPUTED PROPERTIES ====================

// Выбранные сети для деплоя
const selectedNetworkDetails = computed(() => {
  return availableNetworks.value.filter(network => 
    selectedNetworks.value.includes(network.chainId)
  );
});

// Проверка есть ли выбранные сети
const hasSelectedNetworks = computed(() => {
  return selectedNetworks.value.length > 0;
});

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => {
    // no-op
  }).catch(() => {});
}

// Информация о выбранном стандарте токена
const selectedTokenStandardInfo = computed(() => {
  return tokenStandardsData[dleSettings.tokenStandard] || null;
});

// Информация о выбранной сети для деплоя (устаревшее - для совместимости)
const selectedNetworkInfo = computed(() => {
  if (!dleSettings.deployNetwork) return null;
  return availableNetworks.value.find(network => network.network_id === dleSettings.deployNetwork);
});

// Информация об автоматически выбранном ОКТМО
const autoSelectedOktmoInfo = computed(() => {
  if (!dleSettings.selectedOktmo || !autoSelectedOktmo.value) return null;
  return russianClassifiers.oktmo.find(oktmo => oktmo.code === dleSettings.selectedOktmo);
});

// ===== КАСКАДНАЯ СИСТЕМА КЛАССИФИКАТОРОВ =====

// Состояние для загрузки и опций ОКВЭД/ISIC
const okvedLevel1Options = ref([]);
const okvedLevel2Options = ref([]);
const okvedLevel3Options = ref([]);

// Состояние для загрузки ISIC кодов
const isicLevel1Options = ref([]);
const isicLevel2Options = ref([]);
const isicLevel3Options = ref([]);
const isicLevel4Options = ref([]);
const okvedLevel4Options = ref([]);

const isLoadingOkvedLevel1 = ref(false);
const isLoadingOkvedLevel2 = ref(false);
const isLoadingOkvedLevel3 = ref(false);

// Состояние загрузки ISIC
const isLoadingIsicLevel1 = ref(false);
const isLoadingIsicLevel2 = ref(false);
const isLoadingIsicLevel3 = ref(false);
const isLoadingIsicLevel4 = ref(false);
const isLoadingOkvedLevel4 = ref(false);

// Состояние для КПП кодов
const kppCodes = ref([]);
const isLoadingKppCodes = ref(false);

// Выбранные значения на каждом уровне ОКВЭД
const selectedOkvedLevel1 = ref('');
const selectedOkvedLevel2 = ref('');
const selectedOkvedLevel3 = ref('');
const selectedOkvedLevel4 = ref('');

// Выбранные значения на каждом уровне ISIC
const selectedIsicLevel1 = ref('');
const selectedIsicLevel2 = ref('');
const selectedIsicLevel3 = ref('');
const selectedIsicLevel4 = ref('');

// Текущий выбранный код ОКВЭД
const currentSelectedOkvedCode = ref('');
const currentSelectedOkvedText = ref('');

// Текущий выбранный код ISIC
const currentSelectedIsicCode = ref('');
const currentSelectedIsicText = ref('');


// Функция определения уровня ОКВЭД кода
const getOkvedLevel = (code) => {
  if (!code) return 0;
  const parts = code.split('.');
  if (parts.length === 1) return 1; // 01
  if (parts.length === 2 && parts[1].length === 1) return 2; // 01.1
  if (parts.length === 2 && parts[1].length === 2) return 3; // 01.11
  if (parts.length === 3) return 4; // 01.11.1
  return parts.length + 1; // для более глубоких уровней
};

// Функция для загрузки ISIC кодов определенного уровня
const fetchIsicCodes = async (level, parentCode, optionsRef, loadingRef) => {
  loadingRef.value = true;
  optionsRef.value = [];
  
  try {
    console.log(`[DleDeployForm] Загрузка ISIC уровень ${level}, родитель: ${parentCode || 'root'}`);
    
    const params = {
      level: level,
      limit: 1000 // Увеличиваем лимит для получения всех кодов
    };
    
    if (parentCode) {
      params.parent_code = parentCode;
    }
    
    const response = await api.get('/isic/codes', { params });
    
    if (response.data && response.data.codes) {
      optionsRef.value = response.data.codes.map(code => ({
        value: code.code,
        text: `${code.code} - ${code.description}`
      }));
      
      console.log(`[DleDeployForm] Загружено ISIC кодов уровня ${level}: ${optionsRef.value.length}`);
    } else {
      console.error('[DleDeployForm] Ошибка ответа API ISIC:', response.data);
    }
  } catch (error) {
    console.error('[DleDeployForm] Ошибка при загрузке ISIC кодов:', error);
  } finally {
    loadingRef.value = false;
  }
};

// Функция для загрузки ОКВЭД кодов определенного уровня
const fetchOkvedCodes = async (level, parentCode, optionsRef, loadingRef) => {
      // console.log(`🔍 fetchOkvedCodes вызвана: level=${level}, parentCode=${parentCode || 'root'}`);
  
  if (!optionsRef || !loadingRef) {
    // console.error('[DleDeployForm] fetchOkvedCodes requires optionsRef and loadingRef');
    return;
  }
  
  loadingRef.value = true;
  optionsRef.value = [];
  
  try {
    // console.log(`[DleDeployForm] Загрузка ОКВЭД уровень ${level}, родитель: ${parentCode || 'root'}`);
    // console.log(`[DleDeployForm] Доступно ОКВЭД кодов: ${russianClassifiers.okved?.length || 0}`);
    
    // Фильтруем коды из уже загруженных данных
    let filteredCodes = [];
    
    if (level === 1) {
      // Уровень 1: классы ОКВЭД (01.11, 01.12, 02.10...)
      filteredCodes = russianClassifiers.okved.filter(code => {
        const parts = code.code.split('.');
        return parts.length === 2 && parts[1].length === 2; // формат XX.YY
      });
    } else if (level === 2 && parentCode) {
      // Уровень 2: подклассы (01.11.1, 01.11.2... для родителя 01.11)
      filteredCodes = russianClassifiers.okved.filter(code => 
        code.code.startsWith(parentCode + '.') && 
        code.code.split('.').length === 3
      );
    }
    
    // Сортировка кодов ОКВЭД по коду (правильная числовая сортировка для каждой части)
    filteredCodes.sort((a, b) => {
      // Разбиваем коды на части для правильной сортировки
      const partsA = a.code.split('.').map(p => parseInt(p, 10));
      const partsB = b.code.split('.').map(p => parseInt(p, 10));
      
      // Сравниваем части по порядку численно
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] !== undefined ? partsA[i] : 0;
        const partB = partsB[i] !== undefined ? partsB[i] : 0;
        
        if (partA !== partB) {
          return partA - partB;
        }
      }
      return 0;
    });
    
    optionsRef.value = filteredCodes.map(code => ({
      value: code.code,
      text: `${code.code} - ${code.title}`
    }));
    
    // console.log(`[DleDeployForm] Загружено ОКВЭД кодов уровня ${level}: ${optionsRef.value.length}`);
    // console.log(`[DleDeployForm] Первые 3 кода:`, optionsRef.value.slice(0, 3));
    
  } catch (error) {
    // console.error('[DleDeployForm] Ошибка при загрузке ОКВЭД кодов:', error);
  } finally {
    loadingRef.value = false;
  }
};

// Функция для обновления текущего выбранного кода ISIC
const updateCurrentIsicSelection = () => {
  let code = '';
  let text = '';
  let optionsToSearch = [];
  let valueToFind = '';

  // Приоритет: сначала подкласс, потом класс, потом группа, потом раздел
  if (selectedIsicLevel4.value) {
    code = selectedIsicLevel4.value;
    optionsToSearch = isicLevel4Options.value;
    valueToFind = selectedIsicLevel4.value;
  } else if (selectedIsicLevel3.value) {
    code = selectedIsicLevel3.value;
    optionsToSearch = isicLevel3Options.value;
    valueToFind = selectedIsicLevel3.value;
  } else if (selectedIsicLevel2.value) {
    code = selectedIsicLevel2.value;
    optionsToSearch = isicLevel2Options.value;
    valueToFind = selectedIsicLevel2.value;
  } else if (selectedIsicLevel1.value) {
    code = selectedIsicLevel1.value;
    optionsToSearch = isicLevel1Options.value;
    valueToFind = selectedIsicLevel1.value;
  }

  if (code && optionsToSearch.length > 0 && valueToFind) {
    const foundOption = optionsToSearch.find(opt => opt.value === valueToFind);
    if (foundOption) {
      text = foundOption.text;
    } else {
      text = code;
    }
  }

  currentSelectedIsicCode.value = code;
  currentSelectedIsicText.value = text;
};

// Функция для обновления текущего выбранного кода ОКВЭД
const updateCurrentOkvedSelection = () => {
  let code = '';
  let text = '';
  let optionsToSearch = [];
  let valueToFind = '';

  // Приоритет: сначала подкласс, потом класс
  if (selectedOkvedLevel2.value) {
    code = selectedOkvedLevel2.value;
    optionsToSearch = okvedLevel2Options.value;
    valueToFind = selectedOkvedLevel2.value;
  } else if (selectedOkvedLevel1.value) {
    code = selectedOkvedLevel1.value;
    optionsToSearch = okvedLevel1Options.value;
    valueToFind = selectedOkvedLevel1.value;
  }

  if (code && optionsToSearch.length > 0 && valueToFind) {
    const foundOption = optionsToSearch.find(opt => opt.value === valueToFind);
    if (foundOption) {
      text = foundOption.text;
    }
  }
  
  currentSelectedOkvedCode.value = code;
  currentSelectedOkvedText.value = text;
};

// Watchers для 2-уровневой загрузки ОКВЭД
watch(selectedOkvedLevel1, (newVal) => {
  // console.log('[DleDeployForm] selectedOkvedLevel1 changed to:', newVal);
  selectedOkvedLevel2.value = ''; 
  okvedLevel2Options.value = [];
  
  if (newVal) {
    fetchOkvedCodes(2, newVal, okvedLevel2Options, isLoadingOkvedLevel2);
  }
  updateCurrentOkvedSelection();
});

watch(selectedOkvedLevel2, () => {
  // console.log('[DleDeployForm] selectedOkvedLevel2 changed to:', selectedOkvedLevel2.value);
  updateCurrentOkvedSelection();
});

// Watchers для ISIC
watch(selectedIsicLevel1, (newVal) => {
  selectedIsicLevel2.value = '';
  selectedIsicLevel3.value = '';
  selectedIsicLevel4.value = '';
  if (newVal) {
    fetchIsicCodes(2, newVal, isicLevel2Options, isLoadingIsicLevel2);
  } else {
    isicLevel2Options.value = [];
    isicLevel3Options.value = [];
    isicLevel4Options.value = [];
  }
  updateCurrentIsicSelection();
});

watch(selectedIsicLevel2, (newVal) => {
  selectedIsicLevel3.value = '';
  selectedIsicLevel4.value = '';
  if (newVal) {
    fetchIsicCodes(3, newVal, isicLevel3Options, isLoadingIsicLevel3);
  } else {
    isicLevel3Options.value = [];
    isicLevel4Options.value = [];
  }
  updateCurrentIsicSelection();
});

watch(selectedIsicLevel3, (newVal) => {
  selectedIsicLevel4.value = '';
  if (newVal) {
    fetchIsicCodes(4, newVal, isicLevel4Options, isLoadingIsicLevel4);
  } else {
    isicLevel4Options.value = [];
  }
  updateCurrentIsicSelection();
});

watch(selectedIsicLevel4, () => {
  updateCurrentIsicSelection();
});

// Функция добавления выбранного ISIC кода в список
const addIsicCode = () => {
  if (currentSelectedIsicCode.value && currentSelectedIsicText.value) {
    const alreadyExists = dleSettings.selectedOkved.find(c => c === currentSelectedIsicCode.value);
    if (!alreadyExists) {
      dleSettings.selectedOkved.push(currentSelectedIsicCode.value);
      dleSettings.mainOkvedCode = currentSelectedIsicCode.value; // Обновляем основной код
      
      // Сбрасываем селекторы для выбора следующего кода
      selectedIsicLevel1.value = '';
      selectedIsicLevel2.value = '';
      selectedIsicLevel3.value = '';
      selectedIsicLevel4.value = '';
      // Остальные опции сбросятся через watchers
    } else {
      alert('Этот код уже добавлен.');
    }
  } else {
    alert('Код не выбран полностью.');
  }
};

// Функция добавления выбранного ОКВЭД кода в список
const addOkvedCode = () => {
  if (currentSelectedOkvedCode.value && currentSelectedOkvedText.value) {
    const alreadyExists = dleSettings.selectedOkved.find(c => c === currentSelectedOkvedCode.value);
    if (!alreadyExists) {
      dleSettings.selectedOkved.push(currentSelectedOkvedCode.value);
      dleSettings.mainOkvedCode = currentSelectedOkvedCode.value; // Обновляем основной код
      
      // Сбрасываем селекторы для выбора следующего кода
      selectedOkvedLevel1.value = '';
      // Остальные уровни сбросятся через watchers
    } else {
      alert('Этот код уже добавлен.');
    }
  } else {
    alert('Код не выбран полностью.');
  }
};

// Функция получения названия ОКВЭД кода
const getOkvedTitle = (code) => {
  const okvedItem = russianClassifiers.okved.find(item => item.code === code);
  return okvedItem ? `${code} - ${okvedItem.title}` : code;
};

// Функция удаления ОКВЭД кода из списка
const removeOkvedCode = (index) => {
  dleSettings.selectedOkved.splice(index, 1);
  
  // Если удалили основной код, берем первый из оставшихся или очищаем
  if (dleSettings.selectedOkved.length > 0) {
    dleSettings.mainOkvedCode = dleSettings.selectedOkved[0];
  } else {
    dleSettings.mainOkvedCode = '';
  }
};

// Компактная строка адреса для отображения
const compactAddressString = computed(() => {
  const parts = [];
  
  // Добавляем компоненты адреса через запятую
  if (dleSettings.addressData.postalCode) parts.push(dleSettings.addressData.postalCode);
  if (dleSettings.addressData.region) parts.push(dleSettings.addressData.region);
  if (dleSettings.addressData.city) parts.push(dleSettings.addressData.city);
  if (dleSettings.addressData.street) parts.push(dleSettings.addressData.street);
  if (dleSettings.addressData.building) parts.push(dleSettings.addressData.building);
  if (dleSettings.addressData.apartment) parts.push(dleSettings.addressData.apartment);
  
  return parts.join(', ');
});

// Проверка есть ли данные адреса
const hasAddressData = computed(() => {
  const addr = dleSettings.addressData;
  return addr.postalCode || addr.region || addr.city || addr.street || addr.building || addr.apartment || addr.fullAddress;
});

// Проверка можно ли проверять адрес
const canVerifyAddress = computed(() => {
  const addr = dleSettings.addressData;
  return addr.postalCode && addr.city && addr.street && addr.building;
});

// Форматированный черновик адреса
const formattedDraftAddress = computed(() => {
  const addr = dleSettings.addressData;
  const parts = [
    addr.postalCode,
    addr.region,
    addr.city,
    addr.street,
    addr.building,
    addr.apartment
  ].filter(Boolean);
  return parts.join(', ') || 'Заполните поля адреса';
});

// Фильтрованные данные API (исключаем ненужные поля)
const filteredApiData = computed(() => {
  if (!lastApiResult.value || !lastApiResult.value.rawData) return {};
  
  const excluded = ['licence', 'osm_type', 'osm_id', 'place_id', 'boundingbox'];
  const data = lastApiResult.value.rawData;
  
  return Object.keys(data)
    .filter(key => !excluded.includes(key) && data[key])
    .reduce((obj, key) => {
      obj[key] = data[key];
      return obj;
    }, {});
});

// Данные для блокчейна (оптимизированные)
const blockchainData = computed(() => {
  if (!lastApiResult.value || !lastApiResult.value.coordinates) return null;
  
  return {
    // Координаты масштабированные на 1e6 для целых чисел в Solidity
    latitude: Math.round(lastApiResult.value.coordinates.lat * 1000000),
    longitude: Math.round(lastApiResult.value.coordinates.lon * 1000000),
    postalCode: dleSettings.addressData.postalCode || '',
    oktmoCode: dleSettings.selectedOktmo || ''
  };
});

// Примерная стоимость газа для хранения данных
const estimatedGasCost = computed(() => {
  if (!blockchainData.value) return 0;
  
  // Примерный расчет газа:
  // int256 (latitude) - 20,000 gas
  // int256 (longitude) - 20,000 gas  
  // string (postalCode) - ~600 gas per byte
  // string (oktmoCode) - ~600 gas per byte
  
  const baseGas = 40000; // координаты
  const postalCodeGas = (blockchainData.value.postalCode.length || 0) * 600;
  const oktmoGas = (blockchainData.value.oktmoCode.length || 0) * 600;
  
  return baseGas + postalCodeGas + oktmoGas;
});

// Форматирование ключей API для отображения
const formatApiKey = (key) => {
  const translations = {
    'country': 'Страна',
    'state': 'Регион/область',
    'city': 'Город',
    'town': 'Городок',
    'village': 'Деревня',
    'road': 'Дорога',
    'house_number': 'Номер дома',
    'postcode': 'Почтовый индекс',
    'country_code': 'Код страны',
    'suburb': 'Район',
    'neighbourhood': 'Микрорайон',
    'amenity': 'Объект',
    'building': 'Здание'
  };
  
  return translations[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

// Проверка есть ли выбранные данные
const hasSelectedData = computed(() => {
  return dleSettings.jurisdiction || 
         hasAddressData.value ||
         dleSettings.mainOkvedCode || 
         (dleSettings.selectedOkved && dleSettings.selectedOkved.length > 0) ||
         dleSettings.kppCode ||
         dleSettings.name ||
         dleSettings.tokenSymbol ||
         (dleSettings.partners && dleSettings.partners.some(p => p.address || p.amount > 1)) ||
         // Мульти-чейн данные
         (dleSettings.selectedNetworks && dleSettings.selectedNetworks.length > 0) ||
         dleSettings.tokenStandard !== 'ERC20' ||
         // dleSettings.predictedAddress ||
         unifiedPrivateKey.value ||
         Object.keys(privateKeys).length > 0 ||
         // Устаревшие поля
         dleSettings.deployNetwork ||
         dleSettings.privateKey;
});

// Функции для работы с localStorage
const STORAGE_KEY = 'dle_form_data';

// Сохранение данных в localStorage с дебаунсом
const saveFormData = () => {
  // Очищаем предыдущий таймер
  if (saveFormData.timeout) {
    clearTimeout(saveFormData.timeout);
  }
  
  // Устанавливаем новый таймер для дебаунса
  saveFormData.timeout = setTimeout(() => {
    try {
      const dataToSave = {
        ...dleSettings,
        // Сохраняем также выбранные уровни ОКВЭД
        selectedOkvedLevel1: selectedOkvedLevel1.value,
        selectedOkvedLevel2: selectedOkvedLevel2.value,
        postalCodeInput: postalCodeInput.value,
        searchResults: searchResults.value,
        lastApiResult: lastApiResult.value,
        autoSelectedOktmo: autoSelectedOktmo.value,
        // Мульти-чейн данные
        selectedNetworks: selectedNetworks.value,
        totalDeployCost: totalDeployCost.value,
        // predictedAddress: predictedAddress.value,
        useSameKeyForAllChains: useSameKeyForAllChains.value,
        unifiedPrivateKey: unifiedPrivateKey.value,
        privateKeys: { ...privateKeys },
        privateKeyVisibility: { ...privateKeyVisibility },
        keyValidation: { ...keyValidation },
        showUnifiedKey: showUnifiedKey.value,
        // Ключи сканов/автоверификация
        etherscanApiKey: etherscanApiKey.value,
        autoVerifyAfterDeploy: autoVerifyAfterDeploy.value,
        unifiedScanKeyVisible: unifiedScanKeyVisible.value
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      console.log('[DleDeployForm] Данные формы сохранены в localStorage');
      console.log('[DleDeployForm] Coordinates saved:', dataToSave.coordinates);
    } catch (error) {
      // console.error('[DleDeployForm] Ошибка сохранения данных:', error);
    }
  }, 500); // Задержка 500мс
};

// Восстановление данных из localStorage
const loadFormData = () => {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      
      // Восстанавливаем основные настройки DLE
      Object.assign(dleSettings, {
        jurisdiction: parsedData.jurisdiction || '',
        selectedOktmo: parsedData.selectedOktmo || '',
        kppCode: parsedData.kppCode || '',
        addressData: parsedData.addressData || {
          postalCode: '',
          region: '',
          city: '',
          street: '',
          building: '',
          apartment: '',
          fullAddress: '',
          isVerified: false
        },
        mainOkvedCode: parsedData.mainOkvedCode || '',
        selectedOkved: parsedData.selectedOkved || [],
        name: parsedData.name || '',
        tokenSymbol: parsedData.tokenSymbol || '',

        partners: parsedData.partners || [{ address: '', amount: 1 }],
        governanceQuorum: parsedData.governanceQuorum || 51,
        // Координаты
        coordinates: parsedData.coordinates || '',
        // Мульти-чейн настройки
        selectedNetworks: parsedData.selectedNetworks || [],
        tokenStandard: parsedData.tokenStandard || 'ERC20',
        // predictedAddress: parsedData.predictedAddress || '',
        // Устаревшие поля
        deployNetwork: parsedData.deployNetwork || '',
        privateKey: parsedData.privateKey || ''
      });

      // Восстанавливаем состояние ОКВЭД
      selectedOkvedLevel1.value = parsedData.selectedOkvedLevel1 || '';
      selectedOkvedLevel2.value = parsedData.selectedOkvedLevel2 || '';
      
      // Восстанавливаем состояние поиска адреса
      postalCodeInput.value = parsedData.postalCodeInput || '';
      searchResults.value = parsedData.searchResults || [];
      lastApiResult.value = parsedData.lastApiResult || null;
      autoSelectedOktmo.value = parsedData.autoSelectedOktmo || false;
      
      // Восстанавливаем мульти-чейн состояние
      selectedNetworks.value = parsedData.selectedNetworks || [];
      totalDeployCost.value = parsedData.totalDeployCost || 0;
              // predictedAddress.value = parsedData.predictedAddress || '';
      useSameKeyForAllChains.value = parsedData.useSameKeyForAllChains !== undefined ? parsedData.useSameKeyForAllChains : true;
      unifiedPrivateKey.value = parsedData.unifiedPrivateKey || '';
      Object.assign(privateKeys, parsedData.privateKeys || {});
      Object.assign(privateKeyVisibility, parsedData.privateKeyVisibility || {});
      Object.assign(keyValidation, parsedData.keyValidation || {});
      showUnifiedKey.value = parsedData.showUnifiedKey || false;

      // Восстанавливаем ключи сканов/автопараметры
      etherscanApiKey.value = parsedData.etherscanApiKey || '';
      autoVerifyAfterDeploy.value = !!parsedData.autoVerifyAfterDeploy;
      unifiedScanKeyVisible.value = !!parsedData.unifiedScanKeyVisible;

      console.log('[DleDeployForm] Данные формы восстановлены из localStorage');
      console.log('[DleDeployForm] Coordinates loaded:', dleSettings.coordinates);
      return true;
    }
  } catch (error) {
    // console.error('[DleDeployForm] Ошибка восстановления данных:', error);
  }
  return false;
};

// Очистка данных localStorage
const clearStoredData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // console.log('[DleDeployForm] Данные формы удалены из localStorage');
  } catch (error) {
    // console.error('[DleDeployForm] Ошибка очистки localStorage:', error);
  }
};

// Методы (функция goBack перенесена в SettingsView.vue)

// Очистка всех выбранных данных
const clearAllData = () => {
  dleSettings.jurisdiction = '';
  dleSettings.selectedOktmo = '';
  dleSettings.kppCode = '';
  dleSettings.addressData = {
    postalCode: '',
    region: '',
    city: '',
    street: '',
    building: '',
    apartment: '',
    fullAddress: '',
    isVerified: false
  };
  dleSettings.mainOkvedCode = '';
  dleSettings.selectedOkved = [];
  dleSettings.name = '';
  dleSettings.tokenSymbol = '';

  dleSettings.partners = [{ address: '', amount: 1 }]; // Сброс к одному пустому партнеру
  dleSettings.governanceQuorum = 51; // Сброс кворума к значению по умолчанию
  
  // Очищаем мульти-чейн настройки
  dleSettings.selectedNetworks = [];
  dleSettings.tokenStandard = 'ERC20'; // Сбрасываем к стандартному ERC-20
          // dleSettings.predictedAddress = '';
  
  // Очищаем координаты
  dleSettings.coordinates = '';
  
  // Устаревшие поля
  dleSettings.deployNetwork = '';
  dleSettings.privateKey = '';
  
  // Очищаем также поиск адресов и флаги автовыбора
  postalCodeInput.value = '';
  searchResults.value = [];
  isSearchingAddress.value = false;
  autoSelectedOktmo.value = false;
  lastApiResult.value = null;
  
  // Сбрасываем выбранные уровни ОКВЭД
  selectedOkvedLevel1.value = '';
  selectedOkvedLevel2.value = '';
  selectedOkvedLevel3.value = '';
  selectedOkvedLevel4.value = '';
  currentSelectedOkvedCode.value = '';
  currentSelectedOkvedText.value = '';
  
  // Очищаем мульти-чейн состояние
  selectedNetworks.value = [];
  totalDeployCost.value = 0;
          // predictedAddress.value = '';
  useSameKeyForAllChains.value = true;
  unifiedPrivateKey.value = '';
  Object.keys(privateKeys).forEach(key => delete privateKeys[key]);
  Object.keys(privateKeyVisibility).forEach(key => delete privateKeyVisibility[key]);
  Object.keys(keyValidation).forEach(key => delete keyValidation[key]);
  showUnifiedKey.value = false;
  
  // Очищаем настройки деплоя
  etherscanApiKey.value = '';
  unifiedScanKeyVisible.value = false;
  autoVerifyAfterDeploy.value = true;
  showDeploymentWizard.value = false;
  deployedDLEAddress.value = '';
  
  // Очищаем localStorage
  clearStoredData();
};

// Сброс состояния UI компонентов
const resetUIState = () => {
  // Сбрасываем состояние загрузки
  isLoadingCountries.value = false;
  isLoadingRussianClassifiers.value = false;
  isLoadingNetworks.value = false;
  isLoadingOkvedLevel1.value = false;
  isLoadingOkvedLevel2.value = false;
  isLoadingOkvedLevel3.value = false;
  isLoadingOkvedLevel4.value = false;
  isLoadingKppCodes.value = false;
  
  // Сбрасываем состояние админских токенов
  adminTokenCheck.value = {
    isLoading: false,
    canManageSettings: false,
    error: null
  };
  
  // Очищаем файл логотипа
  logoFile.value = null;
  logoPreviewUrl.value = '';
  ensDomain.value = '';
  ensResolvedUrl.value = '';
  
  // Сбрасываем состояние видимости ключей
  showPrivateKey.value = false;
  showUnifiedKey.value = false;
  
  console.log('[DleDeployFormView] UI state reset completed');
};

// Обработчики событий для очистки и обновления данных
const handleClearApplicationData = () => {
  console.log('[DleDeployFormView] Clearing DLE deploy data');
  // Очищаем все данные формы при выходе из системы
  clearAllData();
  // Сбрасываем состояние UI
  resetUIState();
};

// handleRefreshApplicationData будет определен после checkAdminTokens

// Подписываемся на централизованные события очистки и обновления данных
onMounted(() => {
  window.addEventListener('clear-application-data', handleClearApplicationData);
  window.addEventListener('refresh-application-data', handleRefreshApplicationData);
  // Подписка на события авторизации
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
});

onUnmounted(() => {
  // Отписка от события при удалении компонента
  if (unsubscribe) {
    unsubscribe();
  }
  
  // Удаляем слушатели событий window
  window.removeEventListener('clear-application-data', handleClearApplicationData);
  window.removeEventListener('refresh-application-data', handleRefreshApplicationData);
});

// (Старые функции ОКВЭД удалены - заменены каскадной системой)

// Поиск по почтовому индексу (по кнопке)
const searchByPostalCode = async () => {
  if (!postalCodeInput.value || postalCodeInput.value.length < 5) {
    return;
  }

  isSearchingAddress.value = true;
  searchResults.value = [];

  try {
    // Поиск через Nominatim API
    const params = new URLSearchParams();
    params.append('postalcode', postalCodeInput.value.trim());
    params.append('format', 'jsonv2');
    params.append('addressdetails', '1');
    params.append('limit', '10');

    // Если в юрисдикции выбрана Россия, добавляем countrycodes=RU
    if (dleSettings.jurisdiction === '643') {
      params.append('countrycodes', 'RU');
    }

    // console.log(`[SearchByPostalCode] Querying Nominatim: ${params.toString()}`);
    const response = await api.get(`/geocoding/nominatim-search?${params.toString()}`);
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Преобразуем результаты Nominatim для отображения
      searchResults.value = response.data.map(result => ({
        fullAddress: result.display_name,
        country: result.address?.country || '',
        region: result.address?.state || result.address?.region || '',
        city: result.address?.city || result.address?.town || result.address?.village || '',
        street: result.address?.road || '',
        building: result.address?.house_number || '',
        postcode: result.address?.postcode || postalCodeInput.value,
        coordinates: {
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon)
        },
        rawData: result.address  // Сохраняем все сырые данные для анализа
      }));
      
      // console.log(`[SearchByPostalCode] Found ${searchResults.value.length} results`);
      
      // Автоматически заполняем поля первым результатом
      if (searchResults.value.length > 0) {
        fillFromSearchResult(searchResults.value[0]);
        // console.log('[SearchByPostalCode] Auto-filled with first result');
      }
    } else {
      // console.log('[SearchByPostalCode] No results found');
    }
  } catch (error) {
    // console.error('Ошибка при поиске по индексу:', error);
  } finally {
    isSearchingAddress.value = false;
  }
};

// Автоматический поиск ОКТМО по адресу
const findOktmoByAddress = (result) => {
  // Получаем регион/область из результата поиска
  const region = result.region || result.city || '';
  
  if (!region || !russianClassifiers.oktmo) {
    return '';
  }

  // console.log(`[FindOktmo] Searching OKTMO for region: "${region}"`);
  
  // Ищем совпадение по названию региона
  const foundOktmo = russianClassifiers.oktmo.find(oktmo => {
    const oktmoTitle = oktmo.title.toLowerCase();
    const searchRegion = region.toLowerCase();
    
    // Проверяем точное совпадение или вхождение
    return oktmoTitle === searchRegion || 
           oktmoTitle.includes(searchRegion) || 
           searchRegion.includes(oktmoTitle);
  });

  if (foundOktmo) {
    // console.log(`[FindOktmo] Found OKTMO: ${foundOktmo.code} - ${foundOktmo.title}`);
    return foundOktmo.code;
  }
  
  // console.log(`[FindOktmo] No OKTMO found for region: "${region}"`);
  return '';
};

// Заполнение полей из результата поиска
const fillFromSearchResult = (result) => {
  console.log('[FillFromSearchResult] Called with result:', result);
  
  dleSettings.addressData.postalCode = result.postcode;
  dleSettings.addressData.region = result.region;
  dleSettings.addressData.city = result.city;
  dleSettings.addressData.street = result.street;
  dleSettings.addressData.building = result.building;
  dleSettings.addressData.apartment = '';  // Квартиру пользователь введет сам
  dleSettings.addressData.isVerified = false;  // Требует проверки после дозаполнения
  
  // Сохраняем координаты в dleSettings
  if (result.coordinates && result.coordinates.lat && result.coordinates.lon) {
    dleSettings.coordinates = `${result.coordinates.lat},${result.coordinates.lon}`;
    console.log(`[FillFromSearchResult] Saved coordinates from coordinates object: ${dleSettings.coordinates}`);
    // Сохраняем в localStorage
    saveFormData();
  } else if (result.lat && result.lon) {
    // Альтернативный формат координат
    dleSettings.coordinates = `${result.lat},${result.lon}`;
    console.log(`[FillFromSearchResult] Saved coordinates from lat/lon: ${dleSettings.coordinates}`);
    // Сохраняем в localStorage
    saveFormData();
  } else {
    console.log('[FillFromSearchResult] No coordinates found in result');
  }
  
  // Сохраняем результат API для отображения в превью
  lastApiResult.value = result;
  
  // Автоматически выбираем ОКТМО по адресу
  const autoOktmo = findOktmoByAddress(result);
  if (autoOktmo) {
    dleSettings.selectedOktmo = autoOktmo;
    autoSelectedOktmo.value = true;  // Помечаем как автовыбранный
    // console.log(`[FillFromSearchResult] Auto-selected OKTMO: ${autoOktmo}`);
  } else {
    autoSelectedOktmo.value = false;
  }
  
  // console.log('[FillFromSearchResult] Filled address data:', dleSettings.addressData);
  // console.log('[FillFromSearchResult] Saved API result:', result);
};

// Проверка адреса (повторный запрос для валидации)
const verifyAddress = async () => {
  const addr = dleSettings.addressData;
  
  try {
    // Формируем полный адрес для проверки
    const fullAddressQuery = [
      addr.postalCode,
      addr.region,
      addr.city,
      addr.street,
      addr.building,
      addr.apartment
    ].filter(Boolean).join(', ');

    console.log('[VerifyAddress] Checking address:', fullAddressQuery);

    const params = new URLSearchParams();
    params.append('q', fullAddressQuery);
    params.append('format', 'jsonv2');
    params.append('addressdetails', '1');
    params.append('limit', '1');

    if (dleSettings.jurisdiction === '643') {
      params.append('countrycodes', 'RU');
    }

    const response = await api.get(`/geocoding/nominatim-search?${params.toString()}`);
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      const verificationResult = response.data[0];
      
      // Формируем итоговый проверенный адрес
      addr.fullAddress = verificationResult.display_name;
      addr.isVerified = true;
      
      // Сохраняем координаты из результата проверки
      if (verificationResult.lat && verificationResult.lon) {
        dleSettings.coordinates = `${verificationResult.lat},${verificationResult.lon}`;
        console.log(`[VerifyAddress] Saved coordinates: ${dleSettings.coordinates}`);
        // Сохраняем в localStorage
        saveFormData();
      }
      
      console.log('[VerifyAddress] Address verified successfully:', addr.fullAddress);
    } else {
      // Если не найден - все равно считаем валидным (пользователь может знать лучше)
      addr.fullAddress = fullAddressQuery;
      addr.isVerified = true;
      
      console.log('[VerifyAddress] Address not found in API, but marking as verified:', addr.fullAddress);
    }
  } catch (error) {
    console.error('Ошибка при проверке адреса:', error);
    // В случае ошибки все равно позволяем пользователю продолжить
    const addr = dleSettings.addressData;
    addr.fullAddress = [
      addr.postalCode,
      addr.region,
      addr.city,
      addr.street,
      addr.building,
      addr.apartment
    ].filter(Boolean).join(', ');
    addr.isVerified = true;
  }
};

// Очистка адреса
const clearAddress = () => {
  dleSettings.addressData = {
    postalCode: '',
    region: '',
    city: '',
    street: '',
    building: '',
    apartment: '',
    fullAddress: '',
    isVerified: false
  };
  // Очищаем координаты
  dleSettings.coordinates = '';
  postalCodeInput.value = '';
  searchResults.value = [];
  autoSelectedOktmo.value = false;
  lastApiResult.value = null;
};

// Форматирование символа токена
const formatTokenSymbol = () => {
  dleSettings.tokenSymbol = dleSettings.tokenSymbol.toUpperCase();
  if (dleSettings.tokenSymbol.length > 10) {
    dleSettings.tokenSymbol = dleSettings.tokenSymbol.substring(0, 10);
  }
};




// Функция загрузки стран
const loadCountries = async () => {
  isLoadingCountries.value = true;
  try {
    const response = await api.get('/countries');
    if (response.data && response.data.success) {
      countriesOptions.value = response.data.data || [];
      console.log(`Загружено стран: ${countriesOptions.value.length}`);
    } else {
      console.error('Ошибка ответа API стран:', response.data);
      countriesOptions.value = [];
    }
  } catch (error) {
    console.error('Ошибка при загрузке стран:', error);
    countriesOptions.value = [];
    // TODO: Показать уведомление пользователю об ошибке
  } finally {
    isLoadingCountries.value = false;
  }
};

// Функция загрузки классификаторов в зависимости от выбранной страны
const loadClassifiers = async () => {
  isLoadingRussianClassifiers.value = true;
  try {
    if (dleSettings.jurisdiction === '643') {
      // Для России загружаем российские классификаторы
      console.log('Загружаем российские классификаторы...');
      
      const response = await api.get('/russian-classifiers/all');
      
      if (response.data && response.data.success) {
        const data = response.data.data;
        russianClassifiers.oktmo = data.oktmo || [];
        russianClassifiers.okved = data.okved || [];
        
        console.log('Российские классификаторы загружены:', {
          oktmo: russianClassifiers.oktmo.length,
          okved: russianClassifiers.okved.length
        });
        
        // Инициализируем каскадную систему ОКВЭД
        if (russianClassifiers.okved.length > 0) {
          console.log('🎯 Инициализируем каскадную систему ОКВЭД...');
          await fetchOkvedCodes(1, null, okvedLevel1Options, isLoadingOkvedLevel1);
          
          if (selectedOkvedLevel1.value) {
            await fetchOkvedCodes(2, selectedOkvedLevel1.value, okvedLevel2Options, isLoadingOkvedLevel2);
          }
        }
        
        loadKppCodes();
      }
    } else {
      // Для других стран загружаем ISIC
      console.log('Загружаем ISIC классификаторы...');
      
      // Инициализируем каскадную систему ISIC
      console.log('🎯 Инициализируем каскадную систему ISIC...');
      await fetchIsicCodes(1, null, isicLevel1Options, isLoadingIsicLevel1);
      
      if (selectedIsicLevel1.value) {
        await fetchIsicCodes(2, selectedIsicLevel1.value, isicLevel2Options, isLoadingIsicLevel2);
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке классификаторов:', error);
    alert('Не удалось загрузить классификаторы с сервера.');
  } finally {
    isLoadingRussianClassifiers.value = false;
  }
};

// Функция загрузки российских классификаторов (для совместимости)
const loadRussianClassifiers = async () => {
  isLoadingRussianClassifiers.value = true;
  try {
    console.log('Загружаем российские классификаторы...');
    
    // Загружаем все классификаторы одним запросом для оптимизации
    const response = await api.get('/russian-classifiers/all');
    
    if (response.data && response.data.success) {
      const data = response.data.data;
      russianClassifiers.oktmo = data.oktmo || [];
      russianClassifiers.okved = data.okved || [];
      
      console.log('Российские классификаторы загружены:', {
        oktmo: russianClassifiers.oktmo.length,
        okved: russianClassifiers.okved.length
      });
      
      // Отладка ОКВЭД данных
      if (russianClassifiers.okved.length > 0) {
        console.log('Первые 3 ОКВЭД кода:', russianClassifiers.okved.slice(0, 3));
        
        // Инициализируем каскадную систему ОКВЭД - загружаем первый уровень
        console.log('🎯 Инициализируем каскадную систему ОКВЭД...');
        await fetchOkvedCodes(1, null, okvedLevel1Options, isLoadingOkvedLevel1);
        
        // Если есть сохраненные выборы ОКВЭД, восстанавливаем каскад
        if (selectedOkvedLevel1.value) {
          await fetchOkvedCodes(2, selectedOkvedLevel1.value, okvedLevel2Options, isLoadingOkvedLevel2);
        }
      } else {
        console.warn('ОКВЭД данные пустые!');
      }
      
      // Загружаем КПП коды
      loadKppCodes();
    } else {
      console.error('Ошибка ответа API российских классификаторов:', response.data);
    }
  } catch (error) {
    console.error('Ошибка при загрузке российских классификаторов:', error);
    // TODO: Показать уведомление пользователю об ошибке
  } finally {
    isLoadingRussianClassifiers.value = false;
  }
};

// Функция загрузки КПП кодов
const loadKppCodes = async () => {
  isLoadingKppCodes.value = true;
  kppCodes.value = [];
  
  try {
    console.log('Загружаем КПП коды...');
    const response = await api.get('/kpp/codes');
    
    if (response.data && Array.isArray(response.data.codes)) {
      kppCodes.value = response.data.codes;
      console.log(`КПП коды загружены: ${kppCodes.value.length}`);
    } else {
      console.error('Ошибка ответа API КПП кодов:', response.data);
    }
  } catch (error) {
    console.error('Ошибка при загрузке КПП кодов:', error);
    // TODO: Показать уведомление пользователю об ошибке
  } finally {
    isLoadingKppCodes.value = false;
  }
};

// Функция загрузки доступных сетей из базы данных
const loadAvailableNetworks = async () => {
  isLoadingNetworks.value = true;
  availableNetworks.value = [];
  
  try {
    console.log('Загружаем доступные сети из базы данных...');
    console.log('URL:', '/api/settings/rpc');
    const response = await api.get('/settings/rpc');
    console.log('Response:', response.data);
    
    if (response.data && response.data.success) {
      const networksData = response.data.data || [];
      
      // Преобразуем данные из базы в формат для мульти-чейн деплоя
      availableNetworks.value = networksData.map(network => {
        const chainId = network.chain_id || parseInt(network.network_id);
        const estimatedCost = getFallbackCost(chainId);
        const description = network.description || 'Блокчейн сеть';
        const name = network.name || network.network_id || `Chain ${chainId}`;
         
         return {
           chainId: chainId,
           name: name,
           description: description,
           estimatedCost: estimatedCost,
           estimatedGas: 800000, // Стандартное значение
           rpcUrl: network.rpc_url,
           explorerUrl: network.explorer_url || '',
           nativeCurrency: network.native_currency || 'ETH',
           network_id: network.network_id,
           chain_id: network.chain_id,
           rpc_url_display: network.rpc_url_display || network.network_id,
           // Дополнительные поля для совместимости
           isLimited: network._isLimited || false,
           // Для не-админов скрываем реальный RPC URL в отображении
           displayRpcUrl: network._isLimited ? 'Скрыто' : (network.rpc_url_display || network.network_id)
         };
      });
      
      console.log(`Доступные сети загружены из базы: ${availableNetworks.value.length}`);
    } else {
      console.error('Ошибка ответа API доступных сетей:', response.data);
    }
  } catch (error) {
    console.error('Ошибка при загрузке доступных сетей:', error);
    // Показываем уведомление пользователю об ошибке
    // TODO: Добавить toast уведомление
    
    // В случае ошибки показываем пустой список
    availableNetworks.value = [];
  } finally {
    isLoadingNetworks.value = false;
  }
};

// Функция открытия страницы настроек RPC в новой вкладке
const openRpcSettings = () => {
  window.open('http://localhost:5173/settings/security', '_blank');
};

// Функция обновления списка сетей (вызывается после добавления RPC провайдера)
const refreshNetworks = () => {
  loadAvailableNetworks();
};



// Валидация совместимости стандарта токена с выбранными сетями
const validateTokenStandardCompatibility = () => {
  const standard = dleSettings.tokenStandard;
  const networks = selectedNetworkDetails.value;
  
  // Проверяем совместимость ERC-4626 с тестовыми сетями
  if (standard === 'ERC4626') {
    const testnetChains = [11155111, 80001, 421613, 420, 97]; // Sepolia, Mumbai, etc.
    const hasTestnet = networks.some(network => testnetChains.includes(network.chainId));
    
    if (hasTestnet) {
      console.warn('ERC-4626 может иметь ограниченную поддержку в тестовых сетях');
      // TODO: Показать уведомление пользователю
    }
  }
  
  // Проверяем совместимость ERC-1155 с DEX
  if (standard === 'ERC1155') {
    console.warn('ERC-1155 имеет ограниченную поддержку в DEX');
    // TODO: Показать уведомление пользователю
  }
};

// Показываем предупреждения для сложных стандартов
const showTokenStandardWarnings = () => {
  const standard = dleSettings.tokenStandard;
  
  if (standard === 'ERC4626') {
    console.warn('ERC-4626 требует тщательного аудита безопасности');
    // TODO: Показать уведомление пользователю
  }
  
  if (standard === 'ERC721') {
    console.warn('ERC-721 может быть сложным для стандартного голосования');
    // TODO: Показать уведомление пользователю
  }
};

// ==================== МУЛЬТИ-ЧЕЙН ФУНКЦИИ ====================

// Обновление общей стоимости деплоя (динамический расчет)
const updateDeployCost = async () => {
  if (selectedNetworkDetails.value.length === 0) {
    totalDeployCost.value = 0;
    return;
  }

  try {
    // Получаем chainId выбранных сетей
    const chainIds = selectedNetworkDetails.value.map(network => network.chainId);

    // Вызываем API для расчета стоимости
    const response = await api.post('/dle-v2/estimate-cost', {
      supportedChainIds: chainIds
    });

    if (response.data.success && response.data.data) {
      const costData = response.data.data;
      
      // Обновляем информацию о каждой сети
      selectedNetworkDetails.value.forEach(network => {
        const estimate = costData.estimates.find(e => e.chainId === network.chainId);
        
        if (estimate && estimate.ok) {
          network.estimatedCost = parseFloat(estimate.costEth);
          network.gasPrice = estimate.gasPrice;
          network.estimatedGas = estimate.gasLimit;
        } else {
          // Fallback для сетей без RPC
          network.estimatedCost = getFallbackCost(network.chainId);
        }
      });

      totalDeployCost.value = parseFloat(costData.totalCostEth);
      console.log('✅ Стоимость деплоя обновлена:', costData);
    } else {
      throw new Error('Ошибка получения стоимости деплоя');
    }
  } catch (error) {
    console.warn('⚠️ Ошибка расчета стоимости, используем fallback:', error.message);
    
    // Fallback к статическим ценам
    selectedNetworkDetails.value.forEach(network => {
      network.estimatedCost = getFallbackCost(network.chainId);
    });
    
    totalDeployCost.value = selectedNetworkDetails.value
      .reduce((sum, network) => sum + network.estimatedCost, 0);
  }
};

// Вспомогательная функция для получения fallback стоимости
const getFallbackCost = (chainId) => {
  const fallbackCosts = {
    1: 45.50,    // Ethereum Mainnet
    137: 0.01,   // Polygon
    42161: 2.30, // Arbitrum One
    10: 1.20,    // Optimism
    56: 0.50,    // BSC
    43114: 0.15, // Avalanche
    11155111: 0.001, // Sepolia testnet
    80001: 0.001,    // Mumbai testnet
    421613: 0.001,   // Arbitrum Goerli
    420: 0.001,      // Optimism Goerli
    97: 0.001,       // BSC Testnet
    17000: 0.001,    // Holesky testnet
    421614: 0.001,   // Arbitrum Sepolia
    84532: 0.001,    // Base Sepolia
    80002: 0.001     // Polygon Amoy
  };
  return fallbackCosts[chainId] || 1.00;
};


// Копирование адреса DLE - отключено
// const copyAddress = async () => {
//   try {
//     await navigator.clipboard.writeText(predictedAddress.value);
//     console.log('Адрес скопирован:', predictedAddress.value);
//     // TODO: Показать уведомление об успешном копировании
//   } catch (error) {
//     console.error('Ошибка копирования адреса:', error);
//   }
// };

// Функция переключения использования одного ключа
const toggleSameKey = () => {
  if (useSameKeyForAllChains.value) {
    // Копируем unified key во все сети
    updateAllKeys();
  } else {
    // Инициализируем видимость для каждой сети
    selectedNetworkDetails.value.forEach(network => {
      if (!(network.chainId in privateKeyVisibility)) {
        privateKeyVisibility[network.chainId] = false;
      }
    });
  }
};

// Обновление всех ключей при использовании единого ключа
const updateAllKeys = () => {
  // Предотвращаем рекурсию
  if (updateAllKeys.isUpdating) return;
  updateAllKeys.isUpdating = true;
  
  try {
    // Валидируем единый ключ
    validatePrivateKey('unified');
    
    // Копируем ключ во все выбранные сети
    selectedNetworkDetails.value.forEach(network => {
      privateKeys[network.chainId] = unifiedPrivateKey.value;
    });
  } finally {
    // Сбрасываем флаг после небольшой задержки
    setTimeout(() => {
      updateAllKeys.isUpdating = false;
    }, 100);
  }
};

// Переключение видимости ключа для конкретной сети
const toggleKeyVisibility = (chainId) => {
  privateKeyVisibility[chainId] = !privateKeyVisibility[chainId];
};

// Валидация приватного ключа с дебаунсом
const validatePrivateKey = async (chainId) => {
  // Очищаем предыдущий таймер
  if (validatePrivateKey.timeout) {
    clearTimeout(validatePrivateKey.timeout);
  }
  
  // Устанавливаем новый таймер для дебаунса
  validatePrivateKey.timeout = setTimeout(async () => {
    const key = chainId === 'unified' ? unifiedPrivateKey.value : privateKeys[chainId];
    
    if (!key) {
      keyValidation[chainId] = null;
      return;
    }
    
    try {
      // Отправляем запрос на бэкенд для валидации
      const response = await api.post('/dle-v2/validate-private-key', {
        privateKey: key
      });
      
      if (response.data.success) {
        keyValidation[chainId] = response.data.data;
      } else {
        keyValidation[chainId] = {
          isValid: false,
          address: null,
          error: response.data.message
        };
      }
    } catch (error) {
      console.error('Ошибка валидации приватного ключа:', error);
      keyValidation[chainId] = {
        isValid: false,
        address: null,
        error: error.response?.data?.message || 'Ошибка валидации приватного ключа'
      };
    }
  }, 300); // Задержка 300мс
};

// Функция переключения видимости приватного ключа (устаревшее)
const togglePrivateKey = () => {
  showPrivateKey.value = !showPrivateKey.value;
};

// Наблюдатель за ручным изменением ОКТМО
watch(() => dleSettings.selectedOktmo, (newOktmo, oldOktmo) => {
  // Если ОКТМО изменился не через автовыбор, сбрасываем флаг
  if (newOktmo !== oldOktmo && autoSelectedOktmo.value) {
    // Добавляем небольшую задержку чтобы не сбрасывать флаг при автовыборе
    setTimeout(() => {
      if (dleSettings.selectedOktmo === newOktmo) {
        autoSelectedOktmo.value = false;
      }
    }, 100);
  }
});

// Наблюдатель за изменением юрисдикции
watch(() => dleSettings.jurisdiction, (newJurisdiction, oldJurisdiction) => {
  console.log('Юрисдикция изменена:', oldJurisdiction, '->', newJurisdiction);
  
  // Сбрасываем российские классификаторы и поиск адреса при смене юрисдикции
  if (oldJurisdiction === '643') {
    dleSettings.selectedOktmo = '';
    dleSettings.kppCode = '';
    dleSettings.mainOkvedCode = '';
    dleSettings.selectedOkved = [];
  }
  
  // Сбрасываем поиск адреса при любой смене юрисдикции
  dleSettings.addressData.postalCode = '';
  searchResults.value = [];
  autoSelectedOktmo.value = false;
  lastApiResult.value = null;
  
  // Загружаем классификаторы в зависимости от выбранной страны
  if (newJurisdiction) {
    loadClassifiers();
  }
  
  // Автосохранение
  saveFormData();
});

// Watchers для автоматического сохранения при изменении данных
watch(() => dleSettings, () => {
  // Добавляем небольшую задержку для предотвращения рекурсии
  setTimeout(() => {
    saveFormData();
  }, 100);
}, { deep: true });

watch([selectedOkvedLevel1, selectedOkvedLevel2, postalCodeInput], () => {
  // Добавляем небольшую задержку для предотвращения рекурсии
  setTimeout(() => {
    saveFormData();
  }, 100);
});

// Сохраняем Etherscan API ключ и флаг авто-верификации при изменении
watch(etherscanApiKey, () => {
  saveFormData();
});
watch(autoVerifyAfterDeploy, () => {
  saveFormData();
});

// Watcher для координат
watch(() => dleSettings.coordinates, (newCoordinates) => {
  console.log('[Coordinates Watcher] Coordinates changed:', newCoordinates);
  // Добавляем небольшую задержку для предотвращения рекурсии
  setTimeout(() => {
    saveFormData();
  }, 100);
});

// ==================== МУЛЬТИ-ЧЕЙН WATCHERS ====================

// Watcher для selectedNetworks - синхронизация с dleSettings
watch(selectedNetworks, (newNetworks) => {
  // Предотвращаем рекурсию
  if (JSON.stringify(dleSettings.selectedNetworks) !== JSON.stringify(newNetworks)) {
    dleSettings.selectedNetworks = [...newNetworks];
    updateDeployCost();
    
    // Автосохранение
    saveFormData();
  }
}, { deep: true });

// Автоматическое обновление списка сетей при фокусе на странице
const handleVisibilityChange = () => {
  if (!document.hidden) {
    // Обновляем список сетей при возврате на страницу
    loadAvailableNetworks();
  }
};

// Watcher: нормализуем PK и обновляем связанные состояния
watch(unifiedPrivateKey, (newValue) => {
  const normalized = normalizePrivateKey(newValue);
  if (normalized && normalized !== newValue) {
    unifiedPrivateKey.value = normalized;
    return;
  }
  updateAllKeys();
});

// Watcher для predictedAddress - синхронизация с dleSettings - отключено
// watch(predictedAddress, (newAddress) => {
//   if (dleSettings.predictedAddress !== newAddress) {
//     dleSettings.predictedAddress = newAddress;
//   }
// });

// Вычисление предсказанного адреса при изменении ключевых данных - отключено
// watch([() => dleSettings.name, () => dleSettings.tokenSymbol, selectedNetworks], () => {
//   // TODO: Реализовать вычисление предсказанного адреса через API
//   if (dleSettings.name && dleSettings.tokenSymbol && selectedNetworks.value.length > 0) {
//     // Заглушка - в реальности будет API запрос
//     const newAddress = '0x' + Math.random().toString(16).substr(2, 40);
//     if (predictedAddress.value !== newAddress) {
//       predictedAddress.value = newAddress;
//     }
//   } else {
//     if (predictedAddress.value !== '') {
//       predictedAddress.value = '';
//     }
//   }
// }, { deep: true });

// Инициализация
onMounted(() => {
  
  
  // Загружаем список стран
  loadCountries();
  
  // Загружаем доступные сети из базы данных
  loadAvailableNetworks();
  
  // Пытаемся загрузить сохраненные данные при загрузке страницы
  const dataLoaded = loadFormData();
  

  
  // Синхронизируем selectedNetworks с dleSettings
  selectedNetworks.value = dleSettings.selectedNetworks || [];
  
  // Если данные были загружены и выбрана Россия, загружаем российские классификаторы
  if (dataLoaded && dleSettings.jurisdiction === '643') {
    loadRussianClassifiers();
  }
  
  // Автозаполнение первого партнера подключенным кошельком
  if (address.value && dleSettings.partners[0]) {
    // Если адрес пустой или это новый пользователь, подставляем адрес кошелька
    if (!dleSettings.partners[0].address || !dataLoaded) {
      dleSettings.partners[0].address = address.value;
      console.log('Автоматически подставлен адрес кошелька:', address.value);
    }
  }
  
  // Проверяем, есть ли приватный ключ
  if (!unifiedPrivateKey.value) {
    console.log('⚠️ Приватный ключ не введен. Пожалуйста, введите приватный ключ для деплоя.');
  }
  
  // Добавляем слушатель события видимости страницы для обновления списка сетей
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Проверяем админские токены при загрузке
  checkAdminTokens();
});

// Удаляем слушатель при размонтировании компонента
onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});

// Watcher для автоматического обновления адреса первого партнера при подключении кошелька
watch(address, (newAddress, oldAddress) => {
  console.log('[DleDeployFormView] Address changed:', { oldAddress, newAddress });
  
  // Обновляем состояние при изменении адреса (подключение/отключение кошелька)
  checkAdminTokens();
  
  if (newAddress && dleSettings.partners[0]) {
    // Подставляем адрес, если поле пустое или пользователь только что подключил кошелек
    if (!dleSettings.partners[0].address) {
      dleSettings.partners[0].address = newAddress;
      console.log('Кошелек подключен, подставлен адрес:', newAddress);
    }
  }
});

// Функция проверки админских токенов
const checkAdminTokens = async () => {
  console.log('[DleDeployFormView] checkAdminTokens called, address:', address.value);
  
  // Небольшая задержка чтобы дать время useAuth обновить состояние
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Обновляем локальное состояние на основе текущих прав из usePermissions
  adminTokenCheck.value.canManageSettings = canManageSettings.value;
  
  if (!address.value) {
    adminTokenCheck.value = { ...adminTokenCheck.value, isLoading: false, error: 'Кошелек не подключен' };
    return;
  }

  adminTokenCheck.value = { ...adminTokenCheck.value, isLoading: true, error: null };

  try {
    const response = await api.get(`/dle-v2/check-admin-tokens?address=${address.value}`);
    
    if (response.data.success) {
      console.log('Проверка админских токенов:', response.data.data);
      // Не перезаписываем canManageSettings, так как это управляется usePermissions
    } else {
      adminTokenCheck.value = { ...adminTokenCheck.value, error: response.data.message || 'Ошибка проверки токенов' };
    }
  } catch (error) {
    console.error('Ошибка проверки админских токенов:', error);
    adminTokenCheck.value = { ...adminTokenCheck.value, error: error.response?.data?.message || 'Ошибка проверки токенов' };
  } finally {
    adminTokenCheck.value = { ...adminTokenCheck.value, isLoading: false };
  }
};

// Определяем handleRefreshApplicationData после checkAdminTokens
const handleRefreshApplicationData = () => {
  console.log('[DleDeployFormView] Refreshing DLE deploy data');
  checkAdminTokens(); // Обновляем данные при входе в систему
};

// Функции для работы с партнерами
const addPartner = () => {
  dleSettings.partners.push({ address: '', amount: 1 });
};

const removePartner = (index) => {
  if (dleSettings.partners.length > 1) {
    dleSettings.partners.splice(index, 1);
  }
};

const validateEthereumAddress = (partner, index) => {
  // Простая валидация Ethereum адреса
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  if (partner.address && !ethAddressRegex.test(partner.address)) {
    // Можно добавить визуальную индикацию ошибки
    console.warn(`Некорректный адрес партнера ${index + 1}:`, partner.address);
  }
};

// Функция для подставления адреса кошелька в первого партнера
const useMyWalletAddress = () => {
  if (address.value && dleSettings.partners[0]) {
    dleSettings.partners[0].address = address.value;
    console.log('Подставлен адрес кошелька:', address.value);
  } else {
    alert('Кошелек не подключен. Пожалуйста, подключите кошелек сначала.');
  }
};

// Маскированный приватный ключ для превью (устаревшее)
const maskedPrivateKey = computed(() => {
  if (!dleSettings.privateKey) return '';
  if (dleSettings.privateKey.length <= 8) return '*'.repeat(dleSettings.privateKey.length);
  
  const start = dleSettings.privateKey.substring(0, 6);
  const end = dleSettings.privateKey.substring(dleSettings.privateKey.length - 4);
  return `${start}...${end}`;
});

// Функция деплоя смарт-контрактов DLE
const deploySmartContracts = async () => {
  console.log('🚀 Начало поэтапного деплоя DLE...');
  try {
    // Валидация данных
    if (!isFormValid.value) {
      alert('Пожалуйста, заполните все обязательные поля');
      return;
    }

    // Сразу показываем мастер деплоя
    showDeploymentWizard.value = true;
    
    // Запускаем деплой DLE в фоне
    startStagedDeployment();
    
  } catch (error) {
    console.error('Ошибка деплоя DLE:', error);
    alert('❌ Ошибка при деплое смарт-контракта: ' + error.message);
  }
};

// Функция запуска поэтапного деплоя
const startStagedDeployment = async () => {
  console.log('🚀 Запуск поэтапного деплоя...');
  
  // Сначала выполняем стандартный деплой DLE контракта
  try {

    // Подготовка данных для деплоя
    console.log('DEBUG: dleSettings.selectedNetworks:', dleSettings.selectedNetworks);
    console.log('DEBUG: selectedNetworks.value:', selectedNetworks.value);
    const deployData = {
      // Основная информация DLE
      name: dleSettings.name,
      symbol: dleSettings.tokenSymbol,

      location: dleSettings.addressData.fullAddress || 'Не указан',
      coordinates: dleSettings.coordinates || '0,0',
      jurisdiction: parseInt(dleSettings.jurisdiction) || 0,
      oktmo: dleSettings.selectedOktmo || '',
      okvedCodes: dleSettings.selectedOkved || [],
      kpp: dleSettings.kppCode || '',
      
      // Настройки кворума
      quorumPercentage: dleSettings.governanceQuorum || 51,
      
      // Партнеры и токены
      initialPartners: dleSettings.partners.map(p => p.address).filter(addr => addr),
      initialAmounts: dleSettings.partners.map(p => p.amount).filter(amount => amount > 0),
      
      // Мульти-чейн настройки
      supportedChainIds: selectedNetworks.value || [],
      
      // Текущая цепочка (будет установлена при деплое)
      currentChainId: selectedNetworks.value[0] || 1,
      // Приватный ключ для деплоя
      privateKey: unifiedPrivateKey.value,
      // Верификация через Etherscan V2
      etherscanApiKey: etherscanApiKey.value,
      autoVerifyAfterDeploy: autoVerifyAfterDeploy.value
    };

    // Обработка логотипа
    try {
      if (logoFile.value) {
        const form = new FormData();
        form.append('logo', logoFile.value);
        const uploadResp = await api.post('/uploads/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const uploaded = uploadResp.data?.data?.url || uploadResp.data?.data?.path;
        if (uploaded) {
          deployData.logoURI = uploaded;
        }
      } else if (ensResolvedUrl.value) {
        deployData.logoURI = ensResolvedUrl.value;
      } else {
        deployData.logoURI = '/uploads/logos/default-token.svg';
      }
    } catch (error) {
      console.warn('Ошибка при обработке логотипа:', error.message);
      deployData.logoURI = '/uploads/logos/default-token.svg';
    }

    console.log('Данные для деплоя DLE:', deployData);

    // Предварительная проверка балансов (через приватный ключ)
    try {
      const pre = await api.post('/dle-v2/precheck', {
        supportedChainIds: deployData.supportedChainIds,
        privateKey: unifiedPrivateKey.value
      });
      const preData = pre.data?.data;
      if (pre.data?.success && preData) {
        const lacks = (preData.insufficient || []);
        if (lacks.length > 0) {
          const message = `❌ Недостаточно средств в некоторых сетях!`;
          alert(message);
          return;
        }
        console.log('✅ Проверка балансов пройдена:', preData.summary);
      }
    } catch (e) {
      console.warn('⚠️ Ошибка проверки балансов:', e.message);
    }
    
    // Показываем мастер деплоя
    showDeploymentWizard.value = true;
    
    // Мастер деплоя сам выполнит деплой
    return;
  } catch (error) {
    console.error('Ошибка при запуске деплоя:', error);
  }
}

// Обработчик завершения поэтапного деплоя
const handleDeploymentCompleted = (result) => {
  console.log('🎉 Поэтапный деплой завершен:', result);
  showDeploymentWizard.value = false;
  
  // Эмитируем событие о завершении деплоя для обновления Header
  eventBus.emit('dle-deployed', result);
  
  // Перенаправляем на главную страницу управления
  router.push('/management');
};

// Валидация формы
    const isFormValid = computed(() => {
  const validation = {
    jurisdiction: !!dleSettings.jurisdiction,
    name: !!dleSettings.name,
    tokenSymbol: !!dleSettings.tokenSymbol,
    partners: dleSettings.partners.length > 0,
    partnersValid: dleSettings.partners.every(partner => partner.address && partner.amount > 0),
    quorum: dleSettings.governanceQuorum > 0 && dleSettings.governanceQuorum <= 100,
    networks: selectedNetworks.value.length > 0,
    privateKey: !!unifiedPrivateKey.value,
    keyValid: !!keyValidation.unified?.isValid,
    coordinates: validateCoordinates(dleSettings.coordinates)
  };
  
  console.log('🔍 Валидация формы:', validation);
  console.log('🔍 selectedNetworks.value:', selectedNetworks.value);
  console.log('🔍 adminTokenCheck:', adminTokenCheck.value);
  console.log('🔍 unifiedPrivateKey.value:', unifiedPrivateKey.value);
  console.log('🔍 keyValidation.unified:', keyValidation.unified);
  console.log('🔍 dleSettings.coordinates:', dleSettings.coordinates);
  console.log('🔍 Кнопка должна быть активна:', !(!validation.jurisdiction || !validation.name || !validation.tokenSymbol || !validation.partners || !validation.partnersValid || !validation.quorum || !validation.networks || !validation.privateKey || !validation.keyValid || !validation.coordinates) && adminTokenCheck.value.canManageSettings && !adminTokenCheck.value.isLoading);
  
  return Boolean(
    validation.jurisdiction &&
    validation.name &&
    validation.tokenSymbol &&
    validation.partners &&
    validation.partnersValid &&
    validation.quorum &&
    validation.networks &&
    validation.privateKey &&
    validation.keyValid &&
    validation.coordinates
  );
});

// Функция валидации координат
const validateCoordinates = (coordinates) => {
  if (!coordinates) return true; // Координаты не обязательны
  const coordRegex = /^-?\d+\.\d+,-?\d+\.\d+$/;
  return coordRegex.test(coordinates);
};

const logoFile = ref(null);
const logoPreviewUrl = ref('');
const ensDomain = ref('');
const ensResolvedUrl = ref('');

function onLogoSelected(e) {
  const file = e?.target?.files?.[0];
  logoFile.value = file || null;
  logoPreviewUrl.value = '';
  if (file) {
    try { logoPreviewUrl.value = URL.createObjectURL(file); } catch (_) {}
  }
}

async function resolveEnsAvatar() {
  ensResolvedUrl.value = '';
  const name = (ensDomain.value || '').trim();
  if (!name) return;
  try {
    const resp = await api.get(`/ens/avatar`, { params: { name } });
    const url = resp.data?.data?.url;
    if (url) {
      ensResolvedUrl.value = url;
      // если файл не выбран – используем ENS для предпросмотра
      if (!logoFile.value) logoPreviewUrl.value = url;
    } else {
      // фолбэк на дефолт
      ensResolvedUrl.value = '/uploads/logos/default-token.svg';
      if (!logoFile.value) logoPreviewUrl.value = ensResolvedUrl.value;
    }
  } catch (_) {
    ensResolvedUrl.value = '/uploads/logos/default-token.svg';
    if (!logoFile.value) logoPreviewUrl.value = ensResolvedUrl.value;
  }
}

// Функция для получения URI логотипа
function getLogoURI() {
  if (logoFile.value) {
    // Если выбран файл, возвращаем временный URL для предпросмотра
    // В реальности файл будет загружен на сервер и получен настоящий URL
    return logoPreviewUrl.value || '/uploads/logos/default-token.svg';
  } else if (ensResolvedUrl.value) {
    return ensResolvedUrl.value;
  } else {
    return '/uploads/logos/default-token.svg';
  }
}

async function submitDeploy() {
  try {
    // Подготовка данных формы
    const deployData = {
      name: dleSettings.name,
      symbol: dleSettings.tokenSymbol,
      location: locationText.value,
      coordinates: dleSettings.coordinates || '',
      jurisdiction: Number(dleSettings.jurisdiction) || 1,
      oktmo: Number(dleSettings.selectedOktmo) || null,
      okvedCodes: Array.isArray(dleSettings.selectedOkved) ? dleSettings.selectedOkved.map(x => String(x)) : [],
      kpp: dleSettings.kppCode ? Number(dleSettings.kppCode) : null,
      initialPartners: dleSettings.partners.map(p => p.address).filter(Boolean),
      initialAmounts: dleSettings.partners.map(p => p.amount).filter(a => a > 0),
      supportedChainIds: dleSettings.selectedNetworks || [],
      currentChainId: dleSettings.selectedNetworks[0] || 1,
      privateKey: unifiedPrivateKey.value,
      etherscanApiKey: etherscanApiKey.value,
      autoVerifyAfterDeploy: autoVerifyAfterDeploy.value
    };

    // Если выбран логотип — загружаем и подставляем logoURI
    if (logoFile.value) {
      const form = new FormData();
      form.append('logo', logoFile.value);
      const uploadResp = await api.post('/uploads/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploaded = uploadResp.data?.data?.url || uploadResp.data?.data?.path;
      if (uploaded) {
        deployData.logoURI = uploaded;
      }
    } else if (ensResolvedUrl.value) {
      deployData.logoURI = ensResolvedUrl.value;
    } else {
      // фолбэк на дефолт
      deployData.logoURI = '/uploads/logos/default-token.svg';
    }

    console.log('Данные для деплоя DLE:', deployData);

    // ... остальные данные остаются без изменений
  } catch (error) {
    console.error('Ошибка при отправке данных:', error);
    // Обработка ошибки
  }
}
</script>

<style scoped>
.explorer-keys-section { margin-top: 16px; }
.explorer-keys-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.explorer-key-item { display: flex; flex-direction: column; gap: 8px; }
.explorer-key-input { display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; }
.explorer-key-input input { flex: 1 1 auto; width: auto; min-width: 0; }
.explorer-keys-actions { margin-top: 8px; display: flex; gap: 12px; align-items: center; }
@media (min-width: 768px) {
  .explorer-keys-grid { grid-template-columns: 1fr 1fr; }
}
.settings-panel {
  padding: 0; /* Убираем отступы, так как они уже есть в родительском контейнере */
  background-color: transparent; /* Убираем фон, так как он уже есть в родительском контейнере */
  border-radius: 0; /* Убираем скругление углов */
  margin-top: 0; /* Убираем отступ сверху */
  animation: fadeIn var(--transition-normal);
}

.settings-block {
  background: white;
  border-radius: 12px; /* Согласуем с основными блоками */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08); /* Согласуем тень */
  border: 1px solid #e9ecef; /* Добавляем границу как у основных блоков */
  padding: 2rem; /* Увеличиваем отступы */
  margin-top: 2rem; /* Увеличиваем отступ сверху */
  margin-bottom: 2rem; /* Увеличиваем отступ снизу */
  width: 100%;
  position: relative;
  overflow-x: auto;
}

.description {
  color: #666;
  margin-bottom: 2rem;
  font-size: 1.1rem;
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eee;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h3 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600; /* Согласуем с основными заголовками */
}

.form-group {
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
}

.flex-grow {
  flex-grow: 2;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e9ecef; /* Согласуем с общими стилями */
  border-radius: 8px; /* Согласуем с кнопками */
  font-size: 1rem;
  transition: all 0.2s; /* Добавляем плавный переход для всех свойств */
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2); /* Согласуем с основными стилями */
}

.address-input-group {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.address-input-group .form-control {
  flex: 1;
}

.address-input-group .btn {
  white-space: nowrap;
  flex-shrink: 0;
}

.input-icon-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  color: #666;
}

.partner-entry {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.form-group-actions {
  display: flex;
  align-items: end;
  padding-bottom: 0.25rem;
}

.total-supply {
  background: #e7f3ff;
  padding: 1rem;
  border-radius: 6px;
  margin-top: 1rem;
  text-align: center;
}

.activity-codes-section {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
}

.codes-placeholder {
  text-align: center;
  padding: 1rem;
}

.selected-codes {
  margin-top: 1rem;
}

.codes-list {
  list-style: none;
  padding: 0;
}

.code-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #eee;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px; /* Согласуем с основными кнопками */
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600; /* Добавляем жирность */
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px); /* Добавляем эффект hover */
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none; /* Убираем эффект hover для отключенных кнопок */
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-link {
  background: none;
  color: var(--color-primary);
  padding: 0.25rem 0.5rem;
  font-size: 0.9rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.deploy-result {
  margin-top: 2rem;
  padding: 1rem;
  border-radius: 6px;
  border-left: 4px solid;
}

.deploy-result.success {
  background: #d4edda;
  border-left-color: #28a745;
  color: #155724;
}

.deploy-result.error {
  background: #f8d7da;
  border-left-color: #dc3545;
  color: #721c24;
}

.deploy-result h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
}

.help-text {
  color: #666;
  font-style: italic;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

/* Стили для российских классификаторов */
.russian-classifiers {
  background: #f8fffe;
  border: 1px solid #e0f2f1;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.loading-section {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.classifiers-forms .form-group {
  margin-bottom: 1.5rem;
}

.okved-selection {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.selected-okved-codes {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.selected-okved-codes h4 {
  color: var(--color-primary);
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.other-countries {
  background: #fff8e1;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
  color: #856404;
}



/* Стили для поиска адреса */
.postal-search {
  position: relative;
}

.searching-indicator {
  color: #666;
  font-style: italic;
  margin-top: 0.5rem;
}

.address-suggestions {
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-top: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.address-suggestions h5 {
  margin: 0;
  padding: 0.75rem 1rem 0.5rem;
  font-size: 0.9rem;
  color: var(--color-primary);
  border-bottom: 1px solid #eee;
}

.address-suggestions ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.address-suggestion {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.address-suggestion:hover {
  background: #f8f9fa;
}

.address-suggestion:last-child {
  border-bottom: none;
}

/* Стили для улучшенного ОКВЭД */
.form-label-small {
  font-size: 0.9rem;
  font-weight: 500;
  color: #555;
  margin-bottom: 0.5rem;
  display: block;
}

.okved-main {
  background: #f0f8ff;
  border: 1px solid #e3f2fd;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.okved-additional {
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 1rem;
}

.selected-okved-codes h5 {
  color: var(--color-primary);
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.codes-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.code-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
}

.code-item span {
  font-family: monospace;
  color: #333;
}

/* Простой вертикальный layout */
.dle-form-container {
  max-width: 100%;
}

.form-content {
  /* Форма */
  margin-bottom: 2rem;
}

.preview-section-below {
  /* Превью данных под формой */
  margin-top: 1rem;
}

.data-preview {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  min-height: 300px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Заголовок превью с кнопкой */
.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #dee2e6;
}

.data-preview h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.1rem;
}

/* Кнопка удалить */
.clear-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: #c82333;
}

/* Стили для адреса в превью */
.address-verified {
  color: #28a745;
  font-weight: 500;
  margin-top: 0.25rem;
  padding: 0.75rem;
  background: #f8fff8;
  border-left: 4px solid #28a745;
  border-radius: 6px;
}

.address-draft {
  color: #856404;
  margin-top: 0.25rem;
  padding: 0.75rem;
  background: #fff3cd;
  border-left: 4px solid #ffc107;
  border-radius: 6px;
}

.address-status {
  font-size: 0.85rem;
  color: #6c757d;
  font-style: italic;
  margin-top: 0.25rem;
}

/* Стили для формы адреса */
.address-form-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.postal-search-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.manual-fields-section h5 {
  color: #495057;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.search-results {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
}

.search-results h5 {
  margin: 0 0 0.75rem 0;
  color: #495057;
  font-size: 0.95rem;
}

.results-list {
  max-height: 200px;
  overflow-y: auto;
}

.search-result-item {
  padding: 0.75rem;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.search-result-item:hover {
  background: #f8f9fa;
  border-color: #007bff;
}

.search-result-item.selected {
  background: #e8f5e8;
  border-color: #28a745;
  border-width: 2px;
}

.auto-selected {
  color: #28a745;
  font-weight: 600;
  margin-right: 0.5rem;
}

/* Стили для автовыбранных полей */
.auto-selected-label {
  color: #28a745;
  font-size: 0.85rem;
  font-weight: 500;
  margin-left: 0.5rem;
  display: inline-block;
}

.auto-selected-field {
  border-color: #28a745 !important;
  background-color: #f8fff8 !important;
  box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.15) !important;
}

.auto-selected-badge {
  background: #28a745;
  color: white;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  font-weight: 500;
}

.result-address {
  font-weight: 500;
  color: #212529;
  margin-bottom: 0.25rem;
}

.result-details {
  font-size: 0.85rem;
  color: #6c757d;
}

.result-details span {
  margin-right: 0.5rem;
}

.address-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}

.form-help {
  color: #6c757d;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  font-style: italic;
}

/* Стили для детального отображения данных */
.address-components,
.coordinates,
.api-data {
  margin-top: 0.5rem;
  padding-left: 1rem;
}

.component-item,
.api-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.component-item strong,
.api-item strong {
  color: #495057;
  margin-right: 0.25rem;
}

.api-data {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.coordinates {
  background: #e8f5e8;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #28a745;
}

.blockchain-data {
  background: #f0f8ff;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #007bff;
  margin-top: 0.5rem;
}

.gas-estimate {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fff3cd;
  border-radius: 4px;
  border: 1px solid #ffc107;
  color: #856404;
  font-weight: 500;
}

/* Компактное отображение адреса */
.compact-address {
  margin-top: 0.5rem;
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid #e9ecef;
  font-family: 'Courier New', monospace;
}

.address-line {
  font-size: 1rem;
  color: #495057;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.coordinates-line {
  font-size: 0.95rem;
  color: #28a745;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.oktmo-line {
  font-size: 0.95rem;
  color: #007bff;
  font-weight: 500;
}

/* Стили для секции ОКВЭД */
.okved-section {
  margin-top: 2rem; /* Отступ от кнопок */
}

.okved-title {
  margin-bottom: 1rem;
  font-weight: 600;
  color: #495057;
}

/* Стили для секции КПП */
.kpp-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e9ecef;
}

.selected-kpp-info {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: #e8f5e8;
  border-radius: 4px;
  border: 1px solid #28a745;
  color: #155724;
}

.selected-kpp-info p {
  margin: 0;
  font-size: 0.9rem;
}

/* Каскадная система ОКВЭД */
.okved-cascade {
  margin-bottom: 1rem;
}

.okved-cascade .form-group {
  margin-bottom: 0.75rem;
}

.okved-cascade .form-group:last-child {
  margin-bottom: 0;
}

.current-okved-selection {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #e8f5e8;
  border-radius: 4px;
  border: 1px solid #28a745;
}

.current-okved-selection p {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: #155724;
}

.current-isic-selection {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #e8f5e8;
  border-radius: 4px;
  border: 1px solid #28a745;
}

.current-isic-selection p {
  margin: 0 0 0.5rem 0;
  font-weight: 500;
  color: #155724;
}

.isic-cascade {
  margin-bottom: 1rem;
}

.selected-okved-codes {
  margin-top: 1rem;
}

.codes-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

.code-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  margin-bottom: 0.25rem;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.code-item span {
  flex: 1;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
}

.preview-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.preview-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.preview-section h4 {
  margin: 0 0 0.75rem 0;
  color: #495057;
  font-size: 0.95rem;
  font-weight: 600;
}

.preview-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.preview-item strong {
  color: #495057;
  font-weight: 500;
}



.okved-list {
  margin: 0.5rem 0 0 0;
  padding-left: 1.2rem;
  list-style-type: disc;
}

.okved-list li {
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
  color: #6c757d;
  font-family: monospace;
}

.preview-empty {
  text-align: center;
  color: #6c757d;
  font-style: italic;
  padding: 2rem 1rem;
}

.preview-empty p {
  margin: 0;
  font-size: 0.9rem;
}

/* Responsive design */
@media (max-width: 1024px) {
  .dle-layout {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .preview-column {
    position: static;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Стили для партнеров */
.partners-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e9ecef;
}

.partners-section h4 {
  color: var(--color-primary);
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.partner-entry {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.partner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.partner-title {
  font-weight: 600;
  color: #495057;
}

.partners-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.total-tokens {
  color: var(--color-primary);
  font-size: 1rem;
}

.partner-details {
  margin-left: 1rem;
  font-size: 0.9rem;
}

.partner-address {
  color: #6c757d;
  font-family: monospace;
  margin-bottom: 0.25rem;
}

.partner-tokens {
  color: #495057;
  font-weight: 500;
}

/* Каскадная система ОКВЭД */

  /* Стили для сети деплоя */
  .deploy-network-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e9ecef;
  }

  .deploy-network-section h4 {
    color: var(--color-primary);
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .selected-network-info {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #e8f5e8;
    border-radius: 4px;
    border: 1px solid #28a745;
    color: #155724;
  }

  .selected-network-info p {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
  }

  .selected-network-info p:last-child {
    margin-bottom: 0;
  }

/* Каскадная система ОКВЭД */

  /* Стили для приватного ключа */
  .private-key-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e9ecef;
  }

  .private-key-section h5 {
    color: var(--color-primary);
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .private-key-input {
    margin-bottom: 0.75rem;
  }

  .private-key-input .form-control {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .private-key-input .form-control:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }

  .input-icon-wrapper {
    position: relative;
  }

  .input-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    color: #666;
  }

  .private-key-help {
    color: #6c757d;
    font-size: 0.9rem;
    margin-bottom: 1rem;
    font-style: italic;
  }

  /* ==================== МУЛЬТИ-ЧЕЙН СТИЛИ ==================== */
  
  .multichain-deploy-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    border: 1px solid #dee2e6;
  }

  .multichain-deploy-section h4 {
    color: #495057;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .section-description {
    color: #6c757d;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .networks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .network-option {
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .network-option:hover {
    border-color: #007bff;
    box-shadow: 0 2px 8px rgba(0, 123, 255, 0.15);
  }

  .network-option.selected {
    border-color: #28a745;
    background-color: #f8fff9;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.15);
  }

  .network-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
    margin: 0;
  }

  .network-label input[type="checkbox"] {
    margin-top: 0.25rem;
    transform: scale(1.2);
  }

  .network-info {
    flex: 1;
  }

  .network-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .network-header h5 {
    margin: 0;
    color: #495057;
    font-weight: 600;
  }

  .chain-id {
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #6c757d;
    font-family: monospace;
  }

  .network-description {
    color: #6c757d;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }

  .network-cost {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cost {
    font-weight: 600;
    color: #28a745;
    font-size: 1.1rem;
  }

  .gas-info {
    font-size: 0.8rem;
    color: #6c757d;
    font-family: monospace;
  }

  .network-limited {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #f0f0f0;
  }

  .network-limited small {
    font-size: 0.75rem;
  }

  .text-muted {
    color: #6c757d !important;
  }

  /* ==================== СТИЛИ ДЛЯ СТАНДАРТА ТОКЕНА ==================== */
  


  /* Стили для операций */
  .option-operations {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
  }

  .option-operations h6 {
    color: #495057;
    margin-bottom: 0.75rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .operations-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .operations-available,
  .operations-unavailable {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .operation-item {
    font-size: 0.8rem;
    padding: 0.5rem;
    border-radius: 4px;
    line-height: 1.3;
  }

  .operation-item.available {
    background: #d4edda;
    color: #155724;
    border-left: 3px solid #28a745;
  }

  .operation-item.unavailable {
    background: #f8d7da;
    color: #721c24;
    border-left: 3px solid #dc3545;
  }

  .predicted-address-section {
    margin: 1.5rem 0;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #007bff;
  }

  .predicted-address-section h5 {
    margin-bottom: 0.75rem;
    color: #495057;
  }

  .address-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dle-address {
    flex: 1;
    background: #fff;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid #dee2e6;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: #495057;
    word-break: break-all;
  }

  .copy-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .copy-btn:hover {
    background: #0056b3;
  }

  .total-cost-section {
    margin: 1.5rem 0;
    padding: 1rem;
    background: #fff3cd;
    border-radius: 8px;
    border-left: 4px solid #ffc107;
  }

  .cost-breakdown h5 {
    margin-bottom: 1rem;
    color: #856404;
  }

  .cost-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
  }

  .total-line {
    border-top: 1px solid #ffeaa7;
    padding-top: 0.75rem;
    margin-top: 0.75rem;
    font-size: 1.1rem;
    color: #856404;
  }

  .rpc-settings-actions {
    margin-top: 1rem;
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .rpc-settings-actions .btn {
    min-width: 160px;
  }

  /* Стили для загрузки и пустого состояния */
  .networks-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }

  .loading-spinner {
    text-align: center;
    color: #6c757d;
  }

  .loading-spinner i {
    font-size: 2rem;
    margin-bottom: 1rem;
    color: #007bff;
  }

  .loading-spinner p {
    margin: 0;
    font-size: 1rem;
  }

  .no-networks-message {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }

  .empty-state {
    text-align: center;
    color: #6c757d;
    max-width: 400px;
  }

  .empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #dee2e6;
  }

  .empty-state h5 {
    margin-bottom: 0.5rem;
    color: #495057;
  }

  .empty-state p {
    margin-bottom: 1.5rem;
    line-height: 1.5;
  }

  /* Стили для приватных ключей */
  .private-keys-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    border: 1px solid #dee2e6;
  }

  .private-keys-section h4 {
    color: #495057;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  /* Информация о ключе */
  .key-info {
    margin-bottom: 1.5rem;
  }

  .info-card {
    background: #fff;
    border-radius: 8px;
    padding: 1.5rem;
    border: 1px solid #e9ecef;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .info-icon {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .info-content h5 {
    margin: 0 0 0.5rem 0;
    color: #495057;
    font-weight: 600;
  }

  .info-content p {
    margin: 0;
    color: #6c757d;
    line-height: 1.5;
  }

  /* Ввод ключа */
  .key-input-section {
    margin-bottom: 2rem;
  }

  .input-icon-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-icon {
    position: absolute;
    right: 10px;
    cursor: pointer;
    color: #6c757d;
    padding: 0.5rem;
  }

  .input-icon:hover {
    color: #495057;
  }

  .key-validation {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .validation-success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .validation-error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* Требования к балансу */
  .balance-requirements {
    margin-bottom: 2rem;
  }

  .balance-requirements h5 {
    color: #495057;
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .balance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .balance-item {
    background: #fff;
    border: 1px solid #e9ecef;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .network-name {
    font-weight: 600;
    color: #495057;
    margin-bottom: 0.5rem;
  }

  .balance-amount {
    font-size: 1.1rem;
    font-weight: 600;
    color: #28a745;
    margin-bottom: 0.25rem;
  }

  .balance-note {
    font-size: 0.8rem;
    color: #6c757d;
  }

  .total-balance {
    background: #e7f3ff;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
    border-left: 4px solid #007bff;
  }

  .total-balance strong {
    color: #0056b3;
  }

  /* Рекомендации безопасности */
  .security-recommendations {
    margin-top: 2rem;
  }

  .security-card {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .security-icon {
    color: #856404;
    font-size: 1.2rem;
    margin-top: 0.2rem;
    flex-shrink: 0;
  }

  .security-content h5 {
    color: #856404;
    margin-bottom: 1rem;
    font-weight: 600;
  }

  .security-content ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .security-content li {
    color: #856404;
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  /* Предупреждение о выборе сетей */
  .networks-warning {
    margin-bottom: 1.5rem;
  }

  .warning-card {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .warning-icon {
    color: #856404;
    font-size: 1.2rem;
    margin-top: 0.2rem;
    flex-shrink: 0;
  }

  .warning-content h5 {
    color: #856404;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .warning-content p {
    color: #856404;
    margin: 0;
    line-height: 1.5;
  }

  .warning-content ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #856404;
  }

  .warning-content li {
    margin-bottom: 0.25rem;
  }

  /* Стили для списков в превью */
  .networks-list,
  .keys-list {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    list-style: none;
  }

  .networks-list li,
  .keys-list li {
    margin-bottom: 0.25rem;
    padding: 0.25rem 0;
    font-size: 0.9rem;
    color: #495057;
  }

  .networks-list li:before {
    content: "🌐";
    margin-right: 0.5rem;
  }

  .keys-list li:before {
    content: "🔑";
    margin-right: 0.5rem;
  }

  .use-cases-list {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
    list-style: none;
  }

  .use-cases-list li {
    margin-bottom: 0.25rem;
    padding: 0.25rem 0;
    font-size: 0.9rem;
    color: #495057;
  }

  .use-cases-list li:before {
    content: "✅";
    margin-right: 0.5rem;
}

  /* Стили для секции кворума */
  .quorum-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e9ecef;
  }

  .quorum-section h5 {
    color: var(--color-primary);
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  /* Стили для секции деплоя */
  .deploy-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e9ecef;
  }

  /* Стили для информации о деплое */
  .deployment-info {
    margin-bottom: 2rem;
    width: 100%;
    max-width: 800px;
    padding: 2rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 16px;
    border: 1px solid #dee2e6;
  }

  .deployment-info h4 {
    color: #2c3e50;
    margin-bottom: 1rem;
    text-align: center;
    font-size: 1.4rem;
    font-weight: 600;
  }

  .deployment-description {
    color: #6c757d;
    text-align: center;
    margin-bottom: 1.5rem;
    font-size: 1rem;
    line-height: 1.5;
  }

  .deployment-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: white;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .feature-item i {
    color: #28a745;
    font-size: 1.1rem;
  }

  .feature-item span {
    color: #495057;
    font-size: 0.9rem;
    font-weight: 500;
  }

  /* Стили для мастера деплоя */
  .deployment-wizard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  }

  .wizard-container {
    background-color: white;
    border-radius: 16px;
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .deploy-buttons {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .deploy-btn {
    min-width: 250px;
  }

  .clear-btn {
    min-width: 150px;
  }

  /* Стили для индикатора статуса админских токенов */
  .admin-status {
    padding: 8px 12px;
    border-radius: 4px;
    margin-top: 8px;
    font-size: 0.9rem;
  }

  .admin-status.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .admin-status.warning {
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeaa7;
  }

  .admin-status.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }


  /* Стили для загрузки картинки токена */
  .token-image-upload {
    margin-top: 0.5rem;
  }

  .upload-area {
    border: 2px dashed #ddd;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: #fafafa;
    min-height: 150px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .upload-area:hover {
    border-color: var(--color-primary);
    background: #f0f8ff;
  }

  .upload-placeholder {
    color: #666;
  }

  .upload-placeholder i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: #ccc;
  }

  .upload-placeholder p {
    margin: 0.5rem 0;
    font-size: 1rem;
    font-weight: 500;
  }

  .upload-placeholder small {
    color: #999;
    font-size: 0.875rem;
  }

  .image-preview {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .token-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
    border-radius: 8px;
  }

  .image-preview:hover .image-overlay {
    opacity: 1;
  }

  .image-overlay .btn {
    background: rgba(220, 53, 69, 0.9);
    border: none;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .image-overlay .btn:hover {
    background: rgba(220, 53, 69, 1);
  }

  /* Стили для превью картинки токена */
  .token-image-preview {
    margin-top: 0.5rem;
  }

  .preview-token-image {
    max-width: 100px;
    max-height: 100px;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .logo-preview img { box-shadow: 0 1px 4px rgba(0,0,0,0.06); background:#fff; }
</style> 