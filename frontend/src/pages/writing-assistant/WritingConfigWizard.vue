<template>
  <div class="writing-config-wizard">
    <!-- 步骤指示器 -->
    <div class="wizard-steps-indicator">
      <div class="steps-container">
        <div
          v-for="(step, index) in steps"
          :key="index"
          class="step-indicator"
          :class="{
            active: currentStep === index + 1,
            completed: currentStep > index + 1
          }"
        >
          <div class="step-number">
            <span v-if="currentStep <= index + 1">{{ index + 1 }}</span>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div class="step-label">
            {{ step }}
          </div>
        </div>
      </div>
      <div class="progress-line" :style="{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }" />
    </div>

    <!-- 步骤内容容器 -->
    <div class="wizard-content-wrapper">
      <transition name="fade-slide" mode="out-in">
        <div :key="currentStep" class="step-content-container">
          <!-- 步骤1: 文章基础信息 -->
          <div v-if="currentStep === 1" class="step-content">
            <div class="step-header">
              <h2 class="step-title">
                📄 文章基础信息
              </h2>
              <p class="step-description">
                让我们从基本信息开始，为您的文章奠定基础
              </p>
            </div>

            <div class="step-form">
              <div class="form-group">
                <label class="form-label">文章标题 <span class="required">*</span></label>
                <input
                  v-model="localArticleTitle"
                  type="text"
                  class="form-input"
                  placeholder="输入一个吸引人的文章标题..."
                >
                <p class="form-hint">
                  标题应该简洁有力，能够准确概括文章内容
                </p>
              </div>

              <div class="form-group">
                <label class="form-label">文章主题 <span class="required">*</span></label>
                <textarea
                  v-model="localArticleTheme"
                  class="form-textarea"
                  placeholder="描述您的文章主题和核心内容..."
                  rows="4"
                />
                <p class="form-hint">
                  详细描述文章的主要内容和要点
                </p>
              </div>

              <div class="form-group">
                <label class="form-label">适配场景</label>
                <select v-model="localArticleScenario" class="form-select">
                  <option value="">
                    请选择适配场景
                  </option>
                  <option v-for="scenario in articleScenarios" :key="scenario.value" :value="scenario.value">
                    {{ scenario.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 步骤2: 知识库配置 -->
          <div v-if="currentStep === 2" class="step-content">
            <div class="step-header">
              <h2 class="step-title">
                📚 知识库配置
              </h2>
              <p class="step-description">
                选择或上传知识库，为文章提供支撑材料
              </p>
            </div>

            <div class="step-form">
              <div class="form-group">
                <label class="form-label">知识库类型</label>
                <div class="knowledge-base-grid">
                  <div
                    v-for="kbType in knowledgeBaseTypes"
                    :key="kbType.value"
                    class="kb-type-card"
                    :class="{ selected: selectedKnowledgeBaseType === kbType.value }"
                    @click="selectKnowledgeBaseType(kbType.value)"
                  >
                    <div class="kb-icon">
                      {{ kbType.icon }}
                    </div>
                    <div class="kb-name">
                      {{ kbType.label }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">知识库来源</label>
                <div class="tabs-container">
                  <button
                    v-for="tab in knowledgeTabs"
                    :key="tab.value"
                    class="tab-button"
                    :class="{ active: knowledgeTab === tab.value }"
                    @click="knowledgeTab = tab.value"
                  >
                    {{ tab.label }}
                  </button>
                </div>

                <div v-if="knowledgeTab === 'search'" class="tab-content">
                  <div class="search-box">
                    <input
                      v-model="knowledgeSearchQuery"
                      type="text"
                      class="form-input"
                      placeholder="输入搜索关键词..."
                    >
                    <button
                      :disabled="searching"
                      class="search-button"
                      @click="handleSearchKnowledge"
                    >
                      <svg
                        v-if="!searching"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <div v-else class="spinner-small" />
                    </button>
                  </div>

                  <div v-if="knowledgeSearchResults.length > 0" class="search-results">
                    <div
                      v-for="(result, index) in knowledgeSearchResults"
                      :key="index"
                      class="result-item"
                      @click="selectKnowledgeItem(result)"
                    >
                      <div class="result-icon">
                        📄
                      </div>
                      <div class="result-content">
                        <p class="result-title">
                          {{ result }}
                        </p>
                      </div>
                      <svg
                        class="result-arrow"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div v-else class="tab-content">
                  <div class="upload-area" @click="fileInputRef?.click()">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line
                        x1="12"
                        y1="3"
                        x2="12"
                        y2="15"
                      />
                    </svg>
                    <p class="upload-text">
                      拖拽文件或点击上传
                    </p>
                    <p class="upload-hint">
                      支持 .txt 和 .jsonl 格式，最大 10MB
                    </p>
                  </div>
                  <input
                    ref="fileInputRef"
                    type="file"
                    accept=".txt,.jsonl"
                    class="hidden"
                    @change="handleFileUpload"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- 步骤3: 高级配置 -->
          <div v-if="currentStep === 3" class="step-content">
            <div class="step-header">
              <h2 class="step-title">
                ⚙️ 高级配置
              </h2>
              <p class="step-description">
                配置文本处理和生成参数
              </p>
            </div>

            <div class="step-form">
              <div class="form-group">
                <label class="form-label">提示词工程化</label>
                <textarea
                  v-model="localIthinkPrompt"
                  class="form-textarea"
                  placeholder="使用ithink语言定义全文关键流程..."
                  rows="3"
                />
              </div>

              <div class="form-group">
                <label class="form-label">文本处理选项</label>
                <div class="checkbox-group">
                  <label class="checkbox-item">
                    <input v-model="localUseEmbedding" type="checkbox">
                    <span>使用 Embedding-V1 进行向量化</span>
                  </label>
                  <label class="checkbox-item">
                    <input v-model="localUseReranker" type="checkbox">
                    <span>使用 Qwen3-Reranker-0.6B 进行重排序</span>
                  </label>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">文本分层梳理</label>
                  <select v-model="localLayeringMethod" class="form-select">
                    <option v-for="method in layeringMethods" :key="method.value" :value="method.value">
                      {{ method.label }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">排序策略</label>
                  <select v-model="localSortingStrategy" class="form-select">
                    <option v-for="strategy in sortingStrategies" :key="strategy.value" :value="strategy.value">
                      {{ strategy.label }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">分片大小</label>
                <input
                  v-model.number="localChunkSize"
                  type="number"
                  class="form-input"
                  min="100"
                  max="2000"
                  placeholder="分片大小（字符数）"
                >
              </div>
            </div>
          </div>

          <!-- 步骤4: 图像配置 -->
          <div v-if="currentStep === 4" class="step-content">
            <div class="step-header">
              <h2 class="step-title">
                🖼️ 图像配置
              </h2>
              <p class="step-description">
                选择图像生成模型和参数
              </p>
            </div>

            <div class="step-form">
              <div class="form-group">
                <label class="form-label">图像生成模型</label>
                <select v-model="localImageGenModel" class="form-select">
                  <option v-for="model in imageGenModels" :key="model.value" :value="model.value">
                    {{ model.label }}
                  </option>
                </select>
              </div>

              <div v-if="localImageGenModel === 'kling-image'" class="form-group">
                <label class="form-label">Kling 模型版本</label>
                <select v-model="localKlingSubmodel" class="form-select">
                  <option v-for="submodel in klingSubmodels" :key="submodel.value" :value="submodel.value">
                    {{ submodel.label }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">算法库设计</label>
                <textarea
                  v-model="localAlgorithmDesign"
                  class="form-textarea"
                  placeholder="输入算法设计..."
                  rows="3"
                />
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 底部操作栏 -->
    <div class="wizard-footer">
      <button
        class="btn btn-ghost"
        @click="handleCancel"
      >
        取消
      </button>

      <div class="footer-actions">
        <button
          v-if="currentStep > 1"
          class="btn btn-outline"
          @click="previousStep"
        >
          ← 上一步
        </button>

        <button
          v-if="currentStep < steps.length"
          :disabled="!canProceed"
          class="btn btn-primary"
          @click="nextStep"
        >
          下一步 →
        </button>

        <button
          v-else
          :disabled="!canGenerate || generating"
          class="btn btn-primary btn-success"
          @click="handleGenerate"
        >
          <svg
            v-if="!generating"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <div v-else class="spinner-small" />
          {{ generating ? '生成中...' : '生成文章' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  config,
  searchKnowledge: searchKnowledgeComposable,
  saveIthinkPrompt: saveIthinkPromptComposable,
  saveAlgorithmDesign: saveAlgorithmDesignComposable
} = useWritingAssistant()

// Props
const props = defineProps<{
  ithinkPrompt?: string
  recallBranches?: Array<{ name: string, type: string }>
  knowledgeItems?: string[]
  useEmbedding?: boolean
  useReranker?: boolean
  layeringMethod?: string
  sortingStrategy?: string
  chunkSize?: number
  algorithmDesign?: string
  articleTitle?: string
  articleTheme?: string
  articleScenario?: string
  imageGenModel?: string
  klingSubmodel?: string
}>()

// Emits
const emit = defineEmits<{
  'update:ithinkPrompt': [value: string]
  'update:recallBranches': [value: Array<{ name: string, type: string }>]
  'update:knowledgeItems': [value: string[]]
  'update:useEmbedding': [value: boolean]
  'update:useReranker': [value: boolean]
  'update:layeringMethod': [value: string]
  'update:sortingStrategy': [value: string]
  'update:chunkSize': [value: number]
  'update:algorithmDesign': [value: string]
  'update:articleTitle': [value: string]
  'update:articleTheme': [value: string]
  'update:articleScenario': [value: string]
  'update:imageGenModel': [value: string]
  'update:klingSubmodel': [value: string]
  'generate': []
  'cancel': []
}>()

// 步骤管理
const steps = ['文章信息', '知识库', '高级配置', '图像配置']
const currentStep = ref(1)
const selectedKnowledgeBaseType = ref<string>('general')

// 知识库类型选项
const knowledgeBaseTypes = [
  { value: 'general', label: '通用知识库', icon: '📚' },
  { value: 'technical', label: '技术文档', icon: '<>' },
  { value: 'business', label: '商业知识', icon: '💼' },
  { value: 'education', label: '教育培训', icon: '🎓' },
  { value: 'medical', label: '医疗健康', icon: '❤️' },
  { value: 'legal', label: '法律法规', icon: '⚖️' }
]

// Local state
const localIthinkPrompt = computed({
  get: () => props.ithinkPrompt || '',
  set: val => emit('update:ithinkPrompt', val)
})

const localRecallBranches = computed({
  get: () => props.recallBranches || [{ name: '', type: 'search' }],
  set: val => emit('update:recallBranches', val)
})

const localUseEmbedding = computed({
  get: () => props.useEmbedding ?? true,
  set: val => emit('update:useEmbedding', val)
})

const localUseReranker = computed({
  get: () => props.useReranker ?? true,
  set: val => emit('update:useReranker', val)
})

const localLayeringMethod = computed({
  get: () => props.layeringMethod || 'auto',
  set: val => emit('update:layeringMethod', val)
})

const localSortingStrategy = computed({
  get: () => props.sortingStrategy || 'relevance',
  set: val => emit('update:sortingStrategy', val)
})

const localChunkSize = computed({
  get: () => props.chunkSize || 500,
  set: val => emit('update:chunkSize', val)
})

const localAlgorithmDesign = computed({
  get: () => props.algorithmDesign || '',
  set: val => emit('update:algorithmDesign', val)
})

const localArticleTitle = computed({
  get: () => props.articleTitle || '',
  set: val => emit('update:articleTitle', val)
})

const localArticleTheme = computed({
  get: () => props.articleTheme || '',
  set: val => emit('update:articleTheme', val)
})

const localArticleScenario = computed({
  get: () => props.articleScenario || '',
  set: val => emit('update:articleScenario', val)
})

const localImageGenModel = computed({
  get: () => props.imageGenModel || 'gemini-2.5-flash-image-preview',
  set: val => emit('update:imageGenModel', val)
})

const localKlingSubmodel = computed({
  get: () => props.klingSubmodel || 'kling-v2-1',
  set: val => emit('update:klingSubmodel', val)
})

// Options
const recallBranchTypes = [
  { label: '搜索引擎', value: 'search' },
  { label: '知识库', value: 'knowledge' },
  { label: '算法库', value: 'algorithm' }
]

const knowledgeTabs = [
  { label: '搜索引擎', value: 'search' },
  { label: '文件上传', value: 'upload' }
]

const layeringMethods = [
  { label: '自动分层（AI辅助）', value: 'auto' },
  { label: '使用算法库', value: 'algorithm' },
  { label: '混合模式（算法+AI）', value: 'hybrid' }
]

const sortingStrategies = [
  { label: '相关性排序', value: 'relevance' },
  { label: '重要性排序', value: 'importance' },
  { label: '时间顺序', value: 'chronological' },
  { label: '自定义排序', value: 'custom' }
]

const articleScenarios = [
  { label: '营销文案', value: 'marketing' },
  { label: '电视剧脚本', value: 'tv-script' },
  { label: '小说创作', value: 'novel' },
  { label: '新闻文章', value: 'article' },
  { label: '博客文章', value: 'blog' },
  { label: '技术文档', value: 'technical' },
  { label: '学术论文', value: 'academic' },
  { label: '广告文案', value: 'advertising' },
  { label: '社交媒体', value: 'social-media' },
  { label: '其他', value: 'other' }
]

const imageGenModels = [
  { label: 'Gemini 2.5 Flash Image Preview', value: 'gemini-2.5-flash-image-preview' },
  { label: 'Gemini 2.5 Flash Image', value: 'gemini-2.5-flash-image' },
  { label: 'Kling Image (中国模型)', value: 'kling-image' },
  { label: 'Doubao Seedream 4.0', value: 'doubao-seedream-4-0-250828' }
]

const klingSubmodels = [
  { label: 'Kling v2.1 (最新)', value: 'kling-v2-1' },
  { label: 'Kling v2 New', value: 'kling-v2-new' },
  { label: 'Kling v2', value: 'kling-v2' },
  { label: 'Kling v1.5', value: 'kling-v1-5' },
  { label: 'Kling v1', value: 'kling-v1' }
]

// UI state
const knowledgeTab = ref('search')
const knowledgeSearchQuery = ref('')
const knowledgeSearchResults = ref<string[]>([])
const searching = ref(false)
const generating = ref(false)
const fileInputRef = ref<HTMLInputElement>()

// Computed
const canProceed = computed(() => {
  if (currentStep.value === 1) {
    return localArticleTitle.value.trim() !== '' && localArticleTheme.value.trim() !== ''
  }
  if (currentStep.value === 2) {
    return selectedKnowledgeBaseType.value !== ''
  }
  return true
})

const canGenerate = computed(() => {
  return localArticleTitle.value.trim() !== ''
})

// Methods
const selectKnowledgeBaseType = (type: string) => {
  selectedKnowledgeBaseType.value = type
}

const nextStep = () => {
  if (currentStep.value < steps.length) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const handleCancel = () => {
  emit('cancel')
}

const addRecallBranch = () => {
  localRecallBranches.value = [...localRecallBranches.value, { name: '', type: 'search' }]
}

const removeRecallBranch = (index: number) => {
  localRecallBranches.value = localRecallBranches.value.filter((_, i) => i !== index)
}

const handleSearchKnowledge = async () => {
  if (!knowledgeSearchQuery.value.trim()) {
    useNotification().add({
      title: '请输入搜索关键词',
      type: 'warning'
    })
    return
  }

  searching.value = true
  try {
    const results = await searchKnowledgeComposable(knowledgeSearchQuery.value)
    knowledgeSearchResults.value = results
  } catch (error: any) {
    useNotification().add({
      title: '搜索失败',
      description: error.message,
      type: 'error'
    })
  } finally {
    searching.value = false
  }
}

const selectKnowledgeItem = (item: string) => {
  const currentItems = props.knowledgeItems || []
  emit('update:knowledgeItems', [...currentItems, item])
  useNotification().add({
    title: '已选择知识库项目',
    type: 'success'
  })
}

const handleFileUpload = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 10 * 1024 * 1024) {
    useNotification().add({
      title: '文件大小不能超过 10MB',
      type: 'error'
    })
    return
  }

  const reader = new FileReader()
  reader.onload = async (e) => {
    const content = e.target?.result as string
    useNotification().add({
      title: '文件上传成功',
      type: 'success'
    })
  }

  reader.readAsText(file)
}

const handleGenerate = async () => {
  generating.value = true
  emit('generate')
}
</script>

<style scoped>
.writing-config-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
  overflow: hidden;
}

/* 步骤指示器 */
.wizard-steps-indicator {
  padding: 2rem 1.5rem 1.5rem;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  position: relative;
}

.steps-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 2;
}

.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  position: relative;
}

.step-number {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: #f3f4f6;
  border: 2px solid #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: #6b7280;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.step-indicator.active .step-number {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transform: scale(1.1);
}

.step-indicator.completed .step-number {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.step-indicator.completed .step-number svg {
  width: 1.25rem;
  height: 1.25rem;
}

.step-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-align: center;
  max-width: 4rem;
  transition: color 0.3s ease;
}

.step-indicator.active .step-label {
  color: #667eea;
  font-weight: 600;
}

.step-indicator.completed .step-label {
  color: #10b981;
}

.progress-line {
  position: absolute;
  bottom: 1.25rem;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.5s ease;
  z-index: 1;
}

/* 内容区域 */
.wizard-content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
}

.step-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.step-header {
  text-align: center;
}

.step-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.step-description {
  font-size: 1rem;
  color: #6b7280;
  margin: 0;
}

.step-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: white;
  padding: 2rem;
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

/* 表单元素 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  transition: all 0.2s ease;
  background: white;
  color: #111827;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 6rem;
}

.form-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
}

/* 知识库网格 */
.knowledge-base-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.kb-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 110px;
}

.kb-type-card:hover {
  border-color: #667eea;
  background: #f3f4f6;
  transform: translateY(-2px);
}

.kb-type-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.kb-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.kb-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
  text-align: center;
}

