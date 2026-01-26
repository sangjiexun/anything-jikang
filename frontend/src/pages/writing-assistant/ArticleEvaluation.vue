<template>
  <div class="article-evaluation">
    <div class="evaluation-card">
      <div class="card-header">
        <h3 class="card-title">
          📊 文章评估 (SMART原则)
        </h3>
        <button
          v-if="evaluationResult"
          :disabled="evaluating"
          class="refresh-button"
          @click="reEvaluate"
        >
          <svg
            v-if="!evaluating"
            class="button-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <div v-else class="loading-spinner" />
          重新评估
        </button>
      </div>

      <div v-if="!evaluationResult" class="evaluation-empty">
        <p class="empty-text">
          文章生成后将自动进行评估
        </p>
      </div>

      <div v-else class="evaluation-content">
        <!-- 总体评分 -->
        <div class="overall-score">
          <div class="score-circle">
            <div class="score-value">
              {{ overallScore }}
            </div>
            <div class="score-label">
              总分
            </div>
          </div>
          <div class="score-description">
            <p class="description-text">
              {{ overallDescription }}
            </p>
          </div>
        </div>

        <!-- SMART各项评估 -->
        <div class="smart-criteria">
          <div
            v-for="criterion in smartCriteria"
            :key="criterion.key"
            class="criterion-item"
          >
            <div class="criterion-header">
              <div class="criterion-title">
                <span class="criterion-letter">{{ criterion.letter }}</span>
                <span class="criterion-name">{{ criterion.name }}</span>
              </div>
              <div class="criterion-score">
                <span class="score-number">{{ criterion.score }}</span>
                <span class="score-max">/10</span>
              </div>
            </div>

            <!-- 自定义进度条 -->
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="getScoreColorClass(criterion.score)"
                :style="{ width: `${criterion.score * 10}%` }"
              />
            </div>

            <p class="criterion-description">
              {{ criterion.description }}
            </p>
            <div v-if="criterion.suggestions && criterion.suggestions.length > 0" class="criterion-suggestions">
              <p class="suggestions-title">
                改进建议：
              </p>
              <ul class="suggestions-list">
                <li
                  v-for="(suggestion, index) in criterion.suggestions"
                  :key="index"
                  class="suggestion-item"
                >
                  • {{ suggestion }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 详细分析 -->
        <div v-if="evaluationResult.detailedAnalysis" class="detailed-analysis">
          <h4 class="analysis-title">
            详细分析
          </h4>
          <div class="analysis-content">
            {{ evaluationResult.detailedAnalysis }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface SMARTEvaluationResult {
  specific: {
    score: number
    description: string
    suggestions: string[]
  }
  measurable: {
    score: number
    description: string
    suggestions: string[]
  }
  achievable: {
    score: number
    description: string
    suggestions: string[]
  }
  relevant: {
    score: number
    description: string
    suggestions: string[]
  }
  timeBound: {
    score: number
    description: string
    suggestions: string[]
  }
  overallScore: number
  overallDescription: string
  detailedAnalysis?: string
}

const props = defineProps<{
  articleContent?: string
  articleTitle?: string
  articleTheme?: string
}>()

const emit = defineEmits<{
  evaluate: []
}>()

const evaluationResult = ref<SMARTEvaluationResult | null>(null)
const evaluating = ref(false)

// 不再需要直接访问 LLM 配置，使用后端 API 代理

// SMART评估标准
const smartCriteria = computed(() => {
  if (!evaluationResult.value) return []

  return [
    {
      key: 'specific',
      letter: 'S',
      name: '具体性 (Specific)',
      score: evaluationResult.value.specific.score,
      description: evaluationResult.value.specific.description,
      suggestions: evaluationResult.value.specific.suggestions
    },
    {
      key: 'measurable',
      letter: 'M',
      name: '可衡量性 (Measurable)',
      score: evaluationResult.value.measurable.score,
      description: evaluationResult.value.measurable.description,
      suggestions: evaluationResult.value.measurable.suggestions
    },
    {
      key: 'achievable',
      letter: 'A',
      name: '可实现性 (Achievable)',
      score: evaluationResult.value.achievable.score,
      description: evaluationResult.value.achievable.description,
      suggestions: evaluationResult.value.achievable.suggestions
    },
    {
      key: 'relevant',
      letter: 'R',
      name: '相关性 (Relevant)',
      score: evaluationResult.value.relevant.score,
      description: evaluationResult.value.relevant.description,
      suggestions: evaluationResult.value.relevant.suggestions
    },
    {
      key: 'timeBound',
      letter: 'T',
      name: '时效性 (Time-bound)',
      score: evaluationResult.value.timeBound.score,
      description: evaluationResult.value.timeBound.description,
      suggestions: evaluationResult.value.timeBound.suggestions
    }
  ]
})

const overallScore = computed(() => {
  if (!evaluationResult.value) return 0
  return Math.round(evaluationResult.value.overallScore)
})

const overallDescription = computed(() => {
  if (!evaluationResult.value) return ''
  return evaluationResult.value.overallDescription
})

// 评估文章
const evaluateArticle = async () => {
  if (!props.articleContent || props.articleContent.trim() === '') {
    return
  }

  evaluating.value = true
  try {
    // 使用后端 API 代理
    const response = await $fetch<{ success: boolean, data: SMARTEvaluationResult, usage?: { total_tokens: number } }>('/api/writing-assistant/evaluate', {
      method: 'POST',
      body: {
        articleContent: props.articleContent,
        articleTitle: props.articleTitle,
        articleTheme: props.articleTheme
      }
    })

    if (response.success && response.data) {
      // 触发更新用户余额事件
      if (response.usage) {
        window.dispatchEvent(new CustomEvent('token_usage', {
          detail: {
            tokens: response.usage.total_tokens
          }
        }))
      }

      evaluationResult.value = response.data
      useNotification().add({
        title: '评估完成',
        type: 'success'
      })
    } else {
      throw new Error('评估失败')
    }
  } catch (error: any) {
    console.error('评估失败:', error)
    useNotification().add({
      title: '评估失败',
      description: error.message || '评估过程中发生错误',
      type: 'error'
    })
  } finally {
    evaluating.value = false
  }
}

const reEvaluate = () => {
  evaluateArticle()
}

const getScoreColorClass = (score: number): string => {
  if (score >= 8) return 'progress-green'
  if (score >= 6) return 'progress-yellow'
  return 'progress-red'
}

// 监听文章内容变化，自动评估
watch(() => props.articleContent, (newContent) => {
  if (newContent && newContent.trim() !== '') {
    // 延迟评估，避免频繁调用
    setTimeout(() => {
      evaluateArticle()
    }, 1000)
  }
}, { immediate: false })

// 暴露评估方法供外部调用
defineExpose({
  evaluateArticle
})
</script>

<style scoped>
.article-evaluation {
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.evaluation-card {
  background: white;
  border-radius: 1rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.refresh-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.refresh-button:hover:not(:disabled) {
  background: #f3f4f6;
  color: #374151;
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-icon {
  width: 1rem;
  height: 1rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.evaluation-empty {
  padding: 2rem;
  text-align: center;
}

.empty-text {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.evaluation-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
}

.overall-score {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: #f0f9ff;
  border-radius: 0.75rem;
  border: 1px solid #e0f2fe;
}

.score-circle {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.score-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  font-size: 0.75rem;
  opacity: 0.9;
  margin-top: 0.25rem;
}

.score-description {
  flex: 1;
}

.description-text {
  color: #374151;
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
}

.smart-criteria {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.criterion-item {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}

.criterion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.criterion-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.criterion-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: #667eea;
  color: white;
  font-weight: 700;
  font-size: 0.875rem;
}

.criterion-name {
  font-weight: 600;
  color: #111827;
  font-size: 0.875rem;
}

.criterion-score {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.score-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.score-max {
  font-size: 0.875rem;
  color: #6b7280;
}

/* 自定义进度条 */
.progress-bar {
  width: 100%;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.progress-fill {
  height: 100%;
  border-radius: 0.25rem;
  transition: width 0.3s ease;
}

.progress-green {
  background: linear-gradient(90deg, #10b981, #059669);
}

.progress-yellow {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.progress-red {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.criterion-description {
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.criterion-suggestions {
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.suggestions-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.suggestion-item {
  font-size: 0.75rem;
  color: #6b7280;
  line-height: 1.5;
}

.detailed-analysis {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
}

.analysis-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.75rem 0;
}

.analysis-content {
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.8;
  white-space: pre-wrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .overall-score {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .criterion-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .criterion-score {
    align-self: flex-end;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .evaluation-card {
    background: #1f2937;
    border-color: #374151;
  }

  .card-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .card-title {
    color: #f9fafb;
  }

  .refresh-button {
    color: #9ca3af;
  }

  .refresh-button:hover:not(:disabled) {
    background: #374151;
    color: #f3f4f6;
  }

  .empty-text {
    color: #9ca3af;
  }

  .overall-score {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.2);
  }

  .description-text {
    color: #d1d5db;
  }

  .criterion-item {
    background: #111827;
    border-color: #374151;
  }

  .criterion-name {
    color: #f9fafb;
  }

  .score-number {
    color: #f9fafb;
  }

  .score-max {
    color: #9ca3af;
  }

  .progress-bar {
    background: #374151;
  }

  .criterion-description {
    color: #9ca3af;
  }

  .criterion-suggestions {
    border-top-color: #374151;
  }

  .suggestions-title {
    color: #9ca3af;
  }

  .suggestion-item {
    color: #9ca3af;
  }

  .detailed-analysis {
    background: #111827;
    border-color: #374151;
  }

  .analysis-title {
    color: #f9fafb;
  }

  .analysis-content {
    color: #9ca3af;
  }
}

/* 动画效果 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
