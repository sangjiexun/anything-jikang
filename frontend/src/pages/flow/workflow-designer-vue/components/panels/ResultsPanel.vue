<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWorkflowStore } from '../stores/workflowStore'
import { useUIStore } from '../stores/uiStore'
import { formatTimestamp } from '../utils/helpers'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 当前选中的结果
const selectedResult = ref<any>(null)

// 执行历史
const executionHistory = computed(() => {
  // 这里应该从workflowStore获取执行历史
  // 暂时使用模拟数据
  return [
    {
      id: '1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      nodeId: 'llm-deepseek',
      status: 'completed',
      result: {
        output: '这是一条LLM生成的示例结果内容。',
        model: 'deepseek-v3',
        tokens: 150
      },
      duration: 2.3
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      nodeId: 'algo-chart',
      status: 'completed',
      result: {
        chart: {
          type: 'bar',
          data: [
            { name: 'A', value: 10 },
            { name: 'B', value: 20 },
            { name: 'C', value: 15 }
          ]
        }
      },
      duration: 1.8
    }
  ]
})

// 选择结果
const selectResult = (result: any) => {
  selectedResult.value = result
}

// 清空历史
const clearHistory = () => {
  if (confirm('确定要清空所有执行历史吗？')) {
    // 清空执行历史
    uiStore.showToast('执行历史已清空', 'success')
  }
}

// 导出结果
const exportResult = (result: any) => {
  const data = JSON.stringify(result, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `execution_result_${new Date(result.timestamp).toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  uiStore.showToast('结果已导出', 'success')
}

// 导出所有结果
const exportAllResults = () => {
  const data = JSON.stringify(executionHistory.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `all_execution_results_${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  uiStore.showToast('所有结果已导出', 'success')
}

// 获取状态颜色
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'completed': '#10b981',
    'running': '#f59e0b',
    'error': '#ef4444',
    'pending': '#6b7280'
  }
  return colors[status] || '#6b7280'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    'completed': '已完成',
    'running': '运行中',
    'error': '错误',
    'pending': '等待中'
  }
  return texts[status] || '未知'
}

// 格式化结果内容
const formatResultContent = (result: any) => {
  if (!result.result) return '无结果'
  
  if (typeof result.result === 'string') {
    return result.result
  }
  
  if (result.result.output) {
    return result.result.output
  }
  
  return JSON.stringify(result.result, null, 2)
}
</script>

<template>
  <div class="results-panel">
    <!-- 操作栏 -->
    <div class="actions-section">
      <div class="actions-left">
        <h4>执行结果</h4>
        <span class="result-count">{{ executionHistory.length }} 条记录</span>
      </div>
      <div class="actions-right">
        <button class="action-btn" @click="exportAllResults" :disabled="executionHistory.length === 0">
          📥 导出全部
        </button>
        <button class="action-btn danger" @click="clearHistory" :disabled="executionHistory.length === 0">
          🗑️ 清空
        </button>
      </div>
    </div>

    <!-- 结果列表 -->
    <div class="results-section">
      <div class="results-list">
        <div
          v-for="result in executionHistory"
          :key="result.id"
          class="result-item"
          :class="{ selected: selectedResult?.id === result.id }"
          @click="selectResult(result)"
        >
          <div class="result-header">
            <div class="result-info">
              <div class="result-status" :style="{ color: getStatusColor(result.status) }">
                <span class="status-dot" :style="{ backgroundColor: getStatusColor(result.status) }"></span>
                {{ getStatusText(result.status) }}
              </div>
              <div class="result-time">{{ formatTimestamp(result.timestamp) }}</div>
            </div>
            <div class="result-actions">
              <button class="mini-btn" @click.stop="exportResult(result)">
                📥
              </button>
            </div>
          </div>
          
          <div class="result-content">
            <div class="result-node">{{ result.nodeId?.replace('-', ' ').toUpperCase() || 'Unknown' }}</div>
            <div class="result-preview">
              {{ formatResultContent(result).substring(0, 100) }}{{ formatResultContent(result).length > 100 ? '...' : '' }}
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="executionHistory.length === 0" class="empty-results">
          <div class="empty-icon">📊</div>
          <p>还没有执行记录</p>
          <span class="empty-hint">执行工作流后结果会显示在这里</span>
        </div>
      </div>
    </div>

    <!-- 结果详情 -->
    <div v-if="selectedResult" class="details-section">
      <div class="details-header">
        <h5>结果详情</h5>
        <button class="close-btn" @click="selectedResult = null">✕</button>
      </div>
      
      <div class="details-content">
        <!-- 基本信息 -->
        <div class="detail-group">
          <label>节点ID</label>
          <div>{{ selectedResult.nodeId }}</div>
        </div>
        
        <div class="detail-group">
          <label>执行时间</label>
          <div>{{ formatTimestamp(selectedResult.timestamp) }}</div>
        </div>
        
        <div class="detail-group">
          <label>状态</label>
          <div class="result-status" :style="{ color: getStatusColor(selectedResult.status) }">
            <span class="status-dot" :style="{ backgroundColor: getStatusColor(selectedResult.status) }"></span>
            {{ getStatusText(selectedResult.status) }}
          </div>
        </div>
        
        <div v-if="selectedResult.duration" class="detail-group">
          <label>执行时长</label>
          <div>{{ selectedResult.duration }}s</div>
        </div>
        
        <!-- 结果内容 -->
        <div class="detail-group full-width">
          <label>结果内容</label>
          <div class="result-code">
            <pre>{{ formatResultContent(selectedResult) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--darker, #181825);
  padding: 16px;
  gap: 16px;
  overflow: hidden;
}

.actions-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--surface, #45475a);
}