/* 标签页 */
.tabs-container {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1rem;
}

.tab-button {
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  position: relative;
  bottom: -1px;
}

.tab-button:hover {
  color: #111827;
}

.tab-button.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 搜索框 */
.search-box {
  display: flex;
  gap: 0.5rem;
}

.search-button {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: white;
  color: #667eea;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  flex-shrink: 0;
}

.search-button:hover:not(:disabled) {
  border-color: #667eea;
  background: #f9fafb;
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-button svg {
  width: 1rem;
  height: 1rem;
}

/* 搜索结果 */
.search-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 15rem;
  overflow-y: auto;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-item:hover {
  background: #f3f4f6;
  border-color: #667eea;
  transform: translateX(4px);
}

.result-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 0.875rem;
  color: #111827;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-arrow {
  width: 1rem;
  height: 1rem;
  color: #d1d5db;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.result-item:hover .result-arrow {
  color: #667eea;
  transform: translateX(4px);
}

/* 上传区域 */
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.75rem;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-area:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.upload-area svg {
  width: 3rem;
  height: 3rem;
  color: #667eea;
  margin-bottom: 1rem;
}

.upload-text {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.upload-hint {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0 0 0;
}

/* 复选框组 */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #111827;
}

.checkbox-item input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: #667eea;
}

