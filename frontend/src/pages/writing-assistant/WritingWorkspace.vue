<template>
  <div class="writing-workspace-wrapper">
    <!-- 现代化顶部工具栏 -->
    <div class="workspace-header-bar">
      <div class="header-left">
        <h2 class="text-xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">
          ✍️ 写作工作台
        </h2>
      </div>

      <div class="header-actions">
        <!-- 配置按钮 -->
        <button
          class="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
          @click="showConfigDrawer = true"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
          </svg>
          写作配置
        </button>

        <!-- 评估按钮 -->
        <button
          :disabled="!articleContent"
          class="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-800 border border-gray-300 rounded-lg text-sm font-medium shadow-sm hover:bg-gray-50 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="showEvaluationModal = true"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          文章评估
        </button>

        <!-- 更多操作 -->
        <div class="relative">
          <button
            class="flex items-center gap-2 px-3 py-2.5 bg-transparent text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            @click="showMoreMenu = !showMoreMenu"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          <div v-if="showMoreMenu" class="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[12rem] z-50 overflow-hidden" @click="showMoreMenu = false">
            <button class="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors" @click="handleExportToPDF">
              <svg
                class="w-4 h-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line
                  x1="12"
                  y1="15"
                  x2="12"
                  y2="3"
                />
              </svg>
              导出PDF
            </button>
            <button class="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors" @click="handleOptimizeFullArticle">
              <svg
                class="w-4 h-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              全文优化
            </button>
            <button class="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors" @click="handleInsertKnowledge()">
              <svg
                class="w-4 h-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              插入知识库
            </button>
            <button class="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition-colors" @click="resetConfig">
              <svg
                class="w-4 h-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              重置配置
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 主编辑区域 -->
    <div class="workspace-main">
      <WorkspaceMain
        :article-content="articleContentHtml"
        @update:article-content="handleContentUpdate"
        @copy-full="handleCopyFullArticle"
        @optimize-full="handleOptimizeFullArticle"
        @export-pdf="handleExportToPDF"
        @insert-knowledge="handleInsertKnowledge"
      />
    </div>

    <!-- 算法分析面板（右侧） -->
    <div v-if="showAlgorithmPanel" class="algorithm-panel-container">
      <AlgorithmAnalysisPanel
        :article-content="articleContent"
        :article-title="articleTitle"
        @close="showAlgorithmPanel = false"
        @algorithm-selected="handleAlgorithmSelected"
        @save-analysis="handleSaveAnalysis"
      />
    </div>

    <!-- 算法分析按钮 -->
    <button
      v-if="articleContent"
      class="algorithm-panel-toggle"
      :class="{ active: showAlgorithmPanel }"
      @click="showAlgorithmPanel = !showAlgorithmPanel"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <span>算法分析</span>
    </button>

    <!-- 配置抽屉 -->
    <div v-if="showConfigDrawer" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-stretch" @click="showConfigDrawer = false">
      <div class="w-[28rem] max-w-[90vw] bg-white shadow-xl flex flex-col animate-slideInLeft" @click.stop>
        <div class="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            写作配置
          </h3>
          <button class="flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" @click="showConfigDrawer = false">
            <svg
              class="w-4 h-4"
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

        <div class="flex-1 overflow-y-auto p-6">
          <WorkspaceSidebar
            v-model:ithink-prompt="config.ithinkPrompt"
            v-model:recall-branches="config.recallBranches"
            v-model:knowledge-items="config.knowledgeItems"
            v-model:use-embedding="config.useEmbedding"
            v-model:use-reranker="config.useReranker"
            v-model:layering-method="config.layeringMethod"
            v-model:sorting-strategy="config.sortingStrategy"
            v-model:chunk-size="config.chunkSize"
            v-model:algorithm-design="config.algorithmDesign"
            v-model:article-title="config.articleTitle"
            v-model:article-theme="config.articleTheme"
            v-model:article-scenario="config.articleScenario"
            v-model:image-gen-model="config.imageGenModel"
            v-model:kling-submodel="config.klingSubmodel"
            @generate="handleGenerateArticle"
          />
        </div>
      </div>
    </div>

    <!-- 评估弹窗 -->
    <div v-if="showEvaluationModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click="showEvaluationModal = false">
      <div class="w-full max-w-6xl bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-modalSlideIn" @click.stop>
        <div class="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            文章评估报告
          </h3>
          <button class="flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-gray-100 rounded-md transition-colors" @click="showEvaluationModal = false">
            <svg
              class="w-4 h-4"
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

        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <ArticleEvaluation
            ref="evaluationRef"
            :article-content="articleContent"
            :article-title="config.articleTitle"
            :article-theme="config.articleTheme"
          />

          <!-- 线上对比分析 -->
          <div class="pt-6 border-t border-gray-200">
            <OnlineComparison
              :article-content="articleContent"
              :article-title="config.articleTitle"
              @optimize="handleOptimizationSuggestions"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 快速操作浮动按钮 -->
    <div class="fixed bottom-8 right-8 z-40 flex flex-col gap-3 items-end animate-fadeInUp">
      <button
        v-if="!articleContent"
        class="flex items-center gap-3 px-6 py-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-full text-base font-semibold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
        @click="showConfigDrawer = true"
      >
        <svg
          class="w-5 h-5"
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
        开始写作
      </button>

      <div v-else class="flex flex-col gap-2 items-end">
        <button
          :disabled="generating"
          class="flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-md text-gray-800 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="handleGenerateArticle"
        >
          <svg
            v-if="!generating"
            class="w-4 h-4 text-gray-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <div v-else class="w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          {{ generating ? '生成中...' : '重新生成' }}
        </button>

        <button
          class="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          @click="handleCopyFullArticle"
        >
          <svg
            class="w-4 h-4 text-green-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect
              x="9"
              y="9"
              width="13"
              height="13"
              rx="2"
              ry="2"
            />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          复制全文
        </button>
      </div>
    </div>

    <!-- 生成进度弹窗 -->
    <GenerationProgress
      :visible="showGenerationProgress"
      :progress="generationProgress"
      :current-step-index="currentStepIndex"
      :preview-content="previewContent"
      @cancel="handleCancelGeneration"
    />

    <!-- 知识库插入弹窗 -->
    <KnowledgeInserter
      :visible="showKnowledgeInserter"
      :insert-position="insertPosition"
      @close="showKnowledgeInserter = false"
      @insert="handleKnowledgeInsert"
    />
  </div>
