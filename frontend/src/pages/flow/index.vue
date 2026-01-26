<!-- AI Workflow Designer - Complete Vue 3 Implementation with Performance Optimization -->
<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { cacheManager } from '~/utils/cacheManager'
import { useGPUAcceleration, useWebWorker, useThrottle, usePerformanceMonitor } from '~/composables/usePerformance'
import { useAlgorithmMenus, type Algorithm, type AlgorithmMenu } from '~/composables/useAlgorithmMenus'
import { useAuth } from '~/composables/useAuth'
import MenuTreeItem from '~/components/MenuTreeItem.vue'
import KnowledgeBaseBrowser from '~/components/KnowledgeBaseBrowser.vue'

// 使用空布局，隐藏侧边栏
definePageMeta({
  layout: 'empty'
})

// 获取当前用户信息和认证token
const { user, token } = useAuth()

// Router and Route
const router = useRouter()
const route = useRoute()

// ────────────────────────────────────────────────
// Utility Functions (declared early to prevent initialization errors)
// ────────────────────────────────────────────────

// Toast notification function
function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  // Simple console log for now, can be enhanced with actual toast UI
  console.log(`[${type.toUpperCase()}] ${message}`)
  
  // You can add actual toast implementation here
  if (typeof window !== 'undefined') {
    // Create a simple toast element
    const toast = document.createElement('div')
    toast.className = `toast toast-${type}`
    toast.textContent = message
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      z-index: 10000;
      font-weight: 500;
      max-width: 300px;
      word-wrap: break-word;
    `
    
    // Set background color based on type
    const colors = {
      success: '#28a745',
      error: '#dc3545', 
      warning: '#ffc107',
      info: '#17a2b8'
    }
    toast.style.backgroundColor = colors[type] || colors.info
    
    document.body.appendChild(toast)
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 3000)
  }
}

// Log function
function addLog(type: 'info' | 'success' | 'warning' | 'error', message: string) {
  const timestamp = Date.now()
  executionLog.value.push({ type, message, timestamp })
  console.log(`[${type.toUpperCase()}] ${message}`)
}

// State persistence functions
function saveToLocalStorage() {
  try {
    if (currentAlgorithm.value) {
      const state = {
        algorithm: currentAlgorithm.value,
        nodes: nodes.value,
        connections: connections.value,
        timestamp: Date.now()
      }
      localStorage.setItem('workflow_state', JSON.stringify(state))
    }
  } catch (error) {
    console.warn('Failed to save state to localStorage:', error)
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('workflow_state')
    if (saved) {
      const state = JSON.parse(saved)
      // Only restore if it's recent (within 1 hour)
      if (Date.now() - state.timestamp < 3600000) {
        currentAlgorithm.value = state.algorithm
        nodes.value = state.nodes || []
        connections.value = state.connections || []
        addLog('info', '已恢复上次的工作流状态')
        return true
      }
    }
  } catch (error) {
    console.warn('Failed to load state from localStorage:', error)
  }
  return false
}

// ────────────────────────────────────────────────
// Core State Variables (declared early to prevent initialization errors)
// ────────────────────────────────────────────────

// Workflow state
const nodes = ref<Node[]>([])
const connections = ref<Connection[]>([])
const currentAlgorithm = ref<Algorithm | null>(null)
const executionLog = ref<any[]>([
  { type: 'info', message: '[系统] 工作流设计器已就绪', timestamp: Date.now() }
])

// ────────────────────────────────────────────────
// Undo/Redo History Management
// ────────────────────────────────────────────────
interface HistoryState {
  nodes: Node[]
  connections: Connection[]
  timestamp: number
}

const history = ref<HistoryState[]>([])
const historyIndex = ref(-1)
const MAX_HISTORY_SIZE = 50 // 最多保存50个历史状态

// 保存当前状态到历史记录
function saveToHistory() {
  // 移除当前索引之后的所有历史记录（如果用户在撤回后进行了新操作）
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  
  // 添加新的历史状态
  history.value.push({
    nodes: JSON.parse(JSON.stringify(nodes.value)),
    connections: JSON.parse(JSON.stringify(connections.value)),
    timestamp: Date.now()
  })
  
  // 限制历史记录大小
  if (history.value.length > MAX_HISTORY_SIZE) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

// 撤回操作
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    if (state) {
      nodes.value = JSON.parse(JSON.stringify(state.nodes))
      connections.value = JSON.parse(JSON.stringify(state.connections))
      addLog('info', '已撤回操作')
    }
  }
}

// 重做操作
function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    if (state) {
      nodes.value = JSON.parse(JSON.stringify(state.nodes))
      connections.value = JSON.parse(JSON.stringify(state.connections))
      addLog('info', '已重做操作')
    }
  }
}

// 检查是否可以撤回/重做
const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// ────────────────────────────────────────────────
// Render Cache Management
// ────────────────────────────────────────────────
const renderCache = ref<Map<string, any>>(new Map())
const CACHE_CLEANUP_INTERVAL = 60000 // 每60秒清理一次缓存
const CACHE_MAX_AGE = 300000 // 缓存最大保留时间（5分钟）

// 清理过期缓存
function cleanupRenderCache() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  renderCache.value.forEach((value, key) => {
    if (now - value.timestamp > CACHE_MAX_AGE) {
      keysToDelete.push(key)
    }
  })
  
  keysToDelete.forEach(key => renderCache.value.delete(key))
  
  if (keysToDelete.length > 0) {
    console.log(`[Cache] 清理了 ${keysToDelete.length} 个过期缓存项`)
  }
}

// 启动缓存清理定时器
let cacheCleanupTimer: NodeJS.Timeout | null = null

// ────────────────────────────────────────────────
// Types & Interfaces
// ────────────────────────────────────────────────
interface Node {
  id: string
  type: string
  x: number
  y: number
  config: Record<string, any>
  data?: Record<string, any>
}

interface Connection {
  id: string
  from: string
  to: string
}

interface NodeTemplate {
  title: string
  type: string
  icon: string
  inputs: string[]
  outputs: string[]
  config: Record<string, any>
}

// ────────────────────────────────────────────────
// Performance Optimization
// ────────────────────────────────────────────────
const { isGPUAvailable, enableCSSGPUAcceleration } = useGPUAcceleration()
const { createWorker, runWorkerTask, terminateAllWorkers } = useWebWorker()
const { throttle, debounce } = useThrottle()
const { metrics } = usePerformanceMonitor()

// 创建 Worker 用于后台计算
let workflowWorker: Worker | null = null

// 自动保存定时器（每5分钟）
let autoSaveInterval: NodeJS.Timeout | null = null
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000 // 5分钟

// 键盘事件处理函数
let handleKeyDown: ((event: KeyboardEvent) => void) | null = null

onMounted(async () => {
  try {
    // 初始化 Worker
    if (typeof Worker !== 'undefined') {
      try {
        workflowWorker = new Worker('/workers/workflow-processor.js')
        console.log('[Performance] Workflow worker initialized')
      } catch (error) {
        console.warn('[Performance] Failed to initialize worker:', error)
      }
    }
    
    // 启用 GPU 加速
    if (isGPUAvailable.value) {
      const canvas = document.getElementById('workflow-canvas')
      if (canvas) {
        enableCSSGPUAcceleration(canvas)
        console.log('[Performance] GPU acceleration enabled')
      }
    }
    
    console.log('[Performance] FPS:', metrics.value.fps, 'Memory:', metrics.value.memory, 'MB')
    
    // Try to restore previous state first
    const stateRestored = loadFromLocalStorage()
    
    // 初始化算法菜单（使用共享状态）
    try {
      // Use nextTick to ensure all functions are available
      await nextTick()
      console.log('开始初始化算法菜单，用户:', user.value)
      // 传递用户ID以正确加载用户的算法数据
      await initializeAlgorithmMenus(user.value?.id?.toString())
      console.log('算法菜单初始化完成，菜单数量:', algorithmMenus.value.length)
      
      // 输出菜单详情用于调试
      algorithmMenus.value.forEach(menu => {
        console.log(`菜单 ${menu.name}: ${menu.algorithms.length} 个算法`)
      })
    } catch (error) {
      console.error('Failed to initialize algorithm menus:', error)
      addLog('error', '算法菜单初始化失败')
    }
    
    // 检查是否有算法ID参数，如果有则自动加载该算法
    const algorithmId = route?.query?.algorithmId as string
    const menuId = route?.query?.menuId as string
    const menuName = route?.query?.menuName as string
    const isNewWorkflow = route?.query?.newWorkflow === 'true'
    
    if (algorithmId) {
      // 等待算法菜单加载完成后再加载指定算法
      nextTick(() => {
        setTimeout(async () => {
          try {
            await loadAlgorithmById(algorithmId)
          } catch (error) {
            console.error('Failed to load algorithm:', error)
            addLog('error', `加载算法失败: ${error.message}`)
          }
        }, 500) // 给一点时间让菜单数据加载完成
      })
    } else if (isNewWorkflow && menuId && menuName) {
      // 创建新工作流
      nextTick(() => {
        try {
          showToast(`正在为 "${menuName}" 创建新工作流`, 'success')
          // 清空画布，准备新工作流
          nodes.value = []
          connections.value = []
          // 创建临时算法对象用于显示标题
          currentAlgorithm.value = {
            id: `temp_${Date.now()}`,
            name: menuName,
            workflowId: '',
            description: '',
            type: 'workflow',
            creatorId: user.value?.id || 'anonymous',
            isBuiltIn: false,
            chartType: '',
            chartData: null,
            category: menuId,
            menuId: menuId
          }
          // 可以在这里设置一些默认节点或提示
          addLog('info', `开始为 "${menuName}" 创建新工作流`)
          saveToLocalStorage()
        } catch (error) {
          console.error('Failed to create new workflow:', error)
          addLog('error', `创建新工作流失败: ${error.message}`)
        }
      })
    }
    
    // 启动缓存清理定时器
    cacheCleanupTimer = setInterval(() => {
      cleanupRenderCache()
    }, CACHE_CLEANUP_INTERVAL)
    console.log('[Cache] 缓存清理定时器已启动')
    
    // 初始化历史记录
    saveToHistory()
    console.log('[History] 历史记录已初始化')
    
    // 添加键盘快捷键支持
    handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Z 或 Cmd+Z 撤回
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      }
      // Ctrl+Y 或 Cmd+Shift+Z 重做
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault()
        redo()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    console.log('[Keyboard] 快捷键已启用 (Ctrl+Z 撤回, Ctrl+Y 重做)')
    
    // 加载用户的知识库列表
    await loadMyKnowledgeBases()
  } catch (error) {
    console.error('onMounted error:', error)
    addLog('error', `页面初始化失败: ${error.message}`)
    showToast('页面初始化失败，请刷新页面重试', 'error')
  }
})

// 添加保存状态标志
const isSaving = ref(false)

// 监听路由变化，实现动态工作流加载
watch(() => route?.query?.algorithmId, (newAlgorithmId, oldAlgorithmId) => {
  // 如果正在保存，跳过路由变化处理
  if (isSaving.value) {
    console.log('正在保存中，跳过路由变化处理')
    return
  }
  
  // 如果新的算法ID与当前算法ID相同，跳过处理
  if (newAlgorithmId && currentAlgorithm.value && newAlgorithmId === currentAlgorithm.value.id) {
    console.log('算法ID未变化，跳过路由变化处理')
    return
  }
  
  if (newAlgorithmId && newAlgorithmId !== oldAlgorithmId) {
    // 等待算法菜单加载完成后再加载指定算法
    nextTick(() => {
      setTimeout(() => {
        loadAlgorithmById(newAlgorithmId as string)
      }, 300)
    })
  }
}, { immediate: false })

// 监听新建工作流参数
watch(() => route?.query?.newWorkflow, (isNewWorkflow) => {
  if (isNewWorkflow === 'true') {
    const menuId = route?.query?.menuId as string
    const menuName = route?.query?.menuName as string
    
    if (menuId && menuName) {
      nextTick(() => {
        try {
          showToast(`正在为 "${menuName}" 创建新工作流`, 'success')
          // 清空画布，准备新工作流
          nodes.value = []
          connections.value = []
          // 创建临时算法对象用于显示标题
          currentAlgorithm.value = {
            id: `temp_${Date.now()}`,
            name: menuName,
            workflowId: '',
            description: '',
            type: 'workflow',
            creatorId: user.value?.id || 'anonymous',
            isBuiltIn: false,
            chartType: '',
            chartData: null,
            category: menuId,
            menuId: menuId
          }
          addLog('info', `开始为 "${menuName}" 创建新工作流`)
          saveToLocalStorage()
        } catch (error) {
          console.error('Failed to create new workflow:', error)
          addLog('error', `创建新工作流失败: ${error.message}`)
        }
      })
    }
  }
}, { immediate: false })

// Auto-save state when nodes or connections change
watch([nodes, connections, currentAlgorithm], () => {
  saveToLocalStorage()
}, { deep: true })

// ────────────────────────────────────────────────
// Node Type Definitions (from HTML)
// ────────────────────────────────────────────────
const NODE_TYPES: Record<string, NodeTemplate> = {
  'llm-deepseek': {
    title: 'DeepSeek V3',
    type: 'llm',
    icon: '🧠',
    inputs: ['prompt'],
    outputs: ['response'],
    config: {
      model: 'deepseek-v3',
      systemPrompt: '你是一个有帮助的AI助手。',
      temperature: 0.7,
      maxTokens: 4000
    }
  },
  'llm-gemini': {
    title: 'Gemini Flash',
    type: 'llm',
    icon: '✨',
    inputs: ['prompt'],
    outputs: ['response'],
    config: {
      model: 'gemini-2.5-flash-all',
      systemPrompt: '你是一个有帮助的AI助手。',
      temperature: 0.7,
      maxTokens: 4000
    }
  },
  'nlp-semantic': {
    title: 'NLP语义分析',
    type: 'nlp',
    icon: '🔬',
    inputs: ['text'],
    outputs: ['analysis'],
    config: {
      analysisType: 'comprehensive',
      model: 'deepseek-v3'
    }
  },
  'personality-analysis': {
    title: '人格分析',
    type: 'personality',
    icon: '👤',
    inputs: ['text'],
    outputs: ['analysis'],
    config: {
      framework: '5度人格分析',
      model: 'deepseek-v3'
    }
  },
  'algo-latex-ai': {
    title: 'LaTeX生成',
    type: 'algo',
    icon: 'TeX',
    inputs: ['input'],
    outputs: ['latex'],
    config: {
      model: 'deepseek-v3',
      promptTemplate: '请将以下内容转换为LaTeX格式的数学公式：${input}'
    }
  },
  'algo-formula': {
    title: '公式执行',
    type: 'algo',
    icon: '𝑓(𝑥)',
    inputs: ['input'],
    outputs: ['result'],
    config: {
      model: 'deepseek-v3',
      promptTemplate: '请执行以下数学公式并给出结果：${output}'
    }
  },
  'algo-chart': {
    title: '图表可视化',
    type: 'algo',
    icon: '📈',
    inputs: ['data'],
    outputs: ['chart'],
    config: {
      library: 'echarts',
      chartType: 'bar',
      style: 'modern',
      title: '',
      useAI: 'true'
    }
  },
  'algo-threejs': {
    title: '3D建模',
    type: 'algo',
    icon: '🧊',
    inputs: ['input'],
    outputs: ['model'],
    config: {
      model: 'deepseek-v3'
    }
  },
  'algo-p5js': {
    title: '物理实验',
    type: 'algo',
    icon: '⚛️',
    inputs: ['input'],
    outputs: ['simulation'],
    config: {
      model: 'deepseek-v3'
    }
  },
  'rag-upload': {
    title: '文档上传',
    type: 'rag',
    icon: '📤',
    inputs: [],
    outputs: ['documents'],
    config: {
      chunkSize: 500,
      chunkOverlap: 50
    }
  },
  'rag-query': {
    title: '知识检索',
    type: 'rag',
    icon: '🔍',
    inputs: ['query'],
    outputs: ['results'],
    config: {
      topK: 3
    }
  },
  'input-text': {
    title: '文本输入',
    type: 'input',
    icon: '📝',
    inputs: [],
    outputs: ['text'],
    config: {
      placeholder: '请输入...',
      defaultValue: ''
    }
  },
  'output-text': {
    title: '文本输出',
    type: 'output',
    icon: '📤',
    inputs: ['text'],
    outputs: [],
    config: {}
  },
  'output-save': {
    title: '保存结果',
    type: 'output',
    icon: '💾',
    inputs: ['data'],
    outputs: [],
    config: {
      filename: 'result',
      format: 'json'
    }
  },
  'code-js': {
    title: 'JavaScript',
    type: 'code',
    icon: '⚡',
    inputs: ['input'],
    outputs: ['output'],
    config: {
      code: '// 输入数据在 input 变量中\n// 返回处理后的结果\nreturn input;'
    }
  },
  'code-cmd': {
    title: 'CMD命令',
    type: 'cmd',
    icon: '🖥️',
    inputs: ['input'],
    outputs: ['output'],
    config: {
      command: 'echo Hello World',
      shell: 'cmd'
    }
  },
  'condition': {
    title: '条件判断',
    type: 'condition',
    icon: '🔀',
    inputs: ['input'],
    outputs: ['true', 'false'],
    config: {
      condition: 'input.length > 0'
    }
  },
  'memory': {
    title: '对话记忆',
    type: 'memory',
    icon: '🧠',
    inputs: ['message'],
    outputs: ['history'],
    config: {
      maxMessages: 10
    }
  },
  'image-generation': {
    title: '图片生成',
    type: 'algo',
    icon: '🖼️',
    inputs: ['prompt'],
    outputs: ['image'],
    config: {
      model: 'dall-e-3'
    }
  },
  'llm-filter': {
    title: '大模型过滤器',
    type: 'algo',
    icon: '🧹',
    inputs: ['text', 'context'],
    outputs: ['filtered', 'rules'],
    config: {
      mode: 'ai', // ai, regex, hybrid
      filterType: 'clean', // clean, extract, transform
      aiPrompt: '请清洗以下文本，去除无关内容，保留关键信息：',
      regexPattern: '',
      regexFlags: 'gim',
      replacement: '',
      examples: '',
      autoGenerateRegex: true,
      model: 'deepseek-v3'
    }
  },
  'post-ppt': {
    title: 'PPT生成',
    type: 'post-process',
    icon: '📊',
    inputs: ['content'],
    outputs: ['file'],
    config: {
      filename: 'presentation.pptx',
      template: 'default'
    }
  },
  'post-web': {
    title: '网页展示页',
    type: 'post-process',
    icon: '🌐',
    inputs: ['input'],
    outputs: [],
    config: {
      filename: 'index.html',
      title: '展示页面'
    }
  },
  'post-pdf': {
    title: 'PDF报告',
    type: 'post-process',
    icon: '📄',
    inputs: ['content'],
    outputs: ['file'],
    config: {
      filename: 'report.pdf',
      template: 'report'
    }
  },
  'file-upload': {
    title: '文件上传',
    type: 'file-upload',
    icon: '📁',
    inputs: ['file'],
    outputs: ['fileUrl', 'fileName'],
    config: {
      uploadPath: 'user/{userId}/uploads',
      allowedTypes: ['*'],
      maxSize: 100 * 1024 * 1024 // 100MB
    }
  },
  'rag-workflow': {
    title: 'RAG工作流',
    type: 'rag-workflow',
    icon: '📖',
    inputs: ['query'],
    outputs: ['response'],
    config: {
      topK: 3,
      model: 'deepseek-v3',
      systemPrompt: '你是一个专业的知识库助手，请基于提供的知识库内容回答用户问题。'
    }
  },
  'local-image-upload': {
    title: '本地上传图片',
    type: 'local-image-upload',
    icon: '🖼️',
    inputs: ['image'],
    outputs: ['imageUrl', 'imageName'],
    config: {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.8,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    }
  },
  'image-to-video': {
    title: '图片转视频',
    type: 'image-to-video',
    icon: '🎬',
    inputs: ['imageUrl'],
    outputs: ['videoUrl'],
    config: {
      duration: 5,
      fps: 30,
      quality: 'high',
      model: 'stable-video-diffusion'
    }
  },
  'video-understanding': {
    title: '视频理解',
    type: 'video-understanding',
    icon: '🎥',
    inputs: ['videoUrl', 'query'],
    outputs: ['analysis'],
    config: {
      model: 'gpt-5-nano',
      ultrathink: true,
      temperature: 0.1,
      maxTokens: 4000
    }
  },
  'kb-assistant': {
    title: '知识库助手',
    type: 'kb-assistant',
    icon: '📚',
    inputs: ['query'],
    outputs: ['response', 'sources'],
    config: {
      knowledgeBaseId: '',
      selectedDocIds: [],
      topK: 3,
      model: 'deepseek-v3',
      systemPrompt: '你是一个专业的知识库助手，请基于提供的知识库内容回答用户问题。',
      enableSources: true
    }
  }
}

// ────────────────────────────────────────────────
// State Management (continued)
// ────────────────────────────────────────────────
const selectedNode = ref<Node | null>(null)
const searchQuery = ref('')
const nodeIdCounter = ref(0)
const nodeExecutionStatus = ref<Record<string, 'idle' | 'running' | 'success' | 'error'>>({})
const nodeOutputs = ref<Record<string, any>>({}) // 存储节点输出结果

// 获取节点执行状态
function getNodeStatus(nodeId: string): 'idle' | 'running' | 'success' | 'error' {
  return nodeExecutionStatus.value[nodeId] || 'idle'
}

// 设置节点执行状态
function setNodeStatus(nodeId: string, status: 'idle' | 'running' | 'success' | 'error') {
  nodeExecutionStatus.value[nodeId] = status
}

// ────────────────────────────────────────────────
// 使用共享的算法菜单管理
// ────────────────────────────────────────────────
const {
  algorithmMenus,
  loadingAlgorithms,
  loadAlgorithms,
  toggleMenu,
  editMenuName,
  deleteMenu,
  addMenu: addMenuToStore,
  addAlgorithm: addAlgorithmToStore,
  findMenuById,
  getAllParentMenus,
  initialize: initializeAlgorithmMenus
} = useAlgorithmMenus()

const showAddMenuModal = ref(false)
const showAddAlgorithmModal = ref(false)
const selectedMenu = ref<AlgorithmMenu | null>(null)
const newMenuName = ref('')
const newMenuParent = ref<string | null>(null)
const newAlgorithmName = ref('')
const newAlgorithmDesc = ref('')
const showNewAlgorithmModal = ref(false) // 新建算法选择模态框
const selectedMenuForCreation = ref<AlgorithmMenu | null>(null)
const expandedMenus = ref<Set<string>>(new Set())
const checkedMenuIds = ref<string[]>([]) // 勾选的菜单ID列表

// 处理菜单勾选
function handleMenuCheck(menu: AlgorithmMenu, checked: boolean) {
  if (checked) {
    // 添加到勾选列表
    if (!checkedMenuIds.value.includes(menu.id)) {
      checkedMenuIds.value.push(menu.id)
    }
    // 同时选中该菜单用于创建
    selectedMenuForCreation.value = menu
    addLog('info', `已勾选分类: ${menu.name}`)
  } else {
    // 从勾选列表移除
    checkedMenuIds.value = checkedMenuIds.value.filter(id => id !== menu.id)
    // 如果取消勾选的是当前选中的菜单，清除选中
    if (selectedMenuForCreation.value?.id === menu.id) {
      selectedMenuForCreation.value = null
    }
    addLog('info', `已取消勾选分类: ${menu.name}`)
  }
}

// 菜单选择处理
function handleMenuSelection(menu: AlgorithmMenu) {
  console.log('Menu selected for creation:', menu.name)
  selectedMenuForCreation.value = menu
  addLog('info', `已选择分类: ${menu.name} (ID: ${menu.id})`)
}

// 确认算法创建
function confirmAlgorithmCreation() {
  if (!selectedMenuForCreation.value) {
    showToast('请选择一个分类', 'warning')
    return
  }

  console.log('Confirming creation in menu:', selectedMenuForCreation.value.name)
  
  // 关闭模态框
  closeNewAlgorithmModal()
  
  // 打开算法创建模态框
  selectedMenu.value = selectedMenuForCreation.value
  showAddAlgorithmModal.value = true
  newAlgorithmName.value = ''
  newAlgorithmDesc.value = ''
  
  showToast(`将在"${selectedMenuForCreation.value.name}"分类中创建算法`, 'success')
  addLog('success', `准备在分类 [${selectedMenuForCreation.value.name}] 中创建新算法`)
}

// 编辑算法
async function handleEditAlgorithm(algorithm: Algorithm) {
  console.log('编辑算法:', algorithm)
  
  // 检查权限
  const userId = user.value?.id?.toString()
  if (algorithm.isBuiltIn && user.value?.role !== 'admin') {
    showToast('无法编辑内置算法', 'warning')
    return
  }
  
  if (algorithm.creatorId && algorithm.creatorId !== userId && user.value?.role !== 'admin') {
    showToast('只能编辑自己创建的算法', 'warning')
    return
  }
  
  // 弹出编辑对话框
  const newName = prompt('请输入新的算法名称:', algorithm.name)
  if (!newName || newName.trim() === '') {
    return
  }
  
  if (newName.trim() === algorithm.name) {
    showToast('算法名称未改变', 'info')
    return
  }
  
  // 检查名称是否重复
  const isDuplicate = await checkAlgorithmNameDuplicate(newName.trim(), userId, algorithm.id)
  if (isDuplicate) {
    showToast('算法名称已存在，请使用其他名称', 'warning')
    return
  }
  
  const newDescription = prompt('请输入算法描述:', algorithm.description || '')
  
  try {
    // 调用 useAlgorithmMenus 中的更新方法
    const { updateAlgorithm } = useAlgorithmMenus()
    await updateAlgorithm(algorithm, {
      name: newName.trim(),
      description: newDescription?.trim() || ''
    })
    
    showToast('算法已更新', 'success')
    addLog('success', `算法 "${algorithm.name}" 已更新为 "${newName.trim()}"`)
    
    // 如果当前正在编辑这个算法，更新当前算法信息
    if (currentAlgorithm.value && currentAlgorithm.value.id === algorithm.id) {
      currentAlgorithm.value.name = newName.trim()
      currentAlgorithm.value.description = newDescription?.trim() || ''
    }
    
  } catch (error: any) {
    showToast('更新算法失败: ' + error.message, 'error')
    addLog('error', '更新算法失败: ' + error.message)
  }
}

// 删除算法
async function handleDeleteAlgorithm(algorithm: Algorithm) {
  console.log('删除算法:', algorithm)
  
  // 检查权限
  const userId = user.value?.id?.toString()
  if (algorithm.isBuiltIn && user.value?.role !== 'admin') {
    showToast('无法删除内置算法', 'warning')
    return
  }
  
  if (algorithm.creatorId && algorithm.creatorId !== userId && user.value?.role !== 'admin') {
    showToast('只能删除自己创建的算法', 'warning')
    return
  }
  
  // 确认删除
  if (!confirm(`确定要删除算法 "${algorithm.name}" 吗？\n\n删除后将无法恢复，包括相关的工作流数据。`)) {
    return
  }
  
  try {
    // 调用 useAlgorithmMenus 中的删除方法
    const { deleteAlgorithm } = useAlgorithmMenus()
    const success = await deleteAlgorithm(algorithm, userId)
    
    if (success) {
      showToast('算法已删除', 'success')
      addLog('success', `算法 "${algorithm.name}" 已删除`)
      
      // 如果当前正在编辑这个算法，清空当前算法和画布
      if (currentAlgorithm.value && currentAlgorithm.value.id === algorithm.id) {
        currentAlgorithm.value = null
        nodes.value = []
        connections.value = []
        addLog('info', '当前工作流已清空')
      }
    }
    
  } catch (error: any) {
    showToast('删除算法失败: ' + error.message, 'error')
    addLog('error', '删除算法失败: ' + error.message)
  }
}

// 检查算法名称是否重复
async function checkAlgorithmNameDuplicate(name: string, userId?: string, excludeId?: string): Promise<boolean> {
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const response = await fetch(`${backendUrl}/api/algorithms/check-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        userId,
        excludeId
      })
    })
    
    const result = await response.json()
    return result.isDuplicate || false
  } catch (error) {
    console.warn('检查算法名称重复失败，跳过检查:', error)
    return false // 如果检查失败，允许继续操作
  }
}

