<template>
  <div v-if="visible" class="knowledge-inserter-overlay" @click="$emit('close')">
    <div class="knowledge-inserter-container" @click.stop>
      <div class="inserter-header">
        <h3 class="inserter-title">
          📚 插入知识库内容
        </h3>
        <button class="close-button" @click="$emit('close')">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            />
          </svg>
        </button>
      </div>

      <div class="inserter-content">
        <!-- 搜索框 -->
        <div class="search-section">
          <div class="search-input-wrapper">
            <svg
              class="search-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索知识库内容..."
              class="search-input"
              @input="handleSearch"
            >
            <button
              v-if="searchQuery"
              class="clear-button"
              @click="clearSearch"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                />
                <line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                />
              </svg>
            </button>
          </div>

          <!-- 搜索过滤器 -->
          <div class="search-filters">
            <select v-model="selectedCategory" class="filter-select">
              <option value="">
                所有分类
              </option>
              <option v-for="category in categories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>

            <select v-model="sortBy" class="filter-select">
              <option value="relevance">
                相关性
              </option>
              <option value="date">
                时间
              </option>
              <option value="title">
                标题
              </option>
            </select>
          </div>
        </div>

        <!-- 搜索结果 -->
        <div class="results-section">
          <div v-if="searching" class="loading-state">
            <div class="loading-spinner" />
            <span>搜索中...</span>
          </div>

          <div v-else-if="searchResults.length === 0 && searchQuery" class="empty-state">
            <svg
              class="empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p>未找到相关内容</p>
          </div>

          <div v-else class="results-list">
            <div
              v-for="(item, index) in displayResults"
              :key="index"
              class="result-item"
              @click="selectItem(item)"
            >
              <div class="result-header">
                <h4 class="result-title">
                  {{ item.title }}
                </h4>
                <span class="result-category">{{ item.category }}</span>
              </div>
              <p class="result-excerpt">
                {{ item.excerpt }}
              </p>
              <div class="result-meta">
                <span class="result-date">{{ formatDate(item.date) }}</span>
                <span class="result-relevance">相关度: {{ item.relevance }}%</span>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div v-if="totalPages > 1" class="pagination">
            <button
              :disabled="currentPage === 1"
              class="page-button"
              @click="currentPage--"
            >
              上一页
            </button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button
              :disabled="currentPage === totalPages"
              class="page-button"
              @click="currentPage++"
            >
              下一页
            </button>
          </div>
        </div>

        <!-- 预览区域 -->
        <div v-if="selectedItem" class="preview-section">
          <h4 class="preview-title">
            内容预览
          </h4>
          <div class="preview-content" v-html="selectedItem.content" />
          <div class="preview-actions">
            <button class="insert-button" @click="insertContent">
              <svg
                class="button-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              插入到文章
            </button>
            <button class="cancel-button" @click="selectedItem = null">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface KnowledgeItem {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  date: string
  relevance: number
}

const props = defineProps<{
  visible: boolean
  insertPosition?: number
}>()

const emit = defineEmits<{
  close: []
  insert: [content: string, position?: number]
}>()

// 搜索状态
const searchQuery = ref('')
const selectedCategory = ref('')
const sortBy = ref('relevance')
const searching = ref(false)
const searchResults = ref<KnowledgeItem[]>([])
const selectedItem = ref<KnowledgeItem | null>(null)

// 分页
const currentPage = ref(1)
const pageSize = 10

// 模拟数据
const categories = ['技术文档', '产品介绍', '用户指南', '常见问题', '最佳实践']

const mockResults: KnowledgeItem[] = [
  {
    id: '1',
    title: 'Vue 3 组合式API最佳实践',
    excerpt: '介绍Vue 3组合式API的使用方法和最佳实践，包括响应式数据、生命周期钩子等...',
    content: '<h3>Vue 3 组合式API</h3><p>组合式API是Vue 3中引入的新特性，它提供了更灵活的代码组织方式...</p>',
    category: '技术文档',
    date: '2024-01-15',
    relevance: 95
  },
  {
    id: '2',
    title: 'TypeScript类型系统详解',
    excerpt: 'TypeScript的类型系统是其核心特性，本文详细介绍了各种类型定义和使用场景...',
    content: '<h3>TypeScript类型系统</h3><p>TypeScript提供了强大的类型系统，帮助开发者在编译时发现错误...</p>',
    category: '技术文档',
    date: '2024-01-10',
    relevance: 88
  },
  {
    id: '3',
    title: '响应式设计原则',
    excerpt: '现代Web开发中响应式设计的核心原则和实现方法，包括媒体查询、弹性布局等...',
    content: '<h3>响应式设计</h3><p>响应式设计确保网站在不同设备上都能提供良好的用户体验...</p>',
    category: '最佳实践',
    date: '2024-01-08',
    relevance: 82
  }
]

