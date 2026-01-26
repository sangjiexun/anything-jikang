<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Header from './Header.vue'
import Sidebar from './Sidebar.vue'
import Canvas from './Canvas.vue'
import RightPanel from './RightPanel.vue'
import { useWorkflowStore } from './stores/workflowStore'
import { useUIStore } from './stores/uiStore'
import './styles/global.css'

// 使用stores
const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 组件挂载
onMounted(() => {
  // 初始化工作流
  workflowStore.initializeWorkflow()
  
  // 设置事件监听器
  document.addEventListener('keydown', handleKeyDown)
})

// 组件卸载
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// 键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {
  // Ctrl+S 保存工作流
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault()
    workflowStore.saveWorkflow()
  }
  
  // Ctrl+E 执行工作流
  if (event.ctrlKey && event.key === 'e') {
    event.preventDefault()
    workflowStore.executeWorkflow()
  }
  
  // Delete 删除选中节点
  if (event.key === 'Delete' && uiStore.selectedNodeId) {
    workflowStore.deleteNode(uiStore.selectedNodeId)
  }
}
</script>

<template>
  <div class="workflow-designer">
    <!-- 顶部工具栏 -->
    <Header />
    
    <!-- 主要内容区 -->
    <div class="main-content">
      <!-- 左侧节点库 -->
      <Sidebar />
      
      <!-- 工作流画布 -->
      <Canvas />
      
      <!-- 右侧配置面板 -->
      <RightPanel />
    </div>
  </div>
</template>

<style scoped>
.workflow-designer {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--dark, #1e1e2e);
  color: var(--light, #cdd6f4);
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  position: relative;
}
</style>