// 使用导入的 getAllParentMenus 函数，已从 useAlgorithmMenus 中导入

// Execution Input Modal Functions
function closeExecutionInputModal() {
  isExecutionInputModal.value = false
  executionQueryInput.value = ''
}

function confirmExecutionInput() {
  if (!executionQueryInput.value.trim()) {
    showToast('请输入查询内容', 'warning')
    return
  }
  
  // 关闭模态框并执行工作流
  isExecutionInputModal.value = false
  
  // 将输入值传递给 input-text 节点
  const inputNode = nodes.value.find(n => n.type === 'input-text')
  if (inputNode) {
    inputNode.config.defaultValue = executionQueryInput.value
    addLog('info', `已设置输入: "${executionQueryInput.value.substring(0, 50)}${executionQueryInput.value.length > 50 ? '...' : ''}"`)
  }
  
  // 执行工作流
  executeWorkflow()
}

// 执行工作流的入口函数，检查是否需要输入
function runWorkflow() {
  // 检查是否包含 input-text 节点
  const hasInputNode = nodes.value.some(n => n.type === 'input-text')
  
  if (hasInputNode) {
    // 打开输入模态框
    isExecutionInputModal.value = true
    executionQueryInput.value = ''
    addLog('info', '检测到输入节点，请输入查询内容')
  } else {
    // 直接执行
    executeWorkflow()
  }
}

// 过滤算法菜单，只显示用户自己创建的算法和内置算法
const filteredAlgorithmMenus = computed(() => {
  const userId = user.value?.id?.toString()
  const isAdmin = user.value?.role?.name === 'admin' || user.value?.roles?.includes('admin')
  
  console.log('[FilteredMenus] 当前用户ID:', userId, '是否管理员:', isAdmin)
  console.log('[FilteredMenus] 原始菜单数量:', algorithmMenus.value.length)
  
  // 递归过滤菜单
  function filterMenu(menu: AlgorithmMenu): AlgorithmMenu | null {
    // 过滤算法：只显示内置算法或用户自己创建的算法
    const filteredAlgorithms = menu.algorithms.filter(algo => {
      // 管理员可以看到所有算法
      if (isAdmin) return true
      // 内置算法所有人都可以看到
      if (algo.isBuiltIn) return true
      // 用户只能看到自己创建的算法（确保类型一致比较）
      const algoCreatorId = algo.creatorId?.toString()
      return algoCreatorId === userId
    })
    
    // 递归过滤子菜单
    const filteredChildren = menu.children
      .map(child => filterMenu(child))
      .filter(child => child !== null) as AlgorithmMenu[]
    
    // 判断是否显示菜单
    const hasContent = filteredAlgorithms.length > 0 || filteredChildren.length > 0
    const menuCreatorId = menu.creatorId?.toString()
    const isMyMenu = !menu.isBuiltIn && menuCreatorId === userId
    const isBuiltInMenu = menu.isBuiltIn
    // 特殊处理：id为'custom'的菜单是公共的自定义算法菜单，所有人都可以看到
    const isPublicCustomMenu = menu.id === 'custom'
    
    // 调试日志
    if (menu.id === 'custom') {
      console.log('[FilteredMenus] 自定义算法菜单:', {
        menuId: menu.id,
        totalAlgorithms: menu.algorithms.length,
        filteredAlgorithms: filteredAlgorithms.length,
        isPublicCustomMenu,
        hasContent
      })
    }
    
    // 显示条件：
    // 1. 管理员可以看到所有菜单
    // 2. 内置菜单所有人都可以看到（即使为空）
    // 3. 公共自定义算法菜单所有人都可以看到（即使为空）
    // 4. 用户自己创建的菜单（即使为空）
    // 5. 有内容的菜单
    if (isAdmin || isBuiltInMenu || isPublicCustomMenu || isMyMenu || hasContent) {
      return {
        ...menu,
        algorithms: filteredAlgorithms,
        children: filteredChildren,
        expanded: menu.expanded // 保持原始的展开状态，允许用户切换
      }
    }
    
    return null
  }
  
  const result = algorithmMenus.value
    .map(menu => filterMenu(menu))
    .filter(menu => menu !== null) as AlgorithmMenu[]
  
  console.log('[FilteredMenus] 过滤后菜单数量:', result.length)
  return result
})

// Canvas state
const canvasState = reactive({
  zoom: 1,
  pan: { x: 0, y: 0 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  isDragging: false,
  draggedNode: null as any,
  isConnecting: false,
  connectionStart: null as any,
  tempConnectionEnd: { x: 0, y: 0 },
  hoveredConnection: null as string | null
})

// UI state
const panelCollapsed = ref(true) // 默认收起，避免初始化时出现"空气墙"
const activeTab = ref('chat')

// 动态计算画布边界，防止宽度挤压
const canvasBounds = computed(() => {
  if (nodes.value.length === 0) {
    // 没有节点时，返回默认边界
    return {
      minX: 0,
      minY: 0,
      maxX: 2000,
      maxY: 2000,
      width: 2000,
      height: 2000,
      padding: 500 // 默认内边距
    }
  }
  
  // 计算所有节点的边界
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  // 节点默认尺寸（根据实际 CSS 中的 min-width: 200px 和内容估算）
  // 实际节点宽度会根据内容动态调整，但最小宽度是 200px
  // 高度根据节点类型和内容变化，估算平均约 250-300px
  const nodeMinWidth = 200
  const nodeEstimatedHeight = 280 // 根据实际节点内容调整
  
  nodes.value.forEach(node => {
    // 尝试获取节点实际尺寸
    let nodeWidth = nodeMinWidth
    let nodeHeight = nodeEstimatedHeight
    
    // 根据节点类型估算更精确的尺寸
    const nodeType = NODE_TYPES[node.type]
    if (nodeType) {
      // 根据节点类型调整估算尺寸
      // 知识库助手节点通常更大
      if (node.type === 'kb-assistant') {
        nodeWidth = 320
        nodeHeight = 400
      } else if (node.type === 'llm-deepseek' || node.type === 'llm-gemini') {
        nodeWidth = 280
        nodeHeight = 300
      } else if (node.type === 'rag-workflow') {
        nodeWidth = 300
        nodeHeight = 350
      } else {
        // 默认尺寸
        nodeWidth = 250
        nodeHeight = nodeEstimatedHeight
      }
    }
    
    const nodeLeft = node.x
    const nodeTop = node.y
    const nodeRight = node.x + nodeWidth
    const nodeBottom = node.y + nodeHeight
    
    minX = Math.min(minX, nodeLeft)
    minY = Math.min(minY, nodeTop)
    maxX = Math.max(maxX, nodeRight)
    maxY = Math.max(maxY, nodeBottom)
  })
  
  // 添加内边距，确保节点不会被挤压
  // 根据缩放级别调整内边距，缩放越大，内边距可以越小
  const basePadding = 1000
  const padding = basePadding / Math.max(canvasState.zoom, 0.3)
  
  // 确保最小尺寸，避免画布太小
  const minWidth = 4000
  const minHeight = 3000
  
  const width = Math.max(maxX - minX + padding * 2, minWidth)
  const height = Math.max(maxY - minY + padding * 2, minHeight)
  
  return {
    minX: Math.min(minX - padding, 0),
    minY: Math.min(minY - padding, 0),
    maxX: maxX + padding,
    maxY: maxY + padding,
    width,
    height,
    padding
  }
})

// 计算画布容器的动态尺寸
const canvasSize = computed(() => {
  const bounds = canvasBounds.value
  
  // 画布尺寸应该基于逻辑坐标，不受缩放影响
  // transform scale 会处理缩放，这里只需要逻辑尺寸
  return {
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    minWidth: `${bounds.width}px`,
    minHeight: `${bounds.height}px`
  }
})
const showAiCreatorModal = ref(false)
const aiWorkflowPrompt = ref('')
const aiCreatorModel = ref('deepseek-v3')
const showKnowledgeBaseModal = ref(false)
const knowledgeBaseDocuments = ref([])
const isUploadingDocument = ref(false)
const kbTestQuery = ref('')
const kbTestResult = ref('')
const isTestingKB = ref(false)
const selectedDocument = ref(null)
const documentPreview = ref('')
const isEditingDocument = ref(false)
const documentEditContent = ref('')
const showDocumentPreview = ref(false)
const isExecuting = ref(false) // 工作流执行状态
const executionResult = ref<any>(null) // 执行结果
const sidebarWidth = ref(280) // 侧边栏宽度
const isResizing = ref(false) // 是否正在调整大小

// 我的知识库相关状态
const myKnowledgeBases = ref<any[]>([]) // 用户的知识库列表
const loadingMyKBs = ref(false) // 加载知识库列表中
const selectedKBDocuments = ref<Record<string, any[]>>({}) // 每个知识库的文档列表缓存
const loadingKBDocuments = ref<Record<string, boolean>>({}) // 加载文档列表状态
const currentSelectedKB = ref<any>(null) // 当前在浏览器中选中的知识库

// 侧边栏调整大小相关方法
const handleResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  e.preventDefault()
}

const handleResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  
  const newWidth = e.clientX
  // 限制最小和最大宽度
  if (newWidth >= 200 && newWidth <= 500) {
    sidebarWidth.value = newWidth
  }
}

const handleResizeEnd = () => {
  isResizing.value = false
}
const chatMessages = ref<any[]>([
  {
    role: 'assistant',
    content: '你好！我是AI助手。你可以通过拖拽左侧节点来创建工作流，或者直接在这里与我对话。'
  }
])
const chatInput = ref('')

// AI Workflow Generation
const isGeneratingWorkflow = ref(false)
const aiGenerationProgress = ref(0)

// Execution Input Modal
const isExecutionInputModal = ref(false)
const executionQueryInput = ref('')
const pendingExecutionNodes = ref<Node[]>([])
const pendingExecutionConnections = ref<Connection[]>([])

// Config
const apiConfig = reactive({
  endpoint: 'https://yunwu.zeabur.app',
  apiKey: 'sk-0uY8HushX62LLCSWbmQPTj5vjTDnTwRUst6vsLR3aMZWfAUT',
  defaultModel: 'deepseek-v3',
  temperature: 0.7
})

// ────────────────────────────────────────────────
// Computed Properties
// ────────────────────────────────────────────────
const filteredNodeTypes = computed(() => {
  if (!searchQuery.value) return NODE_TYPES
  const query = searchQuery.value.toLowerCase()
  return Object.fromEntries(
    Object.entries(NODE_TYPES).filter(([key, node]) =>
      node.title.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query)
    )
  )
})

const groupedNodeTypes = computed(() => {
  const groups: Record<string, any[]> = {
    'llm': [],
    'ai': [],
    'algo': [],
    'rag': [],
    'io': [],
    'code': [],
    'logic': [],
    'tools': [],
    'post': []
  }

  Object.entries(filteredNodeTypes.value).forEach(([key, node]) => {
    if (node.type === 'llm') groups.llm.push({ key, ...node })
    else if (node.type === 'nlp' || node.type === 'personality') groups.ai.push({ key, ...node })
    else if (node.type === 'algo') groups.algo.push({ key, ...node })
    else if (node.type === 'rag') groups.rag.push({ key, ...node })
    else if (node.type === 'input' || node.type === 'output') groups.io.push({ key, ...node })
    else if (node.type === 'code' || node.type === 'cmd') groups.code.push({ key, ...node })
    else if (node.type === 'condition' || node.type === 'memory') groups.logic.push({ key, ...node })
    else if (node.type === 'post-process') groups.post.push({ key, ...node })
    else groups.tools.push({ key, ...node })
  })

  return groups
})

const categoryNames: Record<string, string> = {
  llm: '🤖 大语言模型',
  ai: '🧠 AI分析',
  algo: '📐 算法库',
  rag: '📚 知识库',
  io: '📥 输入输出',
  code: '💻 代码执行',
  logic: '🔀 逻辑控制',
  tools: '🛠️ 工具集合',
  post: '🎨 后处理组件'
}

// ────────────────────────────────────────────────
// Node Operations
// ────────────────────────────────────────────────
function createNode(type: string, x: number, y: number) {
  const nodeConfig = NODE_TYPES[type]
  if (!nodeConfig) return

  // 创建新节点时，清除任何正在进行的拖拽状态，避免状态混乱
  if (canvasState.isDragging) {
    canvasState.isDragging = false
    canvasState.draggedNode = null
    cachedDraggedNode = null
  }

  const nodeId = `node_${++nodeIdCounter.value}`
  const node: Node = {
    id: nodeId,
    type: type,
    x,
    y,
    config: { ...nodeConfig.config },
    data: {}
  }

  nodes.value.push(node)
  addLog('success', `创建节点: ${nodeConfig.title}`)
  saveToLocalStorage()
  saveToHistory()
}

function deleteNode(nodeId: string) {
  nodes.value = nodes.value.filter(n => n.id !== nodeId)
  connections.value = connections.value.filter(c => c.from !== nodeId && c.to !== nodeId)
  if (selectedNode.value?.id === nodeId) {
    selectedNode.value = null
  }
  addLog('warning', `删除节点: ${nodeId}`)
  saveToLocalStorage()
  saveToHistory()
}

function selectNode(node: Node) {
  // 直接设置选中的节点
  selectedNode.value = node
}

function updateNodeConfig(nodeId: string, key: string, value: any) {
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    node.config[key] = value
    saveToLocalStorage()
  }
}

// ────────────────────────────────────────────────
// Connection Operations
// ────────────────────────────────────────────────
function startConnection(nodeId: string, event: MouseEvent) {
  canvasState.isConnecting = true
  canvasState.connectionStart = { nodeId }
  updateTempConnection(event)
}

function updateTempConnection(event: MouseEvent) {
  if (!canvasState.isConnecting) return
  // 使用 canvas-container 而不是 workflow-canvas，因为 workflow-canvas 已经应用了 transform
  const canvas = document.getElementById('canvas-container')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  // 计算鼠标在画布坐标系中的位置（考虑平移和缩放）
  canvasState.tempConnectionEnd = {
    x: (event.clientX - rect.left - canvasState.pan.x) / canvasState.zoom,
    y: (event.clientY - rect.top - canvasState.pan.y) / canvasState.zoom
  }
}

function endConnection(nodeId: string) {
  if (!canvasState.isConnecting || !canvasState.connectionStart) return
  
  if (canvasState.connectionStart.nodeId !== nodeId) {
    createConnection(canvasState.connectionStart.nodeId, nodeId)
  }
  
  cancelConnection()
}

function cancelConnection() {
  canvasState.isConnecting = false
  canvasState.connectionStart = null
}

function createConnection(fromNodeId: string, toNodeId: string) {
  const exists = connections.value.some(c => c.from === fromNodeId && c.to === toNodeId)
  if (exists) return

  const connection: Connection = {
    id: `conn_${Date.now()}`,
    from: fromNodeId,
    to: toNodeId
  }

  connections.value.push(connection)
  addLog('info', `创建连接: ${fromNodeId} → ${toNodeId}`)
  saveToLocalStorage()
  saveToHistory()
}

function deleteConnection(connectionId: string) {
  connections.value = connections.value.filter(c => c.id !== connectionId)
  addLog('warning', '删除连接')
  saveToLocalStorage()
  saveToHistory()
}

// ────────────────────────────────────────────────
// 我的知识库相关函数
// ────────────────────────────────────────────────
async function loadMyKnowledgeBases() {
  loadingMyKBs.value = true
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    // 构建请求头，包含认证token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // 如果有token，添加Authorization头
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases?myAccess=true`, {
      headers
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.success && result.data) {
        // 过滤掉测试数据（纯数字名称的知识库）
        const filteredData = result.data.filter((kb: any) => {
          // 过滤掉名称为纯数字的知识库（测试数据）
          if (/^\d+$/.test(kb.name)) {
            return false
          }
          return true
        })
        myKnowledgeBases.value = filteredData
        console.log('[KB] 加载知识库列表成功:', filteredData.length, '个')
      }
    } else if (response.status === 401) {
      console.warn('[KB] 未登录或token过期，无法加载知识库列表')
      myKnowledgeBases.value = []
    }
  } catch (error) {
    console.error('[KB] 加载知识库列表失败:', error)
  } finally {
    loadingMyKBs.value = false
  }
}

async function loadKBDocuments(kbId: string) {
  if (loadingKBDocuments.value[kbId]) return
  if (selectedKBDocuments.value[kbId]) return // 已缓存
  
  loadingKBDocuments.value[kbId] = true
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    // 构建请求头，包含认证token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // 如果有token，添加Authorization头
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases/${kbId}/documents`, {
      headers
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.success && result.data) {
        selectedKBDocuments.value[kbId] = result.data
        console.log('[KB] 加载文档列表成功:', kbId, result.data.length, '个')
      }
    }
  } catch (error) {
    console.error('[KB] 加载文档列表失败:', error)
    selectedKBDocuments.value[kbId] = []
  } finally {
    loadingKBDocuments.value[kbId] = false
  }
}

// ────────────────────────────────────────────────
// Canvas Operations (Same as HTML) - 优化版本
// ────────────────────────────────────────────────
// 使用 requestAnimationFrame 优化鼠标移动事件
let rafId: number | null = null
// 缓存拖拽节点引用，避免每次查找
let cachedDraggedNode: Node | null = null
// 缓存 canvas-container 元素引用
let canvasContainerElement: HTMLElement | null = null

