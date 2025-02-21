<template>
  <div id="app">
    <h1>DApp for Business</h1>
    <ContractInteraction ref="contractInteraction" />
    <AIAssistant 
      :isConnected="isConnected"
      :userAddress="userAddress"
      @chatUpdated="handleChatUpdate"
    />
    <ServerControl />
    <DataTables 
      :isConnected="isConnected" 
      :userAddress="userAddress"
      ref="dataTables"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ContractInteraction from './components/ContractInteraction.vue'
import AIAssistant from './components/AIAssistant.vue'
import ServerControl from './components/ServerControl.vue'
import DataTables from './components/DataTables.vue'

const contractInteraction = ref(null)
const isConnected = ref(false)
const userAddress = ref(null)
const dataTables = ref(null)

watch(() => contractInteraction.value?.isConnected, (newValue) => {
  isConnected.value = newValue
})

watch(() => contractInteraction.value?.address, (newValue) => {
  userAddress.value = newValue
})

function handleChatUpdate() {
  dataTables.value?.fetchData()
}
</script>

<style>
#app {
  font-family: Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style> 