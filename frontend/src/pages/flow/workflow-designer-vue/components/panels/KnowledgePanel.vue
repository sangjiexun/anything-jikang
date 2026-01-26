<script setup lang="ts">
import { ref, computed } from 'vue'
import { useWorkflowStore } from '../stores/workflowStore'
import { useUIStore } from '../stores/uiStore'
import { formatFileSize } from '../utils/helpers'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 文件上传状态
const isUploading = ref(false)
const uploadProgress = ref(0)

// 处理文件上传
const handleFileUpload = async (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return

  isUploading.value = true
  uploadProgress.value = 0

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      // 模拟文件处理进度
      const simulateProgress = () => {
        const interval = setInterval(() => {
          uploadProgress.value += 10
          if (uploadProgress.value >= 100) {
            clearInterval(interval)
            
            // 处理文件内容
            const reader = new FileReader()
            reader.onload = (e) => {
              const content = e.target?.result as string
              
              // 分块处理
              const chunks = chunkText(content, 500, 50)
              
              // 添加到知识库
              const document = {
                id: `doc_${Date.now()}_${i}`,
                name: file.name,
                size: file.size,
                content: content,
                chunks: chunks,
                uploadTime: new Date().toISOString()
              }
              
              workflowStore.state.knowledgeBase.push(document)
              workflowStore.saveToLocalStorage()
            }
            reader.readAsText(file)
          }
        }, 100)
      }
      
      simulateProgress()
      
    } catch (error) {
      console.error('文件处理失败:', error)
      uiStore.showToast(`处理文件 ${file.name} 失败`, 'error')
    }
  }

  setTimeout(() => {
    isUploading.value = false
    uploadProgress.value = 0
    uiStore.showToast('文件上传完成', 'success')
  }, 2000)
}

// 文本分块
const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.substring(start, end))
    start += chunkSize - overlap
  }

  return chunks
}

// 删除文档
const deleteDocument = (docId: string) => {
  if (confirm('确定要删除这个文档吗？')) {
    const index = workflowStore.state.knowledgeBase.findIndex(doc => doc.id === docId)
    if (index !== -1) {
      workflowStore.state.knowledgeBase.splice(index, 1)
      workflowStore.saveToLocalStorage()
      uiStore.showToast('文档已删除', 'success')
    }
  }
}

// 清空知识库
const clearKnowledgeBase = () => {
  if (confirm('确定要清空整个知识库吗？此操作无法撤销。')) {
    workflowStore.state.knowledgeBase = []
    workflowStore.saveToLocalStorage()
    uiStore.showToast('知识库已清空', 'success')
  }
}

// 计算统计信息
const stats = computed(() => {
  const totalDocs = workflowStore.state.knowledgeBase.length
  const totalSize = workflowStore.state.knowledgeBase.reduce((sum, doc) => sum + doc.size, 0)
  const totalChunks = workflowStore.state.knowledgeBase.reduce((sum, doc) => sum + doc.chunks.length, 0)
  
  return {
    totalDocs,
    totalSize,
    totalChunks
  }
})
</script>