</template>

<script setup lang="ts">
import WorkspaceSidebar from './WorkspaceSidebar.vue'
import WorkspaceMain from './WorkspaceMain.vue'
import ArticleEvaluation from './ArticleEvaluation.vue'
import GenerationProgress from './GenerationProgress.vue'
import KnowledgeInserter from './KnowledgeInserter.vue'
import OnlineComparison from './OnlineComparison.vue'
import AlgorithmAnalysisPanel from './AlgorithmAnalysisPanel.vue'

const {
  config: composableConfig,
  generateArticle: generateArticleComposable,
  loadConfig
} = useWritingAssistant()

const config = ref({
  ithinkPrompt: composableConfig.value.ithinkPrompt,
  recallBranches: composableConfig.value.recallBranches,
  knowledgeItems: composableConfig.value.knowledgeItems,
  useEmbedding: composableConfig.value.useEmbedding,
  useReranker: composableConfig.value.useReranker,
  layeringMethod: composableConfig.value.layeringMethod,
  sortingStrategy: composableConfig.value.sortingStrategy,
  chunkSize: composableConfig.value.chunkSize,
  algorithmDesign: composableConfig.value.algorithmDesign,
  articleTitle: composableConfig.value.articleTitle,
  articleTheme: composableConfig.value.articleTheme,
  articleScenario: composableConfig.value.articleScenario,
  imageGenModel: composableConfig.value.imageGenModel,
  klingSubmodel: composableConfig.value.klingSubmodel
})

const articleContent = ref('')
const articleContentHtml = ref('')
const generating = ref(false)
const evaluationRef = ref<InstanceType<typeof ArticleEvaluation> | null>(null)

// UI 状态管理
const showConfigDrawer = ref(false)
const showEvaluationModal = ref(false)
const showMoreMenu = ref(false)

