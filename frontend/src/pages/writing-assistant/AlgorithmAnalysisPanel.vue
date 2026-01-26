<template>
  <div class="algorithm-analysis-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <svg
          class="panel-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        算法分析
      </h3>
      <button class="close-btn" @click="$emit('close')">
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

    <div class="panel-content">
      <!-- 分析状态 -->
      <div v-if="analyzing" class="analyzing-state">
        <div class="loading-spinner" />
        <p class="analyzing-text">
          正在分析文章内容...
        </p>
      </div>

      <!-- 分析结果 -->
      <div v-else-if="analysisResult" class="analysis-result">
        <!-- 算法需求分析 -->
        <div class="analysis-section">
          <h4 class="section-title">
            算法需求分析
          </h4>
          <div class="analysis-text">
            {{ analysisResult.algorithmNeeds || '暂无分析结果' }}
          </div>
        </div>

        <!-- 推荐算法 -->
        <div v-if="recommendedAlgorithms.length > 0" class="analysis-section">
          <h4 class="section-title">
            推荐算法
          </h4>
          <div class="algorithms-list">
            <div
              v-for="alg in recommendedAlgorithms"
              :key="alg.id"
              class="algorithm-item"
              @click="selectAlgorithm(alg)"
            >
              <div class="algorithm-header">
                <span class="algorithm-name">{{ alg.name }}</span>
                <span v-if="alg.category" class="algorithm-category">{{ alg.category }}</span>
              </div>
              <p v-if="alg.description" class="algorithm-description">
                {{ alg.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- 推荐理由 -->
        <div v-if="recommendationReasoning" class="analysis-section">
          <h4 class="section-title">
            推荐理由
          </h4>
          <div class="analysis-text">
            {{ recommendationReasoning }}
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <p class="empty-text">
          暂无算法分析结果
        </p>
        <button class="analyze-btn" :disabled="!articleContent" @click="analyzeContent">
          开始分析
        </button>
      </div>
    </div>

    <!-- 保存提示 -->
    <div v-if="showSavePrompt" class="save-prompt">
      <div class="save-prompt-content">
        <p class="save-prompt-text">
          是否保存算法分析结果？
        </p>
        <div class="save-prompt-actions">
          <button class="save-btn primary" @click="saveAnalysis">
            保存
          </button>
          <button class="save-btn secondary" @click="dismissSavePrompt">
            稍后
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'

const props = defineProps<{
  articleContent?: string
  articleTitle?: string
}>()

const emit = defineEmits<{
  'close': []
  'algorithm-selected': [algorithm: any]
  'save-analysis': [analysis: any]
}>()

const api = useApi()
const analyzing = ref(false)
const analysisResult = ref<any>(null)
const recommendedAlgorithms = ref<any[]>([])
const recommendationReasoning = ref('')
const showSavePrompt = ref(false)

// 监听文章内容变化，自动分析
watch(() => props.articleContent, (newContent) => {
  if (newContent && newContent.length > 100) {
    // 延迟分析，避免频繁请求
    setTimeout(() => {
      analyzeContent()
    }, 2000)
  }
}, { immediate: false })

// 分析文章内容
async function analyzeContent() {
  if (!props.articleContent || props.articleContent.length < 50) {
    return
  }

  analyzing.value = true
  try {
    // 提取文章关键信息用于算法推荐
    const analysisText = props.articleTitle
      ? `${props.articleTitle}\n\n${props.articleContent.substring(0, 1000)}`
      : props.articleContent.substring(0, 1000)

    // 调用算法推荐API
    const response = await api.post('/algorithms/recommend', {
      question: analysisText
    })

    if (response.success && response.data) {
      recommendedAlgorithms.value = response.data.recommendedAlgorithms || []
      recommendationReasoning.value = response.data.reasoning || ''

      // 生成算法需求分析
      analysisResult.value = {
        algorithmNeeds: generateAlgorithmNeeds(props.articleContent || ''),
        recommendedAlgorithms: recommendedAlgorithms.value,
        reasoning: recommendationReasoning.value
      }

      // 显示保存提示
      showSavePrompt.value = true
    }
  } catch (error: any) {
    console.error('算法分析失败:', error)
  } finally {
    analyzing.value = false
  }
}

// 生成算法需求分析文本
function generateAlgorithmNeeds(content: string): string {
  // 简单的关键词分析
  const keywords = {
    预测: '预测分析算法',
    分类: '分类算法',
    聚类: '聚类算法',
    推荐: '推荐算法',
    关联: '关联规则分析',
    回归: '回归分析',
    优化: '优化算法'
  }

  const foundKeywords: string[] = []
  for (const [key, value] of Object.entries(keywords)) {
    if (content.includes(key)) {
      foundKeywords.push(value)
    }
  }

  if (foundKeywords.length > 0) {
    return `文章内容涉及：${foundKeywords.join('、')}。建议使用相关算法进行深入分析。`
  }

  return '文章内容分析完成，已为您推荐相关算法。'
}

// 选择算法
function selectAlgorithm(algorithm: any) {
  emit('algorithm-selected', algorithm)
}

// 保存分析结果
function saveAnalysis() {
  if (analysisResult.value) {
    emit('save-analysis', analysisResult.value)
    showSavePrompt.value = false
  }
}

// 关闭保存提示
function dismissSavePrompt() {
  showSavePrompt.value = false
}
</script>

<style scoped>
.algorithm-analysis-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-left: 1px solid #e5e7eb;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.panel-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #667eea;
}

.close-btn {
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

.close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-btn svg {
  width: 1rem;
  height: 1rem;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.analyzing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.analyzing-text {
  color: #6b7280;
  font-size: 0.875rem;
}

.analysis-result {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.analysis-section {
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.analysis-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.75rem;
}

.analysis-text {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.6;
}

.algorithms-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.algorithm-item {
  padding: 0.75rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.algorithm-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.algorithm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.algorithm-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}

.algorithm-category {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 0.25rem;
}

.algorithm-description {
  font-size: 0.8125rem;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.empty-text {
  color: #9ca3af;
  font-size: 0.875rem;
}

.analyze-btn {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.analyze-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-prompt {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem 1.5rem;
  background: #fff7ed;
  border-top: 1px solid #fed7aa;
}

.save-prompt-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.save-prompt-text {
  font-size: 0.875rem;
  color: #9a3412;
  margin: 0;
}

.save-prompt-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-btn.primary {
  background: #f59e0b;
  color: white;
}

.save-btn.primary:hover {
  background: #d97706;
}

.save-btn.secondary {
  background: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.save-btn.secondary:hover {
  background: #f9fafb;
}
</style>
