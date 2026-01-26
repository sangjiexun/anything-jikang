<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkflowStore } from './stores/workflowStore'
import { getNodeCategories } from './types/nodes'
import type { NodeType } from '../../../../../../lib/types/flow/workflow'

const workflowStore = useWorkflowStore()

// 搜索关键词
const searchKeyword = ref('')

// 节点类别
const nodeCategories = computed(() => {
  const categories = getNodeCategories()
  const keyword = searchKeyword.value.trim().toLowerCase()
  
  if (!keyword) {
    return categories
  }
  
  // 过滤节点
  const filteredCategories: Record<string, any[]> = {}
  Object.entries(categories).forEach(([category, nodes]) => {
    const filteredNodes = nodes.filter(node => 
      node.title.toLowerCase().includes(keyword) ||
      node.description.toLowerCase().includes(keyword)
    )
    if (filteredNodes.length > 0) {
      filteredCategories[category] = filteredNodes
    }
  })
  
  return filteredCategories
})

// 拖拽开始
const handleDragStart = (event: DragEvent, nodeType: string) => {
  if (!event.dataTransfer) return
  
  event.dataTransfer.setData('nodeType', nodeType)
  event.dataTransfer.effectAllowed = 'copy'
  
  // 设置拖拽时的视觉效果
  const target = event.target as HTMLElement
  target.style.opacity = '0.5'
  
  setTimeout(() => {
    target.style.opacity = '1'
  }, 100)
}

// 拖拽结束
const handleDragEnd = (event: DragEvent) => {
  const target = event.target as HTMLElement
  target.style.opacity = '1'
}
</script>

<template>
  <aside class="sidebar">
    <!-- 顶部标题和搜索 -->
    <div class="sidebar-header">
      <h2 class="sidebar-title">节点库</h2>
      <div class="search-container">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="搜索节点..."
        />
      </div>
    </div>

    <!-- 节点列表 -->
    <div class="node-list">
      <div
        v-for="(nodes, category) in nodeCategories"
        :key="category"
        class="node-category"
      >
        <h3 class="category-title">{{ category }}</h3>
        <div class="node-grid">
          <div
            v-for="node in nodes"
            :key="node.id"
            class="node-item"
            draggable="true"
            @dragstart="handleDragStart($event, node.id)"
            @dragend="handleDragEnd"
          >
            <div class="node-icon" :style="{ backgroundColor: node.color + '20', color: node.color }">
              <span>{{ node.icon }}</span>
            </div>
            <div class="node-info">
              <div class="node-title">{{ node.title }}</div>
              <div class="node-description">{{ node.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部模板 -->
    <div class="sidebar-footer">
      <div class="template-section">
        <h4 class="template-title">快速模板</h4>
        <div class="template-list">
          <button class="template-btn" @click="workflowStore.clearCanvas">
            <span class="template-icon">🔄</span>
            <span>清空画布</span>
          </button>
          <button class="template-btn">
            <span class="template-icon">🤖</span>
            <span>AI生成</span>
          </button>
          <button class="template-btn">
            <span class="template-icon">📋</span>
            <span>导入JSON</span>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 320px;
  height: 100%;
  background: var(--darker, #181825);
  border-right: 1px solid var(--surface, #45475a);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid var(--surface, #45475a);
}

.sidebar-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin-bottom: 16px;
}

.search-container {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #6c7080);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  color: var(--light, #cdd6f4);
  font-size: 13px;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: var(--primary, #6366f1);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.search-input::placeholder {
  color: var(--text-tertiary, #6c7080);
}

.node-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.node-category {
  margin-bottom: 24px;
}

.category-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.node-grid {
  display: grid;
  gap: 8px;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  cursor: move;
  transition: all 0.2s;
  user-select: none;
}

.node-item:hover {
  border-color: var(--primary, #6366f1);
  background: var(--surface, #45475a);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.node-item:active {
  transform: translateY(0);
}

.node-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--light, #cdd6f4);
  margin-bottom: 2px;
  line-height: 1.3;
}

.node-description {
  font-size: 11px;
  color: var(--text-tertiary, #6c7080);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid var(--surface, #45475a);
  background: var(--darker, #181825);
}

.template-section {
  margin-bottom: 16px;
}

.template-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.template-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 6px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.template-btn:hover {
  border-color: var(--primary, #6366f1);
  background: var(--surface, #45475a);
}

.template-icon {
  font-size: 14px;
}

/* 滚动条样式 */
.node-list::-webkit-scrollbar {
  width: 6px;
}

.node-list::-webkit-scrollbar-track {
  background: transparent;
}

.node-list::-webkit-scrollbar-thumb {
  background: var(--surface, #45475a);
  border-radius: 3px;
}

.node-list::-webkit-scrollbar-thumb:hover {
  background: var(--surface-light, #585b70);
}
</style>