function processMouseMove(event: MouseEvent) {
  // 画布平移
  if (canvasState.isPanning) {
    canvasState.pan.x = event.clientX - canvasState.panStart.x
    canvasState.pan.y = event.clientY - canvasState.panStart.y
    return // 平移时不需要处理拖拽
  }
  
  // 连接线绘制
  if (canvasState.isConnecting) {
    updateTempConnection(event)
    return // 连接时不需要处理拖拽
  }
  
  // 节点拖拽 - 关键：严格检查拖拽状态
  if (!canvasState.isDragging) {
    return
  }
  
  const currentDraggedNode = canvasState.draggedNode
  if (!currentDraggedNode || !currentDraggedNode.id) {
    // 状态不一致，清除拖拽状态
    canvasState.isDragging = false
    canvasState.draggedNode = null
    cachedDraggedNode = null
    return
  }
  
  // 使用缓存的节点引用，避免每次查找
  let node = cachedDraggedNode
  if (!node || node.id !== currentDraggedNode.id) {
    // 缓存失效，重新查找（这种情况应该很少发生）
    const nodeId = currentDraggedNode.id
    node = nodes.value.find(n => n.id === nodeId) || null
    cachedDraggedNode = node
    
    if (!node) {
      canvasState.isDragging = false
      canvasState.draggedNode = null
      cachedDraggedNode = null
      if (!canvasContainerElement) {
        canvasContainerElement = document.getElementById('canvas-container')
      }
      if (canvasContainerElement) {
        canvasContainerElement.classList.remove('dragging')
      }
      return
    }
  }
  
  // 计算新位置（直接更新，减少响应式开销）
  const dx = (event.clientX - currentDraggedNode.startX) / canvasState.zoom
  const dy = (event.clientY - currentDraggedNode.startY) / canvasState.zoom
  node.x = currentDraggedNode.nodeStartX + dx
  node.y = currentDraggedNode.nodeStartY + dy
  
  // 只在拖拽开始时同步 selectedNode，避免频繁更新
  // 移除拖拽过程中的 selectedNode 更新，减少响应式开销
}

function throttledMouseMove(event: MouseEvent) {
  // 取消之前的 RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
  
  // 使用 RAF 来节流，并保存最新的 event
  rafId = requestAnimationFrame(() => {
    processMouseMove(event)
    rafId = null
  })
}

function handleCanvasMouseDown(event: MouseEvent) {
  // 如果点击的是节点，不处理画布平移（节点事件会阻止冒泡）
  if (event.target && (event.target as HTMLElement).closest('.workflow-node')) {
    return
  }
  
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    canvasState.isPanning = true
    canvasState.panStart = {
      x: event.clientX - canvasState.pan.x,
      y: event.clientY - canvasState.pan.y
    }
    event.preventDefault()
  } else if (event.button === 0) {
    // 左键点击画布空白处，取消节点选择
    selectedNode.value = null
  }
}

function handleCanvasMouseMove(event: MouseEvent) {
  throttledMouseMove(event)
}

function handleCanvasMouseUp() {
  // 关键修复：立即取消任何待处理的 RAF，防止旧的拖拽回调执行
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 清除所有拖拽和画布操作状态
  canvasState.isPanning = false
  
  // 保存节点位置（如果有拖拽的节点）- 使用防抖优化，避免频繁保存
  if (canvasState.draggedNode) {
    // 延迟保存，避免阻塞 UI
    setTimeout(() => {
      saveToLocalStorage()
    }, 100)
  }
  
  // 关键：彻底清除拖拽状态
  canvasState.isDragging = false
  canvasState.draggedNode = null
  cachedDraggedNode = null
  
  // 清除连接状态
  if (canvasState.isConnecting) {
    cancelConnection()
  }
  
  // 恢复画布样式（使用缓存的元素引用）
  if (!canvasContainerElement) {
    canvasContainerElement = document.getElementById('canvas-container')
  }
  if (canvasContainerElement) {
    canvasContainerElement.classList.remove('dragging')
  }
}

function zoomIn() {
  canvasState.zoom = Math.min(canvasState.zoom * 1.2, 3)
}

function zoomOut() {
  canvasState.zoom = Math.max(canvasState.zoom / 1.2, 0.3)
}

function resetZoom() {
  canvasState.zoom = 1
  canvasState.pan = { x: 0, y: 0 }
}

// ────────────────────────────────────────────────
// Node Mouse Down Handler (参考 xxx.html 的实现)
// ────────────────────────────────────────────────
function handleNodeMouseDown(node: Node, event: MouseEvent) {
  console.log('[MouseDown] 点击节点:', node.id)
  
  // 先检查是否点击了不应该触发拖拽的元素（在阻止事件之前检查）
  const target = event.target as HTMLElement
  
  // 检查是否点击了控件元素，如果是则允许控件正常操作，不触发拖拽
  if (target.closest('.connection-point') || 
      target.closest('input') || 
      target.closest('textarea') || 
      target.closest('select') ||
      target.closest('option') ||
      target.closest('button') ||
      target.closest('label') ||
      target.closest('.switch') ||
      target.closest('.slider') ||
      target.closest('.refresh-btn') ||
      target.closest('.node-delete') ||
      // 注意：不检查 .node-field，因为 node-field 是容器，其内部的控件已经单独检查
      // 如果点击的是 node-field 容器本身（不是控件），应该允许拖拽
      // target.closest('.node-field') ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'OPTION' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'LABEL') {
    // 允许控件正常操作，不阻止事件，不触发拖拽
    console.log('[MouseDown] 点击了控件元素，允许正常操作')
    return
  }
  
  // 只有点击节点背景区域时才阻止事件并触发拖拽
  event.preventDefault()
  event.stopPropagation()
  
  // 关键修复：取消任何待处理的 RAF，防止旧的拖拽回调干扰新的拖拽
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 关键修复：完全重置拖拽状态
  if (!canvasContainerElement) {
    canvasContainerElement = document.getElementById('canvas-container')
  }
  if (canvasContainerElement) {
    canvasContainerElement.classList.remove('dragging')
  }
  canvasState.isDragging = false
  canvasState.draggedNode = null
  cachedDraggedNode = null
  
  // 立即选中当前节点（这会触发 z-index 更新，将节点移到最上层）
  selectedNode.value = node
  
  // 开始拖拽当前节点
  startNodeDrag(node, event)
}

// ────────────────────────────────────────────────
// Node Dragging (参考 xxx.html 的实现)
// ────────────────────────────────────────────────
function startNodeDrag(node: Node, event: MouseEvent) {
  // 缓存 canvas-container 元素引用
  if (!canvasContainerElement) {
    canvasContainerElement = document.getElementById('canvas-container')
  }
  if (!canvasContainerElement) return
  
  // 关键修复：取消任何待处理的 RAF
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  
  // 关键修复：创建一个全新的 draggedNode 对象
  // 确保不会复用之前的对象引用
  const newDraggedNode = {
    id: node.id,  // 使用传入的节点ID
    startX: event.clientX,  // 鼠标开始位置（屏幕坐标）
    startY: event.clientY,
    nodeStartX: node.x,  // 节点开始位置（逻辑坐标）
    nodeStartY: node.y
  }
  
  // 先清除旧状态
  canvasState.isDragging = false
  canvasState.draggedNode = null
  cachedDraggedNode = null
  
  // 缓存节点引用，避免每次 mousemove 时查找
  cachedDraggedNode = node
  
  // 禁止文本选择
  canvasContainerElement.classList.add('dragging')
  
  // 确保选中的节点是当前拖拽的节点
  selectedNode.value = node
  
  // 设置新的拖拽状态
  canvasState.draggedNode = newDraggedNode
  canvasState.isDragging = true
}

// ────────────────────────────────────────────────
// Drag & Drop from Sidebar
// ────────────────────────────────────────────────
function handleTemplateDragStart(nodeType: string, event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('nodeType', nodeType)
  }
}

function handleCanvasDrop(event: DragEvent) {
  event.preventDefault()
  const nodeType = event.dataTransfer?.getData('nodeType')
  if (!nodeType) return
  
  const canvas = document.getElementById('canvas-container')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasState.pan.x) / canvasState.zoom
  const y = (event.clientY - rect.top - canvasState.pan.y) / canvasState.zoom
  
  createNode(nodeType, x, y)
}

function handleCanvasDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

// ────────────────────────────────────────────────
// Mouse Wheel Zoom Handler
// ────────────────────────────────────────────────
function handleCanvasWheel(event: WheelEvent) {
  event.preventDefault()
  
  const canvas = document.getElementById('workflow-canvas')
  if (!canvas) return
  
  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  
  // 计算缩放因子（向上滚动放大，向下滚动缩小）
  const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(3, canvasState.zoom * zoomFactor))
  
  // 计算缩放中心点（鼠标位置）
  const zoomDelta = newZoom - canvasState.zoom
  
  // 调整平移以保持鼠标位置不变
  canvasState.pan.x -= (mouseX / canvasState.zoom) * zoomDelta
  canvasState.pan.y -= (mouseY / canvasState.zoom) * zoomDelta
  
  canvasState.zoom = newZoom
  
  console.log(`[Zoom] 缩放级别: ${(canvasState.zoom * 100).toFixed(0)}%`)
}

// ────────────────────────────────────────────────
// Connection Path Calculation - 使用DOM获取实际位置
// ────────────────────────────────────────────────
function getConnectionPath(conn: Connection): string {
  const fromNode = nodes.value.find(n => n.id === conn.from)
  const toNode = nodes.value.find(n => n.id === conn.to)
  if (!fromNode || !toNode) return ''
  
  // 尝试获取DOM元素的实际尺寸
  const fromEl = document.getElementById(fromNode.id)
  const toEl = document.getElementById(toNode.id)
  
  // 获取节点实际宽度和高度
  const fromWidth = fromEl?.offsetWidth || 230
  const fromHeight = fromEl?.offsetHeight || 100
  const toHeight = toEl?.offsetHeight || 100
  
  // 连接点偏移量（连接点在节点外面7px，连接点宽度14px，中心在7px处）
  const connectionPointOffset = 7
  
  // 输出连接点位置：节点右边界 + 连接点中心偏移
  const x1 = fromNode.x + fromWidth + connectionPointOffset
  const y1 = fromNode.y + fromHeight / 2
  
  // 输入连接点位置：节点左边界 - 连接点中心偏移
  const x2 = toNode.x - connectionPointOffset
  const y2 = toNode.y + toHeight / 2
  
  // 贝塞尔曲线
  const midX = (x1 + x2) / 2
  
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

function getTempConnectionPath(): string {
  if (!canvasState.connectionStart) return ''
  const fromNode = nodes.value.find(n => n.id === canvasState.connectionStart.nodeId)
  if (!fromNode) return ''
  
  // 获取DOM元素的实际尺寸
  const fromEl = document.getElementById(fromNode.id)
  const fromWidth = fromEl?.offsetWidth || 230
  const fromHeight = fromEl?.offsetHeight || 100
  
  // 连接点偏移量
  const connectionPointOffset = 7
  
  const x1 = fromNode.x + fromWidth + connectionPointOffset
  const y1 = fromNode.y + fromHeight / 2
  const x2 = canvasState.tempConnectionEnd.x
  const y2 = canvasState.tempConnectionEnd.y
  
  const midX = (x1 + x2) / 2
  
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
}

// 获取连接线的中点位置（用于显示删除按钮）
function getConnectionMidpoint(conn: Connection): { x: number; y: number } | null {
  const fromNode = nodes.value.find(n => n.id === conn.from)
  const toNode = nodes.value.find(n => n.id === conn.to)
  if (!fromNode || !toNode) return null
  
  // 获取DOM元素的实际尺寸
  const fromEl = document.getElementById(fromNode.id)
  const toEl = document.getElementById(toNode.id)
  const fromWidth = fromEl?.offsetWidth || 230
  const fromHeight = fromEl?.offsetHeight || 100
  const toHeight = toEl?.offsetHeight || 100
  
  const connectionPointOffset = 7
  
  const x1 = fromNode.x + fromWidth + connectionPointOffset
  const y1 = fromNode.y + fromHeight / 2
  const x2 = toNode.x - connectionPointOffset
  const y2 = toNode.y + toHeight / 2
  
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2
  }
}

// ────────────────────────────────────────────────
// Algorithm Menu Management
// ────────────────────────────────────────────────
// Algorithm Menu Management - 使用共享 composable
// ────────────────────────────────────────────────
function openAddMenuModal() {
  showAddMenuModal.value = true
  newMenuName.value = ''
  newMenuParent.value = null
}

function closeAddMenuModal() {
  showAddMenuModal.value = false
}

function addMenu() {
  if (!newMenuName.value.trim()) {
    showToast('请输入菜单名称', 'warning')
    return
  }

  const level = newMenuParent.value ? (findMenuById(algorithmMenus.value as any, newMenuParent.value)?.level || 0) + 1 : 0
  const userId = user.value?.id?.toString()
  addMenuToStore(newMenuName.value, newMenuParent.value, level, userId)
  closeAddMenuModal()
}

function openAddAlgorithmModal(menu: AlgorithmMenu) {
  selectedMenu.value = menu
  showAddAlgorithmModal.value = true
  newAlgorithmName.value = ''
  newAlgorithmDesc.value = ''
}

function closeAddAlgorithmModal() {
  showAddAlgorithmModal.value = false
  selectedMenu.value = null
}

async function addAlgorithm() {
  if (!newAlgorithmName.value.trim() || !selectedMenu.value) {
    showToast('请输入算法名称', 'warning')
    return
  }

  // 传入当前用户ID
  const userId = user.value?.id?.toString()
  
  // 检查算法名称是否重复
  const isDuplicate = await checkAlgorithmNameDuplicate(newAlgorithmName.value.trim(), userId)
  if (isDuplicate) {
    showToast('算法名称已存在，请使用其他名称', 'warning')
    return
  }
  
  const newAlgo = await addAlgorithmToStore(selectedMenu.value.id, newAlgorithmName.value, newAlgorithmDesc.value, userId)
  
  // 设置为当前算法
  if (newAlgo) {
    currentAlgorithm.value = newAlgo
    showToast(`算法 "${newAlgo.name}" 已创建`, 'success')
    
    // 创建新算法后自动清空画布并准备新工作流
    nodes.value = []
    connections.value = []
    nodeIdCounter.value = 0
    showToast(`已打开算法: ${newAlgo.name}（新建工作流）`, 'info')
    addLog('info', `打开算法: ${newAlgo.name}（新建工作流）`)
    
    closeAddAlgorithmModal()
  } else {
    // 如果创建失败（比如名称重复），不关闭模态框，让用户修改名称
    addLog('warning', '算法创建失败，请检查名称是否重复')
  }
}

// 创建新算法并清空画布
function createNewAlgorithm(menu: AlgorithmMenu) {
  selectedMenu.value = menu
  showNewAlgorithmModal.value = false
  showAddAlgorithmModal.value = true
  newAlgorithmName.value = ''
  newAlgorithmDesc.value = ''
}

// 关闭新建算法选择模态框
function closeNewAlgorithmModal() {
  showNewAlgorithmModal.value = false
}

async function saveWorkflowToBackend(workflow: any) {
  if (!currentAlgorithm.value) {
    throw new Error('没有当前算法')
  }

  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const response = await fetch(`${backendUrl}/api/algorithms/${currentAlgorithm.value.id}/workflow/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workflowData: workflow,
        name: currentAlgorithm.value.name,
        description: currentAlgorithm.value.description
      })
    })
    
    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.message || '保存到数据库失败')
    }
    
    return result
  } catch (error: any) {
    console.error('保存工作流到后端失败:', error)
    throw error
  }
}

// 保存当前工作流状态到rustfs系统
async function saveCurrentWorkflowState() {
  if (!currentAlgorithm.value) {
    console.warn('没有当前算法，跳过保存')
    return
  }

  try {
    const workflow = {
      nodes: nodes.value,
      connections: connections.value,
      metadata: {
        name: currentAlgorithm.value.name,
        algorithmId: currentAlgorithm.value.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
        autoSave: true // 标记为自动保存
      }
    }

    // 保存到本地存储
    const localKey = `workflow_${currentAlgorithm.value.id}`
    localStorage.setItem(localKey, JSON.stringify(workflow))

    // 保存到 rustfs 服务器
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const fileName = `workflow_${currentAlgorithm.value.id}_${Date.now()}.json`
    
    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('path', `/workflow/${currentAlgorithm.value.id}`)
    
    const response = await fetch('/api/rustfs/upload', {
      method: 'POST',
      body: formData
    })
    
    if (response.ok) {
      const result = await response.json()
      addLog('success', `自动保存工作流到服务器: ${result.path}`)
      console.log('工作流已自动保存到rustfs:', result.path)
    } else {
      throw new Error('自动保存到 rustfs 失败')
    }
  } catch (error) {
    console.warn('自动保存工作流失败:', error)
    addLog('warning', `自动保存失败: ${error.message}`)
  }
}

async function loadAlgorithm(algorithm: Algorithm) {
  try {
    // 如果当前有算法且有修改，先保存当前状态
    if (currentAlgorithm.value && (nodes.value.length > 0 || connections.value.length > 0)) {
      await saveCurrentWorkflowState()
    }
    
    // 设置当前算法
    currentAlgorithm.value = algorithm
    
    // 更新页面标题
    if (typeof document !== 'undefined') {
      document.title = `${algorithm.name} - AI工作流设计器`
    }
    
    // 更新URL参数但不触发页面刷新
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href)
      url.searchParams.set('algorithmId', algorithm.id)
      url.searchParams.delete('newWorkflow')
      url.searchParams.delete('menuId')
      url.searchParams.delete('menuName')
      window.history.replaceState({}, '', url.toString())
    }
    
    // 1. 优先从数据库加载工作流
    try {
      const runtimeConfig = useRuntimeConfig()
      const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
      
      const response = await fetch(`${backendUrl}/api/algorithms/${algorithm.id}/workflow`)
      
      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.data.workflowData) {
          const workflowData = result.data.workflowData
          nodes.value = workflowData.nodes || []
          connections.value = workflowData.connections || []
          
          // 同时保存到本地缓存
          const localKey = `workflow_${algorithm.id}`
          localStorage.setItem(localKey, JSON.stringify(workflowData))
          
          showToast(`已加载算法: ${algorithm.name}`, 'success')
          addLog('success', `加载算法: ${algorithm.name}（数据库版本）`)
          return
        }
      }
    } catch (error) {
      console.warn('从数据库加载工作流失败:', error)
      addLog('warning', `从数据库加载失败: ${error.message}`)
    }
    
    // 2. 尝试从本地存储加载
    const localKey = `workflow_${algorithm.id}`
    const savedWorkflow = localStorage.getItem(localKey)
    
    if (savedWorkflow) {
      try {
        const workflow = JSON.parse(savedWorkflow)
        nodes.value = workflow.nodes || []
        connections.value = workflow.connections || []
        showToast(`已加载算法: ${algorithm.name}`, 'success')
        addLog('success', `加载算法: ${algorithm.name}（本地版本）`)
        return
      } catch (error) {
        console.warn('解析本地工作流失败:', error)
      }
    }
    
    // 3. 尝试从 RustFS S3 对象存储库动态加载
    try {
      // 首先列出该算法目录下的所有文件
      const listResponse = await fetch(`/api/rustfs/list?path=/workflow/${algorithm.id}`)
      
      if (listResponse.ok) {
        const listResult = await listResponse.json()
        
        // 查找最新的工作流文件（支持多种命名格式）
        const workflowFiles = listResult.files?.filter((f: any) => 
          f.name.endsWith('.json') && 
          (f.name.includes('workflow') || f.name.includes('algorithm'))
        ) || []
        
        if (workflowFiles.length > 0) {
          // 按修改时间排序，获取最新的文件
          workflowFiles.sort((a: any, b: any) => 
            new Date(b.modifiedTime || b.uploadTime || 0).getTime() - 
            new Date(a.modifiedTime || a.uploadTime || 0).getTime()
          )
          
          const latestWorkflowFile = workflowFiles[0]
          
          // 下载并解析工作流文件
          const downloadResponse = await fetch(`/api/rustfs/download?path=${latestWorkflowFile.path}`)
          if (downloadResponse.ok) {
            const workflowData = await downloadResponse.json()
            
            // 验证工作流数据结构
            if (workflowData && typeof workflowData === 'object') {
              nodes.value = workflowData.nodes || []
              connections.value = workflowData.connections || []
              
              // 同时保存到本地缓存
              localStorage.setItem(localKey, JSON.stringify(workflowData))
              
              showToast(`已加载算法: ${algorithm.name}`, 'success')
              addLog('success', `加载算法: ${algorithm.name}（S3存储版本: ${latestWorkflowFile.name}）`)
              return
            } else {
              console.warn('工作流文件格式无效:', latestWorkflowFile.name)
            }
          }
        } else {
          console.log('未找到工作流文件，将创建空工作流')
        }
      }
    } catch (error) {
      console.warn('从 RustFS S3 加载失败:', error)
      addLog('warning', `从S3存储加载失败: ${error.message}`)
    }
    
    // 4. 如果都没有，创建空工作流
    nodes.value = []
    connections.value = []
    showToast(`已打开算法: ${algorithm.name}（新建工作流）`, 'info')
    addLog('info', `打开算法: ${algorithm.name}（新建工作流）`)
    
  } catch (error: any) {
    showToast('加载失败: ' + error.message, 'error')
    addLog('error', '加载失败: ' + error.message)
  }
}

// 根据算法ID加载算法
async function loadAlgorithmById(algorithmId: string) {
  try {
    // 在所有菜单中查找算法
    let foundAlgorithm: Algorithm | null = null
    
    function searchAlgorithm(menus: AlgorithmMenu[]): Algorithm | null {
      for (const menu of menus) {
        // 在当前菜单的算法中查找
        const algo = menu.algorithms.find(a => a.id === algorithmId || a.workflowId === algorithmId)
        if (algo) return algo
        
        // 在子菜单中递归查找
        if (menu.children.length > 0) {
          const found = searchAlgorithm(menu.children)
          if (found) return found
        }
      }
      return null
    }
    
    foundAlgorithm = searchAlgorithm(algorithmMenus.value as any)
    
    if (foundAlgorithm) {
      await loadAlgorithm(foundAlgorithm)
    } else {
      showToast(`未找到算法 ID: ${algorithmId}`, 'warning')
      addLog('warning', `未找到算法 ID: ${algorithmId}`)
    }
  } catch (error: any) {
    showToast('加载算法失败: ' + error.message, 'error')
    addLog('error', '加载算法失败: ' + error.message)
  }
}

// 收纳工作流
async function collapseWorkflow() {
  if (!currentAlgorithm.value) {
    showToast('请先选择一个算法', 'warning')
    return
  }
  
  try {
    // 保存当前工作流到服务器
    await saveWorkflow()
    
    // 清空画布
    nodes.value = []
    connections.value = []
    nodeIdCounter.value = 0
    
    showToast(`已收纳工作流: ${currentAlgorithm.value.name}`, 'success')
    addLog('success', `工作流已收纳: ${currentAlgorithm.value.name}`)
  } catch (error: any) {
    showToast('收纳失败: ' + error.message, 'error')
    addLog('error', '收纳失败: ' + error.message)
  }
}

// Workflow Management - 修复版本
// ────────────────────────────────────────────────
function exportWorkflow() {
  if (nodes.value.length === 0) {
    showToast('工作流为空，无法导出', 'warning')
    return
  }

  const workflow = {
    nodes: nodes.value,
    connections: connections.value,
    metadata: {
      name: currentAlgorithm.value?.name || '未命名工作流',
      algorithmId: currentAlgorithm.value?.id || null,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      createdBy: user.value?.username || '匿名用户',
      description: currentAlgorithm.value?.description || 'AI工作流导出'
    }
  }

  const json = JSON.stringify(workflow, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const filename = currentAlgorithm.value ? 
    `${currentAlgorithm.value.name}-${Date.now()}.json` :
    `workflow-${Date.now()}.json`
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  
  showToast('工作流已导出为JSON', 'success')
  addLog('success', `工作流已导出: ${filename}`)
}

// ────────────────────────────────────────────────
async function saveWorkflow() {
  // 如果没有当前算法，提示用户先创建算法
  if (!currentAlgorithm.value) {
    showToast('请先创建或选择一个算法', 'warning')
    showNewAlgorithmModal.value = true
    return
  }

  // 如果是临时算法（新建工作流），需要先创建正式算法
  if (currentAlgorithm.value.id.startsWith('temp_')) {
    showNewAlgorithmModal.value = true
    showToast('请先为工作流选择保存位置', 'info')
    return
  }

  // 设置保存状态，防止路由监听器干扰
  isSaving.value = true

  // 保存前记录当前状态，防止保存过程中被意外清空
  const currentNodes = [...nodes.value]
  const currentConnections = [...connections.value]
  
  console.log('保存前状态:', { 
    nodes: currentNodes.length, 
    connections: currentConnections.length,
    algorithmId: currentAlgorithm.value.id 
  })

  const workflow = {
    nodes: currentNodes,
    connections: currentConnections,
    metadata: {
      name: currentAlgorithm.value.name,
      algorithmId: currentAlgorithm.value.id,
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }
  }
  
  try {
    // 1. 优先保存到数据库
    let databaseSaved = false
    try {
      await saveWorkflowToBackend(workflow)
      databaseSaved = true
      addLog('success', `工作流已保存到数据库`)
    } catch (error) {
      console.warn('保存到数据库失败:', error)
      addLog('warning', `保存到数据库失败: ${error.message}`)
    }
    
    // 2. 保存到本地存储（作为缓存）
    const localKey = `workflow_${currentAlgorithm.value.id}`
    localStorage.setItem(localKey, JSON.stringify(workflow))
    
    // 3. 保存到 rustfs 服务器（作为备份）
    try {
      const json = JSON.stringify(workflow, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const fileName = `workflow_${currentAlgorithm.value.id}_${Date.now()}.json`
      
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('path', `/workflow/${currentAlgorithm.value.id}`)
      
      const response = await fetch('/api/rustfs/upload', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        const result = await response.json()
        addLog('success', `工作流已备份到服务器: ${result.path}`)
      } else {
        throw new Error('上传到 rustfs 失败')
      }
    } catch (error) {
      console.warn('保存到 rustfs 失败:', error)
      addLog('warning', `备份到服务器失败: ${error.message}`)
    }
    
    // 4. 检查保存后状态，如果被意外清空则恢复
    if (nodes.value.length === 0 && currentNodes.length > 0) {
      console.warn('检测到画布被意外清空，正在恢复...')
      nodes.value = currentNodes
      connections.value = currentConnections
      addLog('warning', '检测到画布被意外清空，已自动恢复')
      showToast('画布已自动恢复', 'info')
    }
    
    // 显示保存结果
    if (databaseSaved) {
      showToast(`算法 "${currentAlgorithm.value.name}" 已保存到数据库`, 'success')
      addLog('success', `算法 "${currentAlgorithm.value.name}" 已保存到数据库`)
    } else {
      showToast(`算法 "${currentAlgorithm.value.name}" 已保存到本地`, 'warning')
      addLog('warning', `算法 "${currentAlgorithm.value.name}" 仅保存到本地`)
    }
    
    console.log('保存后状态:', { 
      nodes: nodes.value.length, 
      connections: connections.value.length 
    })
    
  } catch (error: any) {
    // 如果保存过程中出现错误且画布被清空，恢复状态
    if (nodes.value.length === 0 && currentNodes.length > 0) {
      console.warn('保存失败且画布被清空，正在恢复...')
      nodes.value = currentNodes
      connections.value = currentConnections
      addLog('error', '保存失败，画布已自动恢复')
    }
    
    addLog('error', '保存失败: ' + error.message)
    showToast('保存失败: ' + error.message, 'error')
  } finally {
    // 清除保存状态
    isSaving.value = false
  }
}

function loadWorkflow() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workflow = JSON.parse(event.target?.result as string)
        nodes.value = workflow.nodes || []
        connections.value = workflow.connections || []
        addLog('success', '工作流已加载')
        showToast('工作流已加载', 'success')
      } catch (error) {
        addLog('error', '加载工作流失败')
        showToast('加载工作流失败', 'error')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

function clearCanvas() {
  if (window.confirm('确定要清空画布吗？')) {
    nodes.value = []
    connections.value = []
    selectedNode.value = null
    addLog('warning', '画布已清空')
    showToast('画布已清空', 'warning')
  }
}

function newWorkflow() {
  // 打开新建算法选择模态框
  showNewAlgorithmModal.value = true
}

// ────────────────────────────────────────────────
// Cache Management (使用优化的缓存系统)
// ────────────────────────────────────────────────
const WORKFLOW_CACHE_KEY = 'workflow_data'
const WORKFLOW_CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时

function loadFromLocalStorageOld() {
  try {
    // 从缓存系统加载工作流
    const cached = cacheManager.get<{
      nodes: any[]
      connections: any[]
      nodeIdCounter: number
      savedAt: number
    }>(WORKFLOW_CACHE_KEY)
    
    if (cached) {
      nodes.value = cached.nodes || []
      connections.value = cached.connections || []
      nodeIdCounter.value = cached.nodeIdCounter || 0
      addLog('success', `工作流已从缓存加载 (保存于 ${new Date(cached.savedAt).toLocaleString()})`)
      return
    }
    
    // 降级方案：从 localStorage 加载
    const savedNodes = localStorage.getItem('workflow_nodes')
    const savedConnections = localStorage.getItem('workflow_connections')
    const savedCounter = localStorage.getItem('workflow_nodeIdCounter')
    
    if (savedNodes) nodes.value = JSON.parse(savedNodes)
    if (savedConnections) connections.value = JSON.parse(savedConnections)
    if (savedCounter) nodeIdCounter.value = parseInt(savedCounter)
  } catch (error) {
    console.error('从本地存储加载失败:', error)
  }
}

// ────────────────────────────────────────────────
// Logging & Toast
// ────────────────────────────────────────────────
const toasts = ref<any[]>([])

function removeToast(id: number) {
  const index = toasts.value.findIndex(toast => toast.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

// ────────────────────────────────────────────────
// AI Workflow Creator
// ────────────────────────────────────────────────
function openAiCreator() {
  showAiCreatorModal.value = true
  aiWorkflowPrompt.value = ''
}

function closeAiCreator() {
  showAiCreatorModal.value = false
}

// ────────────────────────────────────────────────
// Knowledge Base Configuration
// ────────────────────────────────────────────────
function openKnowledgeBaseConfig() {
  showKnowledgeBaseModal.value = true
  loadKnowledgeBaseDocuments()
  // 加载用户的知识库列表
  loadMyKnowledgeBases()
}

function closeKnowledgeBaseConfig() {
  showKnowledgeBaseModal.value = false
  currentSelectedKB.value = null
}

// 处理知识库浏览器的选择事件
function handleKBSelect(kb: any) {
  currentSelectedKB.value = kb
  // 加载该知识库的文档
  if (kb && kb.id) {
    loadKBDocuments(kb.id)
  }
}

// 处理知识库浏览器的刷新事件
function handleKBRefresh() {
  loadMyKnowledgeBases()
  if (currentSelectedKB.value?.id) {
    // 清除缓存，强制重新加载
    delete selectedKBDocuments.value[currentSelectedKB.value.id]
    loadKBDocuments(currentSelectedKB.value.id)
  }
}

// 处理知识库浏览器的上传事件
function handleKBUpload() {
  // 触发文件选择
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  if (fileInput) {
    fileInput.click()
  }
}

// 处理知识库浏览器的预览事件
function handleKBPreview(doc: any) {
  previewDocument(doc)
}

// 处理知识库浏览器的删除事件
function handleKBDelete(doc: any) {
  // 从文档对象中获取知识库ID，如果没有则使用当前选中的知识库ID
  const kbId = doc.knowledge_base_id || doc.knowledgeBaseId || currentSelectedKB.value?.id
  deleteDocument(doc.id, kbId)
}

async function loadKnowledgeBaseDocuments() {
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    // 构建请求头，包含认证token
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // 如果有token，添加Authorization头
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases?mine=true`, {
      headers
    })
    
    if (response.ok) {
      const result = await response.json()
      // API returns { success: true, data: [...] }
      if (result.success && result.data) {
        knowledgeBaseDocuments.value = result.data
      } else {
        knowledgeBaseDocuments.value = []
      }
    } else {
      console.warn('加载知识库列表失败:', response.status)
      knowledgeBaseDocuments.value = []
    }
  } catch (error: any) {
    console.error('加载知识库列表失败:', error)
    knowledgeBaseDocuments.value = []
  }
}

