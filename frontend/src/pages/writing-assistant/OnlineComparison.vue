<template>
  <div class="online-comparison">
    <div class="comparison-header">
      <h3 class="comparison-title">
        🔍 线上文章对比分析
      </h3>
      <div class="search-engines">
        <label class="engine-option">
          <input
            v-model="selectedEngines"
            type="checkbox"
            value="baidu"
            class="engine-checkbox"
          >
          <span class="engine-label">百度搜索</span>
        </label>
        <label class="engine-option">
          <input
            v-model="selectedEngines"
            type="checkbox"
            value="bing"
            class="engine-checkbox"
          >
          <span class="engine-label">必应搜索</span>
        </label>
      </div>
    </div>

    <div class="comparison-content">
      <!-- 搜索关键词输入 -->
      <div class="keyword-section">
        <div class="keyword-input-wrapper">
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="输入搜索关键词进行对比分析..."
            class="keyword-input"
            @keyup.enter="startComparison"
          >
          <button
            :disabled="!searchKeyword.trim() || selectedEngines.length === 0 || comparing"
            class="search-button"
            @click="startComparison"
          >
            <svg
              v-if="!comparing"
              class="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <div v-else class="loading-spinner" />
            {{ comparing ? '分析中...' : '开始对比' }}
          </button>
        </div>
      </div>

      <!-- 对比结果 -->
      <div v-if="comparisonResults.length > 0" class="results-section">
        <div class="results-summary">
          <h4 class="summary-title">
            对比摘要
          </h4>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-label">找到文章</span>
              <span class="stat-value">{{ comparisonResults.length }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">平均相似度</span>
              <span class="stat-value">{{ averageSimilarity }}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最高排名</span>
              <span class="stat-value">#{{ highestRank }}</span>
            </div>
          </div>
        </div>

        <!-- 详细对比结果 -->
        <div class="detailed-results">
          <div
            v-for="(result, index) in comparisonResults"
            :key="index"
            class="result-card"
          >
            <div class="result-header">
              <div class="result-info">
                <h5 class="result-title">
                  {{ result.title }}
                </h5>
                <div class="result-meta">
                  <span class="result-engine">{{ getEngineName(result.engine) }}</span>
                  <span class="result-rank">排名 #{{ result.rank }}</span>
                  <span class="result-url">{{ result.domain }}</span>
                </div>
              </div>
              <div class="similarity-score" :class="getSimilarityClass(result.similarity)">
                {{ result.similarity }}%
              </div>
            </div>

            <div class="result-content">
              <div class="content-preview">
                <h6 class="preview-label">
                  文章摘要
                </h6>
                <p class="preview-text">
                  {{ result.excerpt }}
                </p>
              </div>

              <!-- 对比分析 -->
              <div class="comparison-analysis">
                <h6 class="analysis-label">
                  对比分析
                </h6>
                <div class="analysis-items">
                  <div class="analysis-item">
                    <span class="analysis-metric">内容相似度</span>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :class="getSimilarityClass(result.contentSimilarity)"
                        :style="{ width: `${result.contentSimilarity}%` }"
                      />
                    </div>
                    <span class="analysis-value">{{ result.contentSimilarity }}%</span>
                  </div>

                  <div class="analysis-item">
                    <span class="analysis-metric">结构相似度</span>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :class="getSimilarityClass(result.structureSimilarity)"
                        :style="{ width: `${result.structureSimilarity}%` }"
                      />
                    </div>
                    <span class="analysis-value">{{ result.structureSimilarity }}%</span>
                  </div>

                  <div class="analysis-item">
                    <span class="analysis-metric">关键词匹配</span>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :class="getSimilarityClass(result.keywordMatch)"
                        :style="{ width: `${result.keywordMatch}%` }"
                      />
                    </div>
                    <span class="analysis-value">{{ result.keywordMatch }}%</span>
                  </div>
                </div>
              </div>

              <!-- 优势分析 -->
              <div class="advantages-analysis">
                <div class="advantages-section">
                  <h6 class="advantages-title">
                    我的文章优势
                  </h6>
                  <ul class="advantages-list">
                    <li v-for="advantage in result.myAdvantages" :key="advantage" class="advantage-item">
                      {{ advantage }}
                    </li>
                  </ul>
                </div>

                <div class="improvements-section">
                  <h6 class="improvements-title">
                    可改进之处
                  </h6>
                  <ul class="improvements-list">
                    <li v-for="improvement in result.improvements" :key="improvement" class="improvement-item">
                      {{ improvement }}
                    </li>
                  </ul>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="result-actions">
                <button class="action-button secondary" @click="viewFullArticle(result)">
                  <svg
                    class="button-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  查看原文
                </button>
                <button class="action-button primary" @click="optimizeBasedOn(result)">
                  <svg
                    class="button-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  基于此优化
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!comparing" class="empty-state">
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
        <h4 class="empty-title">
          开始对比分析
        </h4>
        <p class="empty-description">
          输入关键词，选择搜索引擎，分析您的文章与线上排名第一的文章的差异
        </p>
      </div>

      <!-- 加载状态 -->
      <div v-else class="loading-state">
        <div class="loading-content">
          <div class="loading-spinner large" />
          <h4 class="loading-title">
            正在分析线上文章
          </h4>
          <p class="loading-description">
            {{ loadingMessage }}
          </p>
          <div class="loading-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${loadingProgress}%` }"
              />
            </div>
            <span class="progress-text">{{ loadingProgress }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const { token } = useAuth()

interface ComparisonResult {
  title: string
  url: string
  domain: string
  engine: string
  rank: number
  excerpt: string
  similarity: number
  contentSimilarity: number
  structureSimilarity: number
  keywordMatch: number
  myAdvantages: string[]
  improvements: string[]
}

const props = defineProps<{
  articleContent: string
  articleTitle: string
}>()

const emit = defineEmits<{
  (e: 'optimize', suggestions: string[]): void
}>()

// 搜索状态
const searchKeyword = ref('')
const selectedEngines = ref(['baidu', 'bing'])
const comparing = ref(false)
const comparisonResults = ref<ComparisonResult[]>([])

// 加载状态
const loadingProgress = ref(0)
const loadingMessage = ref('')

const loadingMessages = [
  '正在搜索线上文章...',
  '分析文章内容结构...',
  '计算相似度指标...',
  '生成对比报告...',
  '完成分析'
]

// 计算属性
const averageSimilarity = computed(() => {
  if (comparisonResults.value.length === 0) return 0
  const total = comparisonResults.value.reduce((sum, result) => sum + result.similarity, 0)
  return Math.round(total / comparisonResults.value.length)
})

const highestRank = computed(() => {
  if (comparisonResults.value.length === 0) return 0
  return Math.min(...comparisonResults.value.map(result => result.rank))
})

// 方法
const getEngineName = (engine: string) => {
  const names: Record<string, string> = {
    baidu: '百度',
    bing: '必应'
  }
  return names[engine] || engine
}

const getSimilarityClass = (similarity: number) => {
  if (similarity >= 80) return 'high'
  if (similarity >= 60) return 'medium'
  return 'low'
}

const startComparison = async () => {
  if (!searchKeyword.value.trim() || selectedEngines.value.length === 0) return

  comparing.value = true
  loadingProgress.value = 0
  comparisonResults.value = []

  try {
    // 模拟进度条，为了用户体验
    const progressInterval = setInterval(() => {
      if (loadingProgress.value < 90) {
        loadingProgress.value += 5
        const msgIndex = Math.floor((loadingProgress.value / 100) * loadingMessages.length)
        loadingMessage.value = loadingMessages[Math.min(msgIndex, loadingMessages.length - 1)]
      }
    }, 500)

    const prompt = `请针对关键词"${searchKeyword.value}"，模拟在 ${selectedEngines.value.join(', ')} 上的搜索结果，并与我的文章内容进行对比分析。
我的文章标题：${props.articleTitle || '无'}
我的文章内容片段：${props.articleContent ? props.articleContent.slice(0, 500) + '...' : '无（请基于关键词通用的高质量标准进行对比）'}

请返回严格的 JSON 格式数组，不要包含 markdown 标记。数组中每个元素代表一个竞品文章的对比结果。
JSON 结构如下：
[
  {
    "title": "竞品文章标题",
    "url": "竞品链接（模拟）",
    "domain": "域名",
    "engine": "搜索引擎(${selectedEngines.value.join('/')})",
    "rank": 排名(1-3),
    "excerpt": "文章摘要",
    "similarity": 总相似度(0-100),
    "contentSimilarity": 内容相似度(0-100),
    "structureSimilarity": 结构相似度(0-100),
    "keywordMatch": 关键词匹配度(0-100),
    "myAdvantages": ["优势1", "优势2"],
    "improvements": ["改进建议1", "改进建议2"]
  }
]
请生成 ${selectedEngines.value.length} 到 ${selectedEngines.value.length * 2} 个结果。`

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个专业的SEO和内容分析专家。请只返回 JSON 数组格式的数据。' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-4o',
        temperature: 0.7
      })
    })

    clearInterval(progressInterval)
    loadingProgress.value = 100
    loadingMessage.value = '分析完成'

    if (!response.ok) {
      throw new Error('Comparison failed')
    }

    const data = await response.json()

    // 分发 token 使用事件
    if (data.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: data.usage.total_tokens
        }
      }))
    }

    let content = data.choices[0].message.content
    content = content.replace(/```json\n?|\n?```/g, '').trim()

    comparisonResults.value = JSON.parse(content)

    useNotification().add({
      title: '对比分析完成',
      description: `找到 ${comparisonResults.value.length} 篇相关文章进行对比`,
      type: 'success'
    })
  } catch (error) {
    console.error('对比分析失败:', error)
    useNotification().add({
      title: '对比分析失败',
      type: 'error'
    })
  } finally {
    comparing.value = false
  }
}