/* 底部操作栏 */
.wizard-footer {
  padding: 1.5rem;
  background: white;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}

.footer-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* 按钮样式 */
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn svg {
  width: 1rem;
  height: 1rem;
}

.btn-ghost {
  background: transparent;
  color: #6b7280;
  border: 1px solid transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: #f3f4f6;
  color: #111827;
}

.btn-outline {
  background: white;
  color: #111827;
  border: 1px solid #d1d5db;
}

.btn-outline:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #667eea;
  color: #667eea;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-success:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
}

/* 加载动画 */
.spinner-small {
  width: 1rem;
  height: 1rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 过渡动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .wizard-steps-indicator {
    padding: 1.5rem 1rem 1rem;
  }

  .step-indicator {
    gap: 0.25rem;
  }

  .step-number {
    width: 2rem;
    height: 2rem;
    font-size: 0.875rem;
  }

  .step-label {
    font-size: 0.65rem;
    max-width: 3rem;
  }

  .wizard-content-wrapper {
    padding: 1.5rem 1rem;
  }

  .step-form {
    padding: 1.5rem;
  }

  .knowledge-base-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .wizard-footer {
    flex-direction: column;
    gap: 1rem;
  }

  .footer-actions {
    width: 100%;
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}

/* 暗色主题 */
@media (prefers-color-scheme: dark) {
  .writing-config-wizard {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  }

  .wizard-steps-indicator {
    background: #111827;
    border-bottom-color: #374151;
  }

  .step-number {
    background: #374151;
    border-color: #4b5563;
    color: #9ca3af;
  }

  .step-label {
    color: #9ca3af;
  }

  .step-form {
    background: #1f2937;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }

  .form-input,
  .form-textarea,
  .form-select {
    background: #111827;
    border-color: #374151;
    color: #f9fafb;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    border-color: #667eea;
  }

  .form-label {
    color: #f9fafb;
  }

  .form-hint {
    color: #6b7280;
  }

  .kb-type-card {
    background: #111827;
    border-color: #374151;
  }

  .kb-type-card:hover {
    background: #1f2937;
  }

  .kb-type-card.selected {
    background: rgba(102, 126, 234, 0.15);
  }

  .kb-name {
    color: #f9fafb;
  }

  .tab-button {
    color: #9ca3af;
  }

  .tab-button:hover {
    color: #f9fafb;
  }

  .search-button {
    background: #111827;
    border-color: #374151;
  }

  .search-button:hover:not(:disabled) {
    background: #1f2937;
  }

  .result-item {
    background: #111827;
    border-color: #374151;
  }

  .result-item:hover {
    background: #1f2937;
  }

  .result-title {
    color: #f9fafb;
  }

  .upload-area {
    background: #111827;
    border-color: #374151;
  }

  .upload-area:hover {
    background: rgba(102, 126, 234, 0.1);
  }

  .upload-text {
    color: #f9fafb;
  }

  .checkbox-item {
    color: #f9fafb;
  }

  .wizard-footer {
    background: #111827;
    border-top-color: #374151;
  }

  .btn-ghost {
    color: #9ca3af;
  }

  .btn-ghost:hover:not(:disabled) {
    background: #374151;
    color: #f9fafb;
  }

  .btn-outline {
    background: #1f2937;
    color: #f9fafb;
    border-color: #374151;
  }

  .btn-outline:hover:not(:disabled) {
    background: #374151;
  }
}
</style>