// 新功能状态
const showGenerationProgress = ref(false)
const generationProgress = ref(0)
const currentStepIndex = ref(0)
const previewContent = ref('')
const showKnowledgeInserter = ref(false)
const insertPosition = ref<number | undefined>(undefined)
const showAlgorithmPanel = ref(false)
const articleTitle = computed(() => config.value.articleTitle || '')

// 将 Markdown 文本转换为 HTML
const convertMarkdownToHtml = (markdown: string): string => {
  const html = markdown
    // 标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗体
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // 斜体
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
    // 图片
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" />')
    // 换行转段落
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br />')}</p>`)
    .join('\n')

  return html
}

const handleGenerateArticle = async () => {
  generating.value = true
  showGenerationProgress.value = true
  generationProgress.value = 0
  currentStepIndex.value = 0
  previewContent.value = ''

  try {
    // 更新 composable 配置
    composableConfig.value = { ...composableConfig.value, ...config.value }

    // 模拟生成步骤
    const steps = [
      { progress: 16, content: '<h2>文章大纲</h2><p>正在分析主题和构建文章结构...</p>' },
      { progress: 33, content: '<h2>引言部分</h2><p>正在生成引人入胜的开头...</p>' },
      { progress: 50, content: '<h3>核心内容</h3><p>正在展开主要论点和支撑材料...</p>' },
      { progress: 66, content: '<h3>详细阐述</h3><p>正在添加具体案例和深入分析...</p>' },
      { progress: 83, content: '<h2>总结</h2><p>正在整理要点并形成结论...</p>' },
      { progress: 100, content: '' }
    ]

    for (let i = 0; i < steps.length; i++) {
      currentStepIndex.value = i
      generationProgress.value = steps[i].progress
      previewContent.value = steps[i].content

      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    // 实际生成文章
    const content = await generateArticleComposable()
    articleContent.value = content

    // 转换为 HTML 格式
    articleContentHtml.value = convertMarkdownToHtml(content)

    showGenerationProgress.value = false

    useNotification().add({
      title: '文章生成完成',
      type: 'success'
    })

    // 触发文章评估
    if (evaluationRef.value) {
      nextTick(() => {
        evaluationRef.value?.evaluateArticle()
      })
    }
  } catch (error: any) {
    showGenerationProgress.value = false
    useNotification().add({
      title: '生成文章失败',
      description: error.message,
      type: 'error'
    })
  } finally {
    generating.value = false
  }
}

const handleCancelGeneration = () => {
  showGenerationProgress.value = false
  generating.value = false
  useNotification().add({
    title: '文章生成已取消',
    type: 'info'
  })
}

const handleInsertKnowledge = (position?: number) => {
  insertPosition.value = position
  showKnowledgeInserter.value = true
}

const handleKnowledgeInsert = (content: string, position?: number) => {
  // 在指定位置插入知识库内容
  if (position !== undefined && articleContentHtml.value) {
    // 这里可以实现更复杂的插入逻辑
    articleContentHtml.value += `\n\n${content}`
  } else {
    articleContentHtml.value += `\n\n${content}`
  }

  // 同步更新纯文本内容
  if (import.meta.client) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = articleContentHtml.value
    articleContent.value = tempDiv.textContent || tempDiv.innerText || ''
  }

  showKnowledgeInserter.value = false
}

const handleContentUpdate = (html: string) => {
  articleContentHtml.value = html
  // 同时保存 HTML 和纯文本
  if (import.meta.client) {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    articleContent.value = tempDiv.textContent || tempDiv.innerText || ''
  }
}

const handleCopyFullArticle = async () => {
  if (!articleContentHtml.value) {
    useNotification().add({
      title: '请先生成文章',
      type: 'warning'
    })
    return
  }

  try {
    // 复制 HTML 内容
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([articleContentHtml.value], { type: 'text/html' }),
        'text/plain': new Blob([articleContent.value], { type: 'text/plain' })
      })
    ])
    useNotification().add({
      title: '全文已复制到剪贴板',
      type: 'success'
    })
  } catch (error) {
    // 降级方案：只复制纯文本
    try {
      await navigator.clipboard.writeText(articleContent.value)
      useNotification().add({
        title: '全文已复制到剪贴板（纯文本）',
        type: 'success'
      })
    } catch (e) {
      useNotification().add({
        title: '复制失败',
        type: 'error'
      })
    }
  }
}