.actions-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions-left h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin: 0;
}

.result-count {
  font-size: 12px;
  color: var(--text-tertiary, #6c7080);
  background: var(--surface, #45475a);
  padding: 2px 6px;
  border-radius: 4px;
}

.actions-right {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 6px 10px;
  background: var(--surface, #45475a);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--light, #cdd6f4);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: var(--surface-light, #585b70);
  border-color: var(--surface-light, #585b70);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.danger:hover:not(:disabled) {
  background: var(--danger, #ef4444);
  border-color: var(--danger, #ef4444);
  color: white;
}

.results-section {
  flex: 1;
  min-height: 0;
}

.results-list {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: var(--primary, #6366f1);
  background: var(--surface, #45475a);
}

.result-item.selected {
  border-color: var(--primary, #6366f1);
  background: rgba(99, 102, 241, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.result-time {
  font-size: 11px;
  color: var(--text-tertiary, #6c7080);
}

.result-actions {
  display: flex;
  gap: 4px;
}

.mini-btn {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #6c7080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 10px;
}

.mini-btn:hover {
  background: var(--surface, #45475a);
  color: var(--light, #cdd6f4);
}

.result-content {
  margin-left: 10px;
}

.result-node {
  font-size: 11px;
  color: var(--text-secondary, #a0a0a0);
  margin-bottom: 4px;
  font-family: monospace;
}

.result-preview {
  font-size: 12px;
  color: var(--light, #cdd6f4);
  line-height: 1.4;
  word-wrap: break-word;
}

.empty-results {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary, #6c7080);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-results p {
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--text-secondary, #a0a0a0);
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary, #6c7080);
}

.details-section {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  padding: 16px;
  max-height: 300px;
  overflow-y: auto;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--surface, #45475a);
}

.details-header h5 {
  font-size: 14px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin: 0;
}

.close-btn {
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #6c7080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--surface, #45475a);
  color: var(--light, #cdd6f4);
}

.details-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-group.full-width {
  grid-column: 1 / -1;
}

.detail-group label {
  font-size: 11px;
  color: var(--text-tertiary, #6c7080);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-group > div {
  font-size: 12px;
  color: var(--light, #cdd6f4);
  word-wrap: break-word;
}

.result-code {
  background: var(--darker, #181825);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  padding: 8px;
}

.result-code pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: var(--light, #cdd6f4);
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
}

/* 滚动条样式 */
.results-list::-webkit-scrollbar,
.details-section::-webkit-scrollbar,
.result-code::-webkit-scrollbar {
  width: 4px;
}

.results-list::-webkit-scrollbar-track,
.details-section::-webkit-scrollbar-track,
.result-code::-webkit-scrollbar-track {
  background: transparent;
}

.results-list::-webkit-scrollbar-thumb,
.details-section::-webkit-scrollbar-thumb,
.result-code::-webkit-scrollbar-thumb {
  background: var(--surface, #45475a);
  border-radius: 2px;
}

.results-list::-webkit-scrollbar-thumb:hover,
.details-section::-webkit-scrollbar-thumb:hover,
.result-code::-webkit-scrollbar-thumb:hover {
  background: var(--surface-light, #585b70);
}
</style>