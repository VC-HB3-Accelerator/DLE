<template>
  <div id="app">
    <h1>DApp for Business</h1>
    <ContractInteraction ref="contractInteraction" />
    <AIAssistant 
      :isConnected="isConnected"
      :userAddress="userAddress"
    />
    <ServerControl />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ContractInteraction from './components/ContractInteraction.vue'
import AIAssistant from './components/AIAssistant.vue'
import ServerControl from './components/ServerControl.vue'

const contractInteraction = ref(null)
const isConnected = ref(false)
const userAddress = ref(null)

watch(() => contractInteraction.value?.isConnected, (newValue) => {
  isConnected.value = newValue
})

watch(() => contractInteraction.value?.address, (newValue) => {
  userAddress.value = newValue
})
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