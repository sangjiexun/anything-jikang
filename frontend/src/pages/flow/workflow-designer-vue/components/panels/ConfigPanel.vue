<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkflowStore } from '../stores/workflowStore'
import { useUIStore } from '../stores/uiStore'
import { NODE_TYPES } from '../types/nodes'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 当前选中的节点
const selectedNode = computed(() => {
  if (!uiStore.state.selectedNodeId) return null
  return workflowStore.state.nodes.find(n => n.id === uiStore.state.selectedNodeId)
})

// 节点类型配置
const nodeTypeConfig = computed(() => {
  if (!selectedNode.value) return null
  return NODE_TYPES[selectedNode.value.type]
})

// 更新节点配置
const updateNodeConfig = (key: string, value: any) => {
  if (!selectedNode.value) return
  
  workflowStore.updateNode(selectedNode.value.id, {
    config: {
      ...selectedNode.value.config,
      [key]: value
    }
  })
}

// 更新节点位置
const updateNodePosition = () => {
  if (!selectedNode.value) return
  
  workflowStore.updateNode(selectedNode.value.id, {
    x: selectedNode.value.x,
    y: selectedNode.value.y
  })
}

// 删除节点
const deleteNode = () => {
  if (!selectedNode.value) return
  
  if (confirm(`确定要删除节点 "${nodeTypeConfig.value?.title}" 吗？`)) {
    workflowStore.deleteNode(selectedNode.value.id)
    uiStore.showToast('节点已删除', 'success')
  }
}

// 复制节点
const duplicateNode = () => {
  if (!selectedNode.value) return
  
  const newNode = workflowStore.addNode(
    selectedNode.value.type,
    {
      x: selectedNode.value.x + 50,
      y: selectedNode.value.y + 50
    }
  )
  
  // 复制配置
  workflowStore.updateNode(newNode.id, {
    config: { ...selectedNode.value.config }
  })
  
  uiStore.selectNode(newNode.id)
  uiStore.showToast('节点已复制', 'success')
}

// 配置字段类型
const getConfigFieldType = (key: string, value: any): 'text' | 'number' | 'select' | 'textarea' | 'checkbox' => {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  if (key.includes('prompt') || key.includes('code') || key.includes('content')) return 'textarea'
  
  // 特殊处理
  if (key === 'model') {
    return 'select'
  }
  if (key === 'chartType' || key === 'library' || key === 'style') {
    return 'select'
  }
  
  return 'text'
}