async function uploadDocument(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return

  // 检查是否选择了知识库
  if (!currentSelectedKB.value?.id) {
    showToast('请先选择一个知识库', 'warning')
    return
  }

  isUploadingDocument.value = true
  
  try {
    const userId = user.value?.id || 'anonymous'
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    for (const file of Array.from(files)) {
      // 使用 FormData 上传到 RustFS
      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', `knowledgebase/${userId}`)
      
      // 使用当前选中的知识库ID
      formData.append('knowledgeBaseId', currentSelectedKB.value.id)
      
      // 上传到 RustFS
      const response = await fetch('/api/rustfs/upload', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        showToast(`文档 ${file.name} 上传成功`, 'success')
        
        // 触发后端向量化处理
        if (result.data?.key) {
          try {
            // 构建请求头，包含认证token
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            }
            if (token.value) {
              headers['Authorization'] = `Bearer ${token.value}`
            }
            
            // 调用后端API进行文档处理和向量化
            const vectorizeResponse = await fetch(`${backendUrl}/api/knowledge-bases/${currentSelectedKB.value.id}/documents/vectorize`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                fileKey: result.data.key,
                fileName: file.name,
                fileType: file.type
              })
            })
            
            if (vectorizeResponse.ok) {
              console.log('[KB] 文档向量化任务已提交')
            }
          } catch (vectorizeError) {
            console.warn('[KB] 向量化请求失败，文件已上传但未向量化:', vectorizeError)
          }
        }
      } else {
        showToast(`文档 ${file.name} 上传失败: ${result.message}`, 'error')
      }
    }
    
    // 刷新知识库文档列表
    if (currentSelectedKB.value?.id) {
      // 清除缓存，强制重新加载
      delete selectedKBDocuments.value[currentSelectedKB.value.id]
      await loadKBDocuments(currentSelectedKB.value.id)
    }
  } catch (error: any) {
    showToast('上传失败: ' + error.message, 'error')
  } finally {
    isUploadingDocument.value = false
    // 清空文件输入
    const fileInput = event.target as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }
}

async function deleteDocument(docId: string, kbId?: string) {
  if (!confirm('确定要删除这个文档吗？')) return
  
  // 使用传入的kbId，或者从当前选中的知识库获取
  const knowledgeBaseId = kbId || currentSelectedKB.value?.id
  if (!knowledgeBaseId) {
    showToast('无法确定知识库ID', 'error')
    return
  }
  
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases/${knowledgeBaseId}/documents/${docId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token.value ? { 'Authorization': `Bearer ${token.value}` } : {})
      }
    })
    
    if (response.ok) {
      showToast('文档删除成功', 'success')
      // 刷新当前选中知识库的文档列表
      delete selectedKBDocuments.value[knowledgeBaseId]
      await loadKBDocuments(knowledgeBaseId)
    } else {
      const result = await response.json().catch(() => ({}))
      showToast(result.message || '文档删除失败', 'error')
    }
  } catch (error: any) {
    showToast('删除失败: ' + error.message, 'error')
  }
}

async function testKnowledgeBase() {
  if (!kbTestQuery.value.trim()) {
    showToast('请输入测试问题', 'warning')
    return
  }

  isTestingKB.value = true
  
  try {
    // 使用当前选中的知识库进行搜索
    const kbId = currentSelectedKB.value?.id
    if (!kbId) {
      showToast('请先选择一个知识库', 'warning')
      isTestingKB.value = false
      return
    }
    
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    // 使用向量搜索端点
    const response = await fetch(`${backendUrl}/api/knowledge-bases/${kbId}/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: kbTestQuery.value,
        topK: 3
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      const docs = result.results || result.data || []
      
      if (docs.length === 0) {
        kbTestResult.value = '未找到相关文档'
      } else {
        kbTestResult.value = `找到 ${docs.length} 个相关文档：\n` + 
          docs.map((doc: any, index: number) => 
            `${index + 1}. ${doc.title || doc.filename || doc.name}\n${(doc.content || doc.text || '').substring(0, 100)}...`
          ).join('\n\n')
      }
    } else {
      const errorResult = await response.json().catch(() => ({}))
      showToast(errorResult.message || '检索失败', 'error')
    }
  } catch (error: any) {
    showToast('检索失败: ' + error.message, 'error')
  } finally {
    isTestingKB.value = false
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(timestamp: string | number | null | undefined): string {
  if (!timestamp) return '未知日期'
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return '无效日期'
    return date.toLocaleDateString('zh-CN')
  } catch (e) {
    return '无效日期'
  }
}

// 文档预览和编辑功能
async function previewDocument(doc: any) {
  try {
    selectedDocument.value = doc
    showToast('正在加载文档内容...', 'info')
    
    // 从文档对象中获取知识库ID，如果没有则使用当前选中的知识库ID
    const kbId = doc.knowledge_base_id || doc.knowledgeBaseId || currentSelectedKB.value?.id
    if (!kbId) {
      showToast('无法确定知识库ID', 'error')
      return
    }
    
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases/${kbId}/documents/${doc.id}/preview`, {
      headers
    })
    if (response.ok) {
      const result = await response.json()
      // 后端返回的数据结构是 { success: true, data: { preview: "...", ... } }
      if (result.success && result.data) {
        documentPreview.value = result.data.preview || result.data.content || ''
        // 更新文档对象，添加从API返回的额外信息
        if (result.data.name) selectedDocument.value.name = result.data.name
        if (result.data.originalName) selectedDocument.value.originalName = result.data.originalName
        if (result.data.fileSize) selectedDocument.value.size = result.data.fileSize
        if (result.data.fileType) selectedDocument.value.fileType = result.data.fileType
        documentEditContent.value = documentPreview.value
        showDocumentPreview.value = true
      } else {
        documentPreview.value = '文档内容为空'
        documentEditContent.value = ''
        showToast('文档内容为空', 'warning')
      }
    } else {
      const errorResult = await response.json().catch(() => ({}))
      showToast(errorResult.message || '加载文档失败', 'error')
      documentPreview.value = '加载失败'
      documentEditContent.value = ''
    }
  } catch (error: any) {
    showToast('加载文档失败: ' + error.message, 'error')
  }
}

function startEditDocument() {
  isEditingDocument.value = true
  documentEditContent.value = documentPreview.value
}

function cancelEditDocument() {
  isEditingDocument.value = false
  documentEditContent.value = documentPreview.value
}

async function saveDocumentEdit() {
  if (!selectedDocument.value) return
  
  // 从文档对象中获取知识库ID，如果没有则使用当前选中的知识库ID
  const kbId = selectedDocument.value.knowledge_base_id || selectedDocument.value.knowledgeBaseId || currentSelectedKB.value?.id
  if (!kbId) {
    showToast('无法确定知识库ID', 'error')
    return
  }
  
  try {
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }
    
    const response = await fetch(`${backendUrl}/api/knowledge-bases/${kbId}/documents/${selectedDocument.value.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        content: documentEditContent.value
      })
    })
    
    if (response.ok) {
      documentPreview.value = documentEditContent.value
      isEditingDocument.value = false
      showToast('文档已更新', 'success')
    } else {
      showToast('更新文档失败', 'error')
    }
  } catch (error: any) {
    showToast('更新文档失败: ' + error.message, 'error')
  }
}

function closeDocumentPreview() {
  showDocumentPreview.value = false
  isEditingDocument.value = false
  selectedDocument.value = null
  documentPreview.value = ''
  documentEditContent.value = ''
}

// ────────────────────────────────────────────────
// Utility Functions
// ────────────────────────────────────────────────
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function formatDetailedTime(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hours}:${minutes}:${seconds}`
}

// ────────────────────────────────────────────────
// Navigation - 导航功能
// ────────────────────────────────────────────────

function goBackToChat() {
  // 直接返回到创作者操作台
  router.push('/creator/workstation')
}

// ────────────────────────────────────────────────
// Workflow Execution - 执行功能
// ────────────────────────────────────────────────
async function executeWorkflow() {
  if (nodes.value.length === 0) {
    showToast('工作流为空，无法执行', 'warning')
    return
  }

  // 设置执行状态和光标
  isExecuting.value = true
  document.body.style.cursor = 'wait'
  executionResult.value = null // 清空之前的结果

  showToast('开始执行工作流...', 'info')
  addLog('info', '开始执行工作流...')

  try {
    // 验证工作流
    const validation = validateWorkflow()
    if (!validation.valid) {
      showToast('工作流验证失败', 'error')
      validation.errors.forEach(err => addLog('error', err))
      return
    }

    // 按拓扑顺序执行节点
    const executionOrder = getExecutionOrder()
    const results = new Map<string, any>()

    for (const nodeId of executionOrder) {
      const node = nodes.value.find(n => n.id === nodeId)
      if (!node) continue

      addLog('info', `执行节点: ${NODE_TYPES[node.type]?.title}`)
      
      try {
        // 标记节点为运行状态
        setNodeStatus(nodeId, 'running')
        const nodeEl = document.getElementById(nodeId)
        if (nodeEl) {
          nodeEl.classList.add('running')
        }

        const result = await executeNode(node, results)
        results.set(nodeId, result)
        
        // 如果是输出节点，存储输出结果
        if (node.type === 'output-text') {
          nodeOutputs.value[nodeId] = result
        }
        
        // 显示成功状态
        setNodeStatus(nodeId, 'success')
        if (nodeEl) {
          nodeEl.classList.remove('running')
          nodeEl.style.borderColor = '#10b981'
        }
        
        addLog('success', `节点执行成功: ${nodeId}`)
      } catch (error: any) {
        // 显示错误状态
        setNodeStatus(nodeId, 'error')
        const nodeEl = document.getElementById(nodeId)
        if (nodeEl) {
          nodeEl.classList.remove('running')
          nodeEl.style.borderColor = '#ef4444'
        }
        
        addLog('error', `节点执行失败: ${error.message}`)
        throw error
      }
    }

    // 收集执行结果
    executionResult.value = {
      success: true,
      timestamp: new Date().toISOString(),
      results: Array.from(results.entries()).map(([nodeId, result]) => ({
        nodeId,
        nodeName: nodes.value.find(n => n.id === nodeId)?.type,
        result
      }))
    }

    showToast('工作流执行完成', 'success')
    addLog('success', '工作流执行完成')
    
    // 清除所有节点的运行状态（延迟2秒后）
    setTimeout(() => {
      nodes.value.forEach(node => {
        setNodeStatus(node.id, 'idle')
        const nodeEl = document.getElementById(node.id)
        if (nodeEl) {
          nodeEl.classList.remove('running')
          nodeEl.style.borderColor = ''
        }
      })
    }, 2000)
  } catch (error: any) {
    showToast('执行失败: ' + error.message, 'error')
    addLog('error', '执行失败: ' + error.message)
    
    // 记录错误结果
    executionResult.value = {
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    }
  } finally {
    // 恢复光标
    isExecuting.value = false
    document.body.style.cursor = ''
  }
}

function validateWorkflow() {
  const errors: string[] = []
  const warnings: string[] = []

  // 检查是否有节点
  if (nodes.value.length === 0) {
    errors.push('工作流中没有节点')
  }

  // 检查循环依赖
  const cycles = detectCycles()
  if (cycles.length > 0) {
    errors.push('检测到循环依赖')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

function detectCycles(): string[][] {
  const graph = new Map<string, string[]>()
  
  nodes.value.forEach(node => {
    graph.set(node.id, [])
  })
  
  connections.value.forEach(conn => {
    const neighbors = graph.get(conn.from) || []
    neighbors.push(conn.to)
    graph.set(conn.from, neighbors)
  })

  const cycles: string[][] = []
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(nodeId: string, path: string[] = []): boolean {
    visited.add(nodeId)
    recStack.add(nodeId)
    path.push(nodeId)

    const neighbors = graph.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path])) {
          return true
        }
      } else if (recStack.has(neighbor)) {
        cycles.push([...path, neighbor])
        return true
      }
    }

    recStack.delete(nodeId)
    return false
  }

  nodes.value.forEach(node => {
    if (!visited.has(node.id)) {
      dfs(node.id)
    }
  })

  return cycles
}

function getExecutionOrder(): string[] {
  const graph = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  
  nodes.value.forEach(node => {
    graph.set(node.id, [])
    inDegree.set(node.id, 0)
  })
  
  connections.value.forEach(conn => {
    const neighbors = graph.get(conn.from) || []
    neighbors.push(conn.to)
    graph.set(conn.from, neighbors)
    inDegree.set(conn.to, (inDegree.get(conn.to) || 0) + 1)
  })

  const queue: string[] = []
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId)
    }
  })

  const order: string[] = []
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    order.push(nodeId)

    const neighbors = graph.get(nodeId) || []
    neighbors.forEach(neighbor => {
      const degree = inDegree.get(neighbor)! - 1
      inDegree.set(neighbor, degree)
      if (degree === 0) {
        queue.push(neighbor)
      }
    })
  }

  return order
}

async function executeNode(node: Node, previousResults: Map<string, any>): Promise<any> {
  const nodeType = NODE_TYPES[node.type]
  if (!nodeType) {
    throw new Error(`未知节点类型: ${node.type}`)
  }

  // 获取输入数据
  const inputs = getNodeInputs(node, previousResults)

  // 根据节点类型执行
  if (node.type.startsWith('llm-') && node.type !== 'llm-filter') {
    return await executeLLMNode(node, inputs)
  } else if (node.type === 'llm-filter') {
    return await executeLLMFilterNode(node, inputs)
  } else if (node.type === 'file-upload') {
    return await executeFileUploadNode(node, inputs)
  } else if (node.type === 'local-image-upload') {
    return await executeLocalImageUploadNode(node, inputs)
  } else if (node.type === 'image-to-video') {
    return await executeImageToVideoNode(node, inputs)
  } else if (node.type === 'video-understanding') {
    return await executeVideoUnderstandingNode(node, inputs)
  } else if (node.type === 'kb-assistant') {
    return await executeKBAssistantNode(node, inputs)
  } else if (node.type === 'rag-workflow') {
    return await executeRAGWorkflowNode(node, inputs)
  } else if (node.type === 'input-text') {
    return node.config.defaultValue || ''
  } else if (node.type === 'output-text') {
    console.log('Output:', inputs)
    return inputs
  } else if (node.type === 'code-js') {
    return executeJavaScriptNode(node, inputs)
  }

  return null
}

function getNodeInputs(node: Node, previousResults: Map<string, any>): any {
  const inputConnections = connections.value.filter(c => c.to === node.id)
  if (inputConnections.length === 0) {
    return null
  }

  const inputs: any = {}
  inputConnections.forEach(conn => {
    const result = previousResults.get(conn.from)
    inputs[conn.from] = result
  })

  return Object.keys(inputs).length === 1 ? Object.values(inputs)[0] : inputs
}

