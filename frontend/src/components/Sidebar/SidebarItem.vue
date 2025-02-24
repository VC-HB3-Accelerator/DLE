<template>
  <router-link 
    :to="to" 
    class="sidebar-item"
    :class="{ 'router-link-active': $route.path === to }"
    custom
    v-slot="{ navigate, isActive }"
  >
    <div 
      @click="navigate"
      class="sidebar-link"
      :class="{ active: isActive }"
    >
      <span class="text">{{ text }}</span>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router/dist/vue-router.esm-bundler'

const props = defineProps({
  to: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📄'
  },
  text: {
    type: String,
    required: true
  }
})

const route = useRoute()
const isActive = computed(() => route.path === props.to)
</script>

<style scoped>
.sidebar-link {
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  color: #2c3e50;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
  cursor: pointer;
  height: 36px;
}

.sidebar-link:hover {
  background-color: rgba(0,0,0,0.05);
}

.sidebar-link.active {
  background-color: rgba(0,0,0,0.1);
  font-weight: 500;
}

.icon {
  margin-right: 0.5rem;
}

.text {
  font-size: 0.9rem;
  color: inherit;
  line-height: 1;
}
</style>