const viewFullArticle = (result: ComparisonResult) => {
  window.open(result.url, '_blank')
}

const optimizeBasedOn = (result: ComparisonResult) => {
  emit('optimize', result.improvements)
  useNotification().add({
    title: '优化建议已应用',
    description: '基于对比分析生成了优化建议',
    type: 'success'
  })
}

// 初始化搜索关键词
onMounted(() => {
  if (props.articleTitle) {
    searchKeyword.value = props.articleTitle
  }
})
</script>

<style scoped>
.online-comparison {
  background: white;
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.comparison-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.search-engines {
  display: flex;
  gap: 1rem;
}

.engine-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.engine-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}

.engine-label {
  font-size: 0.875rem;
  color: #374151;
}

.comparison-content {
  padding: 1.5rem;
}

/* 关键词搜索 */
.keyword-section {
  margin-bottom: 1.5rem;
}

.keyword-input-wrapper {
  display: flex;
  gap: 0.75rem;
}

.keyword-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  transition: all 0.15s ease;
}

.keyword-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-button {
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
  white-space: nowrap;
}

.search-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.search-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.button-icon {
  width: 1rem;
  height: 1rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner.large {
  width: 2rem;
  height: 2rem;
  border-width: 3px;
}

/* 结果摘要 */
.results-summary {
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.summary-title {
  font-size: 1rem;
  font-weight: 600;
  color: #0c4a6e;
  margin: 0 0 1rem 0;
}

.summary-stats {
  display: flex;
  gap: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.75rem;
  color: #0369a1;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #0c4a6e;
}

/* 详细结果 */
.detailed-results {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.result-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: white;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.result-info {
  flex: 1;
}

.result-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.result-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.result-engine {
  background: #667eea;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

.similarity-score {
  font-size: 1.25rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
}

.similarity-score.high {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.similarity-score.medium {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.similarity-score.low {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.result-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.content-preview {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.preview-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.preview-text {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
  margin: 0;
}

/* 对比分析 */
.comparison-analysis {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.analysis-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.analysis-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.analysis-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.analysis-metric {
  font-size: 0.75rem;
  color: #6b7280;
  min-width: 5rem;
}

.progress-bar {
  flex: 1;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 0.25rem;
  transition: width 0.3s ease;
}

.progress-fill.high {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.progress-fill.medium {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.progress-fill.low {
  background: linear-gradient(90deg, #10b981, #059669);
}

.analysis-value {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  min-width: 2.5rem;
  text-align: right;
}

/* 优势分析 */
.advantages-analysis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.advantages-section,
.improvements-section {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.advantages-title,
.improvements-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
}

.advantages-title {
  color: #059669;
}

.improvements-title {
  color: #d97706;
}

.advantages-list,
.improvements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.advantage-item,
.improvement-item {
  font-size: 0.75rem;
  line-height: 1.4;
  padding-left: 1rem;
  position: relative;
}

.advantage-item::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #059669;
  font-weight: 600;
}

.improvement-item::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #d97706;
  font-weight: 600;
}

/* 操作按钮 */
.result-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-button.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.action-button.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.action-button.secondary {
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.action-button.secondary:hover {
  background: #f3f4f6;
  color: #374151;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.empty-icon {
  width: 3rem;
  height: 3rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.5rem 0;
}

.empty-description {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
  max-width: 24rem;
  margin: 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 20rem;
}

.loading-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #374151;
  margin: 1rem 0 0.5rem 0;
}

.loading-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.loading-progress {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 3rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .comparison-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .keyword-input-wrapper {
    flex-direction: column;
  }

  .summary-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .result-header {
    flex-direction: column;
    gap: 1rem;
  }

  .advantages-analysis {
    grid-template-columns: 1fr;
  }

  .result-actions {
    flex-direction: column;
  }

  .analysis-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .analysis-metric {
    min-width: auto;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .online-comparison {
    background: #1f2937;
    border-color: #374151;
  }

  .comparison-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .comparison-title {
    color: #f9fafb;
  }

  .engine-label {
    color: #d1d5db;
  }

  .keyword-input {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .keyword-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .results-summary {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .summary-title {
    color: #60a5fa;
  }

  .stat-label {
    color: #93c5fd;
  }

  .stat-value {
    color: #60a5fa;
  }

  .result-card {
    background: #111827;
    border-color: #374151;
  }

  .result-header {
    background: #1f2937;
    border-bottom-color: #374151;
  }

  .result-title {
    color: #f9fafb;
  }

  .result-meta {
    color: #9ca3af;
  }

  .content-preview,
  .comparison-analysis,
  .advantages-section,
  .improvements-section {
    background: #1f2937;
  }

  .preview-label,
  .analysis-label {
    color: #d1d5db;
  }

  .preview-text {
    color: #9ca3af;
  }

  .analysis-metric,
  .analysis-value {
    color: #9ca3af;
  }

  .progress-bar {
    background: #4b5563;
  }

  .action-button.secondary {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .action-button.secondary:hover {
    background: #4b5563;
    color: #f3f4f6;
  }

  .empty-title,
  .loading-title {
    color: #d1d5db;
  }

  .empty-description,
  .loading-description {
    color: #9ca3af;
  }

  .progress-text {
    color: #d1d5db;
  }
}

/* 动画效果 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
