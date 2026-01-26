<template>
  <div class="analysis-charts p-4">
    <div class="text-gray-500 text-center py-8">
      <p>分析图表</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  data?: any
  isLoading?: boolean
}>()
</script>

<style scoped>
.analysis-charts {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}
</style>