async function executeLLMNode(node: Node, inputs: any): Promise<string> {
  const prompt = typeof inputs === 'string' ? inputs : JSON.stringify(inputs)
  
  const response = await fetch(`${apiConfig.endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiConfig.apiKey}`
    },
    body: JSON.stringify({
      model: node.config.model || apiConfig.defaultModel,
      messages: [
        { role: 'system', content: node.config.systemPrompt || '你是一个有帮助的AI助手。' },
        { role: 'user', content: prompt }
      ],
      temperature: node.config.temperature || 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`LLM请求失败: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

function executeJavaScriptNode(node: Node, inputs: any): any {
  try {
    const func = new Function('input', node.config.code)
    return func(inputs)
  } catch (error: any) {
    throw new Error(`JavaScript执行失败: ${error.message}`)
  }
}

async function executeRAGWorkflowNode(node: Node, inputs: any): Promise<string> {
  try {
    // 获取查询输入
    const query = typeof inputs === 'string' ? inputs : JSON.stringify(inputs)
    
    if (!query || query.trim() === '') {
      return '请提供查询内容'
    }
    
    // 构建RAG查询消息
    const messages = [
      { 
        role: 'system', 
        content: node.config.systemPrompt || '你是一个专业的知识库助手，请基于提供的知识库内容回答用户问题。' 
      },
      { 
        role: 'user', 
        content: query 
      }
    ]
    
    // 调用LLM API
    const response = await fetch(`${apiConfig.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: node.config.model || apiConfig.defaultModel,
        messages: messages,
        temperature: node.config.temperature || 0.7,
        max_tokens: node.config.maxTokens || 2000,
        top_k: node.config.topK || 3
      })
    })

    if (!response.ok) {
      throw new Error(`RAG查询失败: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (error: any) {
    throw new Error(`RAG工作流节点执行失败: ${error.message}`)
  }
}

async function executeFileUploadNode(node: Node, inputs: any): Promise<any> {
  try {
    // 获取用户ID
    const userId = user.value?.id || 'anonymous'
    
    // 替换路径中的占位符
    const uploadPath = node.config.uploadPath.replace('{userId}', userId)
    
    // 检查输入是否为文件对象
    if (!inputs || typeof inputs !== 'object' || !inputs.file) {
      throw new Error('请提供有效的文件输入')
    }
    
    // 创建FormData
    const formData = new FormData()
    formData.append('file', inputs.file)
    formData.append('path', uploadPath)
    
    // 上传到rustfs服务器
    const response = await fetch('/api/rustfs/upload', {
      method: 'POST',
      body: formData
    })
    
    if (!response.ok) {
      throw new Error(`文件上传失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    // 返回文件URL和文件名
    return {
      fileUrl: result.url || result.path,
      fileName: inputs.file.name || 'unknown'
    }
  } catch (error: any) {
    throw new Error(`文件上传节点执行失败: ${error.message}`)
  }
}

async function executeLocalImageUploadNode(node: Node, inputs: any): Promise<any> {
  try {
    // 检查输入是否为图片文件
    if (!inputs || typeof inputs !== 'object' || !inputs.file) {
      throw new Error('请提供有效的图片文件')
    }
    
    // 验证文件类型
    const allowedTypes = node.config.allowedTypes || ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(inputs.file.type)) {
      throw new Error(`不支持的文件类型: ${inputs.file.type}`)
    }
    
    // 压缩和调整图片尺寸
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          // 计算新尺寸
          let { width, height } = img
          const maxWidth = node.config.maxWidth || 1920
          const maxHeight = node.config.maxHeight || 1080
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height)
            width *= ratio
            height *= ratio
          }
          
          canvas.width = width
          canvas.height = height
          
          // 绘制压缩后的图片
          ctx?.drawImage(img, 0, 0, width, height)
          
          // 转换为Blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              throw new Error('图片处理失败')
            }
            
            // 上传到rustfs服务器
            const userId = user.value?.id || 'anonymous'
            const uploadPath = `user/${userId}/images`
            
            const formData = new FormData()
            formData.append('file', blob, inputs.file.name)
            formData.append('path', uploadPath)
            
            const response = await fetch('/api/rustfs/upload', {
              method: 'POST',
              body: formData
            })
            
            if (!response.ok) {
              throw new Error(`图片上传失败: ${response.statusText}`)
            }
            
            const result = await response.json()
            
            resolve({
              imageUrl: result.url || result.path,
              imageName: inputs.file.name || 'unknown',
              width: width,
              height: height
            })
          }, 'image/jpeg', node.config.quality || 0.8)
        } catch (error) {
          reject(error)
        }
      }
      
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = URL.createObjectURL(inputs.file)
    })
  } catch (error: any) {
    throw new Error(`本地上传图片节点执行失败: ${error.message}`)
  }
}

async function executeImageToVideoNode(node: Node, inputs: any): Promise<any> {
  try {
    // 获取图片URL
    const imageUrl = typeof inputs === 'string' ? inputs : inputs.imageUrl
    
    if (!imageUrl) {
      throw new Error('请提供有效的图片URL')
    }
    
    // 调用图片转视频API
    const response = await fetch('/api/video/generate-from-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: imageUrl,
        duration: node.config.duration || 5,
        fps: node.config.fps || 30,
        quality: node.config.quality || 'high',
        model: node.config.model || 'stable-video-diffusion'
      })
    })
    
    if (!response.ok) {
      throw new Error(`图片转视频失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    return {
      videoUrl: result.videoUrl,
      duration: result.duration,
      fps: result.fps
    }
  } catch (error: any) {
    throw new Error(`图片转视频节点执行失败: ${error.message}`)
  }
}

async function executeVideoUnderstandingNode(node: Node, inputs: any): Promise<string> {
  try {
    // 获取视频URL和查询
    let videoUrl, query
    
    if (typeof inputs === 'string') {
      videoUrl = inputs
      query = '请分析这个视频的内容'
    } else if (typeof inputs === 'object') {
      videoUrl = inputs.videoUrl
      query = inputs.query || '请分析这个视频的内容'
    } else {
      throw new Error('请提供有效的视频URL和查询内容')
    }
    
    if (!videoUrl) {
      throw new Error('请提供有效的视频URL')
    }
    
    // 构建分析请求
    const response = await fetch('/api/video/understand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        videoUrl: videoUrl,
        query: query,
        model: node.config.model || 'gpt-5-nano',
        ultrathink: node.config.ultrathink !== false,
        temperature: node.config.temperature || 0.1,
        maxTokens: node.config.maxTokens || 4000
      })
    })
    
    if (!response.ok) {
      throw new Error(`视频理解失败: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    return result.analysis || result.content
  } catch (error: any) {
    throw new Error(`视频理解节点执行失败: ${error.message}`)
  }
}

