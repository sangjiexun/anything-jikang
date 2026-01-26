<template>
  <div class="space-y-6 font-sans">
    <!-- 快速配置面板 -->
    <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
      <h4 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
        <svg
          class="w-5 h-5 text-indigo-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
        </svg>
        快速配置
      </h4>

      <div class="space-y-5 mt-6">
        <!-- 文章标题 -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">文章标题</label>
          <div class="relative">
            <svg
              class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
              />
              <line
                x1="16"
                y1="17"
                x2="8"
                y2="17"
              />
            </svg>
            <input
              v-model="localArticleTitle"
              type="text"
              placeholder="输入您的文章标题..."
              class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            >
          </div>
        </div>

        <!-- 文章主题 -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">文章主题</label>
          <textarea
            v-model="localArticleTheme"
            rows="3"
            placeholder="描述您想要写作的主题和核心内容..."
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
          />
        </div>

        <!-- 适配场景 -->
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700">适配场景</label>
          <select v-model="localArticleScenario" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors bg-white">
            <option value="">
              选择适配场景
            </option>
            <option v-for="scenario in articleScenarios" :key="scenario.value" :value="scenario.value">
              {{ scenario.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- 生成按钮 -->
      <button
        :disabled="!canGenerate || generating"
        class="flex items-center gap-3 justify-center w-full mt-8 px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleGenerate"
      >
        <svg
          v-if="!generating"
          class="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        {{ generating ? '正在生成...' : '生成文章' }}
      </button>
    </div>

    <!-- 高级配置折叠面板 -->
    <div class="space-y-3">
      <div v-for="(item, index) in accordionItems" :key="index" class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          class="flex items-center justify-between w-full px-5 py-4 text-left transition-colors hover:bg-gray-50"
          @click="toggleAccordion(index)"
        >
          <div class="flex items-center gap-3">
            <svg
              class="w-5 h-5 text-indigo-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path v-if="item.icon === 'i-lucide-code'" d="M16 18l6-6-6-6" />
              <path v-else-if="item.icon === 'i-lucide-git-branch'" d="M6 3v12" />
              <circle
                v-else-if="item.icon === 'i-lucide-git-branch'"
                cx="18"
                cy="6"
                r="3"
              />
              <circle
                v-else-if="item.icon === 'i-lucide-git-branch'"
                cx="6"
                cy="18"
                r="3"
              />
              <path v-else-if="item.icon === 'i-lucide-layers'" d="M2 12h20l-10-7z" />
              <path v-else-if="item.icon === 'i-lucide-layers'" d="M2 17h20l-10-7z" />
              <path v-else-if="item.icon === 'i-lucide-layers'" d="M2 7h20l-10-7z" />
              <rect
                v-else-if="item.icon === 'i-lucide-cpu'"
                x="4"
                y="4"
                width="16"
                height="16"
                rx="2"
              />
              <rect
                v-else-if="item.icon === 'i-lucide-cpu'"
                x="9"
                y="9"
                width="6"
                height="6"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="9"
                y1="1"
                x2="9"
                y2="4"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="15"
                y1="1"
                x2="15"
                y2="4"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="9"
                y1="20"
                x2="9"
                y2="23"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="15"
                y1="20"
                x2="15"
                y2="23"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="20"
                y1="9"
                x2="23"
                y2="9"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="20"
                y1="14"
                x2="23"
                y2="14"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="1"
                y1="9"
                x2="4"
                y2="9"
              />
              <line
                v-else-if="item.icon === 'i-lucide-cpu'"
                x1="1"
                y1="14"
                x2="4"
                y2="14"
              />
              <rect
                v-else-if="item.icon === 'i-lucide-image'"
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                ry="2"
              />
              <circle
                v-else-if="item.icon === 'i-lucide-image'"
                cx="9"
                cy="9"
                r="2"
              />
              <path v-else-if="item.icon === 'i-lucide-image'" d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>

            <span class="accordion-label">{{ item.label }}</span>

            <svg
              class="accordion-chevron"
              :class="{ 'rotate-180': openAccordions.includes(index) }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6,9 12,15 18,9" />
            </svg>
          </div>
        </button>

        <div v-if="openAccordions.includes(index)" class="accordion-content">
          <!-- 提示词工程 -->
          <div v-if="item.slot === 'ithink'">
            <div class="form-group">
              <label class="form-label">ithink语言流程定义</label>
              <textarea
                v-model="localIthinkPrompt"
                rows="6"
                placeholder="使用ithink语言定义全文关键流程..."
                class="form-textarea code-textarea"
              />
            </div>
          </div>

          <!-- 召回分支 -->
          <div v-else-if="item.slot === 'recall'">
            <div class="branch-list">
              <div
                v-for="(branch, branchIndex) in localRecallBranches"
                :key="branchIndex"
                class="branch-item"
              >
                <input
                  v-model="branch.name"
                  type="text"
                  placeholder="分支名称"
                  class="branch-input"
                >
                <select v-model="branch.type" class="branch-select">
                  <option v-for="type in recallBranchTypes" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
                <button
                  class="remove-button"
                  @click="removeRecallBranch(branchIndex)"
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
              <button class="add-branch-button" @click="addRecallBranch">
                <svg
                  class="button-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <line
                    x1="12"
                    y1="5"
                    x2="12"
                    y2="19"
                  />
                  <line
                    x1="5"
                    y1="12"
                    x2="19"
                    y2="12"
                  />
                </svg>
                添加分支
              </button>
            </div>
          </div>

          <!-- 文本处理 -->
          <div v-else-if="item.slot === 'processing'">
            <div class="processing-config">
              <div class="checkbox-group">
                <label class="checkbox-item">
                  <input
                    v-model="localUseEmbedding"
                    type="checkbox"
                    class="checkbox-input"
                  >
                  <span class="checkbox-label">使用 Embedding-V1 进行向量化</span>
                </label>
                <label class="checkbox-item">
                  <input
                    v-model="localUseReranker"
                    type="checkbox"
                    class="checkbox-input"
                  >
                  <span class="checkbox-label">使用 Qwen3-Reranker-0.6B 进行重排序</span>
                </label>
              </div>

              <div class="form-group">
                <label class="form-label">文本分层梳理</label>
                <select v-model="localLayeringMethod" class="form-select">
                  <option v-for="method in layeringMethods" :key="method.value" :value="method.value">
                    {{ method.label }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">文本排序策略</label>
                <select v-model="localSortingStrategy" class="form-select">
                  <option v-for="strategy in sortingStrategies" :key="strategy.value" :value="strategy.value">
                    {{ strategy.label }}
                  </option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">分片大小（字符数）</label>
                <input
                  v-model.number="localChunkSize"
                  type="number"
                  placeholder="500"
                  min="100"
                  max="2000"
                  class="form-input"
                >
              </div>
            </div>
          </div>

          <!-- 算法库 -->
          <div v-else-if="item.slot === 'algorithm'">
            <div class="form-group">
              <label class="form-label">算法设计</label>
              <textarea
                v-model="localAlgorithmDesign"
                rows="4"
                placeholder="输入算法设计..."
                class="form-textarea code-textarea"
              />
            </div>
          </div>

          <!-- 配图模型 -->
          <div v-else-if="item.slot === 'image'">
            <div class="image-config">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import WritingConfigWizard from './WritingConfigWizard.vue'

const {
  config,
  apiConfig,
  saveIthinkPrompt: saveIthinkPromptComposable,
  saveAlgorithmDesign: saveAlgorithmDesignComposable,
  saveImageGenModelConfig,
  loadConfig,
  searchKnowledge: searchKnowledgeComposable,
  generateArticle: generateArticleComposable
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
}>()

// Local state
const localIthinkPrompt = computed({
  get: () => props.ithinkPrompt || '',
  set: val => emit('update:ithinkPrompt', val)
})

const localRecallBranches = computed({
  get: () => props.recallBranches || [{ name: '', type: 'search' }],
  set: val => emit('update:recallBranches', val)
})

const localKnowledgeItems = computed({
  get: () => props.knowledgeItems || [],
  set: val => emit('update:knowledgeItems', val)
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

// UI 状态
const generating = ref(false)
const openAccordions = ref<number[]>([])

// 切换折叠面板
const toggleAccordion = (index: number) => {
  const currentIndex = openAccordions.value.indexOf(index)
  if (currentIndex > -1) {
    openAccordions.value.splice(currentIndex, 1)
  } else {
    openAccordions.value.push(index)
  }
}

// 配置选项
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

const recallBranchTypes = [
  { label: '搜索引擎', value: 'search' },
  { label: '知识库', value: 'knowledge' },
  { label: '算法库', value: 'algorithm' }
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

// 折叠面板配置
const accordionItems = [
  {
    label: '提示词工程',
    icon: 'i-lucide-code',
    slot: 'ithink',
    defaultOpen: false
  },
  {
    label: '多路召回分支',
    icon: 'i-lucide-git-branch',
    slot: 'recall',
    defaultOpen: false
  },
  {
    label: '文本处理与分层',
    icon: 'i-lucide-layers',
    slot: 'processing',
    defaultOpen: false
  },
  {
    label: '算法库配置',
    icon: 'i-lucide-cpu',
    slot: 'algorithm',
    defaultOpen: false
  },
  {
    label: '配图模型',
    icon: 'i-lucide-image',
    slot: 'image',
    defaultOpen: false
  }
]

// 计算属性
const canGenerate = computed(() => {
  return localArticleTitle.value.trim() !== ''
})

// 方法
const handleGenerate = async () => {
  generating.value = true
  try {
    emit('generate')
  } finally {
    generating.value = false
  }
}

const addRecallBranch = () => {
  localRecallBranches.value = [...localRecallBranches.value, { name: '', type: 'search' }]
}

const removeRecallBranch = (index: number) => {
  localRecallBranches.value = localRecallBranches.value.filter((_, i) => i !== index)
}

// Load config on mount
onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.workspace-sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 快速配置面板 */
.quick-config-panel {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1.25rem;
}

.title-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #667eea;
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

/* 表单样式 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
  z-index: 1;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  padding-left: 2.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  transition: all 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  resize: vertical;
  transition: all 0.15s ease;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.code-textarea {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.8rem;
}

.form-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
  cursor: pointer;
  transition: all 0.15s ease;
}

.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* 生成按钮 */
.generate-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.generate-button:disabled {
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

/* 高级配置面板 */
.advanced-config {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.accordion-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.accordion-trigger {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem;
  border: none;
  background: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.accordion-trigger:hover {
  background: #f9fafb;
}

.accordion-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #667eea;
  flex-shrink: 0;
}

.accordion-label {
  flex: 1;
  text-align: left;
}

.accordion-chevron {
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.accordion-chevron.rotate-180 {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 1rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
  animation: slideDown 0.2s ease-out;
}

/* 分支管理 */
.branch-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.branch-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.branch-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
}

.branch-input:focus {
  outline: none;
  border-color: #667eea;
}

.branch-select {
  width: 8rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  background: white;
  color: #111827;
}

.branch-select:focus {
  outline: none;
  border-color: #667eea;
}

.remove-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.remove-button:hover {
  background: #fecaca;
}

.remove-button svg {
  width: 1rem;
  height: 1rem;
}

.add-branch-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  border: 1px dashed #d1d5db;
  background: white;
  color: #667eea;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-branch-button:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

/* 复选框组 */
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}

.checkbox-label {
  font-size: 0.875rem;
  color: #374151;
}

/* 配置区域 */
.processing-config,
.image-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .workspace-sidebar-content {
    gap: 1rem;
  }

  .quick-config-panel {
    padding: 1rem;
  }

  .panel-title {
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .config-grid {
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .generate-button {
    padding: 0.75rem 1rem;
  }

  .branch-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .branch-select {
    width: 100%;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .quick-config-panel,
  .accordion-item {
    background: #1f2937;
    border-color: #374151;
  }

  .panel-title {
    color: #f9fafb;
  }

  .form-label {
    color: #d1d5db;
  }

  .form-input,
  .form-textarea,
  .form-select {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .accordion-trigger {
    background: #1f2937;
    color: #d1d5db;
  }

  .accordion-trigger:hover {
    background: #374151;
  }

  .accordion-content {
    background: #111827;
    border-top-color: #374151;
  }

  .branch-item {
    background: #1f2937;
    border-color: #374151;
  }

  .branch-input,
  .branch-select {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .add-branch-button {
    background: #1f2937;
    border-color: #4b5563;
    color: #667eea;
  }

  .add-branch-button:hover {
    background: #374151;
    border-color: #667eea;
  }

  .checkbox-label {
    color: #d1d5db;
  }

  .remove-button {
    background: rgba(220, 38, 38, 0.2);
    color: #f87171;
  }

  .remove-button:hover {
    background: rgba(220, 38, 38, 0.3);
  }
}

/* 动画效果 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 自定义滚动条 */
.advanced-config::-webkit-scrollbar {
  width: 6px;
}

.advanced-config::-webkit-scrollbar-track {
  background: transparent;
}

.advanced-config::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

.advanced-config::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

@media (prefers-color-scheme: dark) {
  .advanced-config::-webkit-scrollbar-thumb {
    background: #4b5563;
  }

  .advanced-config::-webkit-scrollbar-thumb:hover {
    background: #6b7280;
  }
}
</style>
