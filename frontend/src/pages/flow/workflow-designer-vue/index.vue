<script setup lang="ts">
definePageMeta({
  layout: 'empty',
  middleware: 'creator'
})

useSeoMeta({
  title: 'AI工作流设计器 | 极康AI',
  description: 'AI工具链工作流设计器 - 可视化拖拽式工作流编排',
  robots: 'noindex, nofollow'
})

// 导入主组件
import WorkflowDesigner from './components/WorkflowDesigner.vue'
</script>

<template>
  <WorkflowDesigner />
</template>