async function executeKBAssistantNode(node: Node, inputs: any): Promise<any> {
  try {
    // 获取查询输入
    const query = typeof inputs === 'string' ? inputs : JSON.stringify(inputs)
    
    if (!query || query.trim() === '') {
      return {
        response: '请提供查询内容',
        sources: []
      }
    }
    
    // 获取配置的知识库ID和选中的文档ID
    const knowledgeBaseId = node.config.knowledgeBaseId
    const selectedDocIds = node.config.selectedDocIds || []
    
    // 检查是否选择了知识库
    if (!knowledgeBaseId) {
      return {
        response: '请先选择一个知识库',
        sources: []
      }
    }
    
    const runtimeConfig = useRuntimeConfig()
    const backendUrl = runtimeConfig.public.backendUrl || 'http://localhost:8090'
    
    let context = ''
    let relevantDocs: any[] = []
    
    // 如果选择了特定文档，直接获取这些文档的内容
    if (selectedDocIds.length > 0) {
      addLog('info', `正在获取 ${selectedDocIds.length} 个选中文档的内容...`)
      
      // 获取选中文档的内容
      const docContents: string[] = []
      for (const docId of selectedDocIds) {
        try {
          const docResponse = await fetch(`${backendUrl}/api/knowledge-bases/${knowledgeBaseId}/documents/${docId}/content`, {
            headers: { 'Content-Type': 'application/json' }
          })
          
          if (docResponse.ok) {
            const docResult = await docResponse.json()
            if (docResult.success && docResult.data) {
              const docContent = docResult.data.content || ''
              const docName = docResult.data.name || docResult.data.original_name || '未知文档'
              docContents.push(`【${docName}】\n${docContent}`)
              relevantDocs.push({
                id: docId,
                title: docName,
                content: docContent,
                score: 1.0
              })
            }
          }
        } catch (docError) {
          console.warn(`获取文档 ${docId} 内容失败:`, docError)
        }
      }
      
      if (docContents.length === 0) {
        return {
          response: '无法获取选中文档的内容，请检查文档是否存在',
          sources: []
        }
      }
      
      context = docContents.join('\n\n---\n\n')
      addLog('success', `成功获取 ${docContents.length} 个文档内容`)
    } else {
      // 没有选择特定文档，使用向量搜索
      addLog('info', `正在知识库 ${knowledgeBaseId} 中搜索相关内容...`)
      
      const searchResponse = await fetch(`${backendUrl}/api/vector-search/knowledge-bases/${knowledgeBaseId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          topK: node.config.topK || 3,
          threshold: 0.5,
          useCache: true,
          includeMetadata: true
        })
      })
      
      if (!searchResponse.ok) {
        throw new Error('知识库检索失败')
      }
      
      const searchResult = await searchResponse.json()
      relevantDocs = searchResult.data?.results || searchResult.results || []
      
      if (relevantDocs.length === 0) {
        return {
          response: '在知识库中未找到相关信息，请尝试其他查询或选择特定文档',
          sources: []
        }
      }
      
      context = relevantDocs.map((doc: any) => doc.content || doc.preview || '').join('\n\n')
      addLog('success', `找到 ${relevantDocs.length} 个相关内容片段`)
    }
    
    // 调用LLM生成回答
    const messages = [
      { 
        role: 'system', 
        content: node.config.systemPrompt || '你是一个专业的知识库助手，请基于提供的知识库内容回答用户问题。如果知识库内容无法回答问题，请明确说明。' 
      },
      { 
        role: 'system', 
        content: `参考以下知识库内容回答问题：\n\n${context}` 
      },
      { 
        role: 'user', 
        content: query 
      }
    ]
    
    addLog('info', '正在调用LLM生成回答...')
    
    const llmResponse = await fetch(`${apiConfig.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: node.config.model || apiConfig.defaultModel,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    })
    
    if (!llmResponse.ok) {
      throw new Error('LLM调用失败')
    }
    
    const llmResult = await llmResponse.json()
    const response = llmResult.choices[0].message.content
    
    addLog('success', '知识库助手回答生成完成')
    
    // 构建返回结果
    const result = {
      response: response,
      sources: node.config.enableSources ? relevantDocs.map((doc: any) => ({
        id: doc.id || doc.chunkId,
        title: doc.title || doc.filename || doc.metadata?.documentName || '未知来源',
        snippet: (doc.content || doc.preview || '').substring(0, 200) + '...',
        score: doc.score || doc.similarity || 0
      })) : []
    }
    
    return result
  } catch (error: any) {
    throw new Error(`知识库助手节点执行失败: ${error.message}`)
  }
}

async function generateWorkflowWithAI() {
  if (!aiWorkflowPrompt.value.trim()) {
    showToast('请描述您想要的工作流', 'warning')
    return
  }

  // 检查是否有现有节点，如果有则确认清空
  if (nodes.value.length > 0) {
    if (!window.confirm('生成新工作流将清空当前画布，是否继续？')) {
      return
    }
  }

  // 设置生成状态
  isGeneratingWorkflow.value = true
  aiGenerationProgress.value = 0
  
  showToast('正在生成工作流...', 'info')
  addLog('info', 'AI正在生成工作流...')

  // 模拟进度更新
  const progressInterval = setInterval(() => {
    if (aiGenerationProgress.value < 90) {
      aiGenerationProgress.value += Math.random() * 10
    }
  }, 500)

  const systemPrompt = `你是一个工作流设计专家。根据用户的描述，生成一个JSON格式的工作流配置。
可用的节点类型：
- llm-deepseek: DeepSeek V3大语言模型，用于文本生成和对话
- llm-gemini: Gemini Flash大语言模型
- nlp-semantic: NLP语义分析
- personality-analysis: 人格分析
- algo-latex-ai: LaTeX公式生成
- algo-formula: 公式执行
- algo-chart: 图表可视化
- rag-upload: 文档上传节点，用于创建知识库
- rag-query: 知识检索节点，用于RAG检索
- input-text: 文本输入节点
- output-text: 文本输出节点
- output-save: 保存结果到文件
- code-js: JavaScript代码执行节点
- code-cmd: CMD命令执行节点
- condition: 条件判断节点
- memory: 对话记忆节点

请返回一个JSON对象，格式如下：
{
    "nodes": [
        {
            "id": "node_1",
            "type": "节点类型",
            "x": x坐标(建议间隔300),
            "y": y坐标(建议100-200),
            "config": { 节点配置 }
        }
    ],
    "connections": [
        {
            "id": "conn_1",
            "from": "源节点id",
            "to": "目标节点id"
        }
    ]
}

只返回JSON，不要其他解释。`

  try {
    aiGenerationProgress.value = 20
    
    const response = await fetch(`${apiConfig.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: aiCreatorModel.value,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: aiWorkflowPrompt.value }
        ],
        temperature: 0.7
      })
    })

    aiGenerationProgress.value = 60

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }

    const data = await response.json()
    aiGenerationProgress.value = 80
    
    let workflowJson = data.choices[0].message.content

    // 提取JSON
    const jsonMatch = workflowJson.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      workflowJson = jsonMatch[0]
    }

    const workflow = JSON.parse(workflowJson)
    aiGenerationProgress.value = 90

    // 清空当前画布
    nodes.value = []
    connections.value = []

    // 应用生成的工作流
    nodes.value = workflow.nodes || []
    connections.value = workflow.connections || []
    
    // 更新节点计数器
    const maxId = Math.max(...nodes.value.map(n => parseInt(n.id.split('_')[1]) || 0), 0)
    nodeIdCounter.value = maxId

    // 确保节点配置完整
    nodes.value.forEach(node => {
      if (NODE_TYPES[node.type]) {
        node.config = { ...NODE_TYPES[node.type].config, ...node.config }
      }
    })

    aiGenerationProgress.value = 100
    
    saveToLocalStorage()
    closeAiCreator()
    showToast('工作流已生成', 'success')
    addLog('success', 'AI工作流生成完成')

  } catch (error: any) {
    showToast('生成失败: ' + error.message, 'error')
    addLog('error', 'AI工作流生成失败: ' + error.message)
  } finally {
    clearInterval(progressInterval)
    isGeneratingWorkflow.value = false
    aiGenerationProgress.value = 0
  }
}

// ────────────────────────────────────────────────
// Chat
// ────────────────────────────────────────────────
async function sendMessage() {
  if (!chatInput.value.trim()) return
  
  const message = chatInput.value.trim()
  
  // 添加用户消息
  chatMessages.value.push({
    role: 'user',
    content: message
  })
  
  chatInput.value = ''
  
  // 添加加载消息
  const loadingIndex = chatMessages.value.length
  chatMessages.value.push({
    role: 'assistant',
    content: '正在思考中...',
    isLoading: true
  })
  
  try {
    // 调用AI API
    const response = await fetch(`${apiConfig.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.defaultModel,
        messages: [
          { role: 'system', content: '你是一个有帮助的AI助手，专门帮助用户设计和理解工作流。' },
          ...chatMessages.value.filter(m => !m.isLoading).map(m => ({
            role: m.role,
            content: m.content
          }))
        ],
        temperature: apiConfig.temperature,
        stream: true
      })
    })
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`)
    }
    
    // 处理流式响应
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullReply = ''
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const json = JSON.parse(line.slice(6))
              const content = json.choices?.[0]?.delta?.content || ''
              
              if (content) {
                fullReply += content
                // 更新消息内容
                chatMessages.value[loadingIndex] = {
                  role: 'assistant',
                  content: fullReply,
                  isLoading: false
                }
              }
            } catch (e) {
              console.log('解析流式数据错误:', e)
            }
          }
        }
      }
    }
    
    // 确保最终消息已更新
    if (fullReply) {
      chatMessages.value[loadingIndex] = {
        role: 'assistant',
        content: fullReply,
        isLoading: false
      }
    } else {
      // 如果没有流式响应，使用普通响应
      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || '抱歉，我无法回答这个问题。'
      chatMessages.value[loadingIndex] = {
        role: 'assistant',
        content: reply,
        isLoading: false
      }
    }
    
    addLog('success', 'AI回复完成')
    
  } catch (error: any) {
    chatMessages.value[loadingIndex] = {
      role: 'assistant',
      content: `错误: ${error.message}`,
      isError: true
    }
    addLog('error', `聊天错误: ${error.message}`)
    showToast('AI回复失败: ' + error.message, 'error')
  }
}

// ────────────────────────────────────────────────
// Tab Switching
// ────────────────────────────────────────────────
function switchTab(tab: string) {
  activeTab.value = tab
}

// ────────────────────────────────────────────────
// Lifecycle - 优化版本
// ────────────────────────────────────────────────
onMounted(() => {
  // 初始化 canvas-container 元素引用
  nextTick(() => {
    canvasContainerElement = document.getElementById('canvas-container')
  })
  
  document.addEventListener('mousemove', handleCanvasMouseMove, { passive: true })
  document.addEventListener('mouseup', handleCanvasMouseUp)
  
  // 添加侧边栏调整大小的事件监听器
  document.addEventListener('mousemove', handleResizeMove)
  document.addEventListener('mouseup', handleResizeEnd)
  
  // 延迟加载缓存数据，避免阻塞渲染
  requestAnimationFrame(() => {
    loadFromLocalStorage()
    
    // Add example nodes if empty
    if (nodes.value.length === 0) {
      createNode('input-text', 100, 100)
      createNode('llm-deepseek', 400, 100)
      createNode('output-text', 700, 100)
    }
  })
  
  // 启动自动保存定时器（每5分钟）
  autoSaveInterval = setInterval(async () => {
    if (currentAlgorithm.value && (nodes.value.length > 0 || connections.value.length > 0)) {
      console.log('[AutoSave] 开始自动保存工作流...')
      await saveCurrentWorkflowState()
      showToast('工作流已自动保存', 'info')
    }
  }, AUTO_SAVE_INTERVAL)
  console.log('[AutoSave] 自动保存定时器已启动，间隔: 5分钟')
  
  // 监听窗口大小变化，使用防抖优化
  const debouncedResize = debounce(() => {
    // 触发重新渲染
    const temp = [...connections.value]
    connections.value = []
    nextTick(() => {
      connections.value = temp
    })
  }, 300)
  
  window.addEventListener('resize', debouncedResize)
  
  // 清理函数
  onUnmounted(() => {
    window.removeEventListener('resize', debouncedResize)
  })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleCanvasMouseMove)
  document.removeEventListener('mouseup', handleCanvasMouseUp)
  
  // 移除侧边栏调整大小的事件监听器
  document.removeEventListener('mousemove', handleResizeMove)
  document.removeEventListener('mouseup', handleResizeEnd)
  
  // 移除键盘事件监听器
  if (handleKeyDown) {
    document.removeEventListener('keydown', handleKeyDown)
    console.log('[Keyboard] 快捷键已移除')
  }
  
  // 清理自动保存定时器
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
    console.log('[AutoSave] 自动保存定时器已清理')
  }
  
  // 清理缓存清理定时器
  if (cacheCleanupTimer) {
    clearInterval(cacheCleanupTimer)
    cacheCleanupTimer = null
    console.log('[Cache] 缓存清理定时器已清理')
  }
  
  // 清理渲染缓存
  renderCache.value.clear()
  console.log('[Cache] 渲染缓存已清理')
  
  // 终止 Worker
  if (workflowWorker) {
    workflowWorker.terminate()
    console.log('[Performance] Workflow worker terminated')
  }
})

// 监听节点和连接变化，使用防抖优化重新渲染
const debouncedConnectionUpdate = debounce(() => {
  nextTick(() => {
    connections.value = [...connections.value]
  })
}, 100)

// 监听节点变化，触发边界重新计算
watch([nodes, () => canvasState.zoom], () => {
  // 节点位置或缩放变化时，边界会自动重新计算（computed 属性）
  // 这里可以添加额外的逻辑，比如自动调整视图
  debouncedConnectionUpdate()
}, { deep: true })

watch([connections, () => canvasState.zoom, () => canvasState.pan], () => {
  debouncedConnectionUpdate()
}, { deep: true })
</script>

<template>
  <div class="workflow-designer">
    <!-- Header - 居中显示 -->
    <header class="header-centered">
      <!-- 左上角返回按钮 -->
      <div class="header-back">
        <button class="btn-back" @click="goBackToChat" title="返回问答对话">
          <span class="back-icon">←</span>
          <span class="back-text">返回对话</span>
        </button>
      </div>

      <!-- 中间操作按钮 -->
      <div class="header-actions-centered">
        <!-- 当前算法名称显示 -->
        <div v-if="currentAlgorithm" class="current-algorithm-display">
          <span class="algorithm-icon">📊</span>
          <span class="algorithm-name">{{ currentAlgorithm.name }}</span>
        </div>
        
        <button class="btn btn-secondary" @click="newWorkflow">
          <span class="btn-icon">📄</span>
          <span>新建</span>
        </button>
        <button class="btn btn-secondary" @click="openKnowledgeBaseConfig">
          <span class="btn-icon">📚</span>
          <span>知识库配置</span>
        </button>
        <!-- Undo/Redo Buttons -->
        <button 
          class="btn btn-secondary" 
          @click="undo"
          :disabled="!canUndo"
          title="撤回 (Ctrl+Z)"
        >
          <span class="btn-icon">↶</span>
          <span>撤回</span>
        </button>
        <button 
          class="btn btn-secondary" 
          @click="redo"
          :disabled="!canRedo"
          title="重做 (Ctrl+Y)"
        >
          <span class="btn-icon">↷</span>
          <span>重做</span>
        </button>
        <button class="btn btn-success" @click="saveWorkflow">
          <span class="btn-icon">💾</span>
          <span>保存</span>
        </button>
        <button class="btn btn-secondary" @click="exportWorkflow">
          <span class="btn-icon">📤</span>
          <span>导出JSON</span>
        </button>
        <button class="btn btn-secondary" @click="loadWorkflow">
          <span class="btn-icon">📂</span>
          <span>加载</span>
        </button>
        <button class="btn btn-primary" @click="runWorkflow">
          <span class="btn-icon">▶️</span>
          <span>执行</span>
        </button>
      </div>

      <!-- 右侧占位，保持居中 -->
      <div class="header-spacer"></div>
    </header>

    <!-- Main Container -->
    <div class="main-container">
      <!-- Left Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <h3>算法库</h3>
          <button class="btn-add-menu" @click="openAddMenuModal" title="添加菜单">
            <span class="add-icon">+</span>
          </button>
        </div>
        
        <div class="search-container">
          <input 
            v-model="searchQuery"
            type="text" 
            class="search-box" 
            placeholder="搜索算法..."
          />
        </div>

        <!-- 算法菜单树 -->
        <div class="algorithm-menus">
          <div class="menu-section-title">算法库</div>
          <div 
            v-for="menu in filteredAlgorithmMenus" 
            :key="menu.id"
            class="menu-tree"
          >
            <MenuTreeItem 
              :menu="menu" 
              :checkedMenuIds="checkedMenuIds"
              @toggle="toggleMenu"
              @edit="editMenuName"
              @delete="deleteMenu"
              @add-algorithm="openAddAlgorithmModal"
              @load-algorithm="loadAlgorithm"
              @edit-algorithm="handleEditAlgorithm"
              @delete-algorithm="handleDeleteAlgorithm"
              @check="handleMenuCheck"
            />
          </div>
        </div>

        <div class="divider"></div>

        <div class="sidebar-header">
          <h3>节点库</h3>
        </div>
        <div class="node-categories">
          <div 
            v-for="(categoryNodes, category) in groupedNodeTypes" 
            :key="category"
            v-show="categoryNodes.length > 0"
            class="category"
          >
            <div class="category-title">{{ categoryNames[category] }}</div>
            <div
              v-for="node in categoryNodes"
              :key="node.key"
              class="node-item"
              draggable="true"
              @dragstart="handleTemplateDragStart(node.key, $event)"
            >
              <div :class="`node-icon ${node.type}`">{{ node.icon }}</div>
              <div class="node-info">
                <h4>{{ node.title }}</h4>
                <p>{{ node.inputs.length }} 输入 / {{ node.outputs.length }} 输出</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Resize Handle -->
      <div 
        class="resize-handle"
        @mousedown="handleResizeStart"
        title="拖拽调整侧边栏宽度"
      ></div>

      <!-- Canvas Area -->
      <div 
        class="canvas-container" 
        id="canvas-container"
        :class="{ 'panel-collapsed': panelCollapsed }"
        @mousedown="handleCanvasMouseDown"
        @mousemove="handleCanvasMouseMove"
        @mouseup="handleCanvasMouseUp"
        @mouseleave="handleCanvasMouseUp"
        @drop="handleCanvasDrop"
        @dragover="handleCanvasDragOver"
        @wheel.prevent="handleCanvasWheel"
      >
        <!-- SVG Connections Layer -->
        <svg 
          class="connections-layer"
          :style="{
            transform: `translate(${canvasState.pan.x}px, ${canvasState.pan.y}px) scale(${canvasState.zoom})`,
            transformOrigin: '0 0'
          }"
        >
          <!-- Existing Connections -->
          <g v-for="conn in connections" :key="conn.id">
            <!-- 连接线 - 点击直接删除 -->
            <path
              :d="getConnectionPath(conn)"
              class="connection-line"
              @click.stop="deleteConnection(conn.id)"
              title="点击删除连线"
            />
          </g>
          <!-- Temporary Connection -->
          <path
            v-if="canvasState.isConnecting"
            :d="getTempConnectionPath()"
            class="connection-line"
            style="opacity: 0.5; stroke-dasharray: 5"
          />
        </svg>

        <!-- Workflow Canvas -->
        <div 
          id="workflow-canvas"
          :style="{
            transform: `translate(${canvasState.pan.x}px, ${canvasState.pan.y}px) scale(${canvasState.zoom})`,
            transformOrigin: '0 0',
            width: canvasSize.width,
            height: canvasSize.height,
            minWidth: canvasSize.minWidth,
            minHeight: canvasSize.minHeight
          }"
        >
          <!-- Nodes -->
          <div
            v-for="(node, index) in nodes"
            :key="node.id"
            :id="node.id"
            class="workflow-node"
            :class="{ selected: selectedNode?.id === node.id, dragging: canvasState.draggedNode?.id === node.id }"
            :style="{ 
              left: `${node.x}px`, 
              top: `${node.y}px`,
              zIndex: selectedNode?.id === node.id ? 1000 : (canvasState.draggedNode?.id === node.id ? 1000 : 150 + index)
            }"
            @mousedown.stop="handleNodeMouseDown(node, $event)"
          >
            <!-- Node Status Icon -->
            <div 
              :id="`status-${node.id}`" 
              class="node-status-icon"
              :class="{
                'visible': getNodeStatus(node.id) !== 'idle',
                'loading': getNodeStatus(node.id) === 'running',
                'success': getNodeStatus(node.id) === 'success',
                'error': getNodeStatus(node.id) === 'error'
              }"
            >
              <div v-if="getNodeStatus(node.id) === 'running'" class="loading-spinner"></div>
              <span v-else-if="getNodeStatus(node.id) === 'success'">✓</span>
              <span v-else-if="getNodeStatus(node.id) === 'error'">✕</span>
            </div>

            <!-- Node Header -->
            <div :class="`node-header ${NODE_TYPES[node.type]?.type}`">
              <span style="font-size: 20px;">{{ NODE_TYPES[node.type]?.icon }}</span>
              <span class="node-title">{{ NODE_TYPES[node.type]?.title }}</span>
              <button class="node-delete" @click.stop="deleteNode(node.id)">✕</button>
            </div>

            <!-- Node Body -->
            <div class="node-body">
              <!-- LLM Nodes -->
              <template v-if="node.type === 'llm-deepseek' || node.type === 'llm-gemini'">
                <div class="node-field">
                  <label>系统提示词</label>
                  <textarea 
                    v-model="node.config.systemPrompt"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
                <div class="node-field">
                  <label>Temperature: {{ node.config.temperature }}</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    v-model.number="node.config.temperature"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- NLP Semantic -->
              <template v-else-if="node.type === 'nlp-semantic'">
                <div class="node-field">
                  <label>分析类型</label>
                  <select v-model="node.config.analysisType" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="comprehensive">综合分析</option>
                    <option value="sentiment">情感分析</option>
                    <option value="keywords">关键词提取</option>
                    <option value="summary">文本摘要</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini Flash</option>
                  </select>
                </div>
              </template>

              <!-- Personality Analysis -->
              <template v-else-if="node.type === 'personality-analysis'">
                <div class="node-field">
                  <label>分析框架</label>
                  <input type="text" :value="node.config.framework" disabled class="opacity-70 bg-slate-800" />
                  <p class="text-xs opacity-50 mt-1">精神归宿 / 角色适配 / BVR / 专业能力 / 行为动线</p>
                </div>
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini Flash</option>
                  </select>
                </div>
              </template>

              <!-- LaTeX AI -->
              <template v-else-if="node.type === 'algo-latex-ai'">
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini 2.5 Flash</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>提示词模板</label>
                  <textarea 
                    v-model="node.config.promptTemplate"
                    style="min-height: 80px;"
                    placeholder="例如: 请基于以下内容生成LaTeX公式: ${input}"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
              </template>

              <!-- Formula Execution -->
              <template v-else-if="node.type === 'algo-formula'">
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini 2.5 Flash</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>提示词模板</label>
                  <textarea 
                    v-model="node.config.promptTemplate"
                    style="min-height: 80px;"
                    placeholder="默认会自动嵌入上游节点的输出结果"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
              </template>

              <!-- Chart Visualization -->
              <template v-else-if="node.type === 'algo-chart'">
                <div class="node-field">
                  <label>图表库</label>
                  <select v-model="node.config.library" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="echarts">ECharts (推荐)</option>
                    <option value="chartjs">Chart.js</option>
                    <option value="d3">D3.js (高级)</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>图表类型</label>
                  <select v-model="node.config.chartType" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="bar">柱状图</option>
                    <option value="line">折线图</option>
                    <option value="pie">饼图</option>
                    <option value="radar">雷达图</option>
                    <option value="scatter">散点图</option>
                  </select>
                </div>
              </template>

              <!-- RAG Upload -->
              <template v-else-if="node.type === 'rag-upload'">
                <div class="node-field">
                  <label>分块大小</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.chunkSize"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>重叠大小</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.chunkOverlap"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- File Upload -->
              <template v-else-if="node.type === 'file-upload'">
                <div class="node-field">
                  <label>上传路径</label>
                  <input 
                    type="text" 
                    v-model="node.config.uploadPath"
                    placeholder="user/{userId}/uploads"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>允许的文件类型</label>
                  <input 
                    type="text" 
                    v-model="node.config.allowedTypes"
                    placeholder="* 或 .jpg,.png,.pdf"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>最大文件大小 (MB)</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.maxSize"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- RAG Query -->
              <template v-else-if="node.type === 'rag-query'">
                <div class="node-field">
                  <label>返回数量 (Top K)</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.topK"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- RAG Workflow -->
              <template v-else-if="node.type === 'rag-workflow'">
                <div class="node-field">
                  <label>返回数量 (Top K)</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.topK"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="claude-3">Claude 3</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>系统提示</label>
                  <textarea 
                    v-model="node.config.systemPrompt"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                    rows="3"
                    placeholder="你是一个专业的知识库助手..."
                  ></textarea>
                </div>
              </template>

              <!-- Input Text -->
              <template v-else-if="node.type === 'input-text'">
                <div class="node-field">
                  <label>默认值</label>
                  <input 
                    type="text" 
                    v-model="node.config.defaultValue"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- Output Text -->
              <template v-else-if="node.type === 'output-text'">
                <div class="node-field">
                  <label>输出标签</label>
                  <input 
                    type="text" 
                    v-model="node.config.label"
                    placeholder="输出结果标签"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                
                <!-- 输出结果显示 -->
                <div v-if="nodeOutputs[node.id]" class="output-result-container" @mousedown.stop>
                  <div class="output-result-header">
                    <span class="output-result-icon">📤</span>
                    <span class="output-result-label">输出结果</span>
                  </div>
                  <div class="output-result-content">
                    <div v-if="typeof nodeOutputs[node.id] === 'string'" class="output-text-result">
                      {{ nodeOutputs[node.id] }}
                    </div>
                    <div v-else-if="typeof nodeOutputs[node.id] === 'object'" class="output-object-result">
                      <pre>{{ JSON.stringify(nodeOutputs[node.id], null, 2) }}</pre>
                    </div>
                    <div v-else class="output-other-result">
                      {{ String(nodeOutputs[node.id]) }}
                    </div>
                  </div>
                </div>
              </template>

              <!-- Output Save -->
              <template v-else-if="node.type === 'output-save'">
                <div class="node-field">
                  <label>文件名</label>
                  <input 
                    type="text" 
                    v-model="node.config.filename"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>格式</label>
                  <select v-model="node.config.format" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="json">JSON</option>
                    <option value="txt">TXT</option>
                    <option value="md">Markdown</option>
                  </select>
                </div>
              </template>

              <!-- Local Image Upload -->
              <template v-else-if="node.type === 'local-image-upload'">
                <div class="node-field">
                  <label>最大宽度</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.maxWidth"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>最大高度</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.maxHeight"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>图片质量</label>
                  <input 
                    type="range" 
                    v-model.number="node.config.quality"
                    min="0.1" 
                    max="1" 
                    step="0.1"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                  <span>{{ node.config.quality }}</span>
                </div>
                <div class="node-field">
                  <label>允许的类型</label>
                  <div v-for="(type, index) in node.config.allowedTypes" :key="index" class="tag-input">
                    <span>{{ type }}</span>
                  </div>
                </div>
              </template>

              <!-- Image to Video -->
              <template v-else-if="node.type === 'image-to-video'">
                <div class="node-field">
                  <label>视频时长 (秒)</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.duration"
                    min="1" 
                    max="30"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>帧率 (FPS)</label>
                  <select v-model="node.config.fps" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="24">24 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>视频质量</label>
                  <select v-model="node.config.quality" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="low">低质量</option>
                    <option value="medium">中等质量</option>
                    <option value="high">高质量</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>生成模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="stable-video-diffusion">Stable Video Diffusion</option>
                    <option value="gen-2">Gen-2</option>
                    <option value="runway">Runway</option>
                  </select>
                </div>
              </template>

              <!-- Video Understanding -->
              <template v-else-if="node.type === 'video-understanding'">
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="gpt-5-nano">GPT-5 Nano</option>
                    <option value="gpt-4-vision">GPT-4 Vision</option>
                    <option value="claude-3-vision">Claude 3 Vision</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>UltraThink模式</label>
                  <label class="switch">
                    <input 
                      type="checkbox" 
                      v-model="node.config.ultrathink"
                      @mousedown.stop
                      @change="saveToLocalStorage()"
                    />
                    <span class="slider"></span>
                  </label>
                </div>
                <div class="node-field">
                  <label>温度</label>
                  <input 
                    type="range" 
                    v-model.number="node.config.temperature"
                    min="0" 
                    max="1" 
                    step="0.1"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                  <span>{{ node.config.temperature }}</span>
                </div>
                <div class="node-field">
                  <label>最token数</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.maxTokens"
                    min="100" 
                    max="8000"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- Knowledge Base Assistant -->
              <template v-else-if="node.type === 'kb-assistant'">
                <!-- 知识库选择 -->
                <div class="node-field">
                  <label>选择知识库</label>
                  <select 
                    v-model="node.config.knowledgeBaseId" 
                    @mousedown.stop
                    @click.stop
                    @change="(e) => { saveToLocalStorage(); loadKBDocuments(node.config.knowledgeBaseId) }"
                  >
                    <option value="">请选择知识库</option>
                    <option v-for="kb in myKnowledgeBases" :key="kb.id" :value="kb.id">
                      {{ kb.name }}
                    </option>
                  </select>
                  <button 
                    v-if="loadingMyKBs" 
                    class="refresh-btn" 
                    disabled
                  >
                    加载中...
                  </button>
                  <button 
                    v-else 
                    class="refresh-btn" 
                    @mousedown.stop
                    @click.stop="loadMyKnowledgeBases"
                    title="刷新知识库列表"
                  >
                    🔄
                  </button>
                </div>
                
                <!-- 文档选择（多选） -->
                <div v-if="node.config.knowledgeBaseId" class="node-field">
                  <label>选择文档 (可多选)</label>
                  <div class="document-select-list">
                    <div v-if="loadingKBDocuments[node.config.knowledgeBaseId]" class="loading-text">
                      加载文档中...
                    </div>
                    <div v-else-if="!selectedKBDocuments[node.config.knowledgeBaseId]?.length" class="empty-text">
                      暂无文档
                    </div>
                    <div v-else class="document-checkboxes">
                      <label 
                        v-for="doc in selectedKBDocuments[node.config.knowledgeBaseId]" 
                        :key="doc.id"
                        class="document-checkbox-item"
                      >
                        <input 
                          type="checkbox" 
                          :value="doc.id"
                          v-model="node.config.selectedDocIds"
                          @mousedown.stop
                          @change="saveToLocalStorage()"
                        />
                        <span class="doc-name" :title="doc.original_name || doc.name || doc.title">
                          {{ doc.original_name || doc.name || doc.title }}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div class="selected-count">
                    已选择 {{ (node.config.selectedDocIds || []).length }} 个文档
                  </div>
                </div>
                
                <div class="node-field">
                  <label>返回数量 (Top K)</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.topK"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="claude-3">Claude 3</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>系统提示</label>
                  <textarea 
                    v-model="node.config.systemPrompt"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                    rows="3"
                    placeholder="你是一个专业的知识库助手..."
                  ></textarea>
                </div>
                <div class="node-field">
                  <label>返回来源</label>
                  <label class="switch">
                    <input 
                      type="checkbox" 
                      v-model="node.config.enableSources"
                      @mousedown.stop
                      @change="saveToLocalStorage()"
                    />
                    <span class="slider"></span>
                  </label>
                </div>
              </template>

              <!-- JavaScript Code -->
              <template v-else-if="node.type === 'code-js'">
                <div class="node-field">
                  <label>JavaScript代码</label>
                  <textarea 
                    v-model="node.config.code"
                    style="font-family: monospace; min-height: 100px;"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
              </template>

              <!-- CMD Command -->
              <template v-else-if="node.type === 'code-cmd'">
                <div class="node-field">
                  <label>命令</label>
                  <input 
                    type="text" 
                    v-model="node.config.command"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>Shell</label>
                  <select v-model="node.config.shell" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="cmd">CMD</option>
                    <option value="powershell">PowerShell</option>
                    <option value="bash">Bash</option>
                  </select>
                </div>
              </template>

              <!-- Condition -->
              <template v-else-if="node.type === 'condition'">
                <div class="node-field">
                  <label>条件表达式</label>
                  <input 
                    type="text" 
                    v-model="node.config.condition"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- Memory -->
              <template v-else-if="node.type === 'memory'">
                <div class="node-field">
                  <label>最大消息数</label>
                  <input 
                    type="number" 
                    v-model.number="node.config.maxMessages"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
              </template>

              <!-- LLM Filter 大模型过滤器 -->
              <template v-else-if="node.type === 'llm-filter'">
                <div class="node-field">
                  <label>过滤模式</label>
                  <select v-model="node.config.mode" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="ai">AI智能过滤</option>
                    <option value="regex">正则表达式</option>
                    <option value="hybrid">混合模式</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>过滤类型</label>
                  <select v-model="node.config.filterType" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="clean">清洗数据</option>
                    <option value="extract">提取内容</option>
                    <option value="transform">转换格式</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>模型</label>
                  <select v-model="node.config.model" @mousedown.stop @change="saveToLocalStorage()">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini Flash</option>
                    <option value="gpt-4">GPT-4</option>
                  </select>
                </div>
                <div class="node-field">
                  <label>AI提示词</label>
                  <textarea 
                    v-model="node.config.aiPrompt"
                    style="min-height: 60px;"
                    placeholder="请清洗以下文本，去除无关内容，保留关键信息："
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
                <div class="node-field">
                  <label>正则表达式</label>
                  <input 
                    type="text" 
                    v-model="node.config.regexPattern"
                    placeholder="例如: [^\w\s]|\d+"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>正则标志</label>
                  <input 
                    type="text" 
                    v-model="node.config.regexFlags"
                    placeholder="gim"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>替换内容（转换模式）</label>
                  <input 
                    type="text" 
                    v-model="node.config.replacement"
                    placeholder="$1, $2 表示捕获组"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                </div>
                <div class="node-field">
                  <label>示例文本</label>
                  <textarea 
                    v-model="node.config.examples"
                    style="min-height: 60px;"
                    placeholder="提供示例帮助AI理解过滤规则"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  ></textarea>
                </div>
                <div class="node-field" style="flex-direction: row; align-items: center; gap: 10px;">
                  <input 
                    type="checkbox" 
                    :id="'auto-regex-' + node.id"
                    v-model="node.config.autoGenerateRegex"
                    style="width: auto;"
                    @mousedown.stop
                    @change="saveToLocalStorage()"
                  />
                  <label :for="'auto-regex-' + node.id" style="margin-bottom: 0;">自动生成正则表达式</label>
                </div>
                <button 
                  class="btn btn-secondary" 
                  style="width: 100%; margin-top: 10px;"
                  @mousedown.stop
                  @click.stop="previewFilter(node)"
                >
                  🧹 预览过滤效果
                </button>
              </template>
            </div>

            <!-- Connection Points -->
            <div 
              v-if="NODE_TYPES[node.type]?.inputs.length > 0"
              class="connection-point input"
              @mouseup.stop="endConnection(node.id)"
            ></div>
            <div 
              v-if="NODE_TYPES[node.type]?.outputs.length > 0"
              class="connection-point output"
              @mousedown.stop="startConnection(node.id, $event)"
            ></div>
          </div>
        </div>

        <!-- Canvas Controls -->
        <div class="canvas-controls">
          <button @click="zoomIn" title="放大">🔍+</button>
          <button @click="zoomOut" title="缩小">🔍-</button>
          <button @click="resetZoom" title="重置">↺</button>
          <button @click="clearCanvas" title="清空">🗑️</button>
        </div>
      </div>

      <!-- Right Panel - 重新设计 -->
      <aside class="right-panel" :class="{ collapsed: panelCollapsed }">
        <!-- 折叠按钮 -->
        <button 
          class="panel-collapse-btn" 
          @click="panelCollapsed = !panelCollapsed"
          :title="panelCollapsed ? '展开面板' : '收起面板'"
        >
          <span class="collapse-icon">{{ panelCollapsed ? '⟨' : '⟩' }}</span>
        </button>

        <div v-if="!panelCollapsed" class="panel-content-wrapper">
          <!-- Panel Header -->
          <div class="panel-header">
            <h2 class="panel-title">工作流助手</h2>
            <p class="panel-subtitle">配置、对话和结果</p>
          </div>

          <!-- Panel Tabs -->
          <div class="panel-tabs-modern">
            <button 
              :class="['tab-modern', { active: activeTab === 'chat' }]"
              @click="switchTab('chat')"
            >
              <span class="tab-icon">💬</span>
              <span class="tab-label">对话</span>
            </button>
            <button 
              :class="['tab-modern', { active: activeTab === 'config' }]"
              @click="switchTab('config')"
            >
              <span class="tab-icon">⚙️</span>
              <span class="tab-label">配置</span>
            </button>
            <button 
              :class="['tab-modern', { active: activeTab === 'results' }]"
              @click="switchTab('results')"
            >
              <span class="tab-icon">📊</span>
              <span class="tab-label">结果</span>
            </button>
            <button 
              :class="['tab-modern', { active: activeTab === 'logs' }]"
              @click="switchTab('logs')"
            >
              <span class="tab-icon">📝</span>
              <span class="tab-label">日志</span>
              <span v-if="executionLog.length > 0" class="tab-badge">{{ executionLog.length }}</span>
            </button>
          </div>

          <!-- Chat Tab -->
          <div v-show="activeTab === 'chat'" class="panel-tab-content">
            <div class="chat-container-modern">
              <div class="chat-messages-modern">
                <div 
                  v-for="(msg, index) in chatMessages" 
                  :key="index"
                  :class="['chat-message-modern', msg.role]"
                >
                  <div class="message-avatar-modern">
                    <span v-if="msg.role === 'user'">👤</span>
                    <span v-else>🤖</span>
                  </div>
                  <div class="message-bubble">
                    <div 
                      class="message-content-modern"
                      :class="{ error: msg.isError }"
                    >
                      {{ msg.content }}
                      <span v-if="msg.isLoading" class="typing-cursor">|</span>
                    </div>
                    <div class="message-time">{{ formatTime(msg.timestamp || Date.now()) }}</div>
                  </div>
                </div>
              </div>
              
              <div class="chat-input-container-modern">
                <div class="chat-input-wrapper-modern">
                  <textarea 
                    v-model="chatInput"
                    class="chat-input-modern" 
                    placeholder="输入消息，询问工作流相关问题..." 
                    rows="3"
                    @keydown.enter.exact.prevent="sendMessage"
                    @keydown.shift.enter="chatInput += '\n'"
                  ></textarea>
                  <button 
                    class="chat-send-modern" 
                    @click="sendMessage"
                    :disabled="!chatInput.trim()"
                  >
                    <span class="send-icon">➤</span>
                  </button>
                </div>
                <div class="chat-hint">按 Enter 发送，Shift+Enter 换行</div>
              </div>
            </div>
          </div>

          <!-- Config Tab -->
          <div v-show="activeTab === 'config'" class="panel-tab-content">
            <div class="config-section-modern">
              <div class="section-header-modern">
                <span class="section-icon">🔧</span>
                <h3>全局配置</h3>
              </div>
              
              <div class="config-grid">
                <div class="config-item">
                  <label class="config-label">
                    <span class="label-icon">🌐</span>
                    <span>API端点</span>
                  </label>
                  <input 
                    type="text" 
                    v-model="apiConfig.endpoint" 
                    class="config-input"
                    placeholder="https://api.example.com"
                  />
                </div>

                <div class="config-item">
                  <label class="config-label">
                    <span class="label-icon">🔑</span>
                    <span>API Key</span>
                  </label>
                  <input 
                    type="password" 
                    v-model="apiConfig.apiKey" 
                    class="config-input"
                    placeholder="sk-..."
                  />
                </div>

                <div class="config-item">
                  <label class="config-label">
                    <span class="label-icon">🤖</span>
                    <span>默认模型</span>
                  </label>
                  <select v-model="apiConfig.defaultModel" class="config-select">
                    <option value="deepseek-v3">DeepSeek V3</option>
                    <option value="gemini-2.5-flash-all">Gemini 2.5 Flash</option>
                  </select>
                </div>

                <div class="config-item">
                  <label class="config-label">
                    <span class="label-icon">🌡️</span>
                    <span>Temperature: {{ apiConfig.temperature }}</span>
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="2" 
                    step="0.1" 
                    v-model.number="apiConfig.temperature"
                    class="config-range"
                  />
                  <div class="range-labels">
                    <span>精确</span>
                    <span>平衡</span>
                    <span>创造</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="config-section-modern" v-if="selectedNode">
              <div class="section-header-modern">
                <span class="section-icon">🎯</span>
                <h3>选中节点</h3>
              </div>
              
              <div class="node-info-card">
                <div class="node-info-row">
                  <span class="info-label">节点 ID</span>
                  <span class="info-value">{{ selectedNode.id }}</span>
                </div>
                <div class="node-info-row">
                  <span class="info-label">节点类型</span>
                  <span class="info-value">{{ NODE_TYPES[selectedNode.type]?.title }}</span>
                </div>
                <div class="node-info-row">
                  <span class="info-label">位置</span>
                  <span class="info-value">X: {{ Math.round(selectedNode.x) }}, Y: {{ Math.round(selectedNode.y) }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- Results Tab -->
          <div v-show="activeTab === 'results'" class="panel-tab-content">
            <div class="results-section-modern">
              <div class="section-header-modern">
                <span class="section-icon">📊</span>
                <h3>执行结果</h3>
              </div>
              
              <!-- 执行结果展示区域 -->
              <div v-if="executionResult" class="execution-result-panel">
                <div class="result-header">
                  <span class="result-icon" :class="executionResult.success ? 'success' : 'error'">
                    {{ executionResult.success ? '✓' : '✗' }}
                  </span>
                  <span class="result-title">执行结果</span>
                  <button @click="executionResult = null" class="close-result-btn" title="关闭">×</button>
                </div>
                
                <div class="result-content">
                  <!-- 成功结果 -->
                  <div v-if="executionResult.success" class="result-success">
                    <div class="result-timestamp">
                      执行时间: {{ new Date(executionResult.timestamp).toLocaleString() }}
                    </div>
                    
                    <!-- 节点结果列表 -->
                    <div v-for="(item, index) in executionResult.results" :key="index" class="result-item">
                      <div class="result-item-header">
                        <span class="result-node-name">{{ item.nodeName }}</span>
                        <span class="result-node-id">{{ item.nodeId }}</span>
                      </div>
                      
                      <div class="result-item-content">
                        <!-- 文本结果 -->
                        <div v-if="typeof item.result === 'string'" class="result-text">
                          {{ item.result }}
                        </div>
                        
                        <!-- 对象结果 -->
                        <div v-else-if="typeof item.result === 'object'" class="result-object">
                          <!-- 图片 -->
                          <div v-if="item.result.type === 'image' || item.result.image" class="result-image">
                            <img :src="item.result.url || item.result.image" alt="Result Image" />
                          </div>
                          
                          <!-- 文件 -->
                          <div v-else-if="item.result.type === 'file' || item.result.file" class="result-file">
                            <a :href="item.result.url || item.result.file" target="_blank" class="file-link">
                              <span class="file-icon">📄</span>
                              <span>{{ item.result.name || '下载文件' }}</span>
                            </a>
                          </div>
                          
                          <!-- JSON 数据 -->
                          <pre v-else class="result-json">{{ JSON.stringify(item.result, null, 2) }}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- 错误结果 -->
                  <div v-else class="result-error">
                    <div class="error-message">{{ executionResult.error }}</div>
                    <div class="result-timestamp">
                      错误时间: {{ new Date(executionResult.timestamp).toLocaleString() }}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 无结果提示 -->
              <div v-else class="empty-state">
                <span class="empty-icon">📊</span>
                <p>暂无执行结果</p>
                <p class="empty-hint">执行工作流后将在此显示结果</p>
              </div>
            </div>
          </div>
          
          <!-- Logs Tab -->
          <div v-show="activeTab === 'logs'" class="panel-tab-content">
            <div class="results-section-modern">
              <div class="section-header-modern">
                <span class="section-icon">📝</span>
                <h3>执行日志</h3>
                <div class="section-actions">
                  <button class="btn-clear-logs" @click="executionLog = []" v-if="executionLog.length > 0">
                    清空日志
                  </button>
                  <button class="btn-export-logs" @click="exportExecutionLog" v-if="executionLog.length > 0">
                    📤 导出日志
                  </button>
                </div>
              </div>
              
              <!-- 执行统计信息 -->
              <div v-if="executionLog.length > 0" class="execution-stats">
                <div class="stat-card">
                  <div class="stat-value">{{ getSuccessCount }}</div>
                  <div class="stat-label">成功</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ getWarningCount }}</div>
                  <div class="stat-label">警告</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ getErrorCount }}</div>
                  <div class="stat-label">错误</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">{{ getTotalCount }}</div>
                  <div class="stat-label">总计</div>
                </div>
              </div>
              
              <div class="execution-log-modern">
                <!-- 执行摘要 -->
                <div v-if="executionLog.length > 0" class="execution-summary">
                  <div class="summary-header">
                    <span class="summary-icon">📊</span>
                    <span>执行摘要</span>
                  </div>
                  <div class="summary-content">
                    <p>开始时间: {{ formatDetailedTime(executionLog[0]?.timestamp) }}</p>
                    <p>结束时间: {{ formatDetailedTime(executionLog[executionLog.length - 1]?.timestamp) }}</p>
                    <p>执行时长: {{ getExecutionDuration }} 秒</p>
                  </div>
                </div>
                
                <!-- 详细日志条目 -->
                <div 
                  v-for="(log, index) in executionLog" 
                  :key="index"
                  :class="['log-entry-modern', log.type]"
                >
                  <span class="log-icon">
                    <span v-if="log.type === 'success'">✓</span>
                    <span v-else-if="log.type === 'error'">✗</span>
                    <span v-else-if="log.type === 'warning'">⚠</span>
                    <span v-else>ℹ</span>
                  </span>
                  <div class="log-content">
                    <div class="log-message">{{ log.message }}</div>
                    <div class="log-details" v-if="log.details">
                      <p class="log-detail-text">{{ log.details }}</p>
                    </div>
                    <div class="log-time">{{ formatDetailedTime(log.timestamp) }}</div>
                  </div>
                </div>
                
                <div v-if="executionLog.length === 0" class="empty-state">
                  <span class="empty-icon">??</span>
                  <p>暂无执行日志</p>
                  <p class="empty-hint">执行工作流后将显示详细的执行日志</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Toast Container -->
    <div class="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
      <div 
        v-for="toast in toasts" 
        :key="toast.id"
        class="group overflow-hidden bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-3 items-start pointer-events-auto transform transition-all duration-300 ease-out animate-slide-in"
        :class="{
          'border-l-4 border-l-blue-500': toast.type === 'info',
          'border-l-4 border-l-green-500': toast.type === 'success', 
          'border-l-4 border-l-yellow-500': toast.type === 'warning',
          'border-l-4 border-l-red-500': toast.type === 'error'
        }"
      >
        <!-- Icon -->
        <div class="flex-shrink-0 mt-0.5">
          <div v-if="toast.type === 'info'" class="w-5 h-5 text-blue-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div v-else-if="toast.type === 'success'" class="w-5 h-5 text-green-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div v-else-if="toast.type === 'warning'" class="w-5 h-5 text-yellow-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div v-else-if="toast.type === 'error'" class="w-5 h-5 text-red-500">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
          </div>
        </div>
        
        <!-- Content -->
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-900 dark:text-gray-100 font-medium">
            {{ toast.message }}
          </p>
        </div>
        
        <!-- Close Button -->
        <button 
          @click="removeToast(toast.id)"
          class="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- AI Workflow Creator Modal -->
    <div v-if="showAiCreatorModal" class="modal-overlay active" @click.self="closeAiCreator">
      <div class="modal">
        <div class="modal-header">
          <h2>🤖 AI工作流创建器</h2>
          <button class="modal-close" @click="closeAiCreator">✕</button>
        </div>
        <div class="modal-body">
          <div class="node-field">
            <label>描述你想要的工作流</label>
            <textarea 
              v-model="aiWorkflowPrompt"
              rows="4" 
              placeholder="例如：创建一个能够读取文档并回答问题的RAG工作流，包含文档上传、向量检索和LLM问答功能..."
            ></textarea>
          </div>
          <div class="node-field">
            <label>选择模型</label>
            <select v-model="aiCreatorModel">
              <option value="deepseek-v3">DeepSeek V3</option>
              <option value="gemini-2.5-flash-all">Gemini 2.5 Flash</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAiCreator">取消</button>
          <button 
            class="btn btn-primary" 
            @click="generateWorkflowWithAI"
            :disabled="isGeneratingWorkflow"
          >
            <span v-if="isGeneratingWorkflow">
              <div class="loading-spinner-small"></div>
              生成中... {{ Math.round(aiGenerationProgress) }}%
            </span>
            <span v-else>
              🚀 生成工作流
            </span>
          </button>
        </div>
        
        <!-- 进度条显示 -->
        <div v-if="isGeneratingWorkflow" class="progress-container">
          <div class="progress-text">AI正在生成您的工作流...</div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: aiGenerationProgress + '%' }"
            ></div>
          </div>
          <div class="progress-steps">
            <span :class="{ active: aiGenerationProgress >= 20 }">请求生成</span>
            <span :class="{ active: aiGenerationProgress >= 60 }">生成中</span>
            <span :class="{ active: aiGenerationProgress >= 80 }">解析中</span>
            <span :class="{ active: aiGenerationProgress >= 90 }">应用配置</span>
            <span :class="{ active: aiGenerationProgress >= 100 }">完成</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Knowledge Base Configuration Modal -->
    <div v-if="showKnowledgeBaseModal" class="modal-overlay active" @click.self="closeKnowledgeBaseConfig">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>📚 知识库管理</h2>
          <button class="modal-close" @click="closeKnowledgeBaseConfig">✕</button>
        </div>
        <div class="modal-body" style="padding: 0;">
          <!-- Hidden file input for upload -->
          <input 
            ref="fileInput"
            type="file" 
            accept=".txt,.md,.pdf,.doc,.docx" 
            multiple 
            @change="uploadDocument"
            style="display: none;"
          />
          
          <!-- Knowledge Base Browser Component -->
          <KnowledgeBaseBrowser
            :knowledgeBases="myKnowledgeBases"
            :documents="currentSelectedKB?.id ? (selectedKBDocuments[currentSelectedKB.id] || []) : []"
            :loading="loadingMyKBs"
            :loadingDocuments="currentSelectedKB?.id ? (loadingKBDocuments[currentSelectedKB.id] || false) : false"
            @refresh="handleKBRefresh"
            @selectKB="handleKBSelect"
            @upload="handleKBUpload"
            @preview="handleKBPreview"
            @delete="handleKBDelete"
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeKnowledgeBaseConfig">关闭</button>
        </div>
      </div>
    </div>

    <!-- Document Preview Modal -->
    <div v-if="showDocumentPreview" class="modal-overlay active" @click.self="closeDocumentPreview">
      <div class="modal" style="max-width: 900px; width: 90%;">
        <div class="modal-header">
          <h2>📄 文档预览 - {{ selectedDocument?.name || selectedDocument?.filename }}</h2>
          <button class="modal-close" @click="closeDocumentPreview">✕</button>
        </div>
        <div class="modal-body">
          <div class="document-preview-container">
            <div class="document-preview-toolbar">
              <div class="document-info">
                <span class="document-size">{{ formatFileSize(selectedDocument?.size || selectedDocument?.fileSize || 0) }}</span>
                <span class="document-date">{{ formatDate(selectedDocument?.uploadTime || selectedDocument?.created_at || selectedDocument?.createdAt) }}</span>
              </div>
              <div class="document-actions">
                <button 
                  v-if="!isEditingDocument"
                  class="btn btn-primary btn-small" 
                  @click="startEditDocument"
                >
                  ✏️ 编辑
                </button>
                <button 
                  v-if="isEditingDocument"
                  class="btn btn-success btn-small" 
                  @click="saveDocumentEdit"
                >
                  💾 保存
                </button>
                <button 
                  v-if="isEditingDocument"
                  class="btn btn-secondary btn-small" 
                  @click="cancelEditDocument"
                >
                  ❌ 取消
                </button>
              </div>
            </div>
            
            <div class="document-content">
              <div v-if="!isEditingDocument" class="markdown-preview">
                <pre v-if="documentPreview && documentPreview.trim()" class="markdown-content">{{ documentPreview }}</pre>
                <div v-else class="empty-content">
                  <p>文档内容为空</p>
                  <p class="empty-hint">该文档可能没有可提取的文本内容，或者文件格式不支持预览。</p>
                </div>
              </div>
              <div v-else class="markdown-editor">
                <textarea 
                  v-model="documentEditContent"
                  class="markdown-textarea"
                  placeholder="编辑文档内容..."
                  rows="20"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeDocumentPreview">关闭</button>
        </div>
      </div>
    </div>

    <!-- Add Menu Modal -->
    <div v-if="showAddMenuModal" class="modal-overlay active" @click.self="closeAddMenuModal">
      <div class="modal">
        <div class="modal-header">
          <h2>📁 添加菜单</h2>
          <button class="modal-close" @click="closeAddMenuModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="node-field">
            <label>菜单名称</label>
            <input 
              v-model="newMenuName"
              type="text" 
              placeholder="输入菜单名称..."
            />
          </div>
          <div class="node-field">
            <label>父菜单（可选）</label>
            <select v-model="newMenuParent">
              <option :value="null">根级别</option>
              <option 
                v-for="menu in getAllParentMenus()" 
                :key="menu.id"
                :value="menu.id"
              >
                {{ '　'.repeat(menu.level) }}{{ menu.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAddMenuModal">取消</button>
          <button class="btn btn-primary" @click="addMenu">✅ 添加</button>
        </div>
      </div>
    </div>

    <!-- Add Algorithm Modal -->
    <div v-if="showAddAlgorithmModal" class="modal-overlay active" @click.self="closeAddAlgorithmModal">
      <div class="modal">
        <div class="modal-header">
          <h2>⚡ 添加算法</h2>
          <button class="modal-close" @click="closeAddAlgorithmModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="node-field">
            <label>算法名称</label>
            <input 
              v-model="newAlgorithmName"
              type="text" 
              placeholder="输入算法名称..."
            />
          </div>
          <div class="node-field">
            <label>算法描述（可选）</label>
            <textarea 
              v-model="newAlgorithmDesc"
              rows="3" 
              placeholder="描述算法的功能..."
            ></textarea>
          </div>
          <div class="info-box">
            <span class="info-icon">ℹ️</span>
            <span>当前工作流将被保存为此算法</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeAddAlgorithmModal">取消</button>
          <button class="btn btn-primary" @click="addAlgorithm">💾 保存算法</button>
          <button class="btn btn-success" @click="saveWorkflowToRustFS">☁️ 保存到云端</button>
        </div>
      </div>
    </div>

    <!-- New Algorithm Selection Modal -->
    <div v-if="showNewAlgorithmModal" class="modal-overlay active" @click.self="closeNewAlgorithmModal">
      <div class="modal modal-large">
        <div class="modal-header">
          <h2>📝 选择算法分类</h2>
          <button class="modal-close" @click="closeNewAlgorithmModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="info-box">
            <span class="info-icon">ℹ️</span>
            <span>请选择要创建算法的分类，新算法将保存在该分类下</span>
          </div>
          
          <!-- 选中的分类显示 -->
          <div v-if="selectedMenuForCreation" class="selected-category-display">
            <span class="selected-label">已选择:</span>
            <span class="selected-name">📁 {{ selectedMenuForCreation.name }}</span>
          </div>
          
          <div class="algorithm-menu-tree">
            <MenuTreeItem
              v-for="menu in filteredAlgorithmMenus"
              :key="menu.id"
              :menu="menu"
              :expanded-menus="expandedMenus"
              :checkedMenuIds="checkedMenuIds"
              @toggle="toggleMenu"
              @select-algorithm="loadAlgorithm"
              @add-algorithm="handleMenuSelection"
              @edit-algorithm="handleEditAlgorithm"
              @delete-algorithm="handleDeleteAlgorithm"
              @check="handleMenuCheck"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeNewAlgorithmModal">取消</button>
          <button 
            class="btn btn-primary" 
            @click="confirmAlgorithmCreation"
            :disabled="!selectedMenuForCreation"
          >
            🚀 确认保存
          </button>
        </div>
      </div>
    </div>

    <!-- Execution Input Modal -->
    <div v-if="isExecutionInputModal" class="modal-overlay active" @click.self="closeExecutionInputModal">
      <div class="modal">
        <div class="modal-header">
          <h2>📝 输入查询内容</h2>
          <button class="modal-close" @click="closeExecutionInputModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="info-box">
            <span class="info-icon">ℹ️</span>
            <span>请输入要传递给工作流执行的查询内容</span>
          </div>
          <div class="node-field">
            <label>查询内容</label>
            <textarea 
              v-model="executionQueryInput"
              rows="6"
              placeholder="在此输入您的查询内容..."
              class="execution-query-input"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeExecutionInputModal">取消</button>
          <button 
            class="btn btn-primary" 
            @click="confirmExecutionInput"
            :disabled="!executionQueryInput.trim()"
          >
            ▶️ 开始执行
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.workflow-designer {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --secondary: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --dark: #1e1e2e;
  --darker: #181825;
  --light: #cdd6f4;
  --surface: #313244;
  --surface-light: #45475a;
  
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--darker);
  color: var(--light);
  overflow: hidden;
  height: 100vh;
  display: flex;
  flex-direction: column;
  /* 确保节点可以超出边界显示 */
  position: relative;
}

/* Header - 居中样式 */
.header-centered {
  background: var(--dark);
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--surface);
  height: 70px;
  position: relative;
  z-index: 100;
}

.header-back {
  flex: 0 0 auto;
  min-width: 120px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--surface);
  border-radius: 8px;
  color: var(--light);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.btn-back:hover {
  background: var(--surface);
  border-color: var(--primary);
  transform: translateX(-2px);
}

.back-icon {
  font-size: 18px;
  font-weight: bold;
}

.back-text {
  font-size: 14px;
}

.header-actions-centered {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
  justify-content: center;
}

/* 当前算法名称显示 */
.current-algorithm-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  border-radius: 8px;
  margin-right: 16px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  animation: slideInFromLeft 0.3s ease-out;
}

.algorithm-icon {
  font-size: 18px;
  animation: pulse 2s ease-in-out infinite;
}

.algorithm-name {
  font-size: 14px;
  font-weight: 600;
  color: white;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.header-spacer {
  flex: 0 0 auto;
  min-width: 120px;
}

.btn-icon {
  font-size: 18px;
  margin-right: 6px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  font-weight: 500;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--light);
}

.btn-secondary:hover {
  background: var(--surface-light);
  transform: translateY(-1px);
}

.btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

/* Main Layout */
.main-container {
  display: flex;
  height: calc(100vh - 70px);
  position: relative;
  overflow: visible;
  min-width: 0;
}

/* Sidebar */
.sidebar {
  width: v-bind('sidebarWidth + "px"');
  background: var(--dark);
  border-right: 1px solid var(--surface);
  overflow: hidden;
  flex-shrink: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Resize Handle */
.resize-handle {
  width: 4px;
  background: var(--surface);
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background: var(--primary);
}

.resize-handle:active {
  background: var(--primary-light);
}

.sidebar-header {
  padding: 15px;
  border-bottom: 1px solid var(--surface);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  font-size: 14px;
  color: var(--light);
  opacity: 0.7;
  margin: 0;
}

.btn-add-menu {
  width: 32px;
  height: 32px;
  background: var(--primary);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.btn-add-menu:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
}

.add-icon {
  font-size: 20px;
  font-weight: bold;
}

.search-container {
  padding: 15px;
}

.search-box {
  width: 100%;
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 6px;
  color: var(--light);
  font-size: 14px;
}

.search-box:focus {
  outline: none;
  border-color: var(--primary);
}

.algorithm-menus {
  flex: 0 1 auto;
  overflow-y: auto;
  padding: 10px;
  min-height: 0;
  max-height: 50%;
}

.menu-section-title {
  font-size: 12px;
  color: var(--light);
  opacity: 0.6;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 0 5px;
}

.menu-tree {
  margin-bottom: 8px;
}

.divider {
  height: 1px;
  background: var(--surface);
  margin: 10px 0;
}

.node-categories {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  min-height: 200px;
}

.category {
  margin-bottom: 15px;
}

.category-title {
  font-size: 12px;
  color: var(--light);
  opacity: 0.6;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.node-item {
  background: var(--surface);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.node-item:hover {
  border-color: var(--primary);
  transform: translateX(5px);
}

.node-item:active {
  cursor: grabbing;
}

.node-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.node-icon.llm { background: linear-gradient(135deg, #8b5cf6, #6366f1); }
.node-icon.rag { background: linear-gradient(135deg, #10b981, #059669); }
.node-icon.input { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.node-icon.output { background: linear-gradient(135deg, #f59e0b, #d97706); }
.node-icon.code { background: linear-gradient(135deg, #ec4899, #db2777); }
.node-icon.cmd { background: linear-gradient(135deg, #6b7280, #4b5563); }
.node-icon.condition { background: linear-gradient(135deg, #14b8a6, #0d9488); }
.node-icon.memory { background: linear-gradient(135deg, #a855f7, #9333ea); }
.node-icon.nlp { background: linear-gradient(135deg, #f43f5e, #e11d48); }
.node-icon.personality { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.node-icon.algo { background: linear-gradient(135deg, #ec4899, #d946ef); }
.node-icon.post-process { background: linear-gradient(135deg, #f97316, #ea580c); }

.node-info h4 {
  font-size: 14px;
  margin-bottom: 2px;
}

.node-info p {
  font-size: 11px;
  opacity: 0.6;
}

/* Canvas Area */
.canvas-container {
  flex: 1;
  position: relative;
  overflow: auto; /* 改为 auto，允许滚动查看超出边界的节点 */
  background: radial-gradient(circle at center, var(--surface) 1px, transparent 1px);
  background-size: 20px 20px;
  cursor: default;
  margin-right: 44px; /* 默认收起状态，避免初始化时出现"空气墙" */
  transition: margin-right 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  /* 确保节点不会被挤压，允许动态扩展 */
  min-width: 0;
}

.canvas-container:not(.panel-collapsed) {
  margin-right: 350px; /* 展开时恢复完整宽度 */
}

.canvas-container.panel-collapsed {
  margin-right: 44px;
  /* 确保收起时节点可以拖拽到边缘，不会被挤压 */
  min-width: 0;
}

/* 拖拽时禁止文本选择（参考 xxx.html） */
.canvas-container.dragging {
  user-select: none;
  cursor: crosshair;
}

.canvas-container.dragging * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
}

#workflow-canvas {
  /* 动态尺寸由 computed 属性控制 */
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  /* 确保节点可以超出画布边界显示 */
  overflow: visible;
  /* 动态调整尺寸，防止宽度挤压 */
  box-sizing: border-box;
  /* 确保画布可以动态扩展 */
  will-change: width, height;
}

.canvas-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: var(--dark);
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  z-index: 100;
}

.canvas-controls button {
  width: 40px;
  height: 40px;
  border: none;
  background: var(--surface);
  color: var(--light);
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.canvas-controls button:hover {
  background: var(--primary);
}

/* Workflow Nodes */
.workflow-node {
  position: absolute;
  background: var(--dark);
  border: 2px solid var(--surface);
  border-radius: 10px;
  padding: 15px;
  min-width: 200px;
  width: auto;
  max-width: none;
  box-sizing: border-box;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  cursor: move;
  z-index: 150;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  /* 防止节点被挤压，允许内容正常显示 */
  overflow: visible;
  /* 确保节点内容可以正常换行 */
  word-wrap: break-word;
  word-break: break-word;
}

/* 确保节点内的控件可以正常交互，覆盖节点的 user-select: none */
.workflow-node input,
.workflow-node textarea,
.workflow-node select,
.workflow-node button,
.workflow-node label {
  user-select: auto !important;
  -webkit-user-select: auto !important;
  -moz-user-select: auto !important;
  -ms-user-select: auto !important;
  pointer-events: auto !important;
}

.workflow-node input[type="text"],
.workflow-node input[type="number"],
.workflow-node textarea {
  cursor: text;
}

.workflow-node select {
  cursor: pointer;
}

.workflow-node input[type="range"] {
  cursor: grab;
}

.workflow-node input[type="range"]:active {
  cursor: grabbing;
}

.workflow-node button {
  cursor: pointer;
}

.workflow-node.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
  z-index: 1000 !important;
}

.workflow-node.dragging {
  z-index: 1001 !important;
  opacity: 0.95;
}

.node-header {
  padding: 12px;
  border-bottom: 1px solid var(--surface);
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 10px 10px 0 0;
}

.node-header.llm { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2)); }
.node-header.rag { background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2)); }
.node-header.input { background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2)); }
.node-header.output { background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2)); }
.node-header.code { background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.2)); }
.node-header.cmd { background: linear-gradient(135deg, rgba(107, 114, 128, 0.2), rgba(75, 85, 99, 0.2)); }
.node-header.nlp { background: linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(225, 29, 72, 0.2)); }
.node-header.personality { background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.2)); }
.node-header.algo { background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.2)); }
.node-header.post-process { background: linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.2)); }

.node-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
}

.node-delete {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--light);
  opacity: 0.5;
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
}

.node-delete:hover {
  opacity: 1;
  background: var(--danger);
}

.node-body {
  padding: 12px;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  overflow: visible;
}

.node-field {
  margin-bottom: 10px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}

.node-field label {
  display: block;
  font-size: 11px;
  opacity: 0.7;
  margin-bottom: 4px;
}

.node-field input,
.node-field select,
.node-field textarea {
  width: 100%;
  min-width: 0;
  padding: 8px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 6px;
  color: var(--light);
  font-size: 13px;
  box-sizing: border-box;
  /* 确保控件可以正常交互 */
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  pointer-events: auto;
  cursor: text;
  /* 防止文本被压缩 */
  white-space: normal;
  word-wrap: break-word;
}

.node-field textarea {
  min-height: 60px;
  resize: vertical;
}

.node-field input:focus,
.node-field select:focus,
.node-field textarea:focus {
  outline: none;
  border-color: var(--primary);
}

/* 确保按钮和复选框可以正常交互 */
.node-field button,
.node-field .refresh-btn,
.node-field input[type="checkbox"],
.node-field input[type="range"] {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  pointer-events: auto;
  cursor: pointer;
}

.node-field input[type="range"] {
  cursor: grab;
}

.node-field input[type="range"]:active {
  cursor: grabbing;
}

/* 知识库文档选择样式 */
.node-field .refresh-btn {
  margin-top: 4px;
  padding: 4px 8px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 4px;
  color: var(--light);
  font-size: 12px;
  cursor: pointer;
}

.node-field .refresh-btn:hover {
  background: var(--surface-light);
}

.node-field .refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.document-select-list {
  max-height: 150px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 6px;
  padding: 8px;
}

.document-select-list .loading-text,
.document-select-list .empty-text {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  padding: 8px;
}

.document-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.document-checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.document-checkbox-item:hover {
  background: var(--surface-light);
}

.document-checkbox-item input[type="checkbox"] {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.document-checkbox-item .doc-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-count {
  font-size: 10px;
  color: var(--primary);
  margin-top: 4px;
}

/* Output Result Display */
.output-result-container {
  margin-top: 12px;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  max-height: 250px;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
}

.output-result-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  flex-shrink: 0;
}

.output-result-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.output-result-label {
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.output-result-content {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  color: #e0e7ff;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
}

.output-text-result {
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.output-object-result pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  color: #a5f3fc;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.output-other-result {
  line-height: 1.5;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Connection Points */
.connection-point {
  width: 14px;
  height: 14px;
  background: var(--surface-light);
  border: 2px solid var(--light);
  border-radius: 50%;
  position: absolute;
  cursor: crosshair;
  z-index: 20;
  transition: all 0.2s;
}

.connection-point:hover {
  transform: scale(1.3);
  background: var(--primary);
}

.connection-point.input {
  left: -7px;
  top: 50%;
  transform: translateY(-50%);
}

.connection-point.output {
  right: -7px;
  top: 50%;
  transform: translateY(-50%);
}

.connection-point.input:hover,
.connection-point.output:hover {
  transform: translateY(-50%) scale(1.3);
}

/* SVG Connections */
.connections-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 120;
  user-select: none;
  overflow: visible;
  transform-origin: 0 0;
}

.connection-line {
  fill: none;
  stroke: var(--primary);
  stroke-width: 2;
  pointer-events: stroke;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
}

.connection-line:hover {
  stroke-width: 4;
}

/* Connection Delete Button */
.connection-delete-btn {
  pointer-events: all;
  cursor: pointer;
}

.connection-delete-btn:hover circle {
  fill: #dc2626;
}

/* Right Panel - Modern Design */
.right-panel {
  width: 350px;
  background: var(--dark);
  border-left: 1px solid var(--surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  z-index: 100;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  /* 展开时正常交互 */
  pointer-events: auto;
}

.right-panel.collapsed {
  width: 44px;
  /* 收起时只允许折叠按钮交互，其他区域不阻挡拖拽 */
  pointer-events: none;
}

.right-panel.collapsed .panel-collapse-btn {
  /* 折叠按钮始终可以交互 */
  pointer-events: auto;
}

.panel-collapse-btn {
  position: absolute;
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f97316, #fb923c);
  border: 2px solid #fdba74;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
  will-change: transform, box-shadow;
}

.panel-collapse-btn:hover {
  background: linear-gradient(135deg, #ea580c, #f97316);
  border-color: #fed7aa;
  transform: translateY(-50%) scale(1.1);
  box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3);
}

.panel-collapse-btn:active {
  transform: translateY(-50%) scale(0.95);
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
}

.collapse-icon {
  font-size: 18px;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.right-panel.collapsed {
  width: 44px;
  /* 收起时只允许折叠按钮交互，其他区域不阻挡节点拖拽 */
  pointer-events: none;
}

.right-panel.collapsed .panel-collapse-btn {
  /* 折叠按钮始终可以交互 */
  pointer-events: auto;
}

.right-panel.collapsed .panel-content-wrapper {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.panel-content-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease 0.1s, visibility 0.3s ease 0.1s;
}

/* Panel Header */
.panel-header {
  padding: 20px;
  border-bottom: 1px solid var(--surface);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
}

.panel-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--light);
}

.panel-subtitle {
  font-size: 12px;
  color: var(--light);
  opacity: 0.6;
  margin: 0;
}

/* Modern Tabs */
.panel-tabs-modern {
  display: flex;
  padding: 10px;
  gap: 8px;
  border-bottom: 1px solid var(--surface);
  background: var(--darker);
}

.tab-modern {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--light);
  opacity: 0.6;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  position: relative;
}

.tab-modern:hover {
  opacity: 0.8;
  background: var(--surface);
}

.tab-modern.active {
  opacity: 1;
  background: var(--surface);
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 11px;
  font-weight: 500;
}

.tab-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--primary);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

/* Panel Tab Content */
.panel-tab-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Old panel styles for compatibility */
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.panel-section {
  margin-bottom: 20px;
}

.panel-section h4 {
  font-size: 13px;
  margin-bottom: 10px;
  color: var(--light);
  opacity: 0.8;
}

/* Modern Chat Interface */
.chat-container-modern {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--darker);
}

.chat-messages-modern {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-message-modern {
  display: flex;
  gap: 12px;
  animation: slideIn 0.3s ease-out;
  align-items: flex-start;
}

.chat-message-modern.user {
  flex-direction: row-reverse;
}

.message-avatar-modern {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.chat-message-modern.user .message-avatar-modern {
  background: linear-gradient(135deg, var(--secondary), #059669);
}

.message-bubble {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 75%;
}

.message-content-modern {
  background: var(--surface);
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--light);
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.chat-message-modern.user .message-content-modern {
  background: linear-gradient(135deg, var(--primary), #6366f1);
  color: white;
}

.message-content-modern.error {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid var(--danger);
  color: #fca5a5;
}

.message-time {
  font-size: 10px;
  color: var(--light);
  opacity: 0.5;
  padding: 0 4px;
}

.chat-input-container-modern {
  padding: 16px;
  border-top: 1px solid var(--surface);
  background: var(--dark);
}

.chat-input-wrapper-modern {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  background: var(--surface);
  border-radius: 12px;
  padding: 8px;
  border: 1px solid var(--surface-light);
  transition: border-color 0.2s;
}

.chat-input-wrapper-modern:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.chat-input-modern {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: var(--light);
  font-size: 14px;
  resize: none;
  max-height: 120px;
  font-family: inherit;
}

.chat-input-modern:focus {
  outline: none;
}

.chat-input-modern::placeholder {
  color: var(--light);
  opacity: 0.4;
}

.chat-send-modern {
  width: 40px;
  height: 40px;
  background: var(--primary);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.chat-send-modern:hover:not(:disabled) {
  background: var(--primary-dark);
  transform: scale(1.05);
}

.chat-send-modern:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.send-icon {
  font-size: 16px;
  font-weight: bold;
}

.chat-hint {
  font-size: 11px;
  color: var(--light);
  opacity: 0.5;
  margin-top: 8px;
  text-align: center;
}

/* Old chat styles for compatibility */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.chat-message {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
  animation: slideIn 0.3s ease-out;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.chat-message.user .message-avatar {
  background: var(--secondary);
}

.message-content {
  background: var(--surface);
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 80%;
  font-size: 14px;
  line-height: 1.5;
}

.chat-message.user .message-content {
  background: var(--primary);
}

.chat-input-container {
  padding: 15px;
  border-top: 1px solid var(--surface);
}

.chat-input-wrapper {
  display: flex;
  gap: 10px;
}

.chat-input {
  flex: 1;
  padding: 12px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 8px;
  color: var(--light);
  font-size: 14px;
  resize: none;
}

.chat-input:focus {
  outline: none;
  border-color: var(--primary);
}

.chat-send {
  width: 44px;
  height: 44px;
  background: var(--primary);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.chat-send:hover {
  background: var(--primary-dark);
}

/* Modern Config Section */
.config-section-modern {
  padding: 20px;
  border-bottom: 1px solid var(--surface);
}

.section-header-modern {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 20px;
}

.section-header-modern h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--light);
  flex: 1;
}

.btn-clear-logs {
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 6px;
  color: var(--light);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-clear-logs:hover {
  background: var(--danger);
  border-color: var(--danger);
}

.config-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--light);
  opacity: 0.8;
}

.label-icon {
  font-size: 14px;
}

.config-input,
.config-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--surface-light);
  border-radius: 8px;
  color: var(--light);
  font-size: 13px;
  transition: all 0.2s;
}

.config-input:focus,
.config-select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.config-range {
  width: 100%;
  height: 6px;
  background: var(--surface);
  border-radius: 3px;
  outline: none;
  -webkit-appearance: none;
}

.config-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition: all 0.2s;
}

.config-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.config-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--light);
  opacity: 0.5;
  margin-top: 4px;
}

.node-info-card {
  background: var(--surface);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.node-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.info-label {
  color: var(--light);
  opacity: 0.6;
  font-weight: 500;
}

.info-value {
  color: var(--light);
  font-weight: 600;
  font-family: monospace;
}

/* Modern Results Section */
.results-section-modern {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.execution-log-modern {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-entry-modern {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--surface);
  border-radius: 8px;
  border-left: 3px solid var(--surface-light);
  transition: all 0.2s;
  animation: slideIn 0.3s ease-out;
}

.log-entry-modern:hover {
  background: var(--surface-light);
  transform: translateX(2px);
}

.log-entry-modern.info {
  border-left-color: #3b82f6;
}

.log-entry-modern.success {
  border-left-color: var(--secondary);
}

.log-entry-modern.warning {
  border-left-color: var(--warning);
}

.log-entry-modern.error {
  border-left-color: var(--danger);
}

.log-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  font-weight: bold;
}

.log-entry-modern.info .log-icon {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.log-entry-modern.success .log-icon {
  background: rgba(16, 185, 129, 0.2);
  color: var(--secondary);
}

.log-entry-modern.warning .log-icon {
  background: rgba(245, 158, 11, 0.2);
  color: var(--warning);
}

.log-entry-modern.error .log-icon {
  background: rgba(239, 68, 68, 0.2);
  color: var(--danger);
}

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-message {
  font-size: 13px;
  color: var(--light);
  line-height: 1.4;
}

.log-time {
  font-size: 10px;
  color: var(--light);
  opacity: 0.5;
  font-family: monospace;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.3;
}

.empty-state p {
  margin: 0;
  color: var(--light);
  opacity: 0.6;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.4;
}

/* Execution Result Panel */
.execution-result-panel {
  background: var(--surface);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  animation: slideDown 0.3s ease-out;
}

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

.result-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--surface-light), var(--surface));
  border-bottom: 1px solid var(--border-color);
}

.result-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.result-icon.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.result-icon.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.result-title {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--light);
}

.close-result-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--light);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-result-btn:hover {
  background: var(--surface-light);
  color: white;
}

.result-content {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
}

.result-timestamp {
  font-size: 11px;
  color: var(--light);
  opacity: 0.6;
  margin-bottom: 12px;
}

.result-item {
  background: var(--darker);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--border-color);
}

.result-item:last-child {
  margin-bottom: 0;
}

.result-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.result-node-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

.result-node-id {
  font-size: 10px;
  color: var(--light);
  opacity: 0.5;
  font-family: monospace;
}

.result-item-content {
  font-size: 13px;
  color: var(--light);
}

.result-text {
  padding: 8px;
  background: var(--surface);
  border-radius: 6px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-image {
  margin-top: 8px;
}

.result-image img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.result-file {
  margin-top: 8px;
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface);
  border-radius: 6px;
  color: var(--primary);
  text-decoration: none;
  transition: all 0.2s;
  border: 1px solid var(--border-color);
}

.file-link:hover {
  background: var(--surface-light);
  transform: translateX(2px);
}

.file-icon {
  font-size: 18px;
}

.result-json {
  margin-top: 8px;
  padding: 12px;
  background: var(--darker);
  border-radius: 6px;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  color: #a5d6ff;
  overflow-x: auto;
  border: 1px solid var(--border-color);
}

.result-error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.error-message {
  color: #ef4444;
  font-size: 13px;
  margin-bottom: 8px;
  line-height: 1.5;
}

/* Execution Log (old style for compatibility) */
.execution-log {
  background: var(--darker);
  border-radius: 8px;
  padding: 15px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  margin-bottom: 5px;
  padding: 5px;
  border-radius: 4px;
}

.log-entry.info { color: #3b82f6; }
.log-entry.success { color: #10b981; }
.log-entry.warning { color: #f59e0b; }
.log-entry.error { color: #ef4444; }

/* Toast Notifications */
.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 2000;
}

.toast {
  background: var(--dark);
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  gap: 10px;
  animation: slideIn 0.3s ease;
  border-left: 4px solid var(--primary);
}

.toast.success { border-left-color: var(--secondary); }
.toast.error { border-left-color: var(--danger); }
.toast.warning { border-left-color: var(--warning); }

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Typing Cursor Animation */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.typing-cursor {
  font-weight: bold;
  color: var(--primary);
  animation: blink 1s infinite;
  margin-left: 2px;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--darker);
}

::-webkit-scrollbar-thumb {
  background: var(--surface);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--surface-light);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.7);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-overlay.active {
  display: flex;
}

.modal {
  background: var(--dark);
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: modalSlideIn 0.3s ease-out;
}

.modal-large {
  max-width: 1200px;
  max-height: 90vh;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid var(--surface);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 18px;
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--surface);
  color: var(--light);
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--surface-light);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(80vh - 140px);
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid var(--surface);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.info-box {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--light);
  margin-top: 10px;
}

.info-icon {
  font-size: 16px;
}

/* Knowledge Base Configuration Styles */
.file-upload {
  border: 2px dashed var(--border);
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: rgba(99, 102, 241, 0.02);
}

.file-upload:hover {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.05);
}

.file-upload-icon {
  font-size: 48px;
  margin-bottom: 15px;
  opacity: 0.6;
}

.uploading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  border-radius: 8px;
  gap: 10px;
}

.kb-documents-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
}

.document-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--surface);
  border-radius: 6px;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
}

.document-item:hover {
  background: rgba(99, 102, 241, 0.05);
  border-color: var(--primary);
}

.document-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.document-icon {
  font-size: 20px;
  opacity: 0.7;
}

.document-details {
  flex: 1;
  min-width: 0;
}

.document-name {
  font-weight: 500;
  color: var(--light);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-meta {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: var(--muted);
}

.document-size,
.document-date {
  opacity: 0.8;
}

.document-actions {
  display: flex;
  gap: 8px;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
  min-width: auto;
}

.kb-test-result {
  margin-top: 15px;
  padding: 15px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.result-header {
  font-weight: 500;
  color: var(--light);
  margin-bottom: 10px;
}

.result-content {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--muted);
}

/* Document Preview Styles */
.document-preview-container {
  display: flex;
  flex-direction: column;
  height: 500px;
}

.document-preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 15px;
}

.document-info {
  display: flex;
  gap: 15px;
  font-size: 12px;
  color: var(--muted);
}

.document-actions {
  display: flex;
  gap: 8px;
}

.document-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.markdown-preview {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 15px;
  background: var(--surface);
}

.markdown-content {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--light);
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--muted);
}

.empty-content p {
  margin: 8px 0;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
  margin-top: 10px;
}

.markdown-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.markdown-textarea {
  flex: 1;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 15px;
  background: var(--surface);
  color: var(--light);
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.markdown-textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* 算法菜单树样式 */
.algorithm-menu-tree {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
  background: var(--surface);
  border-radius: 8px;
  margin-top: 15px;
}

/* ────────────────────────────────────────────────
   GPU 加速和性能优化
   ──────────────────────────────────────────────── */

/* 启用硬件加速 */
.workflow-canvas,
.connections-layer,
.workflow-node,
.canvas-container {
  transform: translateZ(0);
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -webkit-font-smoothing: subpixel-antialiased;
}

/* 优化动画性能 */
.workflow-node,
.connection-line,
.node-item {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 减少重绘 */
.workflow-node.selected {
  contain: layout style paint;
}

/* 优化滚动性能 */
.node-categories,
.chat-messages,
.execution-log {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  contain: strict;
}

/* 优化文本渲染 */
* {
  text-rendering: optimizeSpeed;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 减少布局抖动 */
.workflow-node,
.node-item,
.stat-card {
  contain: layout style;
}

/* 优化 SVG 渲染 */
.connections-layer {
  shape-rendering: geometricPrecision;
}

.connection-line {
  vector-effect: non-scaling-stroke;
}

/* 性能监控指示器 */
.performance-indicator {
  position: fixed;
  top: 70px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #10b981;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-family: monospace;
  z-index: 9999;
  pointer-events: none;
}

.performance-indicator.warning {
  color: #f59e0b;
}

.performance-indicator.error {
  color: #ef4444;
}

/* 加载优化 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 高 DPI 屏幕优化 */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .workflow-node,
  .node-item {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
  }
}

/* Tailwind CSS 极康金主题样式 */
.workflow-designer {
  font-family: system-ui, -apple-system, sans-serif;
}

.header-centered {
}

.btn-back {
}

.btn-primary {
}

.btn-secondary {
}

/* Toast Animations */
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slide-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}

.sidebar {
}

.search-box {
}

.node-item {
}

.canvas-wrapper {
  background-image: radial-gradient(circle at center, rgba(180, 83, 9, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

.workflow-node {
}

.workflow-node.selected {
}

.connection-line {
}

.right-panel {
}

.tab {
}

.tab.active {
}

.chat-messages {
}

.message {
}

.message.user {
}

.message.assistant {
}

.chat-input {
}

.config-input {
}

.log-entry {
}

.log-entry.info {
}

.log-entry.success {
}

.log-entry.warning {
}

.log-entry.error {
}

.toast {
}

.toast.info {
}

.toast.success {
}

.toast.warning {
}

.toast.error {
}

::-webkit-scrollbar {
}

::-webkit-scrollbar-track {
}

::-webkit-scrollbar-thumb {
}

/* Node Status Icons - 执行动画 */
.node-status-icon {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1e1e2e;
  border: 2px solid #313244;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  z-index: 20;
  opacity: 0;
  transition: all 0.3s ease;
  transform: scale(0.8);
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}

.node-status-icon.visible {
  opacity: 1;
  transform: scale(1);
}

.node-status-icon.loading {
  border-color: #f59e0b;
  color: #f59e0b;
}

.node-status-icon.success {
  border-color: #10b981;
  background: #10b981;
  color: white;
}

.node-status-icon.error {
  border-color: #ef4444;
  background: #ef4444;
  color: white;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin-clockwise 1s linear infinite;
  display: block;
  will-change: transform;
  color: var(--primary);
}

@keyframes spin-clockwise {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Node Running Animation */
.workflow-node.running {
  border-color: #f59e0b;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.3); }
  50% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.1); }
}

/* Progress Bar Styles */
.progress-container {
  padding: 20px;
  border-top: 1px solid var(--surface);
}

.progress-text {
  text-align: center;
  margin-bottom: 15px;
  color: var(--light);
  opacity: 0.8;
}

.progress-bar {
  height: 8px;
  background: var(--surface);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--light);
  opacity: 0.6;
}

.progress-steps span {
  position: relative;
  padding-top: 20px;
}

.progress-steps span::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: var(--surface);
  border-radius: 50%;
}

.progress-steps span.active::before {
  background: var(--primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
}

.loading-spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin-clockwise 1s linear infinite;
  display: inline-block;
  margin-right: 8px;
  will-change: transform;
}
</style>
