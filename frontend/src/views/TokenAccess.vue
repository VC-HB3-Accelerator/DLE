<template>
    <div class="token-access">
      <h1>Настройка прав доступа</h1>
      <div>
        <label for="blockchain">Выберите блокчейн:</label>
        <select v-model="selectedBlockchain" id="blockchain">
          <option v-for="(blockchain, index) in blockchains" :key="index" :value="blockchain.value">
            {{ blockchain.name }}
          </option>
        </select>
      </div>
      <form @submit.prevent="checkTokenBalance">
        <div>
          <label for="contractAddress">Адрес смарт-контракта:</label>
          <input v-model="contractAddress" id="contractAddress" placeholder="Введите адрес смарт-контракта" required />
        </div>
        <div>
          <label for="requiredAmount">Объем токенов:</label>
          <input v-model="requiredAmount" type="number" id="requiredAmount" placeholder="Введите объем токенов" required />
        </div>
        <button type="submit">Проверить баланс</button>
      </form>
      <p v-if="message">{{ message }}</p>
    </div>
  </template>
  
  <script>
  export default {
    data() {
      return {
        selectedBlockchain: 'mainnet', // Значение по умолчанию
        blockchains: [
          { name: 'Ethereum', value: 'mainnet' },
          { name: 'Polygon', value: 'polygon' },
          { name: 'Binance Smart Chain', value: 'bsc' },
          { name: 'Arbitrum', value: 'arbitrum' }
        ],
        contractAddress: '',
        requiredAmount: '',
        message: ''
      };
    },
    methods: {
      async checkTokenBalance() {
        const response = await fetch(`/api/admin/check-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            walletAddress: this.$store.state.walletAddress, // Предполагается, что адрес кошелька хранится в хранилище
            contractAddress: this.contractAddress,
            requiredAmount: this.requiredAmount,
            blockchain: this.selectedBlockchain
          })
        });
  
        const data = await response.json();
        this.message = data.message;
      }
    }
  };
  </script>
  
  <style scoped>
  .token-access {
    max-width: 400px;
    margin: auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 5px;
    background-color: #f9f9f9;
  }
  </style>
  