// 获取选择选项
const getSelectOptions = (key: string): Array<{ label: string, value: any }> => {
  const options: Record<string, Array<{ label: string, value: any }>> = {
    model: [
      { label: 'DeepSeek V3', value: 'deepseek-v3' },
      { label: 'DeepSeek Chat', value: 'deepseek-chat' },
      { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash-all' }
    ],
    chartType: [
      { label: '柱状图', value: 'bar' },
      { label: '折线图', value: 'line' },
      { label: '饼图', value: 'pie' },
      { label: '环形图', value: 'doughnut' },
      { label: '散点图', value: 'scatter' },
      { label: '雷达图', value: 'radar' },
      { label: '面积图', value: 'area' }
    ],
    library: [
      { label: 'ECharts', value: 'echarts' },
      { label: 'Chart.js', value: 'chartjs' },
      { label: 'D3.js', value: 'd3' }
    ],
    style: [
      { label: '现代风格', value: 'modern' },
      { label: '商务风格', value: 'business' },
      { label: '科技风格', value: 'scientific' },
      { label: '彩色风格', value: 'colorful' },
      { label: '暗色风格', value: 'dark' },
      { label: '极简风格', value: 'minimal' }
    ]
  }
  
  return options[key] || []
}

// 获取字段显示名称
const getFieldDisplayName = (key: string): string => {
  const nameMap: Record<string, string> = {
    model: '模型',
    systemPrompt: '系统提示词',
    temperature: '温度',
    maxTokens: '最大令牌数',
    prompt: '提示词',
    placeholder: '占位符',
    defaultValue: '默认值',
    format: '格式',
    filename: '文件名',
    chunkSize: '分块大小',
    chunkOverlap: '分块重叠',
    topK: '返回数量',
    threshold: '相似度阈值',
    code: '代码',
    command: '命令',
    condition: '条件',
    maxMessages: '最大消息数',
    chartType: '图表类型',
    library: '图表库',
    useAI: 'AI辅助',
    analysisType: '分析类型'
  }
  
  return nameMap[key] || key
}
</script>

<template>
  <div class="config-panel">
    <!-- 无选中节点时显示 -->
    <div v-if="!selectedNode" class="empty-state">
      <div class="empty-icon">⚙️</div>
      <h3>选择一个节点</h3>
      <p>点击画布上的节点以查看和编辑其配置</p>
    </div>

    <!-- 节点配置表单 -->
    <div v-else class="node-config">
      <!-- 节点基本信息 -->
      <div class="config-section">
        <h4 class="section-title">节点信息</h4>
        <div class="info-grid">
          <div class="info-item">
            <label class="info-label">类型</label>
            <div class="info-value">
              <span class="node-type-icon" :style="{ color: nodeTypeConfig?.color }">
                {{ nodeTypeConfig?.icon }}
              </span>
              {{ nodeTypeConfig?.title }}
            </div>
          </div>
          <div class="info-item">
            <label class="info-label">ID</label>
            <div class="info-value">{{ selectedNode.id }}</div>
          </div>
        </div>
      </div>

      <!-- 位置配置 -->
      <div class="config-section">
        <h4 class="section-title">位置</h4>
        <div class="position-grid">
          <div class="position-item">
            <label class="position-label">X 坐标</label>
            <input
              v-model.number="selectedNode.x"
              type="number"
              class="position-input"
              @change="updateNodePosition"
            />
          </div>
          <div class="position-item">
            <label class="position-label">Y 坐标</label>
            <input
              v-model.number="selectedNode.y"
              type="number"
              class="position-input"
              @change="updateNodePosition"
            />
          </div>
        </div>
      </div>

      <!-- 配置参数 -->
      <div class="config-section">
        <h4 class="section-title">配置参数</h4>
        <div class="config-fields">
          <div
            v-for="(value, key) in selectedNode.config"
            :key="key"
            class="config-field"
          >
            <label class="field-label">{{ getFieldDisplayName(key) }}</label>
            
            <!-- 文本输入 -->
            <input
              v-if="getConfigFieldType(key, value) === 'text'"
              v-model="selectedNode.config[key]"
              type="text"
              class="field-input"
              @input="updateNodeConfig(key, $event.target.value)"
            />
            
            <!-- 数字输入 -->
            <input
              v-else-if="getConfigFieldType(key, value) === 'number'"
              v-model.number="selectedNode.config[key]"
              type="number"
              step="0.1"
              class="field-input"
              @input="updateNodeConfig(key, Number($event.target.value))"
            />
            
            <!-- 选择框 -->
            <select
              v-else-if="getConfigFieldType(key, value) === 'select'"
              v-model="selectedNode.config[key]"
              class="field-select"
              @change="updateNodeConfig(key, $event.target.value)"
            >
              <option
                v-for="option in getSelectOptions(key)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            
            <!-- 文本域 -->
            <textarea
              v-else-if="getConfigFieldType(key, value) === 'textarea'"
              v-model="selectedNode.config[key]"
              class="field-textarea"
              rows="4"
              @input="updateNodeConfig(key, $event.target.value)"
            ></textarea>
            
            <!-- 复选框 -->
            <label
              v-else-if="getConfigFieldType(key, value) === 'checkbox'"
              class="field-checkbox"
            >
              <input
                v-model="selectedNode.config[key]"
                type="checkbox"
                @change="updateNodeConfig(key, $event.target.checked)"
              />
              <span class="checkbox-text">启用</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="config-actions">
        <button class="action-btn secondary" @click="duplicateNode">
          📋 复制节点
        </button>
        <button class="action-btn danger" @click="deleteNode">
          🗑️ 删除节点
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--darker, #181825);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-tertiary, #6c7080);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-secondary, #a0a0a0);
}

.empty-state p {
  font-size: 13px;
  line-height: 1.4;
}

.node-config {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-section {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  padding: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--surface, #45475a);
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
}

.info-value {
  font-size: 12px;
  color: var(--light, #cdd6f4);
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-type-icon {
  font-size: 14px;
}

.position-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.position-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.position-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
}

.position-input {
  padding: 6px 8px;
  background: var(--darker, #181825);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  outline: none;
}

.position-input:focus {
  border-color: var(--primary, #6366f1);
}

.config-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  font-weight: 500;
}

.field-input,
.field-select {
  padding: 8px 10px;
  background: var(--darker, #181825);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  outline: none;
}

.field-input:focus,
.field-select:focus {
  border-color: var(--primary, #6366f1);
}

.field-textarea {
  padding: 8px 10px;
  background: var(--darker, #181825);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  outline: none;
  resize: vertical;
  font-family: monospace;
}

.field-textarea:focus {
  border-color: var(--primary, #6366f1);
}

.field-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.field-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--primary, #6366f1);
}

.checkbox-text {
  font-size: 12px;
  color: var(--light, #cdd6f4);
}

.config-actions {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--surface, #45475a);
}

.action-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--surface, #45475a);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.secondary {
  background: var(--surface, #45475a);
  color: var(--light, #cdd6f4);
}

.action-btn.secondary:hover {
  background: var(--surface-light, #585b70);
  border-color: var(--surface-light, #585b70);
}

.action-btn.danger {
  background: transparent;
  color: var(--danger, #ef4444);
  border-color: var(--danger, #ef4444);
}

.action-btn.danger:hover {
  background: var(--danger, #ef4444);
  color: white;
}

/* 滚动条样式 */
.node-config::-webkit-scrollbar {
  width: 4px;
}

.node-config::-webkit-scrollbar-track {
  background: transparent;
}

.node-config::-webkit-scrollbar-thumb {
  background: var(--surface, #45475a);
  border-radius: 2px;
}
</style>