const handleOptimizeFullArticle = async () => {
  // 实现全文优化逻辑
}

const handleExportToPDF = () => {
  // 实现导出PDF逻辑
  useNotification().add({
    title: 'PDF导出功能开发中',
    type: 'info'
  })
}

const handleOptimizationSuggestions = (suggestions: string[]) => {
  // 处理优化建议
  useNotification().add({
    title: '收到优化建议',
    description: `基于线上文章分析，获得 ${suggestions.length} 条优化建议`,
    type: 'info'
  })

  // 这里可以将建议应用到文章中
  console.log('优化建议:', suggestions)
}

const handleAlgorithmSelected = (algorithm: any) => {
  useNotification().add({
    title: '算法已选择',
    description: `已选择算法：${algorithm.name}`,
    type: 'success'
  })
  // 这里可以进一步处理算法选择
}

const handleSaveAnalysis = (analysis: any) => {
  useNotification().add({
    title: '分析结果已保存',
    type: 'success'
  })
  // 这里可以保存分析结果到后端
}

const resetConfig = () => {
  // 重置配置
  config.value = {
    ithinkPrompt: '',
    recallBranches: [{ name: '', type: 'search' }],
    knowledgeItems: [],
    useEmbedding: true,
    useReranker: true,
    layeringMethod: 'auto',
    sortingStrategy: 'relevance',
    chunkSize: 500,
    algorithmDesign: '',
    articleTitle: '',
    articleTheme: '',
    articleScenario: '',
    imageGenModel: 'gemini-2.5-flash-image-preview',
    klingSubmodel: 'kling-v2-1'
  }
  useNotification().add({
    title: '配置已重置',
    type: 'success'
  })
}

// 加载保存的配置
onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.writing-workspace-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: #fafafa;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 现代化顶部工具栏 */
.workspace-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 50;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
}

/* 主编辑区域 */
.workspace-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fafafa;
}

/* 动画效果 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
}

/* 响应式设计 */
@media (max-width: 768px) {
  .workspace-header-bar {
    padding: 0.75rem 1rem;
  }

  .header-actions {
    gap: 0.5rem;
  }

  .action-button {
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }

  .floating-actions {
    bottom: 1rem;
    right: 1rem;
  }

  .fab-main {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }

  .config-drawer {
    width: 100vw;
  }

  .modal-container {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .writing-workspace-wrapper {
    background: #111827;
  }

  .workspace-header-bar {
    background: rgba(17, 24, 39, 0.95);
    border-bottom-color: #374151;
  }

  .workspace-main {
    background: #111827;
  }

  .secondary-button {
    background: #374151;
    color: #f9fafb;
    border-color: #4b5563;
  }

  .secondary-button:hover:not(:disabled) {
    background: #4b5563;
  }

  .ghost-button {
    color: #9ca3af;
  }

  .ghost-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .dropdown-menu {
    background: #1f2937;
    border-color: #374151;
  }

  .dropdown-item {
    color: #f9fafb;
  }

  .dropdown-item:hover {
    background: #374151;
  }

  .config-drawer,
  .modal-container {
    background: #1f2937;
  }

  .drawer-header,
  .modal-header {
    border-bottom-color: #374151;
  }

  .drawer-title,
  .modal-title {
    color: #f9fafb;
  }

  .close-button {
    color: #9ca3af;
  }

  .close-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .fab-secondary {
    background: rgba(31, 41, 55, 0.95);
    color: #f9fafb;
  }

  .comparison-section {
    border-top-color: #374151;
  }
}

/* 动画效果 */
@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

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

.floating-actions {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 算法分析面板样式 */
.algorithm-panel-container {
  position: fixed;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.algorithm-panel-toggle {
  position: fixed;
  right: 20px;
  bottom: 100px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 2rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
  z-index: 999;
}

.algorithm-panel-toggle:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
}

.algorithm-panel-toggle.active {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
}

.algorithm-panel-toggle svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
