<script setup lang="ts">
import { ref } from 'vue'
import { useWorkflowStore } from './stores/workflowStore'
import { useUIStore } from './stores/uiStore'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 工作流名称和描述
const workflowName = ref('新建工作流')
const workflowDescription = ref('')

// API配置
const apiEndpoint = ref('https://api.deepseek.com/v1')
const apiKey = ref('')

// 保存工作流
const handleSave = () => {
  workflowStore.saveWorkflow()
}

// 执行工作流
const handleExecute = () => {
  workflowStore.executeWorkflow()
}

// 新建工作流
const handleNew = () => {
  if (confirm('创建新工作流将清空当前内容，是否继续？')) {
    workflowStore.clearCanvas()
    workflowName.value = '新建工作流'
    workflowDescription.value = ''
  }
}

// 加载工作流
const handleLoad = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workflow = JSON.parse(event.target?.result as string)
        
        // 应用工作流
        workflowStore.state.nodes = workflow.nodes || []
        workflowStore.state.connections = workflow.connections || []
        workflowStore.state.nodeIdCounter = Math.max(
          ...workflowStore.state.nodes.map(n => parseInt(n.id.split('_')[1]) || 0),
          0
        )
        
        workflowName.value = workflow.name || '未命名工作流'
        workflowDescription.value = workflow.description || ''
        
        workflowStore.saveToLocalStorage()
        uiStore.showToast('工作流已加载', 'success')
      } catch (error) {
        uiStore.showToast('加载失败: ' + (error as Error).message, 'error')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

// AI创建工作流
const handleAICreate = () => {
  uiStore.showToast('AI创建功能开发中...', 'info')
}

// 个人中心
const handleProfile = () => {
  uiStore.showToast('个人中心功能开发中...', 'info')
}

// 帮助
const handleHelp = () => {
  uiStore.showToast('快捷键：Ctrl+S 保存，Ctrl+E 执行，Delete 删除节点', 'info')
}
</script>

<template>
  <header class="workflow-header">
    <div class="header-content">
      <!-- 左侧：返回按钮和标题 -->
      <div class="header-left">
        <button class="back-btn" @click="$router.push('/creator/workstation')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div class="workflow-info">
          <input
            v-model="workflowName"
            class="workflow-name"
            placeholder="新建工作流"
          />
          <input
            v-model="workflowDescription"
            class="workflow-description"
            placeholder="工作流描述"
          />
        </div>
      </div>

      <!-- 中间：API配置 -->
      <div class="header-center">
        <div class="api-config">
          <input
            v-model="apiEndpoint"
            class="api-input"
            placeholder="API端点"
          />
          <input
            v-model="apiKey"
            class="api-input api-key"
            type="password"
            placeholder="API密钥"
          />
        </div>
      </div>

      <!-- 右侧：操作按钮 -->
      <div class="header-right">
        <button class="btn btn-secondary" @click="handleNew">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          新建
        </button>
        
        <button class="btn btn-secondary" @click="handleLoad">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          加载
        </button>
        
        <button class="btn btn-success" @click="handleSave">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
          </svg>
          保存
        </button>
        
        <button class="btn btn-primary" @click="handleExecute">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          执行
        </button>
        
        <div class="divider"></div>
        
        <button class="btn btn-secondary" @click="handleAICreate">
          <span class="ai-icon">🤖</span>
          AI创建
        </button>
        
        <button class="btn btn-secondary" @click="handleProfile">
          <span>👤</span>
        </button>
        
        <button class="btn btn-secondary" @click="handleHelp">
          <span>❓</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.workflow-header {
  height: 72px;
  background: var(--darker, #181825);
  border-bottom: 1px solid var(--surface, #45475a);
  display: flex;
  align-items: center;
  padding: 0 20px;
  z-index: 100;
}

.header-content {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--surface, #45475a);
  background: var(--dark, #1e1e2e);
  color: var(--light, #cdd6f4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--surface, #45475a);
  border-color: var(--primary, #6366f1);
}

.workflow-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.workflow-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  background: transparent;
  border: none;
  outline: none;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.workflow-name:hover {
  background: var(--surface, #45475a);
}

.workflow-description {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  background: transparent;
  border: none;
  outline: none;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.workflow-description:hover {
  background: var(--surface, #45475a);
}

.header-center {
  flex: 0 0 auto;
}

.api-config {
  display: flex;
  gap: 8px;
  align-items: center;
}

.api-input {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--surface, #45475a);
  background: var(--dark, #1e1e2e);
  color: var(--light, #cdd6f4);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.api-input:focus {
  border-color: var(--primary, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.api-key {
  width: 200px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.btn-secondary {
  background: var(--surface, #45475a);
  color: var(--light, #cdd6f4);
  border-color: var(--surface, #45475a);
}

.btn-secondary:hover {
  background: var(--surface-light, #585b70);
  border-color: var(--surface-light, #585b70);
}

.btn-primary {
  background: var(--primary, #6366f1);
  color: white;
}

.btn-primary:hover {
  background: #5558e3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-success {
  background: var(--success, #10b981);
  color: white;
}

.btn-success:hover {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--surface, #45475a);
  margin: 0 4px;
}

.ai-icon {
  font-size: 14px;
}
</style>