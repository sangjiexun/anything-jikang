<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkflowStore } from './stores/workflowStore'
import { useUIStore } from './stores/uiStore'
import ChatPanel from './panels/ChatPanel.vue'
import ConfigPanel from './panels/ConfigPanel.vue'
import KnowledgePanel from './panels/KnowledgePanel.vue'
import ResultsPanel from './panels/ResultsPanel.vue'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 当前选中的标签页
const activeTab = computed(() => uiStore.state.activeTab)

// 标签页定义
const tabs = [
  { id: 'chat', label: '聊天', icon: '💬' },
  { id: 'config', label: '配置', icon: '⚙️' },
  { id: 'kb', label: '知识库', icon: '📚' },
  { id: 'results', label: '结果', icon: '📊' }
]

// 切换标签页
const switchTab = (tabId: string) => {
  uiStore.setActiveTab(tabId as any)
}

// 切换面板收起状态
const togglePanel = () => {
  uiStore.toggleRightPanel()
}
</script>

<template>
  <aside class="right-panel" :class="{ collapsed: uiStore.state.rightPanelCollapsed }">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="panel-title">
        <h3>属性面板</h3>
        <button class="collapse-btn" @click="togglePanel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      <!-- 标签页 -->
      <div class="tab-container">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="switchTab(tab.id)"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- 面板内容 -->
    <div class="panel-content">
      <!-- 聊天面板 -->
      <ChatPanel v-show="activeTab === 'chat'" />
      
      <!-- 配置面板 -->
      <ConfigPanel v-show="activeTab === 'config'" />
      
      <!-- 知识库面板 -->
      <KnowledgePanel v-show="activeTab === 'kb'" />
      
      <!-- 结果面板 -->
      <ResultsPanel v-show="activeTab === 'results'" />
    </div>

    <!-- 收起状态显示 -->
    <div v-if="uiStore.state.rightPanelCollapsed" class="collapsed-indicator">
      <button class="expand-btn" @click="togglePanel">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  width: 380px;
  height: 100%;
  background: var(--darker, #181825);
  border-left: 1px solid var(--surface, #45475a);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
}

.right-panel.collapsed {
  width: 0;
  overflow: hidden;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid var(--surface, #45475a);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin: 0;
}

.collapse-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--surface, #45475a);
  background: var(--dark, #1e1e2e);
  color: var(--light, #cdd6f4);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: var(--surface, #45475a);
  border-color: var(--primary, #6366f1);
}

.tab-container {
  display: flex;
  gap: 4px;
  background: var(--dark, #1e1e2e);
  padding: 4px;
  border-radius: 8px;
}

.tab-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: var(--surface, #45475a);
}

.tab-btn.active {
  background: var(--primary, #6366f1);
  color: white;
}

.tab-icon {
  font-size: 14px;
  line-height: 1;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.collapsed-indicator {
  position: absolute;
  top: 50%;
  right: -20px;
  transform: translateY(-50%);
  z-index: 10;
}

.expand-btn {
  width: 32px;
  height: 60px;
  background: var(--darker, #181825);
  border: 1px solid var(--surface, #45475a);
  border-left: none;
  border-radius: 0 8px 8px 0;
  color: var(--light, #cdd6f4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.expand-btn:hover {
  background: var(--surface, #45475a);
  border-color: var(--primary, #6366f1);
  color: var(--primary, #6366f1);
}
</style>