// 计算属性
const displayResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return searchResults.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(searchResults.value.length / pageSize)
})

// 搜索防抖
let searchTimeout: NodeJS.Timeout

const handleSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    performSearch()
  }, 300)
}

const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = mockResults
    return
  }

  searching.value = true

  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 500))

    // 过滤和排序结果
    const results = mockResults.filter((item) => {
      const matchesQuery = item.title.toLowerCase().includes(searchQuery.value.toLowerCase())
        || item.excerpt.toLowerCase().includes(searchQuery.value.toLowerCase())
      const matchesCategory = !selectedCategory.value || item.category === selectedCategory.value
      return matchesQuery && matchesCategory
    })

    // 排序
    if (sortBy.value === 'relevance') {
      results.sort((a, b) => b.relevance - a.relevance)
    } else if (sortBy.value === 'date') {
      results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else if (sortBy.value === 'title') {
      results.sort((a, b) => a.title.localeCompare(b.title))
    }

    searchResults.value = results
    currentPage.value = 1
  } catch (error) {
    console.error('搜索失败:', error)
    useNotification().add({
      title: '搜索失败',
      type: 'error'
    })
  } finally {
    searching.value = false
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  searchResults.value = mockResults
  currentPage.value = 1
}

const selectItem = (item: KnowledgeItem) => {
  selectedItem.value = item
}

const insertContent = () => {
  if (selectedItem.value) {
    emit('insert', selectedItem.value.content, props.insertPosition)
    useNotification().add({
      title: '内容已插入',
      type: 'success'
    })
    emit('close')
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

// 监听搜索条件变化
watch([selectedCategory, sortBy], () => {
  performSearch()
})

// 初始化
onMounted(() => {
  searchResults.value = mockResults
})
</script>

<style scoped>
.knowledge-inserter-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.knowledge-inserter-container {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 56rem;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

.inserter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.inserter-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-button svg {
  width: 1rem;
  height: 1rem;
}

.inserter-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 搜索区域 */
.search-section {
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 0.75rem 0.75rem 0.75rem 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  transition: all 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.clear-button {
  position: absolute;
  right: 0.75rem;
  width: 1rem;
  height: 1rem;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.15s ease;
}

.clear-button:hover {
  color: #6b7280;
}

.clear-button svg {
  width: 1rem;
  height: 1rem;
}

.search-filters {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

/* 结果区域 */
.results-section {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #6b7280;
}

.loading-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #6b7280;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  color: #9ca3af;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.result-item {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.result-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.result-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
  flex: 1;
}

.result-category {
  font-size: 0.75rem;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  margin-left: 0.75rem;
}

.result-excerpt {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.result-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #9ca3af;
}

.result-relevance {
  font-weight: 500;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.page-button {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-button:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.page-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: #6b7280;
}

/* 预览区域 */
.preview-section {
  border-top: 1px solid #e5e7eb;
  padding: 1.5rem;
  background: #f9fafb;
}

.preview-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.preview-content {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  max-height: 12rem;
  overflow-y: auto;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.preview-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.insert-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.insert-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.button-icon {
  width: 1rem;
  height: 1rem;
}

.cancel-button {
  padding: 0.75rem 1rem;
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .knowledge-inserter-container {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }

  .inserter-header {
    padding: 1rem;
  }

  .search-section {
    padding: 1rem;
  }

  .results-section {
    padding: 0.75rem 1rem;
  }

  .preview-section {
    padding: 1rem;
  }

  .search-filters {
    flex-direction: column;
  }

  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .result-category {
    margin-left: 0;
  }

  .preview-actions {
    flex-direction: column;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .knowledge-inserter-container {
    background: #1f2937;
  }

  .inserter-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .inserter-title {
    color: #f9fafb;
  }

  .close-button {
    color: #9ca3af;
  }

  .close-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .search-section {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .search-input,
  .filter-select {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .search-input:focus,
  .filter-select:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .result-item {
    border-color: #374151;
    background: #111827;
  }

  .result-item:hover {
    border-color: #667eea;
  }

  .result-title {
    color: #f9fafb;
  }

  .result-excerpt {
    color: #9ca3af;
  }

  .result-meta {
    color: #6b7280;
  }

  .pagination {
    border-top-color: #374151;
  }

  .page-button {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .page-button:hover:not(:disabled) {
    background: #4b5563;
  }

  .page-info {
    color: #9ca3af;
  }

  .preview-section {
    background: #111827;
    border-top-color: #374151;
  }

  .preview-title {
    color: #f9fafb;
  }

  .preview-content {
    background: #1f2937;
    border-color: #374151;
    color: #d1d5db;
  }

  .cancel-button {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .cancel-button:hover {
    background: #4b5563;
    color: #f3f4f6;
  }
}

/* 动画效果 */
@keyframes modalSlideIn {
  from {
    transform: scale(0.95) translateY(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