<template>
  <div class="knowledge-panel">
    <!-- 统计信息 -->
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalDocs }}</div>
          <div class="stat-label">文档数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ formatFileSize(stats.totalSize) }}</div>
          <div class="stat-label">总大小</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ stats.totalChunks }}</div>
          <div class="stat-label">分块数</div>
        </div>
      </div>
    </div>

    <!-- 文件上传 -->
    <div class="upload-section">
      <div class="upload-area" :class="{ uploading: isUploading }">
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx"
          @change="handleFileUpload"
          :disabled="isUploading"
        />
        <label for="file-upload" class="upload-label">
          <div class="upload-icon">📚</div>
          <div class="upload-text">
            <div v-if="!isUploading">
              <strong>点击上传文档</strong>
              <span>支持 TXT, MD, PDF, DOC 格式</span>
            </div>
            <div v-else class="uploading-text">
              <strong>处理中... {{ uploadProgress }}%</strong>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- 文档列表 -->
    <div class="documents-section">
      <div class="section-header">
        <h4>文档列表</h4>
        <button class="clear-btn" @click="clearKnowledgeBase" :disabled="stats.totalDocs === 0">
          🗑️ 清空
        </button>
      </div>
      
      <div class="documents-list">
        <div
          v-for="doc in workflowStore.state.knowledgeBase"
          :key="doc.id"
          class="document-item"
        >
          <div class="document-info">
            <div class="document-icon">📄</div>
            <div class="document-details">
              <div class="document-name">{{ doc.name }}</div>
              <div class="document-meta">
                <span>{{ formatFileSize(doc.size) }}</span>
                <span>{{ doc.chunks.length }} 个分块</span>
                <span>{{ new Date(doc.uploadTime).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
          
          <button class="delete-btn" @click="deleteDocument(doc.id)">
            🗑️
          </button>
        </div>
        
        <!-- 空状态 -->
        <div v-if="stats.totalDocs === 0" class="empty-documents">
          <div class="empty-icon">📭</div>
          <p>还没有上传任何文档</p>
          <span class="empty-hint">点击上方区域开始上传</span>
        </div>
      </div>
    </div>

    <!-- 搜索功能 -->
    <div class="search-section">
      <h4>搜索文档</h4>
      <div class="search-container">
        <input
          type="text"
          class="search-input"
          placeholder="搜索文档内容..."
        />
        <button class="search-btn">🔍</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.knowledge-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--darker, #181825);
  padding: 16px;
  gap: 16px;
  overflow-y: auto;
}

.stats-section {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  padding: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  line-height: 1.2;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary, #6c7080);
  margin-top: 2px;
}

.upload-section {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  padding: 12px;
}

#file-upload {
  display: none;
}

.upload-label {
  display: block;
  cursor: pointer;
}

.upload-area {
  border: 2px dashed var(--surface, #45475a);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.2s;
}

.upload-area:hover {
  border-color: var(--primary, #6366f1);
  background: var(--surface, #45475a);
}

.upload-area.uploading {
  border-color: var(--success, #10b981);
  background: rgba(16, 185, 129, 0.05);
}

.upload-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.upload-text strong {
  display: block;
  font-size: 14px;
  color: var(--light, #cdd6f4);
  margin-bottom: 4px;
}

.upload-text span {
  font-size: 12px;
  color: var(--text-tertiary, #6c7080);
}

.uploading-text {
  color: var(--success, #10b981);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--surface, #45475a);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--success, #10b981);
  border-radius: 2px;
  transition: width 0.2s;
}

.documents-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin: 0;
}

.clear-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--text-tertiary, #6c7080);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  border-color: var(--danger, #ef4444);
  color: var(--danger, #ef4444);
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.documents-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 6px;
  transition: all 0.2s;
}

.document-item:hover {
  border-color: var(--surface-light, #585b70);
}

.document-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.document-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.document-details {
  flex: 1;
  min-width: 0;
}

.document-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--light, #cdd6f4);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-meta {
  font-size: 11px;
  color: var(--text-tertiary, #6c7080);
  display: flex;
  gap: 8px;
}

.delete-btn {
  padding: 6px;
  background: transparent;
  border: none;
  color: var(--text-tertiary, #6c7080);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: var(--danger, #ef4444);
  color: white;
}

.empty-documents {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary, #6c7080);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-documents p {
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--text-secondary, #a0a0a0);
}

.empty-hint {
  font-size: 12px;
  color: var(--text-tertiary, #6c7080);
}

.search-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--light, #cdd6f4);
  margin-bottom: 8px;
}

.search-container {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 6px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: var(--primary, #6366f1);
}

.search-btn {
  padding: 8px 12px;
  background: var(--primary, #6366f1);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover {
  background: #5558e3;
}

/* 滚动条样式 */
.knowledge-panel::-webkit-scrollbar,
.documents-list::-webkit-scrollbar {
  width: 4px;
}

.knowledge-panel::-webkit-scrollbar-track,
.documents-list::-webkit-scrollbar-track {
  background: transparent;
}

.knowledge-panel::-webkit-scrollbar-thumb,
.documents-list::-webkit-scrollbar-thumb {
  background: var(--surface, #45475a);
  border-radius: 2px;
}
</style>