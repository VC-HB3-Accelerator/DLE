<template>
    <div class="vector-store">
      <h2>Векторное хранилище</h2>
      <div v-if="loading" class="loading">
        Загрузка...
      </div>
      <div v-else>
        <div class="stats">
          <p>Всего документов: {{ vectors.length }}</p>
          <p>Размерность эмбеддингов: {{ getEmbeddingStats }}</p>
        </div>
  
        <div class="filters">
          <input 
            v-model="search" 
            placeholder="Поиск по содержанию..."
            class="search-input"
          >
          <select v-model="typeFilter" class="type-filter">
            <option value="">Все типы</option>
            <option value="approved_chat">Одобренные чаты</option>
          </select>
        </div>
  
        <table class="vectors-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Содержание</th>
              <th>Метаданные</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vector in filteredVectors" :key="vector.id">
              <td>{{ vector.id }}</td>
              <td class="content-cell">
                <div class="qa-format">
                  <div class="question">Q: {{ getQuestion(vector.content) }}</div>
                  <div class="answer">A: {{ getAnswer(vector.content) }}</div>
                </div>
              </td>
              <td>
                <div class="metadata">
                  <span class="metadata-item">
                    <strong>Тип:</strong> {{ vector.metadata.type }}
                  </span>
                  <span class="metadata-item">
                    <strong>Одобрил:</strong> {{ shortenAddress(vector.metadata.approvedBy) }}
                  </span>
                  <span class="metadata-item">
                    <strong>ID чата:</strong> {{ vector.metadata.chatId }}
                  </span>
                </div>
              </td>
              <td>{{ formatDate(vector.created) }}</td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  </template>
  
  <script>
  const API_BASE_URL = 'http://localhost:3000';
  
  export default {
    name: 'VectorStore',
    data() {
      return {
        vectors: [],
        loading: true,
        error: null,
        search: '',
        typeFilter: '',
        baseUrl: API_BASE_URL
      }
    },
    computed: {
      getEmbeddingStats() {
        if (!this.vectors.length) return 'Нет данных';
        const sizes = this.vectors.map(v => v.embedding_size);
        const uniqueSizes = [...new Set(sizes)];
        if (uniqueSizes.length === 1) {
          return uniqueSizes[0];
        }
        return `Разные размерности: ${uniqueSizes.join(', ')}`;
      },
      filteredVectors() {
        return this.vectors.filter(vector => {
          const matchesSearch = this.search === '' || 
            vector.content.toLowerCase().includes(this.search.toLowerCase());
          const matchesType = this.typeFilter === '' || 
            vector.metadata.type === this.typeFilter;
          return matchesSearch && matchesType;
        });
      }
    },
    async mounted() {
      await this.loadVectors();
    },
    methods: {
      async loadVectors() {
        try {
          const response = await fetch('http://127.0.0.1:3000/api/admin/vectors', {
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
  
          if (response.status === 401) {
            this.error = 'Необходима авторизация. Пожалуйста, подключите кошелек.';
            return;
          }
          
          if (response.status === 403) {
            this.error = 'Доступ запрещен. Только владелец контракта может просматривать векторное хранилище.';
            return;
          }
  
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
  
          const data = await response.json();
          if (!Array.isArray(data.vectors)) {
            throw new Error('Неверный формат данных');
          }
  
          this.vectors = data.vectors;
          this.error = null;
        } catch (error) {
          console.error('Error loading vectors:', error);
          this.error = `Ошибка загрузки векторов: ${error.message}. 
            ${error.message.includes('404') ? 
              'API эндпоинт не найден. Проверьте URL и работу сервера.' : 
              'Проверьте права доступа и подключение к серверу.'}`;
        } finally {
          this.loading = false;
        }
      },
      getQuestion(content) {
        return content.split('\nA:')[0].replace('Q:', '').trim();
      },
      getAnswer(content) {
        return content.split('\nA:')[1]?.trim() || '';
      },
      shortenAddress(address) {
        return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
      },
      formatDate(date) {
        return new Date(date).toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
  }
  </script>
  
  <style scoped>
  .vector-store {
    padding: 20px;
  }
  
  .filters {
    margin: 20px 0;
    display: flex;
    gap: 10px;
  }
  
  .search-input,
  .type-filter {
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .search-input {
    flex: 1;
  }
  
  .vectors-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
  }
  
  .vectors-table th,
  .vectors-table td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
  }
  
  .vectors-table th {
    background-color: #f5f5f5;
  }
  
  .content-cell {
    max-width: 400px;
  }
  
  .qa-format {
    white-space: pre-wrap;
  }
  
  .question {
    color: #2c3e50;
    margin-bottom: 5px;
  }
  
  .answer {
    color: #34495e;
  }
  
  .metadata {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .metadata-item {
    background: #f8f9fa;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  
  .stats {
    margin: 20px 0;
    padding: 10px;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  .error-message {
    margin-top: 20px;
    padding: 10px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
  }
  </style> 