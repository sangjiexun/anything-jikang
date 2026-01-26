<template>
  <div class="structure-analysis-panel p-4">
    <div class="text-gray-500 text-center py-8">
      <p>结构分析面板</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  result?: any
  isLoading?: boolean
}>()

defineEmits(['close'])
</script>

<style scoped>
.structure-analysis-panel {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
</style>
