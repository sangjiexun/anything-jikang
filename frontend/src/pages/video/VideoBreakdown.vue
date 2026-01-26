<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { useAuth } from '~/composables/useAuth'
import type { ApiResponse } from '~/types/global'

// 视频生成任务接口定义
interface GeneratedVideo {
  taskId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  progress: number
  url: string
  prompt: string
  createdAt: number
  duration?: number
  aspectRatio?: string
}

// 人物画像图结构接口定义
interface InfluenceGraphNode {
  id: string
  name: string
  type: 'character' | 'organization' | 'channel' | 'audience'
  attributes: Record<string, any>
  vector?: number[] // 用于向量分析
}

interface InfluenceGraphEdge {
  source: string // node.id
  target: string // node.id
  relation: string // 关联类型
  weight: number // 关联强度 (0-1)
  rules?: string[] // 关联规则
}

interface InfluenceGraph {
  nodes: InfluenceGraphNode[]
  edges: InfluenceGraphEdge[]
  rootNodes: string[] // 多个根节点ID
}

// 向后兼容的树状结构接口（用于兼容旧数据）
interface LegacyInfluenceTreeNode {
  name: string
  children?: LegacyInfluenceTreeNode[]
}

const { token, user } = useAuth()

// 全屏状态
const isFullscreen = ref(false)

// 切换全屏模式
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value

  if (isFullscreen.value) {
    // 进入全屏
    const element = document.documentElement
    if (element.requestFullscreen) {
      element.requestFullscreen()
    } else if (element.mozRequestFullScreen) { /* Firefox */
      element.mozRequestFullScreen()
    } else if (element.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
      element.webkitRequestFullscreen()
    } else if (element.msRequestFullscreen) { /* IE/Edge */
      element.msRequestFullscreen()
    }
  } else {
    // 退出全屏
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if ((document as any).mozCancelFullScreen) { /* Firefox */
      (document as any).mozCancelFullScreen()
    } else if ((document as any).webkitExitFullscreen) { /* Chrome, Safari & Opera */
      (document as any).webkitExitFullscreen()
    } else if ((document as any).msExitFullscreen) { /* IE/Edge */
      (document as any).msExitFullscreen()
    }
  }
}

// 监听全屏变化事件
onMounted(() => {
  const handleFullscreenChange = () => {
    isFullscreen.value = !!document.fullscreenElement
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
  document.addEventListener('mozfullscreenchange', handleFullscreenChange)
  document.addEventListener('MSFullscreenChange', handleFullscreenChange)

  // 组件卸载时移除事件监听器
  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
  })
})

// 向量分析状态
const vectorAnalysisState = ref({
  isAnalyzing: false,
  progress: 0,
  message: '',
  result: null as any,
  options: {
    similarityThreshold: 0.7,
    maxNewEdgesPerNode: 3,
    useKnowledgeBase: false,
    knowledgeBaseIds: [] as string[]
  }
})

// Helper for safe JSON parsing
const safeJsonParse = (content: string) => {
  // 1. Try to extract JSON from markdown code blocks
  let jsonStr = content.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1') // Extract content inside ```json ... ```
  jsonStr = jsonStr.replace(/```\s*([\s\S]*?)\s*```/gi, '$1') // Extract content inside ``` ... ```

  // 2. If no code blocks, or if the result is still not clean, try to find the outermost {}
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    jsonStr = jsonStr.substring(start, end + 1)
  }

  // 3. Remove potential comments (// ... or /* ... */) which are invalid in JSON but common in LLM output
  // Be careful not to remove urls like http://...
  // Simple regex for single line comments that doesn't match ://
  jsonStr = jsonStr.replace(/(^|[^:])\/\/.*/gm, '$1')

  try {
    return JSON.parse(jsonStr)
  } catch (e: any) {
    console.error('JSON Parse Error. Raw Content:', content)
    console.error('Processed JSON String:', jsonStr)
    throw new Error(`Failed to parse JSON: ${e.message}`)
  }
}

const VIDEO_ANALYSIS_COST = 8000

const modelOptions = [
  { value: 'qwen3-omni-flash-2025-12-01', label: 'qwen3-omni-flash (快速)' },
  { value: 'qwen3-vl-flash', label: 'qwen3-vl-flash' },
  { value: 'qwen-vl-max-2025-08-13', label: 'qwen-vl-max' }
]
const selectedModel = ref(modelOptions[0].value)
// 本地缓存的余额，用于优先显示最新获取的余额
const localBalance = ref<number | undefined>(undefined)

// 获取最新余额
async function fetchUserBalance() {
  try {
    const runtimeConfig = useRuntimeConfig()
    const response = await $fetch<ApiResponse<{ token_balance: number }>>(`${runtimeConfig.public.apiBase}/wallet/balance`, {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })
    if (response.success && response.data) {
      localBalance.value = Number(response.data.token_balance)
      // 刷新用户信息以更新余额
      try {
        await useAuth().fetchUser()
      } catch (e) {
        // 如果 fetchUser 失败，至少更新本地余额
        console.warn('Failed to refresh user info, but balance updated locally:', e)
      }
    }
  } catch (e) {
    console.error('Failed to fetch balance:', e)
  }
}

// 优先使用本地缓存的余额，如果没有则使用用户状态中的余额
const userBalance = computed(() => {
  let val: any = 0
  if (localBalance.value !== undefined) val = localBalance.value
  else if (user.value && user.value.balance !== undefined) {
    val = user.value.balance
  }
  const num = Number(val)
  return isNaN(num) ? 0 : num
})

const emit = defineEmits<{
  (e: 'analysis-complete', result: any): void
  (e: 'video-complete', task: GeneratedVideo): void
  (e: 'video-failed', task: GeneratedVideo, error: string): void
}>()

const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const videoFileInfo = ref<{ name: string, size: number, lastModified: number } | null>(null)
const isAnalyzing = ref(false)
const extensionDuration = ref(10) // AI续写/扩写时长
const analysisResult = ref<any>(null)
const activeTab = ref('breakdown')
const narrationRewrite = ref<string>('') // 相似仿写的口播内容
const isRewritingNarration = ref(false)
const analysisProgress = ref({
  status: 'idle', // idle, extracting, analyzing, synthesizing
  current: 0,
  total: 0,
  message: ''
})

// 添加AbortController用于停止解析
const analysisAbortController = ref<AbortController | null>(null)

// 停止视频解析
const stopAnalysis = () => {
  if (analysisAbortController.value) {
    analysisAbortController.value.abort()
    analysisAbortController.value = null
    isAnalyzing.value = false
    analysisProgress.value = {
      status: 'idle',
      current: 0,
      total: 0,
      message: '解析已停止'
    }
    console.log('[视频解析] 用户手动停止解析')
    
    // 显示提示
    setTimeout(() => {
      analysisProgress.value.message = ''
    }, 2000)
  }
}

// 视频解析缓存工具函数 - 使用文件特征生成缓存key
const getVideoCacheKey = (fileInfo: { name: string, size: number, lastModified: number }): string => {
  // 使用文件名、大小和修改时间生成唯一标识
  const identifier = `${fileInfo.name}_${fileInfo.size}_${fileInfo.lastModified}`
  // 生成哈希值
  let hash = 0
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `video_breakdown_${Math.abs(hash)}`
}

const saveVideoCache = (fileInfo: { name: string, size: number, lastModified: number }, result: any) => {
  try {
    const cacheKey = getVideoCacheKey(fileInfo)
    const cacheData = {
      fileInfo, // 保存文件信息用于验证
      result,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    console.log('[视频解析] 已缓存数据', {
      fileName: fileInfo.name,
      fileSize: `${(fileInfo.size / 1024 / 1024).toFixed(2)}MB`,
      cacheKey
    })
  } catch (error) {
    console.error('[视频解析] 缓存保存失败:', error)
    // 如果存储空间不足，尝试清理旧缓存
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('[视频解析] 存储空间不足，尝试清理旧缓存...')
      clearOldCache()
      // 重试保存
      try {
        const cacheKey = getVideoCacheKey(fileInfo)
        const cacheData = {
          fileInfo,
          result,
          timestamp: Date.now()
        }
        localStorage.setItem(cacheKey, JSON.stringify(cacheData))
        console.log('[视频解析] 清理后重新保存成功')
      } catch (retryError) {
        console.error('[视频解析] 重试保存仍然失败:', retryError)
      }
    }
  }
}

const loadVideoCache = (fileInfo: { name: string, size: number, lastModified: number }): any | null => {
  try {
    const cacheKey = getVideoCacheKey(fileInfo)
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const cacheData = JSON.parse(cached)
      // 验证文件信息是否匹配
      if (cacheData.fileInfo
        && cacheData.fileInfo.name === fileInfo.name
        && cacheData.fileInfo.size === fileInfo.size
        && cacheData.fileInfo.lastModified === fileInfo.lastModified) {
        // 检查缓存是否过期（30天）
        const maxAge = 30 * 24 * 60 * 60 * 1000
        if (Date.now() - cacheData.timestamp < maxAge) {
          console.log('[视频解析] 从缓存加载数据', {
            fileName: fileInfo.name,
            cacheKey,
            age: `${Math.floor((Date.now() - cacheData.timestamp) / (24 * 60 * 60 * 1000))}天前`
          })
          return cacheData.result
        } else {
          // 缓存过期，删除
          localStorage.removeItem(cacheKey)
          console.log('[视频解析] 缓存已过期，已删除', { fileName: fileInfo.name, cacheKey })
        }
      } else {
        // 文件信息不匹配，删除旧缓存
        localStorage.removeItem(cacheKey)
        console.log('[视频解析] 文件信息不匹配，已删除旧缓存', { fileName: fileInfo.name })
      }
    }
  } catch (error) {
    console.error('[视频解析] 缓存加载失败:', error)
  }
  return null
}

// 清理过期缓存（超过30天）
const clearOldCache = () => {
  try {
    const maxAge = 30 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('video_breakdown_')) {
        try {
          const cached = localStorage.getItem(key)
          if (cached) {
            const cacheData = JSON.parse(cached)
            if (cacheData.timestamp && (now - cacheData.timestamp) > maxAge) {
              keysToRemove.push(key)
            }
          }
        } catch (e) {
          // 解析失败，可能是损坏的数据，也删除
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    if (keysToRemove.length > 0) {
      console.log(`[视频解析] 已清理 ${keysToRemove.length} 个过期缓存`)
    }
  } catch (error) {
    console.error('[视频解析] 清理缓存失败:', error)
  }
}

// 监听 videoFileInfo 变化，尝试加载缓存
watch(videoFileInfo, (newFileInfo) => {
  if (newFileInfo && !analysisResult.value) {
    const cached = loadVideoCache(newFileInfo)
    if (cached) {
      analysisResult.value = cached
      console.log('[视频解析] 已从缓存恢复分析结果')
    }
  }
})

// 监听 analysisResult 变化，保存到缓存
watch(analysisResult, (newResult) => {
  if (newResult && videoFileInfo.value) {
    saveVideoCache(videoFileInfo.value, newResult)
  }
}, { deep: true })


// 页面卸载时销毁图表
// 页面卸载时销毁图表
onUnmounted(() => {
  // Chart disposal code removed - comparison charts no longer exist
})

const tabs = [
  { id: 'breakdown', label: '视频解析' },
  { id: 'extraction', label: '素材提取' },
  { id: 'viral', label: '量化分析' },
  { id: 'character', label: '人物分析' },
  { id: 'social_content', label: '文案生成' },
  { id: 'content_generation', label: '内容生成' },
  { id: 'digital_human', label: '数字人视频' },
  { id: 'advice', label: '修改意见' },
  { id: 'history', label: '历史记录' }
]

const socialContentState = ref({
  inputs: {
    targetAudience: '',
    personality: '',
    behavior: '',
    values: '',
    worldview: '',
    lifeView: ''
  },
  isGenerating: false,
  results: {
    douyin: {
      title: '',
      tags: [] as string[],
      content: ''
    },
    xiaohongshu: {
      title: '',
      tags: [] as string[],
      content: ''
    }
  }
})

const asrState = ref({
  speakerCount: 2,
  isProcessing: false,
  taskId: '',
  status: '',
  progress: 0,
  result: null as any,
  error: '',
  model: 'paraformer-v2', // 使用 Paraformer-v2 模型
  languageHints: ['zh', 'en'], // 支持的语言
  diarizationEnabled: false, // 说话人分离
  timestampAlignmentEnabled: true, // 时间戳校准
  disfluencyRemovalEnabled: false, // 过滤语气词
  specialWordFilter: '', // 敏感词过滤
  channelId: [0], // 音轨索引
  vocabularyId: '' // 热词ID
})

// 音频提取状态
const audioExtractState = ref({
  isProcessing: false,
  status: '',
  result: null as any,
  error: '',
  format: 'mp3',
  quality: 'medium',
  audioUrl: '' as string // 存储生成的音频URL用于播放
})

const transcriptionResult = ref('')
const voiceCloningState = ref({
  isRecording: false,
  sampleAudio: null as Blob | null,
  sampleUrl: '',
  clonedVoiceId: '',
  inputText: '',
  generatedAudioUrl: ''
})
const historyList = ref<any[]>([])
const remoteVideoUrl = ref('') // Store uploaded RustFS URL
const jianyingDrafts = ref<any[]>([]) // 剪映草稿列表

// 剪映口播脚本状态
const editableScript = ref([
  { startTime: '00:00', content: '欢迎来到我的频道，今天要和大家分享...' },
  { startTime: '00:05', content: '首先让我们来看看这个有趣的现象...' },
  { startTime: '00:10', content: '通过深入分析，我发现了一些关键点...' }
])

// 对比分析状态
// 数字人视频生成状态
const digitalHumanState = ref({
  // 上传文件状态
  photoFile: null as File | null,
  photoUrl: '',
  photoInfo: null as { name: string, size: number, lastModified: number } | null,
  audioFile: null as File | null,
  audioUrl: '',
  audioInfo: null as { name: string, size: number, lastModified: number } | null,
  
  // 文本输入
  inputText: '',
  
  // 语音合成状态
  ttsState: {
    isGenerating: false,
    audioUrl: '',
    error: ''
  },
  
  // 人脸检测状态
  faceDetectState: {
    isDetecting: false,
    pass: false,
    message: '',
    error: ''
  },
  
  // 视频生成状态
  videoGenerateState: {
    isGenerating: false,
    taskId: '',
    status: '',
    progress: 0,
    videoUrl: '',
    error: ''
  },
  
  // 配置参数
  parameters: {
    templateId: 'normal',
    eyeMoveFreq: 0.5,
    videoFps: 24,
    mouthMoveStrength: 1,
    pasteBack: true,
    headMoveStrength: 0.7
  },
  
  // 远程文件URL（上传到rustfs后的地址）
  remotePhotoUrl: '',
  remoteAudioUrl: ''
})

// Upload video to RustFS
const uploadVideo = async () => {
  if (remoteVideoUrl.value) return remoteVideoUrl.value
  if (!videoFile.value) throw new Error('No video file selected')

  const formData = new FormData()

  // Force file extension to .flv and mime type to video/x-flv (Required by ASR API)
  const originalName = videoFile.value.name
  const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
  const newName = `${nameWithoutExt}.flv`

  // Create a new Blob with the same data but forced content type
  const newBlob = new Blob([videoFile.value], { type: 'video/x-flv' })

  formData.append('file', newBlob, newName)
  formData.append('folder', 'video') // Specify jikang/video folder

  const uploadRes = await fetch('/api/rustfs/upload', {
    method: 'POST',
    body: formData
  })

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text()
    throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`)
  }

  const uploadData = await uploadRes.json()
  console.log('[Upload] Response:', uploadData)

  let fileUrl = ''
  if (uploadData.data && uploadData.data.url) {
    fileUrl = uploadData.data.url
  } else if (uploadData.url) {
    fileUrl = uploadData.url
  }

  if (!fileUrl) {
    const keys = Object.keys(uploadData)
    for (const key of keys) {
      if (key.toLowerCase() === 'url' && uploadData[key]) {
        fileUrl = uploadData[key]
        break
      }
    }
  }

  if (!fileUrl) {
    throw new Error(`Invalid upload response: ${JSON.stringify(uploadData)}`)
  }

  remoteVideoUrl.value = fileUrl.trim()
  return remoteVideoUrl.value
}

const formatTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}分${seconds}秒`
}

// 数字人视频生成相关函数

// 上传照片
const handlePhotoUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    digitalHumanState.value.photoFile = file
    digitalHumanState.value.photoUrl = URL.createObjectURL(file)
    digitalHumanState.value.photoInfo = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    }
    digitalHumanState.value.remotePhotoUrl = ''
    digitalHumanState.value.faceDetectState = {
      isDetecting: false,
      pass: false,
      message: '',
      error: ''
    }
  }
}

// 上传音频
const handleAudioUpload = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]
    digitalHumanState.value.audioFile = file
    digitalHumanState.value.audioUrl = URL.createObjectURL(file)
    digitalHumanState.value.audioInfo = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    }
    digitalHumanState.value.remoteAudioUrl = ''
    digitalHumanState.value.ttsState = {
      isGenerating: false,
      audioUrl: '',
      error: ''
    }
  }
}

// 上传文件到 RustFS
const uploadFileToRustFS = async (file: File, folder: string): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('folder', folder)

  const uploadRes = await fetch('/api/rustfs/upload', {
    method: 'POST',
    body: formData
  })

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text()
    throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`)
  }

  const uploadData = await uploadRes.json()
  let fileUrl = ''
  if (uploadData.data && uploadData.data.url) {
    fileUrl = uploadData.data.url
  } else if (uploadData.url) {
    fileUrl = uploadData.url
  }

  if (!fileUrl) {
    throw new Error(`Invalid upload response: ${JSON.stringify(uploadData)}`)
  }

  return fileUrl.trim()
}

// 语音合成
const generateTTS = async () => {
  if (!digitalHumanState.value.inputText.trim()) {
    alert('请输入文本内容')
    return
  }

  try {
    digitalHumanState.value.ttsState = {
      isGenerating: true,
      audioUrl: '',
      error: ''
    }

    const payload = {
      model: 'qwen3-tts-flash',
      input: {
        text: digitalHumanState.value.inputText,
        voice: 'Cherry',
        language_type: 'Chinese'
      }
    }

    const response = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS API call failed: ${response.status} - ${errorText}`)
    }

    const resJson = await response.json()
    if (!resJson.success) {
      throw new Error(resJson.error || 'TTS generation failed')
    }

    digitalHumanState.value.ttsState.audioUrl = resJson.data.audioUrl
    digitalHumanState.value.remoteAudioUrl = resJson.data.audioUrl
  } catch (error: any) {
    digitalHumanState.value.ttsState.error = error.message
  } finally {
    digitalHumanState.value.ttsState.isGenerating = false
  }
}

// 人脸检测
const detectFace = async () => {
  if (!digitalHumanState.value.photoFile && !digitalHumanState.value.remotePhotoUrl) {
    alert('请先上传照片')
    return
  }

  try {
    digitalHumanState.value.faceDetectState = {
      isDetecting: true,
      pass: false,
      message: '',
      error: ''
    }

    // 确保照片已上传到 RustFS
    if (!digitalHumanState.value.remotePhotoUrl && digitalHumanState.value.photoFile) {
      digitalHumanState.value.remotePhotoUrl = await uploadFileToRustFS(digitalHumanState.value.photoFile, 'photo')
    }

    const payload = {
      model: 'liveportrait-detect',
      input: {
        image_url: digitalHumanState.value.remotePhotoUrl
      }
    }

    const response = await fetch('/api/face/detect', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Face detect API call failed: ${response.status} - ${errorText}`)
    }

    const resJson = await response.json()
    if (!resJson.success) {
      throw new Error(resJson.error || 'Face detection failed')
    }

    digitalHumanState.value.faceDetectState.pass = resJson.data.pass
    digitalHumanState.value.faceDetectState.message = resJson.data.message
  } catch (error: any) {
    digitalHumanState.value.faceDetectState.error = error.message
  } finally {
    digitalHumanState.value.faceDetectState.isDetecting = false
  }
}

// 生成视频
const generateDigitalHumanVideo = async () => {
  if (!digitalHumanState.value.remotePhotoUrl) {
    alert('请先上传照片并通过人脸检测')
    return
  }

  if (!digitalHumanState.value.remoteAudioUrl) {
    alert('请先上传音频或生成语音')
    return
  }

  try {
    digitalHumanState.value.videoGenerateState = {
      isGenerating: true,
      taskId: '',
      status: 'PENDING',
      progress: 0,
      videoUrl: '',
      error: ''
    }

    const payload = {
      model: 'liveportrait',
      input: {
        image_url: digitalHumanState.value.remotePhotoUrl,
        audio_url: digitalHumanState.value.remoteAudioUrl
      },
      parameters: {
        template_id: digitalHumanState.value.parameters.templateId,
        eye_move_freq: digitalHumanState.value.parameters.eyeMoveFreq,
        video_fps: digitalHumanState.value.parameters.videoFps,
        mouth_move_strength: digitalHumanState.value.parameters.mouthMoveStrength,
        paste_back: digitalHumanState.value.parameters.pasteBack,
        head_move_strength: digitalHumanState.value.parameters.headMoveStrength
      }
    }

    const response = await fetch('/api/video/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Video generate API call failed: ${response.status} - ${errorText}`)
    }

    const resJson = await response.json()
    if (!resJson.success) {
      throw new Error(resJson.error || 'Video generation failed')
    }

    digitalHumanState.value.videoGenerateState.taskId = resJson.data.taskId
    digitalHumanState.value.videoGenerateState.status = resJson.data.taskStatus

    // 开始轮询任务状态
    pollTaskStatus(resJson.data.taskId)
  } catch (error: any) {
    digitalHumanState.value.videoGenerateState.error = error.message
    digitalHumanState.value.videoGenerateState.isGenerating = false
  }
}

// 轮询任务状态
const pollTaskStatus = async (taskId: string) => {
  let attempts = 0
  const maxAttempts = 300 // 最多轮询10分钟

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)) // 每2秒轮询一次
    attempts++

    try {
      const response = await fetch(`/api/video/task/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })

      if (!response.ok) {
        throw new Error(`Task status API call failed: ${response.status}`)
      }

      const resJson = await response.json()
      if (!resJson.success) {
        throw new Error(resJson.error || 'Task status query failed')
      }

      const status = resJson.data.status
      digitalHumanState.value.videoGenerateState.status = status
      digitalHumanState.value.videoGenerateState.progress = (attempts / maxAttempts) * 100

      if (status === 'SUCCEEDED') {
        digitalHumanState.value.videoGenerateState.videoUrl = resJson.data.videoUrl
        digitalHumanState.value.videoGenerateState.progress = 100
        digitalHumanState.value.videoGenerateState.isGenerating = false
        break
      } else if (status === 'FAILED') {
        digitalHumanState.value.videoGenerateState.error = resJson.data.message || 'Video generation failed'
        digitalHumanState.value.videoGenerateState.isGenerating = false
        break
      }
    } catch (error: any) {
      console.error('Poll task status error:', error)
    }
  }

  if (attempts >= maxAttempts) {
    digitalHumanState.value.videoGenerateState.error = '任务超时，请稍后查询'
    digitalHumanState.value.videoGenerateState.isGenerating = false
  }
}

// 重置数字人视频生成状态
const resetDigitalHumanState = () => {
  digitalHumanState.value = {
    photoFile: null,
    photoUrl: '',
    photoInfo: null,
    audioFile: null,
    audioUrl: '',
    audioInfo: null,
    inputText: '',
    ttsState: {
      isGenerating: false,
      audioUrl: '',
      error: ''
    },
    faceDetectState: {
      isDetecting: false,
      pass: false,
      message: '',
      error: ''
    },
    videoGenerateState: {
      isGenerating: false,
      taskId: '',
      status: '',
      progress: 0,
      videoUrl: '',
      error: ''
    },
    parameters: {
      templateId: 'normal',
      eyeMoveFreq: 0.5,
      videoFps: 24,
      mouthMoveStrength: 1,
      pasteBack: true,
      headMoveStrength: 0.7
    },
    remotePhotoUrl: '',
    remoteAudioUrl: ''
  }
}

const copyTranscription = async () => {
  let transcriptionText = ''

  if (asrState.value.result) {
    // Extract text from Paraformer-v2 format
    if (asrState.value.result.transcripts && asrState.value.result.transcripts.length > 0) {
      transcriptionText = asrState.value.result.transcripts
        .map((t: any) => t.text || '')
        .join('\n\n')
    } else if (asrState.value.result.sentences) {
      transcriptionText = asrState.value.result.sentences
        .map((s: any) => s.text || '')
        .join(' ')
    } else if (transcriptionResult.value) {
      transcriptionText = transcriptionResult.value
    }
  }

  if (transcriptionText) {
    try {
      await navigator.clipboard.writeText(transcriptionText)
      // Show success message
      const button = event.target as HTMLElement
      const originalText = button.textContent
      button.textContent = '已复制!'
      button.classList.add('bg-[#4ade80]', 'text-black')

      setTimeout(() => {
        button.textContent = originalText
        button.classList.remove('bg-[#4ade80]', 'text-black')
      }, 2000)
    } catch (err) {
      console.error('Failed to copy transcription:', err)
      alert('复制失败，请手动选择文本复制')
    }
  } else {
    alert('没有可复制的转录内容')
  }
}

const startAsr = async () => {
  if (!videoFile.value && !remoteVideoUrl.value) return

  asrState.value.isProcessing = true
  asrState.value.error = ''
  asrState.value.result = null
  asrState.value.progress = 0
  asrState.value.status = 'Preparing...'

  try {
    let submitRes

    // Check if we already have a remote URL (from previous upload or analysis)
    if (!remoteVideoUrl.value && videoFile.value) {
      console.log('[ASR] No remote URL, uploading file first...')
      asrState.value.status = 'Uploading...'
      await uploadVideo()
    }

    if (remoteVideoUrl.value) {
      console.log('[ASR] Submitting task with URL:', remoteVideoUrl.value)
      asrState.value.status = 'Submitting...'

      submitRes = await fetch('/api/asr/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_urls: [remoteVideoUrl.value],
          model: asrState.value.model,
          language_hints: asrState.value.languageHints,
          speaker_count: asrState.value.speakerCount,
          diarization_enabled: asrState.value.diarizationEnabled,
          timestamp_alignment_enabled: asrState.value.timestampAlignmentEnabled,
          disfluency_removal_enabled: asrState.value.disfluencyRemovalEnabled,
          special_word_filter: asrState.value.specialWordFilter,
          channel_id: asrState.value.channelId,
          vocabulary_id: asrState.value.vocabularyId
        })
      })
    } else {
      throw new Error('No video file or URL available')
    }

    if (!submitRes.ok) {
      const errorData = await submitRes.json().catch(() => ({}))
      throw new Error(errorData.message || `Submission failed: ${submitRes.status} ${submitRes.statusText}`)
    }

    const submitData = await submitRes.json()
    if (!submitData.success) {
      throw new Error(submitData.message || 'Submission failed')
    }

    // Support both response formats (submit endpoint returns output.task_id)
    const taskId = submitData.data?.taskId || submitData.output?.task_id
    if (!taskId) {
      throw new Error('No taskId returned from submission')
    }
    asrState.value.taskId = taskId

    // Update remoteVideoUrl if returned (so next time we use the URL)
    if (submitData.data?.fileUrl && !remoteVideoUrl.value) {
      remoteVideoUrl.value = submitData.data.fileUrl
    }

    // 3. Poll for results
    asrState.value.status = 'Processing...'
    let completed = false
    let attempts = 0

    while (!completed && attempts < 600) { // Timeout ~10 mins
      await new Promise(r => setTimeout(r, 2000)) // Poll every 2s

      const queryRes = await fetch('/api/asr/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.value}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task_id: taskId
        })
      })

      if (queryRes.ok) {
        const queryData = await queryRes.json()
        const status = queryData.data?.status

        if (status === 'SUCCEEDED') {
          completed = true
          asrState.value.result = queryData.output?.results || queryData.data?.rawResult
          asrState.value.status = 'Completed'

          // 更新 transcriptionResult 以兼容旧逻辑
          // 从 Paraformer-v2 结果中提取转录文本
          if (queryData.output?.results && queryData.output.results[0]) {
            const result = queryData.output.results[0]
            if (result.transcripts && result.transcripts[0]) {
              transcriptionResult.value = result.transcripts[0].text || ''
            } else if (result.transcript) {
              transcriptionResult.value = result.transcript
            }
          } else if (queryData.data?.transcription) {
            transcriptionResult.value = queryData.data.transcription
          }
        } else if (status === 'FAILED') {
          throw new Error(queryData.output?.message || queryData.data?.message || 'ASR Task Failed')
        }
      }
      attempts++
    }
  } catch (e: any) {
    asrState.value.error = e.message
    asrState.value.status = 'Error'
  } finally {
    asrState.value.isProcessing = false
  }
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
    remoteVideoUrl.value = '' // Clear remote URL for new file
    // 保存文件信息用于缓存
    videoFileInfo.value = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified
    }
    analysisResult.value = null
    analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }

    // 尝试加载缓存
    if (videoFileInfo.value) {
      const cached = loadVideoCache(videoFileInfo.value)
      if (cached) {
        analysisResult.value = cached
        console.log('[视频解析] 已从缓存恢复分析结果')
      }
    }
  }
}

// 提取视频帧
const extractFrames = async (url: string, startTime: number, endTime: number, maxFrames = 5): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.src = url

    const frames: string[] = []
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    video.onloadedmetadata = async () => {
      const duration = endTime - startTime
      const interval = duration / maxFrames
      let currentTime = startTime

      const captureFrame = async () => {
        if (currentTime >= endTime || frames.length >= maxFrames) {
          resolve(frames)
          return
        }

        video.currentTime = currentTime
        await new Promise((r) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked)
            r(null)
          }
          video.addEventListener('seeked', onSeeked)
        })

        // 缩放尺寸以减少数据量 (强制最大 512px)
        const maxDimension = 512
        const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
        canvas.width = Math.floor(video.videoWidth * scale)
        canvas.height = Math.floor(video.videoHeight * scale)

        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height)

        // 使用较低质量 JPEG 压缩
        let dataUrl = canvas.toDataURL('image/jpeg', 0.5)

        // 双重检查大小，如果仍然过大(>500KB)，继续缩小
        if (dataUrl.length > 500 * 1024) {
          const canvas2 = document.createElement('canvas')
          canvas2.width = Math.floor(canvas.width * 0.5)
          canvas2.height = Math.floor(canvas.height * 0.5)
          const ctx2 = canvas2.getContext('2d')
          ctx2?.drawImage(canvas, 0, 0, canvas2.width, canvas2.height)
          dataUrl = canvas2.toDataURL('image/jpeg', 0.5)
        }

        console.log(`[VideoBreakdown] Frame ${frames.length + 1} extracted: ${canvas.width}x${canvas.height}, Size: ${(dataUrl.length / 1024).toFixed(2)}KB`)
        frames.push(dataUrl)

        currentTime += interval
        await captureFrame()
      }

      await captureFrame()
    }

    video.onerror = e => reject(e)
  })
}

// 音频提取函数
const extractAudio = async () => {
  if (!videoFile.value) {
    audioExtractState.value.error = '请先上传视频'
    return
  }

  try {
    audioExtractState.value.isProcessing = true
    audioExtractState.value.status = '正在上传视频并提取音频...'
    audioExtractState.value.error = ''
    audioExtractState.value.result = null

    console.log('🎵 开始提取音频:', {
      fileName: videoFile.value.name,
      format: audioExtractState.value.format,
      quality: audioExtractState.value.quality
    })

    // 创建表单数据 - 使用新的video2mp3 API
    const formData = new FormData()
    formData.append('file', videoFile.value)
    formData.append('bitrate', audioExtractState.value.quality === 'high' ? '320k' : audioExtractState.value.quality === 'low' ? '64k' : '192k')
    formData.append('sample_rate', '44100')

    // 第一步：上传视频文件，获取任务ID
    const uploadResponse = await fetch('/api/audio-extract/video2mp3/upload/local', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error(`视频上传失败: ${uploadResponse.statusText}`)
    }

    const uploadResult = await uploadResponse.json()
    const taskId = uploadResult.task_id

    if (!taskId) {
      throw new Error('未获取到任务ID')
    }

    console.log('✅ 视频上传成功，任务ID:', taskId)
    audioExtractState.value.status = '正在处理音频转换...'

    // 第二步：轮询任务状态
    let attempts = 0
    const maxAttempts = 60 // 最多等待5分钟

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // 等待5秒

      const statusResponse = await fetch(`/api/audio-extract/video2mp3/status/${taskId}`)

      if (!statusResponse.ok) {
        throw new Error(`查询状态失败: ${statusResponse.statusText}`)
      }

      const statusResult = await statusResponse.json()

      console.log('📊 任务状态:', statusResult)

      if (statusResult.status === 'completed') {
        // 转换完成，下载音频文件
        const audioUrl = statusResult.output_url
        if (!audioUrl) {
          throw new Error('未获取到音频文件URL')
        }

        audioExtractState.value.status = '正在下载音频文件...'

        // 下载音频文件
        const runtimeConfig = useRuntimeConfig()
        // 使用Nuxt代理访问静态文件
        const downloadResponse = await fetch(`${runtimeConfig.public.apiBase.replace('/api', '')}${audioUrl}`)
        if (!downloadResponse.ok) {
          throw new Error(`音频下载失败: ${downloadResponse.statusText}`)
        }

        const blob = await downloadResponse.blob()
        const url = window.URL.createObjectURL(blob)

        // 创建下载链接并触发下载
        const a = document.createElement('a')
        a.href = url
        a.download = `extracted-audio-${Date.now()}.mp3`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // 清理URL
        window.URL.revokeObjectURL(url)

        audioExtractState.value.status = '音频下载完成!'
        audioExtractState.value.result = {
          taskId,
          audioUrl,
          fileName: `extracted-audio-${Date.now()}.mp3`
        }

        // 保存音频URL用于播放
        const config = useRuntimeConfig()
        audioExtractState.value.audioUrl = `${config.public.apiBase.replace('/api', '')}${audioUrl}`

        console.log('✅ 音频提取并下载成功')
        return
      } else if (statusResult.status === 'failed') {
        throw new Error(statusResult.error || '音频转换失败')
      }

      // 更新进度
      const progress = statusResult.progress || 0
      audioExtractState.value.status = `正在处理音频转换... (${Math.round(progress)}%)`

      attempts++
    }

    throw new Error('音频转换超时，请稍后重试')
  } catch (error: any) {
    console.error('❌ 音频提取失败:', error)
    audioExtractState.value.error = error.message || '音频提取失败'
    audioExtractState.value.status = ''
  } finally {
    audioExtractState.value.isProcessing = false
  }
}

// 下载音频文件
const downloadAudioFile = async () => {
  if (!audioExtractState.value.audioUrl) {
    return
  }

  try {
    const response = await fetch(audioExtractState.value.audioUrl)
    if (!response.ok) {
      throw new Error('下载失败')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)

    // 创建下载链接并触发下载
    const a = document.createElement('a')
    a.href = url
    a.download = audioExtractState.value.result?.fileName || `extracted-audio-${Date.now()}.mp3`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 清理URL
    window.URL.revokeObjectURL(url)

    console.log('✅ 音频文件下载成功')
  } catch (error: any) {
    console.error('❌ 音频下载失败:', error)
    alert('音频下载失败，请重试')
  }
}

// 剪映口播脚本相关函数
const addScriptSegment = () => {
  const lastTime = editableScript.value[editableScript.value.length - 1]?.startTime || '00:00'
  const [minutes, seconds] = lastTime.split(':').map(Number)
  const newTime = minutes * 60 + seconds + 5
  const newMinutes = Math.floor(newTime / 60)
  const newSeconds = newTime % 60
  const timeString = `${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')}`

  editableScript.value.push({
    startTime: timeString,
    content: ''
  })
}

const removeScriptSegment = (index: number) => {
  editableScript.value.splice(index, 1)
}

const resetScript = () => {
  editableScript.value = [
    { startTime: '00:00', content: '欢迎来到我的频道，今天要和大家分享...' },
    { startTime: '00:05', content: '首先让我们来看看这个有趣的现象...' },
    { startTime: '00:10', content: '通过深入分析，我发现了一些关键点...' }
  ]
}

const exportToJianying = () => {
  if (!contentGenerationState.generatedContent?.jianyingExport) return

  const { script, timeline } = contentGenerationState.generatedContent.jianyingExport

  let exportContent = '剪映专业脚本\n'
  exportContent += '==================\n\n'

  // 脚本概述
  exportContent += `脚本标题: ${analysisResult.value?.script?.title || 'AI生成脚本'}\n`
  exportContent += `总时长: ${contentGenerationState.generatedContent.videoScript.duration}秒\n`
  exportContent += `生成时间: ${new Date().toLocaleString()}\n\n`

  // 时间线脚本
  exportContent += '时间线脚本:\n'
  exportContent += '------------\n\n'

  timeline.forEach((item, index) => {
    exportContent += `${index + 1}. [${item.time}] (${item.duration}s)\n`
    exportContent += `   口播: ${item.text}\n\n`
  })

  // 完整脚本
  exportContent += '完整脚本内容:\n'
  exportContent += '---------------\n\n'
  exportContent += script + '\n\n'

  // 分镜描述
  if (contentGenerationState.generatedContent.videoScript.scenes) {
    exportContent += '分镜描述:\n'
    exportContent += '----------\n\n'
    contentGenerationState.generatedContent.videoScript.scenes.forEach((scene, index) => {
      exportContent += `${index + 1}. ${scene.shot} (${scene.timestamp})\n`
      exportContent += `   画面: ${scene.content}\n`
      exportContent += `   口播: ${scene.narration}\n`
      exportContent += `   AI提示: ${scene.prompt}\n\n`
    })
  }

  exportContent += '==================\n'
  exportContent += '* 剪映导入说明: 复制时间线脚本到剪映口播功能，或手动添加字幕 *\n'

  const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `剪映脚本_${new Date().getTime()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  window.URL.revokeObjectURL(url)

  console.log('✅ 剪映脚本导出成功')
}

const copyJianyingScript = () => {
  if (!contentGenerationState.generatedContent?.jianyingExport?.script) return

  const scriptText = contentGenerationState.generatedContent.jianyingExport.script
  navigator.clipboard.writeText(scriptText).then(() => {
    alert('剪映脚本已复制到剪贴板！')
  }).catch(err => {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制')
  })
}

// 复制音频URL
const copyAudioUrl = async (url: string) => {
  try {
    await navigator.clipboard.writeText(url)
    // 显示成功提示
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = '音频链接已复制到剪贴板'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 分析单个片段
const analyzeChunk = async (frames: string[], chunkIndex: number, startTime: number, endTime: number) => {
  const systemPrompt = `你是一个专业的短视频分析师。请分析这段 ${startTime}秒 到 ${endTime}秒 的视频片段。
请严格按照以下 JSON 格式输出分析结果：
{
  "timeSegments": [
    { "time": "${startTime}-${endTime}", "content": "画面内容描述", "hook": "如有钩子请描述" }
  ],
  "scenes": [
    { "shot": "景别", "content": "分镜内容", "audio": "音效" }
  ],
  "highlights": ["本片段亮点1", "本片段亮点2"]
}`

  const payload = {
    model: 'qwen3-omni-flash-2025-12-01', // 使用支持多图的 VL 模型
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          ...frames.map(frame => ({ type: 'image_url', image_url: { url: frame } }))
        ]
      }
    ]
  }

  const response = await fetch('/api/writing-assistant/chat/completion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3-omni-flash-2025-12-01',
      messages: payload.messages,
      stream: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Chunk ${chunkIndex} analysis failed: ${response.status} - ${errorText}`)
  }

  const resJson = await response.json()
  if (!resJson.success) {
    throw new Error(resJson.error || 'Analysis failed')
  }

  // Dispatch token usage event
  if (resJson.usage) {
    window.dispatchEvent(new CustomEvent('token_usage', {
      detail: {
        tokens: resJson.usage.total_tokens
      }
    }))
  }

  const content = resJson.data.choices[0].message.content
  const jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  return JSON.parse(jsonStr)
}

// 视觉上下文分析 (新增)
const analyzeVisualContext = async (frames: string[], type: 'prequel' | 'sequel') => {
  const prompt = type === 'prequel'
    ? '请仔细分析这段视频的前3秒画面。详细描述场景环境、光影风格、人物状态和整体氛围。并基于画面推测：这段内容之前可能发生了什么？为创作前传提供视觉依据。'
    : '请仔细分析这段视频的最后3秒画面。详细描述场景环境、光影风格、人物状态和整体氛围。并基于画面推测：这段内容之后可能会发生什么？为创作后续提供视觉依据。'

  const payload = {
    model: 'qwen3-omni-flash-2025-12-01',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...frames.map(frame => ({ type: 'image_url', image_url: { url: frame } }))
        ]
      }
    ]
  }

  const response = await fetch('/api/writing-assistant/chat/completion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3-omni-flash-2025-12-01',
      messages: payload.messages,
      stream: false
    })
  })

  if (!response.ok) throw new Error('Visual analysis failed')
  const resJson = await response.json()
  if (!resJson.success) throw new Error(resJson.error || 'Visual analysis failed')

  if (resJson.usage) {
    window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
  }

  return resJson.data.choices[0].message.content
}

// 综合分析
const synthesizeResults = async (chunkResults: any[], totalDuration: number) => {
  const combinedContext = JSON.stringify(chunkResults)

  const systemPrompt = `你是一个专业的短视频分析师。基于以下分段分析结果，生成完整的智能视频工作台分析报告。
输入的分段数据：
${combinedContext}

请严格按照以下 JSON 格式输出最终报告。

**重要要求**：
1. 脚本总时长必须严格等于视频实际总时长秒数。
2. 每个分镜头的时长必须大于等于 3 秒。
3. 必须在开场前 3 秒内嵌入"黄金三秒钩子"。
4. 按照专业影视机构标准进行解析和脚本创作。
5. 提示词（Prompt）必须专业且高质量，用于 AI 视频生成。
6. 视频比例默认为竖屏 (9:16)。
7. **必须生成完整的口播二创内容**：基于视频内容创作一段完整的口播文案，字数要完整（建议 200-500 字），适合直接用于视频配音，语言要流畅自然，符合短视频口播风格。
 8. **必须进行深度人物分析**：识别视频中的人物，分析其外貌、行为、价值观。并构建**多根节点的图结构数据（influenceGraph）**，展示人物的影响力架构。图结构应包含节点（人物、组织、渠道、受众等）和边（关联关系），支持多个根节点，节点之间保持关联规则。

请严格按照以下 JSON 格式输出最终报告：
{
  "timeSegments": [
    { "time": "00:00 - 00:03", "content": "画面内容描述", "hook": "使用的钩子技巧" }
  ],
  "subtitles": "画面中识别到的所有字幕内容（OCR提取），请按时间顺序整理",
  "viralReasons": ["爆款原因1", "爆款原因2", "爆款原因3", "爆款原因4"],
  "characterAnalysis": {
    "characters": [
      {
        "name": "人物名称/代称",
        "gender": "性别",
        "age": "年龄段",
        "avatar": "人物头像描述(用于生成占位符)",
        "appearance": "外貌/美丑评价",
        "behavior": "行为特征分析",
        "values": "三观/价值观分析"
      }
    ],
    "audienceResonance": {
      "targetAudience": ["目标人群1", "目标人群2"],
      "resonancePoints": ["共鸣点1", "共鸣点2"],
      "distributionChannels": ["传播渠道1", "传播渠道2"]
    },
    "influenceGraph": {
      "nodes": [
        {
          "id": "node1",
          "name": "核心人物",
          "type": "character",
          "attributes": {
            "influence": "high",
            "centrality": 0.9
          }
        },
        {
          "id": "node2",
          "name": "关联组织",
          "type": "organization",
          "attributes": {
            "influence": "medium",
            "centrality": 0.7
          }
        },
        {
          "id": "node3",
          "name": "传播渠道",
          "type": "channel",
          "attributes": {
            "influence": "medium",
            "centrality": 0.6
          }
        },
        {
          "id": "node4",
          "name": "目标受众",
          "type": "audience",
          "attributes": {
            "influence": "low",
            "centrality": 0.4
          }
        }
      ],
      "edges": [
        {
          "source": "node1",
          "target": "node2",
          "relation": "领导关系",
          "weight": 0.8,
          "rules": ["层级管理", "决策影响"]
        },
        {
          "source": "node1",
          "target": "node3",
          "relation": "传播关系",
          "weight": 0.7,
          "rules": ["信息传递", "渠道依赖"]
        },
        {
          "source": "node2",
          "target": "node4",
          "relation": "服务关系",
          "weight": 0.6,
          "rules": ["需求满足", "价值提供"]
        },
        {
          "source": "node3",
          "target": "node4",
          "relation": "影响关系",
          "weight": 0.9,
          "rules": ["内容传播", "情感共鸣"]
        }
      ],
      "rootNodes": ["node1", "node2"]
    }
  },
  "platformFit": {
    "douyin": "抖音平台适应性分析",
    "xiaohongshu": "小红书平台适应性分析",
    "bonusPoints": ["加分项1", "加分项2", "加分项3"],
    "audience": "目标人群画像描述"
  },
  "deepAnalysis": {
    "innerAwareness": "内觉分析",
    "outerObservation": "外察分析",
    "dao": "道",
    "fa": "法",
    "shu": "术",
    "qi": "器"
  },
  "hookAnalysis": {
    "location": "钩子时间点",
    "element": "钩子类型",
    "description": "钩子分析"
  },
  "narration": {
    "content": "完整的口播二创内容，字数完整（200-500字），适合直接用于视频配音，语言流畅自然，符合短视频口播风格",
    "wordCount": 0
  },
  "prompts": ["AI复刻提示词1", "AI复刻提示词2"],
  "script": {
    "title": "建议标题",
    "scenes": [
      { "shot": "景别", "content": "分镜内容", "audio": "音效建议" }
    ]
  },
  "pdcaAdvice": {
    "plan": "P策划优化",
    "do": "D执行建议",
    "check": "C数据预判",
    "act": "A迭代方向"
  },
  "scriptAnalysis": {
    "shotTypes": "镜头类型分析",
    "cameraMovement": "运镜技巧分析",
    "composition": "构图分析",
    "depthOfField": "景深控制分析",
    "narrativeStructure": "叙事结构分析",
    "pacing": "节奏控制分析",
    "conflict": "冲突设置分析",
    "climax": "高潮设计分析"
  },
  "emotionAnalysis": {
    "positive": "正面情绪百分比",
    "negative": "负面情绪百分比",
    "neutral": "中性情绪百分比",
    "emotionTags": ["情绪标签1", "情绪标签2", "情绪标签3"]
  },
  "behaviorAnalysis": {
    "userJourney": ["用户行为路径1", "用户行为路径2"],
    "conversionNodes": {
      "retention3s": "前3秒留存率",
      "completion": "完播率",
      "interaction": "互动率",
      "sharing": "分享率"
    }
  },
  "contentScreening": {
    "slipOfTongue": {
      "detected": "口误检测数量",
      "examples": ["口误示例1", "口误示例2"],
      "suggestion": "优化建议"
    },
    "colloquialism": {
      "level": "口语化程度",
      "examples": ["口语化示例1", "口语化示例2"],
      "suggestion": "优化建议"
    },
    "internetSense": {
      "score": "网感匹配度",
      "issues": ["网感问题1", "网感问题2"],
      "suggestion": "优化建议"
    },
    "aiGenerated": {
      "probability": "AI生成概率",
      "indicators": ["AI指标1", "AI指标2"],
      "suggestion": "优化建议"
    },
    "softMarketing": {
      "tendency": "营销倾向",
      "triggers": ["营销触发点1", "营销触发点2"],
      "suggestion": "优化建议"
    }
  }
}`

  const payload = {
    model: 'qwen-plus', // 使用文本模型进行综合
    messages: [
      { role: 'user', content: systemPrompt }
    ]
  }

  const response = await fetch('/api/writing-assistant/chat/completion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: payload.messages,
      stream: false
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Synthesis failed: ${response.status} - ${errorText}`)
  }

  const resJson = await response.json()
  if (!resJson.success) throw new Error(resJson.error || 'Synthesis failed')

  if (resJson.usage) {
    window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
  }

  const content = resJson.data.choices[0].message.content
  const result = safeJsonParse(content)

  // 确保口播内容存在并计算字数
  if (result.narration && result.narration.content) {
    // 计算字数（中文字符 + 英文单词）
    const chineseChars = (result.narration.content.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = result.narration.content.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter((w: string) => w.length > 0).length
    result.narration.wordCount = chineseChars + englishWords
  } else if (!result.narration) {
    // 如果没有生成口播内容，创建一个默认的
    result.narration = {
      content: '口播内容生成中...',
      wordCount: 0
    }
  }

  return result
}

const optimizeScriptWithDuration = async () => {
  if (!analysisResult.value) return

  isAnalyzing.value = true
  analysisProgress.value = { status: 'synthesizing', current: 0, total: 0, message: '正在按时长重拍并优化脚本...' }

  try {
    // 使用用户设定的时长
    const duration = extensionDuration.value

    const currentScript = JSON.stringify(analysisResult.value)

    const systemPrompt = `你是一个专业的影视级脚本优化师。请对以下视频解析结果进行深度优化和重拍。
     
     输入数据：
     ${currentScript}
     
     **核心要求**：
     1. **严格按时长重拍**：总时长必须严格等于 ${duration} 秒。
     2. **专业分镜**：每个镜头时长不得小于 3 秒。
     3. **黄金钩子**：必须在开场 3 秒内植入强吸引力的“黄金三秒钩子”。
     4. **影视级标准**：使用专业影视术语（如推、拉、摇、移、特写、全景等）优化分镜描述。
     5. **AI 提示词优化**：为每个分镜生成适配 Sora/Veo 等大模型的高质量提示词（英文）。
     
     请输出与原格式完全一致的 JSON 数据，仅更新 script 部分和 prompts 部分，保持其他分析内容不变。
     `

    const payload = {
      model: 'qwen-plus',
      messages: [
        { role: 'user', content: systemPrompt }
      ]
    }

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: payload.messages,
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error('Optimization failed')
    }

    const resJson = await response.json()
    if (!resJson.success) throw new Error(resJson.error || 'Optimization failed')

    if (resJson.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
    }

    const content = resJson.data.choices[0].message.content
    const jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
    const optimizedResult = JSON.parse(jsonStr)

    // Merge optimized script back
    analysisResult.value.script = optimizedResult.script
    if (optimizedResult.prompts) analysisResult.value.prompts = optimizedResult.prompts

    alert('脚本已按时长重拍并优化完成！')
  } catch (e: any) {
    console.error(e)
    alert(`优化失败: ${e.message}`)
  } finally {
    isAnalyzing.value = false
    analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }
  }
}

const startAnalysis = async () => {
  if (!videoFile.value || !videoFileInfo.value) return

  // 检查是否有缓存
  if (videoFileInfo.value) {
    const cached = loadVideoCache(videoFileInfo.value)
    if (cached) {
      if (confirm('检测到该视频已有缓存的分析结果，是否直接使用缓存？\n点击"确定"使用缓存，点击"取消"重新分析。')) {
        analysisResult.value = cached
        console.log('[视频解析] 使用缓存结果')
        return
      }
    }
  }

  // 积分扣除：检查余额并扣除积分

  // 使用user.value.balance检查余额
  if (userBalance.value < VIDEO_ANALYSIS_COST) {
    alert(`积分不足！视频解析需要 ${VIDEO_ANALYSIS_COST} 积分，当前余额 ${userBalance.value} 积分。请前往充值页面充值。`)
    return
  }

  try {
    // 扣除积分
    await $fetch('/api/wallet/consume', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
      body: { amount: VIDEO_ANALYSIS_COST, description: '视频解析消耗' }
    })
    console.log(`[视频解析] 已扣除 ${VIDEO_ANALYSIS_COST} 积分`)

    // 更新用户余额和本地缓存的余额
    console.log('[视频解析] 更新用户余额前:', userBalance.value)
    await useAuth().fetchUser()
    console.log('[视频解析] 更新用户余额后:', user.value?.balance)
    await fetchUserBalance()
    console.log('[视频解析] 更新本地余额后:', localBalance.value)
  } catch (e: any) {
    console.error('积分扣除失败:', e)
    alert(`积分扣除失败: ${e.message || '请稍后重试'}`)
    return
  }

  // 创建新的AbortController
  analysisAbortController.value = new AbortController()
  const signal = analysisAbortController.value.signal

  isAnalyzing.value = true
  analysisResult.value = null
  analysisProgress.value = { status: 'extracting', current: 0, total: 0, message: '准备视频处理...' }

  try {
    // 检查是否已停止
    if (signal.aborted) throw new Error('Analysis aborted')

    // 0. 上传视频 (优先) - 满足用户需求：先上传到 RustFS (jikang/video/xxx)
    analysisProgress.value = { status: 'extracting', current: 0, total: 0, message: '正在上传视频到服务器...' }
    await uploadVideo()

    if (signal.aborted) throw new Error('Analysis aborted')

    // 启动 ASR (后台运行，不阻塞视觉分析)
    // 注意：startAsr 内部会检测 remoteVideoUrl，不会重复上传
    startAsr()

    // 1. 获取视频时长
    const video = document.createElement('video')
    video.src = videoUrl.value
    await new Promise(r => video.onloadedmetadata = r)
    const duration = video.duration

    if (signal.aborted) throw new Error('Analysis aborted')

    // 更新默认扩展时长为视频原时长
    extensionDuration.value = Math.round(duration)

    // 2. 确定分片
    const chunkSize = 15 // 15秒一个片段
    const totalChunks = Math.ceil(duration / chunkSize)
    analysisProgress.value = { status: 'extracting', current: 0, total: totalChunks, message: '正在进行分片提取...' }

    const chunkResults = []

    // 3. 逐步分析（支持停止）
    for (let i = 0; i < totalChunks; i++) {
      // 每次循环检查是否已停止
      if (signal.aborted) throw new Error('Analysis aborted')

      const startTime = i * chunkSize
      const endTime = Math.min((i + 1) * chunkSize, duration)

      analysisProgress.value = {
        status: 'analyzing',
        current: i + 1,
        total: totalChunks,
        message: `正在分析第 ${i + 1}/${totalChunks} 个片段 (${Math.round(startTime)}s - ${Math.round(endTime)}s)...`
      }

      // 提取帧
      const frames = await extractFrames(videoUrl.value, startTime, endTime)

      if (signal.aborted) throw new Error('Analysis aborted')

      // 分析片段
      const result = await analyzeChunk(frames, i, startTime, endTime)
      chunkResults.push(result)
    }

    if (signal.aborted) throw new Error('Analysis aborted')

    // 4. 综合结果
    analysisProgress.value = { status: 'synthesizing', current: totalChunks, total: totalChunks, message: '正在生成最终解析报告...' }
    const finalResult = await synthesizeResults(chunkResults, duration)

    if (signal.aborted) throw new Error('Analysis aborted')

    // 增加转录字段 (如果 ASR 已完成)
    if (transcriptionResult.value) {
      finalResult.transcription = transcriptionResult.value
    } else {
      // 如果 ASR 还在运行，transcriptionResult 可能为空，
      // 但由于 startAsr 是并行运行的，这里不做阻塞等待。
      // 用户可以在界面上看到 ASR 的进度。
    }

    analysisResult.value = finalResult

    // 保存到缓存（watch 会自动触发，但这里显式调用确保保存）
    if (videoFileInfo.value) {
      saveVideoCache(videoFileInfo.value, finalResult)
      console.log('[视频解析] 分析完成，结果已保存到本地缓存')
    }

    // 保存到历史
    saveToHistory(finalResult)

    emit('analysis-complete', finalResult)
  } catch (error: any) {
    // 如果是用户主动停止，不显示错误
    if (error.message === 'Analysis aborted') {
      console.log('[视频解析] 用户停止了解析')
      return
    }
    
    console.error('Analysis failed:', error)
    alert(`分析失败: ${error.message}`)
  } finally {
    isAnalyzing.value = false
    analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }
  }
}

// --- 剪映导出逻辑 ---
const jianyingDraftPath = ref('C:\\Users\\ROG\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft')

const fetchJianyingDrafts = async () => {
  try {
    const res = await $fetch('/jianying/list')
    if (res.success) {
      jianyingDrafts.value = res.drafts
    }
  } catch (e) {
    console.error('Failed to fetch drafts', e)
  }
}

// --- 视频生成逻辑 ---
const generatedVideos = ref<GeneratedVideo[]>([])
const selectedSceneIndices = ref(new Set<number>())
const videoGenerationConfig = ref({
  model: 'sora-2', // Default model
  aspectRatio: '16:9',
  duration: 10
})

const availableModels = [
  { label: 'Sora-2', value: 'sora-2' },
  { label: 'Sora-2 Portrait', value: 'sora-2-portrait' },
  { label: 'Veo3', value: 'veo3' }
]

const continueScript = async () => {
  if (!analysisResult.value) return
  isAnalyzing.value = true
  analysisProgress.value = { status: 'synthesizing', current: 0, total: 0, message: '正在进行全模态分析 (基于视频结尾生成前传)...' }

  try {
    // 1. 视觉分析 (改为后3秒，响应用户需求：根据视频最后几句话/画面)
    let visualContext = ''
    if (videoUrl.value) {
      try {
        const video = document.createElement('video')
        video.src = videoUrl.value
        await new Promise(r => video.onloadedmetadata = r)
        const duration = video.duration

        const startTime = Math.max(0, duration - 3)
        const frames = await extractFrames(videoUrl.value, startTime, duration)
        if (frames.length > 0) {
          visualContext = await analyzeVisualContext(frames, 'sequel')
        }
      } catch (e) {
        console.warn('Visual analysis failed, falling back to text only', e)
      }
    }

    // 2. 文本上下文 (改为结尾)
    let textContext = ''
    if (analysisResult.value.transcription) {
      textContext = analysisResult.value.transcription.slice(-500)
    } else if (analysisResult.value.script?.scenes) {
      textContext = JSON.stringify(analysisResult.value.script.scenes.slice(-3))
    }

    analysisProgress.value = { status: 'synthesizing', current: 0, total: 0, message: '正在生成前传脚本...' }

    const systemPrompt = `你是一个专业的影视级脚本作家。请根据视频的**结尾内容**，创作一段**前传/循环开头**脚本。
    
    **视觉分析结果 (视频结尾)**:
    ${visualContext}
    
    **参考文本上下文 (视频结尾)**:
    ${textContext}
    
    **任务要求**：
    1. **时长控制**：创作约 ${extensionDuration.value} 秒的脚本。
    2. **内容衔接**：基于视频结尾的情绪或剧情，创作一段发生在其**之前**的故事（前传），或者一段能无缝衔接回开头的循环脚本。
    3. **插入位置**：这段脚本将被插入到现有视频脚本的最前面。
    4. **专业分镜**：包含分镜号、画面描述、景别、运镜、音频等字段。
    5. **AI 提示词**：为每个分镜生成英文 AI 绘画提示词。
    
    请输出 JSON 格式:
    {
      "scenes": [
        { "shot": "远景", "content": "...", "audio": "...", "prompt": "..." },
        ...
      ]
    }`

    const newScenes = await callLLM(systemPrompt)
    if (newScenes && newScenes.scenes) {
      analysisResult.value.script.scenes.unshift(...newScenes.scenes)
      alert(`成功续写 (前传) ${newScenes.scenes.length} 个镜头`)
    }
  } catch (e: any) {
    console.error(e)
    alert(`续写失败: ${e.message}`)
  } finally {
    isAnalyzing.value = false
    analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }
  }
}

const expandScript = async () => {
  if (!analysisResult.value) return
  isAnalyzing.value = true
  analysisProgress.value = { status: 'synthesizing', current: 0, total: 0, message: '正在进行全模态分析 (后3秒画面)...' }

  try {
    // 1. 视觉分析 (后3秒)
    let visualContext = ''
    if (videoUrl.value) {
      try {
        const video = document.createElement('video')
        video.src = videoUrl.value
        await new Promise(r => video.onloadedmetadata = r)
        const duration = video.duration

        const startTime = Math.max(0, duration - 3)
        const frames = await extractFrames(videoUrl.value, startTime, duration)
        if (frames.length > 0) {
          visualContext = await analyzeVisualContext(frames, 'sequel')
        }
      } catch (e) {
        console.warn('Visual analysis failed', e)
      }
    }

    // 2. 文本上下文 (结尾)
    const textContext = JSON.stringify(analysisResult.value.script.scenes.slice(-5))

    analysisProgress.value = { status: 'synthesizing', current: 0, total: 0, message: '正在生成后传脚本...' }

    const systemPrompt = `你是一个专业的影视级脚本作家。请根据**当前已有的脚本内容**（特别是结尾部分），创作一段**后续/发展**脚本。
    
    **参考文本上下文 (脚本结尾)**:
    ${textContext}
    
    **参考视觉分析 (原视频结尾)**:
    ${visualContext}
    
    **任务要求**：
    1. **时长控制**：创作约 ${extensionDuration.value} 秒的脚本。
    2. **剧情发展**：承接当前脚本的剧情发展，进行合理的延续或升华。
    3. **专业分镜**：包含分镜号、画面描述、景别、运镜、音频等字段。
    4. **AI 提示词**：为每个分镜生成英文 AI 绘画提示词。
    
    请输出 JSON 格式:
    {
      "scenes": [
        { "shot": "远景", "content": "...", "audio": "...", "prompt": "..." },
        ...
      ]
    }`

    const newScenes = await callLLM(systemPrompt)
    if (newScenes && newScenes.scenes) {
      // 追加到结尾
      analysisResult.value.script.scenes.push(...newScenes.scenes)
      alert(`成功扩写 (后传) ${newScenes.scenes.length} 个镜头`)
    }
  } catch (e: any) {
    console.error(e)
    alert(`扩写失败: ${e.message}`)
  } finally {
    isAnalyzing.value = false
    analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }
  }
}

// 通用 LLM 调用 helper
const callLLM = async (prompt: string) => {
  const payload = {
    model: 'qwen-plus',
    messages: [{ role: 'user', content: prompt }]
  }
  const response = await fetch('/api/writing-assistant/chat/completion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.value}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: payload.messages,
      stream: false
    })
  })
  if (!response.ok) throw new Error('LLM call failed')
  const resJson = await response.json()
  if (!resJson.success) throw new Error(resJson.error || 'LLM call failed')

  if (resJson.usage) {
    window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
  }

  const content = resJson.data.choices[0].message.content
  const jsonStr = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  return JSON.parse(jsonStr)
}

const toggleSceneSelection = (index: number) => {
  if (selectedSceneIndices.value.has(index)) {
    selectedSceneIndices.value.delete(index)
  } else {
    selectedSceneIndices.value.add(index)
  }
}

const batchGenerateVideos = async () => {
  if (selectedSceneIndices.value.size === 0) {
    alert('请先勾选需要生成视频的脚本分段')
    return
  }

  // 排序，确保按顺序处理
  const sortedIndices = Array.from(selectedSceneIndices.value).sort((a, b) => a - b)

  // 计算选中的总时长 (假设每段3秒)
  const totalDuration = sortedIndices.length * 3

  if (totalDuration > 15) {
    alert(`当前选中总时长为 ${totalDuration}秒，超过最大限制 (15秒)。请减少选中片段。`)
    return
  }

  // 确定生成视频的目标时长
  let targetDuration = 5
  if (totalDuration > 10) {
    targetDuration = 15
  } else if (totalDuration > 5) {
    targetDuration = 10
  } else {
    targetDuration = 5 // 或 5秒
  }

  if (!confirm(`选中 ${sortedIndices.length} 个片段，预计总时长 ${totalDuration}秒。\n将合并为一个 ${targetDuration}秒 的视频生成任务。\n是否继续？`)) {
    return
  }

  // 整合提示词
  const combinedPrompt = sortedIndices.map((idx) => {
    const scene = analysisResult.value?.script?.scenes[idx]
    return scene ? scene.content : ''
  }).filter(p => p).join(' ') + ', cinematic lighting, high quality'

  // 清空选择
  selectedSceneIndices.value.clear()

  // 创建占位符
  const tempId = `temp_${Date.now()}_batch`
  const placeholder: GeneratedVideo = {
    taskId: tempId,
    status: 'pending',
    progress: 0,
    url: '',
    prompt: combinedPrompt.length > 50 ? combinedPrompt.substring(0, 50) + '...' : combinedPrompt,
    createdAt: Date.now(),
    duration: targetDuration,
    aspectRatio: videoGenerationConfig.value.aspectRatio
  }
  generatedVideos.value.unshift(placeholder)

  // 更新配置并调用生成
  // 临时保存当前配置
  const originalDuration = videoGenerationConfig.value.duration
  videoGenerationConfig.value.duration = targetDuration

  // 尝试提取第一帧作为参考图
  let referenceImages: string[] = []
  const firstIdx = sortedIndices[0]
  if (videoUrl.value && analysisResult.value?.script?.scenes?.length) {
    try {
      const totalScenes = analysisResult.value.script.scenes.length
      const videoElement = document.createElement('video')
      videoElement.src = videoUrl.value
      await new Promise(r => videoElement.onloadedmetadata = r)
      const estTime = (firstIdx / totalScenes) * videoElement.duration
      const frames = await extractFrames(videoUrl.value, estTime, estTime + 1)
      if (frames.length > 0) referenceImages = [frames[0]]
    } catch (e) { console.warn('Frame extract failed', e) }
  }

  await generateVideo(combinedPrompt, referenceImages, 'batch', placeholder)

  // 恢复配置 (可选，或者保留上次使用的时长)
  videoGenerationConfig.value.duration = originalDuration
}

const processSceneGeneration = async (sceneIndex: number, content: string, placeholder: GeneratedVideo) => {
  let referenceImages: string[] = []
  // 尝试提取参考图
  if (videoUrl.value && analysisResult.value?.script?.scenes?.length) {
    try {
      const totalScenes = analysisResult.value.script.scenes.length
      const videoElement = document.createElement('video')
      videoElement.src = videoUrl.value
      await new Promise(r => videoElement.onloadedmetadata = r)
      const estTime = (sceneIndex / totalScenes) * videoElement.duration
      // 提取该大概时间点的帧
      const frames = await extractFrames(videoUrl.value, estTime, estTime + 1)
      if (frames.length > 0) referenceImages = [frames[0]]
    } catch (e) { console.warn('Frame extract failed', e) }
  }

  const prompt = `${content}, cinematic lighting, high quality`
  await generateVideo(prompt, referenceImages, 'single', placeholder)
}

const generateVideoForScene = async (sceneIndex: number, sceneContent: string) => {
  // 保持兼容，如果单独调用也走这个逻辑
  const prompt = `${sceneContent}, cinematic lighting, high quality`
  const placeholder: GeneratedVideo = {
    taskId: `temp_${Date.now()}_${sceneIndex}`,
    status: 'pending',
    progress: 0,
    url: '',
    prompt: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
    createdAt: Date.now(),
    duration: videoGenerationConfig.value.duration,
    aspectRatio: videoGenerationConfig.value.aspectRatio
  }
  generatedVideos.value.unshift(placeholder)
  await processSceneGeneration(sceneIndex, sceneContent, placeholder)
}

const generateVideo = async (prompt: string, images: string[], type: 'batch' | 'single', existingTask?: GeneratedVideo) => {
  try {
    const res = await $fetch('/api/video-generation/generate', {
      method: 'POST',
      body: {
        prompt,
        images, // 传递图片数组
        model: videoGenerationConfig.value.model,
        aspectRatio: videoGenerationConfig.value.aspectRatio,
        duration: videoGenerationConfig.value.duration
      }
    })

    if (res.data?.taskId || (res.data?.id)) { // 兼容不同可能的返回字段
      const taskId = res.data?.taskId || res.data?.id
      const initialStatus = res.data.status || 'pending'
      const initialUrl = res.data.videoUrl || res.data.url || ''
      const initialProgress = initialStatus === 'succeeded' ? 100 : 0

      if (existingTask) {
        // 更新现有占位符
        existingTask.taskId = taskId
        existingTask.status = initialStatus
        existingTask.progress = initialProgress
        existingTask.url = initialUrl

        if (initialStatus !== 'succeeded' && initialStatus !== 'failed') {
          pollVideoStatus(existingTask)
        }
      } else {
        // 只有未提供占位符时才创建新的
        const task: GeneratedVideo = {
          taskId: taskId,
          status: initialStatus,
          progress: initialProgress,
          url: initialUrl,
          prompt: prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt,
          createdAt: Date.now(),
          duration: videoGenerationConfig.value.duration,
          aspectRatio: videoGenerationConfig.value.aspectRatio
        }
        generatedVideos.value.unshift(task)

        if (initialStatus !== 'succeeded' && initialStatus !== 'failed') {
          pollVideoStatus(task)
        }
      }
    } else {
      // Handle sync error or unexpected format
      if (res.error) throw res.error
      console.error('Unexpected response:', res)
      if (existingTask) {
        existingTask.status = 'failed'
      } else {
        alert('视频生成请求失败，未返回任务ID')
      }
    }
  } catch (e: any) {
    console.error(e)
    if (existingTask) {
      existingTask.status = 'failed'
    } else {
      alert(`视频生成请求失败: ${e.message || e}`)
    }
  }
}

const pollVideoStatus = async (task: GeneratedVideo) => {
  const poll = async () => {
    try {
      const res = await $fetch('/api/video-generation/status', {
        method: 'POST',
        body: { taskId: task.taskId }
      })

      if (res.data) {
        const oldStatus = task.status
        task.status = res.data.status
        task.progress = res.data.progress || 0
        if (res.data.videoUrl) {
          task.url = res.data.videoUrl
        }

        // 如果状态从非成功变为成功，发送完成事件
        if (oldStatus !== 'succeeded' && task.status === 'succeeded') {
          emit('video-complete', task)
        }

        // 如果状态变为失败，发送失败事件
        if (oldStatus !== 'failed' && task.status === 'failed') {
          emit('video-failed', task, '视频生成失败')
        }
      }

      if (task.status === 'running' || task.status === 'pending') {
        setTimeout(poll, 3000)
      }
    } catch (e) {
      console.error('Polling error', e)
      const oldStatus = task.status
      task.status = 'failed'
      if (oldStatus !== 'failed') {
        emit('video-failed', task, e instanceof Error ? e.message : '视频生成失败')
      }
    }
  }
  poll()
}

// 保存脚本修改
const saveScriptChanges = () => {
  // 脚本内容已通过 v-model 自动更新到 analysisResult.script.scenes
  // 这里可以添加保存到后端的逻辑（如果需要持久化）
  if (analysisResult.value?.script?.scenes) {
    console.log('脚本内容已更新', analysisResult.value.script.scenes)
    // 可以在这里调用 API 保存修改后的脚本
    // 例如：await $fetch('/api/video-analysis/save-script', { method: 'POST', body: { script: analysisResult.value.script } })
  }
}

// 更新口播字数统计
const updateNarrationWordCount = () => {
  if (analysisResult.value?.narration) {
    analysisResult.value.narration.wordCount = getWordCount(analysisResult.value.narration.content)
  }
}

// 计算字数（中文字符 + 英文单词）
const getWordCount = (text: string): number => {
  if (!text) return 0
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  // 英文单词数（按空格和标点分割）
  const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0).length
  return chineseChars + englishWords
}

// 相似仿写口播内容
const rewriteNarration = async () => {
  if (!analysisResult.value?.narration?.content) {
    alert('请先确保有原始口播内容')
    return
  }

  isRewritingNarration.value = true
  try {
    const originalContent = analysisResult.value.narration.content
    const wordCount = getWordCount(originalContent)

    const systemPrompt = `你是一个专业的短视频口播文案创作专家。请对以下口播内容进行相似仿写，要求：

1. **保持核心观点和逻辑结构不变**
2. **字数要求**：生成的口播内容字数应接近原文（约 ${wordCount} 字），允许 ±10% 的浮动
3. **语言风格**：保持相似的语言风格和表达方式
4. **内容创新**：在保持核心意思的前提下，使用不同的表达方式和词汇
5. **完整性**：确保内容完整，可以直接用于视频配音
6. **输出格式**：请直接输出仿写后的完整口播内容，不要添加任何解释、格式标记或JSON结构

**原始口播内容**：
${originalContent}

请直接输出仿写后的完整口播内容：`

    // 直接调用 LLM API，不使用 callLLM（因为它会尝试解析 JSON）
    const payload = {
      model: 'qwen3-omni-flash-2025-12-01',
      messages: [{ role: 'user', content: systemPrompt }]
    }

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3-omni-flash-2025-12-01',
        messages: payload.messages,
        stream: false
      })
    })

    if (!response.ok) throw new Error('LLM call failed')
    const resJson = await response.json()
    if (!resJson.success) throw new Error(resJson.error || 'LLM call failed')

    if (resJson.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
    }

    // 直接获取文本内容，不解析 JSON
    let rewrittenContent = resJson.data.choices[0].message.content

    // 清理可能的格式标记
    rewrittenContent = rewrittenContent
      .replace(/^```(?:json|text)?\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/^["']/, '')
      .replace(/["']$/, '')
      .trim()

    narrationRewrite.value = rewrittenContent

    // 确保字数接近
    const rewrittenWordCount = getWordCount(narrationRewrite.value)
    if (Math.abs(rewrittenWordCount - wordCount) > wordCount * 0.2) {
      console.warn(`仿写字数差异较大：原文 ${wordCount} 字，仿写 ${rewrittenWordCount} 字`)
    }
  } catch (e: any) {
    console.error(e)
    alert(`相似仿写失败: ${e.message}`)
  } finally {
    isRewritingNarration.value = false
  }
}

// 使用仿写版本替换原始内容
const useRewrittenNarration = () => {
  if (!narrationRewrite.value) return

  if (analysisResult.value?.narration) {
    analysisResult.value.narration.content = narrationRewrite.value
    analysisResult.value.narration.wordCount = getWordCount(narrationRewrite.value)
    narrationRewrite.value = ''
    alert('已使用仿写版本替换原始口播内容')
  }
}

// 全选/取消全选脚本场景
const isAllSelected = computed(() => {
  if (!analysisResult.value?.script?.scenes) return false
  return selectedSceneIndices.value.size === analysisResult.value.script.scenes.length
})

const toggleSelectAll = () => {
  if (!analysisResult.value?.script?.scenes) return

  if (isAllSelected.value) {
    selectedSceneIndices.value.clear()
  } else {
    analysisResult.value.script.scenes.forEach((_: any, idx: number) => {
      selectedSceneIndices.value.add(idx)
    })
  }
}

// 队列操作
const removeVideoFromQueue = (index: number) => {
  generatedVideos.value.splice(index, 1)
}

// 拖拽逻辑
const draggedItemIndex = ref<number | null>(null)

const handleDragStart = (index: number) => {
  draggedItemIndex.value = index
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault() // 允许放置
}

const handleDrop = (index: number) => {
  if (draggedItemIndex.value === null || draggedItemIndex.value === index) return

  const item = generatedVideos.value[draggedItemIndex.value]
  generatedVideos.value.splice(draggedItemIndex.value, 1)
  generatedVideos.value.splice(index, 0, item)

  draggedItemIndex.value = null
}

const createJianyingDraft = async () => {
  if (!analysisResult.value?.script?.scenes) {
    alert('没有可用的脚本数据')
    return
  }

  try {
    // 1. 收集视频素材 (Video Track)
    // 注意：generatedVideos 是倒序排列的 (最新在最前)，通常我们需要按生成顺序或剧情顺序
    // 这里简单地按生成时间正序排列 (最早生成的在前面)
    const videos = generatedVideos.value
      .filter(v => v.status === 'succeeded' && v.url)
      .slice() // copy
      .reverse() // 最早生成的在最前
      .map(v => ({
        url: v.url,
        duration: v.duration || 10,
        aspectRatio: v.aspectRatio || '16:9'
      }))

    // 2. 收集文本素材 (Text Track)
    // 文本始终来自当前脚本
    const texts = analysisResult.value.script.scenes.map((s: any) => ({
      content: s.content,
      duration: 3
    }))

    // 3. 确定分辨率 (以第一个视频为准，或默认 16:9)
    let width = 1920
    let height = 1080
    if (videos.length > 0) {
      const ratio = videos[0].aspectRatio
      if (ratio === '9:16' || ratio === '3:4') { // 竖屏
        width = 1080
        height = 1920
      } else if (ratio === '1:1') {
        width = 1080
        height = 1080
      } else { // 16:9, 21:9, etc.
        width = 1920
        height = 1080
      }
    }

    const res = await $fetch('/jianying/create', {
      method: 'POST',
      body: {
        title: analysisResult.value.script.title || 'AI生成草稿',
        videos, // Pass separated videos
        texts, // Pass separated texts
        resolution: { width, height },
        draft_root: jianyingDraftPath.value
      }
    })

    alert(`草稿创建成功！\n路径：${res.path}`)
    fetchJianyingDrafts() // 刷新列表
  } catch (e: any) {
    alert(`创建草稿失败: ${e.message}`)
    console.error(e)
  }
}

// --- 语音克隆逻辑 ---
const handleVoiceSampleUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    voiceCloningState.value.sampleAudio = file
    voiceCloningState.value.sampleUrl = URL.createObjectURL(file)
    // 模拟上传成功
    setTimeout(() => {
      voiceCloningState.value.clonedVoiceId = 'voice_' + Math.random().toString(36).substr(2, 9)
    }, 1500)
  }
}

const generateVoice = async () => {
  if (!voiceCloningState.value.inputText) return
  voiceCloningState.value.isRecording = true
  // 模拟生成过程
  setTimeout(() => {
    voiceCloningState.value.isRecording = false
    voiceCloningState.value.generatedAudioUrl = 'blob:mock-audio-url' // 这里需要真实后端支持
    alert('语音生成成功 (模拟)')
  }, 2000)
}

// --- 历史记录逻辑 ---
const saveToHistory = async (result: any) => {
  try {
    await $fetch('/rustfs/save', {
      method: 'POST',
      body: result
    })
    fetchHistory()
  } catch (e) {
    console.error('Failed to save history', e)
  }
}

const fetchHistory = async () => {
  // 模拟获取列表（实际应从 RustFS 列出文件，这里简化为本地模拟或后续实现 list API）
  // 暂时手动添加当前结果
  if (analysisResult.value) {
    const exists = historyList.value.find(h => h.script?.title === analysisResult.value.script?.title)
    if (!exists) {
      historyList.value.unshift({
        ...analysisResult.value,
        savedAt: new Date().toLocaleString()
      })
    }
  }
}

const loadHistoryItem = (item: any) => {
  analysisResult.value = item
  activeTab.value = 'breakdown'
}

// ECharts 实例引用
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

// 检测图数据格式并转换为ECharts所需格式
const normalizeGraphData = (graphData: any) => {
  // 检测是否为新的图结构（包含nodes和edges）
  if (graphData.nodes && Array.isArray(graphData.nodes) && graphData.edges && Array.isArray(graphData.edges)) {
    // 新图结构，直接使用
    const nodes = graphData.nodes.map((node: any) => ({
      id: node.id,
      name: node.name,
      symbolSize: node.attributes?.centrality ? node.attributes.centrality * 30 + 10 : 20,
      itemStyle: {
        color: getNodeColor(node.type),
        borderColor: '#ffffff',
        borderWidth: 2
      },
      category: node.type,
      attributes: node.attributes
    }))

    const edges = graphData.edges.map((edge: any) => ({
      source: edge.source,
      target: edge.target,
      lineStyle: {
        color: getEdgeColor(edge.relation),
        width: edge.weight ? Math.max(1, edge.weight * 5) : 2,
        curveness: 0.2
      },
      label: {
        show: true,
        formatter: edge.relation,
        fontSize: 10,
        color: '#a8c7fa'
      },
      tooltip: {
        formatter: function (params: any) {
          const edgeData = params.data
          const rules = edgeData.rules ? edgeData.rules.join(', ') : '无'
          return `关联: ${edgeData.relation}<br/>强度: ${edgeData.weight}<br/>规则: ${rules}`
        }
      },
      ...edge
    }))

    return { nodes, edges, isGraph: true, rootNodes: graphData.rootNodes }
  } else if (graphData.name && (graphData.children || Array.isArray(graphData))) {
    // 旧树状结构，转换为图结构以保持兼容性
    const nodes: any[] = []
    const edges: any[] = []
    let nodeId = 0

    const traverseTree = (node: any, parentId: string | null = null, level = 0) => {
      const currentNodeId = `node_${nodeId++}`
      nodes.push({
        id: currentNodeId,
        name: node.name,
        symbolSize: Math.max(20 - level * 2, 10),
        itemStyle: {
          color: level === 0 ? '#a8c7fa' : '#4caf50',
          borderColor: '#ffffff',
          borderWidth: 2
        },
        category: 'node',
        level: level
      })

      if (parentId !== null) {
        edges.push({
          source: parentId,
          target: currentNodeId,
          relation: '子关系',
          weight: 0.7 - level * 0.1,
          lineStyle: {
            color: '#444746',
            width: 2,
            curveness: 0.5
          }
        })
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((child: any) => traverseTree(child, currentNodeId, level + 1))
      }

      return currentNodeId
    }

    const rootNodeId = traverseTree(graphData)

    return { nodes, edges, isGraph: true, rootNodes: [rootNodeId] }
  } else {
    // 未知格式，返回空图
    console.warn('未知的图数据结构格式:', graphData)
    return { nodes: [], edges: [], isGraph: false, rootNodes: [] }
  }
}

// 获取节点颜色基于类型
const getNodeColor = (type: string) => {
  switch (type) {
    case 'character': return '#a8c7fa'
    case 'organization': return '#4caf50'
    case 'channel': return '#ff9800'
    case 'audience': return '#f44336'
    default: return '#9e9e9e'
  }
}

// 获取边颜色基于关系类型
const getEdgeColor = (relation: string) => {
  if (relation.includes('领导') || relation.includes('管理')) return '#a8c7fa'
  if (relation.includes('传播') || relation.includes('沟通')) return '#4caf50'
  if (relation.includes('服务') || relation.includes('支持')) return '#ff9800'
  if (relation.includes('影响') || relation.includes('情感')) return '#f44336'
  return '#9e9e9e'
}

// 初始化图可视化
const initChart = () => {
  if (!chartRef.value || !analysisResult.value?.characterAnalysis?.influenceGraph) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  chartInstance = echarts.init(chartRef.value, 'dark')

  const graphData = analysisResult.value.characterAnalysis.influenceGraph
  const normalizedData = normalizeGraphData(graphData)

  if (!normalizedData.isGraph || normalizedData.nodes.length === 0) {
    // 空图或无效数据，显示提示
    chartInstance.setOption({
      backgroundColor: 'transparent',
      title: {
        text: '暂无有效的图数据',
        left: 'center',
        top: 'center',
        textStyle: { color: '#9e9e9e', fontSize: 14 }
      }
    })
    return
  }

  // 合并发现的边（如果有）
  const allEdges = [...normalizedData.edges]
  if (vectorAnalysisState.value.result?.markedEdges) {
    const discoveredEdges = vectorAnalysisState.value.result.markedEdges
    // 避免重复边
    const existingEdgeKeys = new Set()
    normalizedData.edges.forEach((edge: any) => {
      const key = `${edge.source}-${edge.target}-${edge.relation}`
      existingEdgeKeys.add(key)
    })

    discoveredEdges.forEach((edge: any) => {
      const key = `${edge.source}-${edge.target}-${edge.relation}`
      if (!existingEdgeKeys.has(key)) {
        allEdges.push(edge)
        existingEdgeKeys.add(key)
      }
    })
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: function (params: any) {
        if (params.dataType === 'node') {
          const node = params.data
          const type = node.category || '未知类型'
          const attrs = node.attributes ? JSON.stringify(node.attributes, null, 2) : '无'
          return `<div style="padding: 8px; color: #e3e3e3;">
            <strong>${node.name}</strong><br/>
            类型: ${type}<br/>
            ID: ${node.id}<br/>
            属性: ${attrs}
          </div>`
        } else if (params.dataType === 'edge') {
          const edge = params.data
          const rules = edge.rules ? edge.rules.join(', ') : '无'
          return `<div style="padding: 8px; color: #e3e3e3;">
            <strong>${edge.relation}</strong><br/>
            强度: ${edge.weight}<br/>
            规则: ${rules}<br/>
            源: ${edge.source} → 目标: ${edge.target}
          </div>`
        }
        return params.name
      }
    },
    legend: {
      data: ['character', 'organization', 'channel', 'audience'].map(type => ({
        name: type,
        itemStyle: { color: getNodeColor(type) }
      })),
      textStyle: { color: '#e3e3e3' },
      top: '5%'
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        force: {
          repulsion: 300,
          edgeLength: 100,
          gravity: 0.1
        },
        roam: true,
        draggable: true,
        focusNodeAdjacency: true,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 8,
        nodes: normalizedData.nodes,
        edges: allEdges,
        categories: [
          { name: 'character' },
          { name: 'organization' },
          { name: 'channel' },
          { name: 'audience' }
        ],
        label: {
          show: true,
          position: 'right',
          formatter: '{b}',
          fontSize: 12,
          color: '#e3e3e3'
        },
        lineStyle: {
          color: 'source',
          curveness: 0.2
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 4
          }
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        }
      }
    ]
  }

  chartInstance.setOption(option)

  // 如果有根节点，高亮显示
  if (normalizedData.rootNodes && normalizedData.rootNodes.length > 0) {
    setTimeout(() => {
      chartInstance.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: normalizedData.nodes.findIndex((n: any) => n.id === normalizedData.rootNodes[0])
      })
    }, 500)
  }
}

// 执行向量分析
const performVectorAnalysis = async () => {
  if (!analysisResult.value?.characterAnalysis?.influenceGraph) {
    alert('请先进行视频解析，生成人物关系图')
    return
  }

  vectorAnalysisState.value.isAnalyzing = true
  vectorAnalysisState.value.progress = 0
  vectorAnalysisState.value.message = '正在准备向量分析...'

  try {
    const runtimeConfig = useRuntimeConfig()
    const graph = analysisResult.value.characterAnalysis.influenceGraph

    vectorAnalysisState.value.message = '正在发送分析请求...'
    vectorAnalysisState.value.progress = 30

    const response = await $fetch<ApiResponse<any>>(`${runtimeConfig.public.apiBase}/influence-graph/analyze`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`
      },
      body: {
        graph,
        options: vectorAnalysisState.value.options
      }
    })

    if (!response.success) {
      throw new Error(response.message || '向量分析失败')
    }

    vectorAnalysisState.value.progress = 80
    vectorAnalysisState.value.message = '正在处理分析结果...'

    const result = response.data
    vectorAnalysisState.value.result = result

    // 将发现的边合并到现有图中，用于可视化
    const discoveredEdges = result.discoveredEdges || []
    if (discoveredEdges.length > 0) {
      // 标记发现的边，用于图表高亮显示
      const markedEdges = discoveredEdges.map((edge: any) => ({
        ...edge,
        discovered: true,
        lineStyle: {
          color: '#ff9800', // 橙色表示新发现的边
          width: Math.max(2, edge.weight * 6),
          type: 'dashed'
        }
      }))

      // 存储发现的边，供图表使用
      vectorAnalysisState.value.result.markedEdges = markedEdges

      // 重新初始化图表以显示新发现的边
      await nextTick()
      if (activeTab.value === 'character') {
        initChart()
      }
    }

    vectorAnalysisState.value.progress = 100
    vectorAnalysisState.value.message = '向量分析完成'

    console.log('向量分析结果:', result)
  } catch (error: any) {
    console.error('向量分析失败:', error)
    vectorAnalysisState.value.message = `分析失败: ${error.message}`
    alert(`向量分析失败: ${error.message}`)
  } finally {
    vectorAnalysisState.value.isAnalyzing = false
  }
}

// 监听 tab 切换和数据变化
watch([activeTab, analysisResult], async () => {
  if (activeTab.value === 'character' && analysisResult.value?.characterAnalysis?.influenceGraph) {
    await nextTick()
    initChart()
  }

  // Pre-fill social content inputs
  if (activeTab.value === 'social_content' && analysisResult.value?.characterAnalysis) {
    const char = analysisResult.value.characterAnalysis.characters?.[0] || {}
    const resonance = analysisResult.value.characterAnalysis.audienceResonance || {}

    const inputs = socialContentState.value.inputs
    if (!inputs.targetAudience && resonance.targetAudience) {
      inputs.targetAudience = Array.isArray(resonance.targetAudience) ? resonance.targetAudience.join(', ') : resonance.targetAudience
    }
    if (!inputs.personality && char.behavior) {
      // Use behavior as a proxy for personality initially
      inputs.personality = ''
    }
    if (!inputs.behavior && char.behavior) {
      inputs.behavior = char.behavior
    }
    if (!inputs.values && char.values) {
      inputs.values = char.values
    }
  }
})

const generateSocialContent = async () => {
  if (!analysisResult.value) return

  socialContentState.value.isGenerating = true
  try {
    const inputs = socialContentState.value.inputs

    // Construct prompt
    const prompt = `你是一个专业的社交媒体运营专家。请基于以下视频分析结果和用户设定的参数，为"抖音"和"小红书"两个平台分别生成发布文案。

**输入信息**：
1. **目标人群**：${inputs.targetAudience || '未指定'}
2. **人物设定**：
   - 性格：${inputs.personality || '未指定'}
   - 行为特征：${inputs.behavior || '未指定'}
   - 价值观：${inputs.values || '未指定'}
   - 世界观：${inputs.worldview || '未指定'}
   - 人生观：${inputs.lifeView || '未指定'}
3. **视频核心内容**：${JSON.stringify(analysisResult.value.script || analysisResult.value.viralReasons || [])}

**生成要求**：
请生成一个 JSON 对象，包含 "douyin" 和 "xiaohongshu" 两个字段，每个字段包含：
- title: 吸引人的标题 (抖音：悬念/反转；小红书：情绪/干货/种草)
- tags: 5-8个相关标签（数组）
- content: 正文内容（适配平台风格，抖音偏短快节奏，小红书偏种草/情感共鸣/干货，Emoji丰富）

**输出格式**：
\`\`\`json
{
  "douyin": {
    "title": "...",
    "tags": ["..."],
    "content": "..."
  },
  "xiaohongshu": {
    "title": "...",
    "tags": ["..."],
    "content": "..."
  }
}
\`\`\`
`

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: '你是一个精通抖音和小红书运营的AI助手。' },
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    })

    if (!response.ok) throw new Error('Generation failed')
    const resJson = await response.json()
    if (!resJson.success) throw new Error(resJson.error || 'Generation failed')

    if (resJson.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', { detail: { tokens: resJson.usage.total_tokens } }))
    }

    const content = resJson.data.choices[0].message.content
    const parsed = safeJsonParse(content)

    if (parsed.douyin && parsed.xiaohongshu) {
      socialContentState.value.results = parsed
    } else {
      throw new Error('Invalid response format from AI')
    }
  } catch (e: any) {
    console.error('Social content generation failed:', e)
    alert(`生成失败: ${e.message}`)
  } finally {
    socialContentState.value.isGenerating = false
  }
}

// 窗口大小调整
const handleResize = () => {
  chartInstance?.resize()
}

// 页面卸载时销毁图表
onUnmounted(() => {
  // Chart disposal code removed - comparison charts no longer exist
})

// 初始化加载
onMounted(() => {
  window.addEventListener('resize', handleResize)
  // 清理过期缓存
  clearOldCache()
  fetchJianyingDrafts()
  fetchHistory()
  // 获取最新余额
  fetchUserBalance()
})

const clearVideo = () => {
  // 释放 blob URL
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
  videoFile.value = null
  videoUrl.value = ''
  videoFileInfo.value = null
  analysisResult.value = null
  analysisProgress.value = { status: 'idle', current: 0, total: 0, message: '' }

  // 清除音频提取状态
  audioExtractState.value.audioUrl = ''
  audioExtractState.value.result = null
  audioExtractState.value.error = ''
  audioExtractState.value.status = ''
}
</script>

<template>
  <div class="h-full flex flex-col bg-[#1e1f20] text-[#e3e3e3] overflow-hidden">
    <!-- Header -->
    <div class="p-6 border-b border-[#444746] flex justify-between items-center bg-[#28292a] shadow-sm">
      <div class="flex items-center gap-4">
        <span class="material-symbols-outlined text-blue-400 text-3xl">movie_filter</span>
        <h2 class="text-xl font-bold tracking-wide">
          视频对比分析
        </h2>
      </div>
      <div class="flex items-center gap-8">
        <!-- 模型选择 -->
        <div class="flex items-center gap-3">
          <span class="text-base text-[#c4c7c5]">模型:</span>
          <select
            v-model="selectedModel"
            class="bg-[#3c4043] text-base text-[#e3e3e3] px-4 py-2 rounded-lg border border-[#5f6368] focus:outline-none focus:border-[#a8c7fa] transition-all shadow-inner"
          >
            <option v-for="model in modelOptions" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </div>
        <!-- 余额信息 -->
        <div class="flex items-center gap-3 text-base">
          <span class="text-[#c4c7c5]">余额:</span>
          <span :class="userBalance >= VIDEO_ANALYSIS_COST ? 'text-[#81c995] font-bold' : 'text-[#f28b82] font-bold'">
            {{ userBalance.toFixed(2) }} 积分
          </span>
          <span class="text-[#5f6368] text-sm">(-{{ VIDEO_ANALYSIS_COST }}/次)</span>
        </div>
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Video Input -->
      <div class="w-[400px] shrink-0 border-r border-[#444746] flex flex-col p-6 gap-6 bg-[#1e1f20]">
        <div
          v-if="!videoUrl"
          class="flex-1 border-2 border-dashed border-[#444746] rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-[#a8c7fa] hover:bg-[#28292a] transition-all cursor-pointer relative group"
        >
          <input
            type="file"
            accept="video/*"
            class="absolute inset-0 opacity-0 cursor-pointer"
            @change="handleFileUpload"
          >
          <span class="material-symbols-outlined text-6xl text-[#5f6368] group-hover:text-[#a8c7fa] transition-colors">add_a_photo</span>
          <div class="text-center">
            <p class="text-xl font-bold text-[#e3e3e3]">
              上传视频文件
            </p>
            <p class="text-base text-[#c4c7c5] mt-3">
              支持 MP4, MOV (最大 500MB)
            </p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col gap-6">
          <div class="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[60vh] flex items-center justify-center shadow-2xl border border-[#444746]">
            <video :src="videoUrl" controls class="w-full h-full object-contain" />
            <button
              class="absolute top-4 right-4 p-2.5 bg-black/60 rounded-full hover:bg-red-500 transition-all text-white shadow-lg"
              @click="clearVideo"
            >
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <button
            :disabled="isAnalyzing"
            class="w-full bg-[var(--text-primary)] text-[var(--bg-primary)] py-2 rounded-full font-medium text-sm hover:bg-[var(--text-secondary)] flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            @click="startAnalysis"
          >
            <span v-if="isAnalyzing" class="material-symbols-outlined text-[18px] animate-spin">sync</span>
            <span v-else class="material-symbols-outlined text-[18px]">auto_awesome</span>
            {{ isAnalyzing ? '正在深度解析...' : '开始爆款解析' }}
          </button>

          <!-- Progress Indicator -->
          <div v-if="isAnalyzing && analysisProgress.status !== 'idle'" class="px-2 mt-2">
            <div class="flex justify-between text-xs text-[#c4c7c5] mb-2 font-medium">
              <span class="truncate pr-2">{{ analysisProgress.message }}</span>
              <span v-if="analysisProgress.total > 0" class="shrink-0 font-bold">{{ Math.round((analysisProgress.current / analysisProgress.total) * 100) }}%</span>
            </div>
            <div class="h-2 bg-[#444746] rounded-full overflow-hidden shadow-inner">
              <div
                class="h-full bg-[#a8c7fa] transition-all duration-300 shadow-[0_0_10px_rgba(168,199,250,0.5)]"
                :style="{ width: `${(analysisProgress.current / (analysisProgress.total || 1)) * 100}%` }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Analysis Result -->
      <div class="flex-1 flex flex-col bg-[#131314] min-w-0">
        <div v-if="!analysisResult" class="flex-1 flex flex-col items-center justify-center text-[#5f6368] gap-6">
          <span class="material-symbols-outlined text-8xl opacity-20">analytics</span>
          <div class="text-center">
            <p class="text-xl font-bold text-[#e3e3e3]">
              请上传视频后点击分析
            </p>
            <p class="text-base mt-2 text-[#c4c7c5]">
              AI 将自动识别爆款基因、人群画像与脚本结构
            </p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <!-- Tabs -->
          <div class="flex border-b border-[#444746] bg-[#1e1f20] shadow-sm">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                'px-10 py-5 text-base font-bold transition-all relative min-w-[140px]',
                activeTab === tab.id ? 'text-[#a8c7fa]' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'
              ]"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <div v-if="activeTab === tab.id" class="absolute bottom-0 left-0 right-0 h-1 bg-[#a8c7fa] rounded-t-full shadow-[0_0_10px_rgba(168,199,250,0.5)]" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-10 custom-scroll bg-[#0f0f10] custom-scrollbar">
            <!-- 1. 视频解析 (Breakdown) -->
            <div v-if="activeTab === 'breakdown'" class="space-y-12 max-w-5xl mx-auto">
              <!-- 深度道法术器分析 -->
              <div v-if="analysisResult.deepAnalysis" class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-purple-400">psychology</span> 深度内觉与道法术器
                </h3>
                <div class="grid grid-cols-2 gap-6">
                  <!-- 内觉 & 外察 -->
                  <div class="col-span-2 grid grid-cols-2 gap-6">
                    <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] relative overflow-hidden group hover:border-[#5f6368] transition-all shadow-md">
                      <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                        <span class="material-symbols-outlined text-6xl">self_improvement</span>
                      </div>
                      <div class="text-base font-black text-purple-400 mb-3 tracking-wider uppercase">
                        内觉 (Inner Awareness)
                      </div>
                      <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                        {{ analysisResult.deepAnalysis.innerAwareness }}
                      </div>
                    </div>
                    <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] relative overflow-hidden group hover:border-[#5f6368] transition-all shadow-md">
                      <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                        <span class="material-symbols-outlined text-6xl">visibility</span>
                      </div>
                      <div class="text-base font-black text-blue-400 mb-3 tracking-wider uppercase">
                        外察 (Outer Observation)
                      </div>
                      <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                        {{ analysisResult.deepAnalysis.outerObservation }}
                      </div>
                    </div>
                  </div>

                  <!-- 道法术器 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] border-l-8 border-l-yellow-500 shadow-sm hover:translate-y-[-2px] transition-all">
                    <div class="text-base font-black text-yellow-500 mb-3 tracking-widest uppercase flex items-center gap-2">
                      <span class="material-symbols-outlined text-xl">star</span>
                      道 (Dao - 底层逻辑)
                    </div>
                    <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                      {{ analysisResult.deepAnalysis.dao }}
                    </div>
                  </div>
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] border-l-8 border-l-blue-500 shadow-sm hover:translate-y-[-2px] transition-all">
                    <div class="text-base font-black text-blue-500 mb-3 tracking-widest uppercase flex items-center gap-2">
                      <span class="material-symbols-outlined text-xl">strategy</span>
                      法 (Fa - 方法策略)
                    </div>
                    <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                      {{ analysisResult.deepAnalysis.fa }}
                    </div>
                  </div>
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] border-l-8 border-l-green-500 shadow-sm hover:translate-y-[-2px] transition-all">
                    <div class="text-base font-black text-green-500 mb-3 tracking-widest uppercase flex items-center gap-2">
                      <span class="material-symbols-outlined text-xl">construction</span>
                      术 (Shu - 技术手段)
                    </div>
                    <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                      {{ analysisResult.deepAnalysis.shu }}
                    </div>
                  </div>
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] border-l-8 border-l-red-500 shadow-sm hover:translate-y-[-2px] transition-all">
                    <div class="text-base font-black text-red-500 mb-3 tracking-widest uppercase flex items-center gap-2">
                      <span class="material-symbols-outlined text-xl">devices</span>
                      器 (Qi - 工具载体)
                    </div>
                    <div class="text-md text-[#e3e3e3] leading-relaxed font-medium">
                      {{ analysisResult.deepAnalysis.qi }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl">timer</span> 时间轴解析
                </h3>
                <div class="space-y-5">
                  <div v-for="(segment, idx) in analysisResult.timeSegments" :key="idx" class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] flex gap-6 hover:border-[#a8c7fa]/50 transition-all shadow-md group">
                    <div class="text-base font-mono font-black text-[#a8c7fa] bg-[#a8c7fa]/10 px-4 py-2 rounded-xl h-fit whitespace-nowrap border border-[#a8c7fa]/20 shadow-inner group-hover:bg-[#a8c7fa] group-hover:text-black transition-all">
                      {{ segment.time }}
                    </div>
                    <div class="flex-1 space-y-3">
                      <div class="text-lg text-[#e3e3e3] leading-relaxed font-medium">
                        {{ segment.content }}
                      </div>
                      <div class="text-sm text-[#c4c7c5] flex items-center gap-3">
                        <!-- Animated HOOK text using SVG -->
                        <svg width="60" height="18" viewBox="0 0 60 18">
                          <text
                            x="0"
                            y="15"
                            font-family="monospace"
                            font-weight="black"
                            font-size="16"
                            fill="#a8c7fa"
                          >
                            HOOK
                            <animate
                              attributeName="opacity"
                              values="1;0.5;1"
                              dur="2s"
                              repeatCount="indefinite"
                            />
                          </text>
                        </svg>
                        <span class="bg-[#3c4043] px-3 py-1 rounded-lg text-xs uppercase font-black text-[#a8c7fa] border border-[#a8c7fa]/30 tracking-widest">{{ segment.hook }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-4">
                <h3 class="text-lg font-bold text-[#a8c7fa] flex items-center gap-3">
                  <!-- SVG Animated Bolt Icon -->
                  <svg class="w-7 h-7 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 21l-1-9H4l10-10h1l1 9h6L11 21z">
                      <animate
                        attributeName="fill"
                        values="#facc15;#fde047;#facc15"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="1;0.7;1"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                      <animateTransform
                        attributeName="transform"
                        type="scale"
                        values="1;1.1;1"
                        dur="0.5s"
                        repeatCount="1"
                        begin="mouseover"
                      />
                    </path>
                  </svg>
                  3秒黄金钩子
                </h3>
                <div class="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-8 rounded-2xl border border-blue-500/40 shadow-xl relative overflow-hidden group">
                  <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                  <div class="flex justify-between items-center mb-4">
                    <span class="text-md font-black text-blue-400 tracking-wider uppercase">出现时间: {{ analysisResult.hookAnalysis.location }}</span>
                    <span class="text-xs bg-blue-500/30 text-blue-300 px-4 py-1 rounded-full border border-blue-500/50 font-black tracking-widest uppercase shadow-sm">{{ analysisResult.hookAnalysis.element }}</span>
                  </div>
                  <p class="text-lg text-[#e3e3e3] leading-loose font-medium">
                    {{ analysisResult.hookAnalysis.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 2. 语音转录 (Transcription) -->
            <div v-if="activeTab === 'transcription'" class="space-y-8 max-w-4xl mx-auto">
              <div class="bg-[#28292a] p-8 rounded-2xl border border-[#444746] shadow-xl relative overflow-hidden">
                <div class="absolute top-0 left-0 w-2 h-full bg-[#a8c7fa]" />
                <div class="flex justify-between items-center mb-6">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl">format_quote</span>
                    语音转录结果
                  </h3>
                  <button class="px-5 py-2 bg-[#3c4043] text-base text-[#a8c7fa] rounded-xl font-bold hover:bg-[#a8c7fa] hover:text-black transition-all border border-[#a8c7fa]/30 shadow-md" @click="startAsr">
                    重新转录
                  </button>
                </div>
                <textarea
                  v-model="transcriptionResult"
                  class="w-full h-[600px] bg-[#1e1f20] text-[#e3e3e3] p-8 rounded-2xl border border-[#444746] text-lg font-mono leading-loose resize-none focus:outline-none focus:border-[#a8c7fa] transition-all shadow-inner custom-scrollbar"
                />
              </div>
            </div>

            <!-- 2. 量化分析 (Viral) -->
            <div v-if="activeTab === 'viral'" class="space-y-10 max-w-5xl mx-auto">
              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-orange-400">trending_up</span> 量化基因分析
                </h3>
                <div class="grid grid-cols-2 gap-6">
                  <div v-for="(reason, idx) in analysisResult.viralReasons" :key="idx" class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm hover:border-[#a8c7fa]/50 transition-all group">
                    <div class="flex items-start gap-4">
                      <span class="text-[#a8c7fa] font-black text-3xl leading-none italic opacity-30 group-hover:opacity-100 transition-all">{{ (idx + 1).toString().padStart(2, '0') }}</span>
                      <span class="text-lg text-[#e3e3e3] font-medium leading-relaxed">{{ reason }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-green-400">add_circle</span> 加分规则匹配
                </h3>
                <div class="flex flex-wrap gap-4">
                  <span v-for="(point, idx) in analysisResult.platformFit.bonusPoints" :key="idx" class="px-6 py-3 bg-[#28292a] border border-[#444746] rounded-2xl text-md font-bold text-[#c4c7c5] flex items-center gap-3 hover:bg-[#a8c7fa] hover:text-black transition-all shadow-sm cursor-default">
                    <span class="material-symbols-outlined text-xl text-green-400 group-hover:text-black">check_circle</span>
                    {{ point }}
                  </span>
                </div>
              </div>

              <!-- 新增：专业的影视级别的脚本及镜头语言分析 -->
              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-purple-400">movie</span> 专业影视脚本分析
                </h3>
                <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- 镜头语言分析 -->
                    <div class="space-y-4">
                      <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2">
                        <span class="material-symbols-outlined text-xl text-purple-400">videocam</span> 镜头语言分析
                      </h4>
                      <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">镜头类型</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.shotTypes || '多镜头组合' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">运镜技巧</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.cameraMovement || '推拉摇移' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">构图分析</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.composition || '黄金分割' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">景深控制</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.depthOfField || '浅景深突出主体' }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- 脚本结构分析 -->
                    <div class="space-y-4">
                      <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2">
                        <span class="material-symbols-outlined text-xl text-purple-400">description</span> 脚本结构分析
                      </h4>
                      <div class="space-y-3">
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">叙事结构</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.narrativeStructure || '三幕式结构' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">节奏控制</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.pacing || '快慢结合' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">冲突设置</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.conflict || '情感冲突' }}</span>
                        </div>
                        <div class="flex justify-between items-center p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                          <span class="text-sm text-[#c4c7c5]">高潮设计</span>
                          <span class="text-sm font-bold text-[#a8c7fa]">{{ analysisResult.scriptAnalysis?.climax || '情感爆发点' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 新增：剪映口播脚本 -->
              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-indigo-400">edit_note</span> 剪映口播脚本
                </h3>
                <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                  <div class="space-y-4">
                    <!-- 脚本编辑器头部 -->
                    <div class="flex justify-between items-center mb-4">
                      <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2">
                        <span class="material-symbols-outlined text-xl text-indigo-400">timeline</span> 时间线脚本编辑器
                      </h4>
                      <div class="flex gap-2">
                        <button
                          class="px-4 py-2 bg-[#444746] text-white rounded-lg font-bold hover:bg-[#5f6368] transition-all flex items-center gap-2"
                          @click="resetScript"
                        >
                          <span class="material-symbols-outlined text-lg">refresh</span>
                          重置
                        </button>
                        <button
                          class="px-4 py-2 bg-[#4caf50] text-white rounded-lg font-bold hover:bg-[#45a049] transition-all flex items-center gap-2"
                          @click="downloadScript"
                        >
                          <span class="material-symbols-outlined text-lg">download</span>
                          下载脚本
                        </button>
                      </div>
                    </div>

                    <!-- 时间线脚本编辑器 -->
                    <div class="bg-[#1e1f20] rounded-lg border border-[#444746] p-4">
                      <div class="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                        <div
                          v-for="(segment, index) in editableScript"
                          :key="index"
                          class="flex gap-3 items-start group hover:bg-[#2a2b2d] p-2 rounded-lg transition-all"
                        >
                          <!-- 时间戳 -->
                          <div class="flex-shrink-0 w-20">
                            <input
                              v-model="segment.startTime"
                              type="text"
                              class="w-full bg-[#28292a] text-[#a8c7fa] px-2 py-1 rounded border border-[#444746] text-sm font-mono focus:outline-none focus:border-[#a8c7fa]"
                              placeholder="00:00"
                            >
                          </div>

                          <!-- 脚本内容 -->
                          <div class="flex-1">
                            <textarea
                              v-model="segment.content"
                              class="w-full bg-[#28292a] text-[#e3e3e3] px-3 py-2 rounded border border-[#444746] text-sm resize-none focus:outline-none focus:border-[#a8c7fa] min-h-[60px]"
                              placeholder="输入脚本内容..."
                            />
                          </div>

                          <!-- 删除按钮 -->
                          <button
                            class="flex-shrink-0 p-2 text-[#f44336] hover:bg-[#f44336]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            @click="removeScriptSegment(index)"
                          >
                            <span class="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>

                      <!-- 添加新段落 -->
                      <button
                        class="w-full py-3 border-2 border-dashed border-[#444746] text-[#c4c7c5] rounded-lg hover:border-[#a8c7fa] hover:text-[#a8c7fa] transition-all flex items-center justify-center gap-2"
                        @click="addScriptSegment"
                      >
                        <span class="material-symbols-outlined text-lg">add_circle</span>
                        添加时间线段落
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 新增：内容甄别分析 -->
              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-cyan-400">psychology</span> NLP情绪与行为动线分析
                </h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- 情绪分析 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-cyan-400">sentiment_satisfied</span> 情绪分析
                    </h4>
                    <div class="space-y-3">
                      <div class="space-y-2">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-[#c4c7c5]">正面情绪</span>
                          <span class="text-sm font-bold text-green-400">{{ analysisResult.emotionAnalysis?.positive || '75%' }}</span>
                        </div>
                        <div class="w-full bg-[#1e1f20] rounded-full h-2">
                          <div class="bg-green-400 h-2 rounded-full" style="width: 75%" />
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-[#c4c7c5]">负面情绪</span>
                          <span class="text-sm font-bold text-red-400">{{ analysisResult.emotionAnalysis?.negative || '15%' }}</span>
                        </div>
                        <div class="w-full bg-[#1e1f20] rounded-full h-2">
                          <div class="bg-red-400 h-2 rounded-full" style="width: 15%" />
                        </div>
                      </div>
                      <div class="space-y-2">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-[#c4c7c5]">中性情绪</span>
                          <span class="text-sm font-bold text-gray-400">{{ analysisResult.emotionAnalysis?.neutral || '10%' }}</span>
                        </div>
                        <div class="w-full bg-[#1e1f20] rounded-full h-2">
                          <div class="bg-gray-400 h-2 rounded-full" style="width: 10%" />
                        </div>
                      </div>
                      <div class="mt-4 p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          主要情绪标签：
                        </p>
                        <div class="flex flex-wrap gap-2">
                          <span class="px-2 py-1 bg-[#a8c7fa]/20 text-[#a8c7fa] text-xs rounded-full border border-[#a8c7fa]/30">兴奋</span>
                          <span class="px-2 py-1 bg-[#4caf50]/20 text-[#4caf50] text-xs rounded-full border border-[#4caf50]/30">愉悦</span>
                          <span class="px-2 py-1 bg-[#ff9800]/20 text-[#ff9800] text-xs rounded-full border border-[#ff9800]/30">期待</span>
                          <span class="px-2 py-1 bg-[#f44336]/20 text-[#f44336] text-xs rounded-full border border-[#f44336]/30">焦虑</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 行为动线分析 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-cyan-400">route</span> 行为动线分析
                    </h4>
                    <div class="space-y-3">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          用户行为路径：
                        </p>
                        <div class="space-y-2">
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-[#a8c7fa] rounded-full" />
                            <span class="text-xs text-[#e3e3e3]">观看视频 → 产生兴趣</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-[#4caf50] rounded-full" />
                            <span class="text-xs text-[#e3e3e3]">情感共鸣 → 点赞互动</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-[#ff9800] rounded-full" />
                            <span class="text-xs text-[#e3e3e3]">分享传播 → 社交裂变</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-[#f44336] rounded-full" />
                            <span class="text-xs text-[#e3e3e3]">深度参与 → 转化行动</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          关键转化节点：
                        </p>
                        <div class="space-y-1">
                          <div class="flex justify-between items-center">
                            <span class="text-xs text-[#c4c7c5]">前3秒留存率</span>
                            <span class="text-xs font-bold text-[#a8c7fa]">85%</span>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="text-xs text-[#c4c7c5]">完播率</span>
                            <span class="text-xs font-bold text-[#4caf50]">72%</span>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="text-xs text-[#c4c7c5]">互动率</span>
                            <span class="text-xs font-bold text-[#ff9800]">68%</span>
                          </div>
                          <div class="flex justify-between items-center">
                            <span class="text-xs text-[#c4c7c5]">分享率</span>
                            <span class="text-xs font-bold text-[#f44336]">45%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 新增：内容甄别分析 -->
              <div class="space-y-6" style="font-size: 30px;">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3" style="font-size: 32px;">
                  <span class="material-symbols-outlined text-3xl text-amber-400">gpp_maybe</span> 内容甄别分析
                </h3>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- 口误分析 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-amber-400">record_voice_over</span> 口误分析
                    </h4>
                    <div class="space-y-3">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-sm text-[#c4c7c5]">口误检测</span>
                          <span class="text-sm font-bold text-amber-400">{{ analysisResult.contentScreening?.slipOfTongue?.detected || '3处' }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, idx) in (analysisResult.contentScreening?.slipOfTongue?.examples || ['嗯...那个...', '就是说...', '然后...然后...'])" :key="idx" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-amber-400 rounded-full" />
                            <span class="text-[#e3e3e3]">{{ item }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          优化建议：
                        </p>
                        <p class="text-sm text-[#e3e3e3]">
                          {{ analysisResult.contentScreening?.slipOfTongue?.suggestion || '减少口头禅，使用更简洁的表达方式' }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 口语化分析 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-amber-400">chat</span> 口语化分析
                    </h4>
                    <div class="space-y-3">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-sm text-[#c4c7c5]">口语化程度</span>
                          <span class="text-sm font-bold text-amber-400">{{ analysisResult.contentScreening?.colloquialism?.level || '中等' }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, idx) in (analysisResult.contentScreening?.colloquialism?.examples || ['真的假的', '绝了', 'yyds'])" :key="idx" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-amber-400 rounded-full" />
                            <span class="text-[#e3e3e3]">{{ item }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          优化建议：
                        </p>
                        <p class="text-sm text-[#e3e3e3]">
                          {{ analysisResult.contentScreening?.colloquialism?.suggestion || '平衡口语化与专业性，保持亲和力' }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 脱离网感分析 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-amber-400">language</span> 脱离网感分析
                    </h4>
                    <div class="space-y-3">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-sm text-[#c4c7c5]">网感匹配度</span>
                          <span class="text-sm font-bold text-amber-400">{{ analysisResult.contentScreening?.internetSense?.score || '75%' }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, idx) in (analysisResult.contentScreening?.internetSense?.issues || ['用词过于正式', '缺乏网络热词', '表达方式传统'])" :key="idx" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-amber-400 rounded-full" />
                            <span class="text-[#e3e3e3]">{{ item }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          优化建议：
                        </p>
                        <p class="text-sm text-[#e3e3e3]">
                          {{ analysisResult.contentScreening?.internetSense?.suggestion || '适当加入网络热词，提升年轻用户共鸣' }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- AI合成甄别 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-amber-400">smart_toy</span> AI合成甄别
                    </h4>
                    <div class="space-y-3">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-sm text-[#c4c7c5]">AI生成概率</span>
                          <span class="text-sm font-bold text-amber-400">{{ analysisResult.contentScreening?.aiGenerated?.probability || '15%' }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, idx) in (analysisResult.contentScreening?.aiGenerated?.indicators || ['语调过于平滑', '缺乏情感波动', '用词过于标准'])" :key="idx" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-amber-400 rounded-full" />
                            <span class="text-[#e3e3e3]">{{ item }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          优化建议：
                        </p>
                        <p class="text-sm text-[#e3e3e3]">
                          {{ analysisResult.contentScreening?.aiGenerated?.suggestion || '增加个性化表达，添加真实情感色彩' }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 软营销内容甄别 -->
                  <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] shadow-sm lg:col-span-2">
                    <h4 class="text-lg font-bold text-[#e3e3e3] flex items-center gap-2 mb-4">
                      <span class="material-symbols-outlined text-xl text-amber-400">campaign</span> 软营销内容甄别
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <div class="flex justify-between items-center mb-2">
                          <span class="text-sm text-[#c4c7c5]">营销倾向</span>
                          <span class="text-sm font-bold text-amber-400">{{ analysisResult.contentScreening?.softMarketing?.tendency || '低' }}</span>
                        </div>
                        <div class="space-y-2">
                          <div v-for="(item, idx) in (analysisResult.contentScreening?.softMarketing?.triggers || ['产品提及', '价格暗示', '购买引导'])" :key="idx" class="flex items-center gap-2 text-sm">
                            <span class="w-2 h-2 bg-amber-400 rounded-full" />
                            <span class="text-[#e3e3e3]">{{ item }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="p-3 bg-[#1e1f20] rounded-lg border border-[#444746]">
                        <p class="text-sm text-[#c4c7c5] mb-2">
                          优化建议：
                        </p>
                        <p class="text-sm text-[#e3e3e3]">
                          {{ analysisResult.contentScreening?.softMarketing?.suggestion || '减少营销痕迹，提升内容价值' }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. 人物分析 (Character Analysis) -->
            <div v-if="activeTab === 'character'" class="space-y-10 max-w-6xl mx-auto">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- 左侧：人物卡片 -->
                <div class="space-y-6">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl text-yellow-400">person_search</span> 人物画像
                  </h3>
                  <div v-if="analysisResult?.characterAnalysis?.characters && analysisResult.characterAnalysis.characters.length > 0" class="space-y-6">
                    <div v-for="(char, idx) in analysisResult.characterAnalysis.characters" :key="idx" class="bg-[#28292a] p-6 rounded-3xl border border-[#444746] flex gap-6 hover:border-[#a8c7fa] transition-all group shadow-lg">
                      <!-- 头像占位 -->
                      <div class="w-20 h-20 rounded-full bg-[#3c4043] flex items-center justify-center text-3xl border-2 border-[#444746] group-hover:border-[#a8c7fa] transition-colors shrink-0">
                        {{ char.name?.[0] || '?' }}
                      </div>
                      <div class="flex-1 space-y-3 min-w-0">
                        <div class="flex items-center justify-between">
                          <span class="font-black text-xl text-[#e3e3e3] truncate">{{ char.name }}</span>
                          <span class="text-xs bg-[#1e1f20] px-3 py-1 rounded-full text-[#a8c7fa] border border-[#444746] font-bold">{{ char.gender }} · {{ char.age }}</span>
                        </div>
                        <div class="text-sm text-[#c4c7c5] leading-relaxed">
                          <span class="text-[#a8c7fa] font-bold">外貌：</span>{{ char.appearance }}
                        </div>
                        <div class="text-sm text-[#c4c7c5] leading-relaxed">
                          <span class="text-[#a8c7fa] font-bold">行为：</span>{{ char.behavior }}
                        </div>
                        <div class="text-sm text-[#c4c7c5] leading-relaxed">
                          <span class="text-[#a8c7fa] font-bold">价值观：</span>{{ char.values }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-12 text-[#5f6368] bg-[#28292a] rounded-3xl border border-[#444746]">
                    <span class="material-symbols-outlined text-4xl mb-3 block opacity-50">no_accounts</span>
                    暂无人物分析数据，请尝试重新解析视频。
                  </div>
                </div>

                <!-- 右侧：共鸣与渠道 -->
                <div class="space-y-6">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl text-pink-400">campaign</span> 传播与共鸣
                  </h3>
                  <div v-if="analysisResult?.characterAnalysis?.audienceResonance" class="bg-[#28292a] p-8 rounded-3xl border border-[#444746] space-y-8 shadow-xl">
                    <div>
                      <h4 class="text-sm font-black text-[#e3e3e3] mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-green-400">target</span> 目标人群
                      </h4>
                      <div class="flex flex-wrap gap-3">
                        <span v-for="tag in analysisResult.characterAnalysis.audienceResonance.targetAudience" :key="tag" class="px-4 py-2 bg-[#3c4043] rounded-xl text-sm font-bold text-[#a8c7fa] border border-[#444746] shadow-sm">
                          {{ tag }}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 class="text-sm font-black text-[#e3e3e3] mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-yellow-400">psychology</span> 共鸣点分析
                      </h4>
                      <ul class="space-y-3">
                        <li v-for="point in analysisResult.characterAnalysis.audienceResonance.resonancePoints" :key="point" class="flex items-start gap-3 text-sm text-[#c4c7c5] leading-relaxed">
                          <span class="w-1.5 h-1.5 rounded-full bg-[#a8c7fa] mt-2 shrink-0" />
                          {{ point }}
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h4 class="text-sm font-black text-[#e3e3e3] mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <span class="material-symbols-outlined text-blue-400">share</span> 传播渠道
                      </h4>
                      <div class="flex flex-wrap gap-3">
                        <span v-for="channel in analysisResult.characterAnalysis.audienceResonance.distributionChannels" :key="channel" class="px-4 py-2 bg-[#1e1f20] rounded-xl border border-[#444746] text-sm font-bold text-[#e3e3e3] flex items-center gap-2 shadow-sm">
                          {{ channel }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-12 text-[#5f6368] bg-[#28292a] rounded-3xl border border-[#444746]">
                    暂无共鸣分析数据。
                  </div>
                </div>
              </div>

              <!-- 底部：思维导图 -->
              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-purple-400">hub</span> 人物关联度分析
                </h3>

                <!-- 向量分析控制面板 -->
                <div class="mb-6 bg-[#28292a] rounded-2xl border border-[#444746] p-6 shadow-xl">
                  <div class="flex flex-wrap items-center gap-6 mb-6">
                    <div class="flex-1 min-w-[300px]">
                      <div class="text-sm font-bold text-[#c4c7c5] mb-2">
                        相似度阈值
                      </div>
                      <input
                        v-model="vectorAnalysisState.options.similarityThreshold"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        class="w-full h-2 bg-[#1e1f20] rounded-lg appearance-none cursor-pointer"
                      >
                      <div class="flex justify-between text-xs text-[#5f6368] mt-1">
                        <span>0.0</span>
                        <span class="font-bold text-[#a8c7fa]">{{ vectorAnalysisState.options.similarityThreshold.toFixed(2) }}</span>
                        <span>1.0</span>
                      </div>
                    </div>

                    <div class="flex-1 min-w-[200px]">
                      <div class="text-sm font-bold text-[#c4c7c5] mb-2">
                        最大新边数/节点
                      </div>
                      <input
                        v-model="vectorAnalysisState.options.maxNewEdgesPerNode"
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        class="w-full h-2 bg-[#1e1f20] rounded-lg appearance-none cursor-pointer"
                      >
                      <div class="flex justify-between text-xs text-[#5f6368] mt-1">
                        <span>1</span>
                        <span class="font-bold text-[#a8c7fa]">{{ vectorAnalysisState.options.maxNewEdgesPerNode }}</span>
                        <span>10</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input v-model="vectorAnalysisState.options.useKnowledgeBase" type="checkbox" class="w-4 h-4 rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-0">
                        <span class="text-sm text-[#c4c7c5]">使用知识库增强</span>
                      </label>

                      <button
                        :disabled="vectorAnalysisState.isAnalyzing"
                        class="px-6 py-3 bg-[#a8c7fa] text-black font-bold rounded-xl hover:bg-[#8cb3f0] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        @click="performVectorAnalysis"
                      >
                        <span class="material-symbols-outlined text-lg">insights</span>
                        {{ vectorAnalysisState.isAnalyzing ? '分析中...' : '向量分析' }}
                      </button>
                    </div>
                  </div>

                  <!-- 进度和结果 -->
                  <div v-if="vectorAnalysisState.isAnalyzing" class="space-y-3">
                    <div class="text-sm text-[#c4c7c5]">
                      {{ vectorAnalysisState.message }}
                    </div>
                    <div class="w-full bg-[#1e1f20] rounded-full h-2">
                      <div class="bg-[#a8c7fa] h-2 rounded-full transition-all duration-300" :style="{ width: vectorAnalysisState.progress + '%' }" />
                    </div>
                  </div>

                  <div v-if="vectorAnalysisState.result && !vectorAnalysisState.isAnalyzing" class="mt-4 p-4 bg-[#1e1f20] rounded-xl border border-[#444746]">
                    <div class="text-sm font-bold text-[#a8c7fa] mb-2">
                      分析结果摘要
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div class="p-3 bg-[#28292a] rounded-lg">
                        <div class="text-2xl font-bold text-white">
                          {{ vectorAnalysisState.result.analysisSummary?.totalNodes || 0 }}
                        </div>
                        <div class="text-xs text-[#c4c7c5]">
                          总节点数
                        </div>
                      </div>
                      <div class="p-3 bg-[#28292a] rounded-lg">
                        <div class="text-2xl font-bold text-white">
                          {{ vectorAnalysisState.result.analysisSummary?.discoveredEdges || 0 }}
                        </div>
                        <div class="text-xs text-[#c4c7c5]">
                          发现新边
                        </div>
                      </div>
                      <div class="p-3 bg-[#28292a] rounded-lg">
                        <div class="text-2xl font-bold text-white">
                          {{ (vectorAnalysisState.result.analysisSummary?.averageSimilarity || 0).toFixed(3) }}
                        </div>
                        <div class="text-xs text-[#c4c7c5]">
                          平均相似度
                        </div>
                      </div>
                      <div class="p-3 bg-[#28292a] rounded-lg">
                        <div class="text-2xl font-bold text-white">
                          {{ vectorAnalysisState.result.vectorDimensions || 0 }}
                        </div>
                        <div class="text-xs text-[#c4c7c5]">
                          向量维度
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="bg-[#1e1f20] rounded-3xl border border-[#444746] p-6 h-[700px] relative shadow-2xl overflow-hidden">
                  <div ref="chartRef" class="w-full h-full" />
                </div>
              </div>
            </div>

            <!-- 4. 文案生成 (Social Content) -->
            <div v-if="activeTab === 'social_content'" class="space-y-10 max-w-6xl mx-auto">
              <!-- 输入配置区域 -->
              <div class="bg-[#28292a] p-8 rounded-3xl border border-[#444746] shadow-xl">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3 mb-8">
                  <span class="material-symbols-outlined text-3xl text-purple-400">edit_note</span> 文案生成配置
                </h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <!-- 左列 -->
                  <div class="space-y-6">
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">目标人群</label>
                      <input
                        v-model="socialContentState.inputs.targetAudience"
                        type="text"
                        class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all"
                        placeholder="例如：25-35岁职场女性"
                      >
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">性格特征</label>
                      <input
                        v-model="socialContentState.inputs.personality"
                        type="text"
                        class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all"
                        placeholder="例如：知性、幽默、毒舌"
                      >
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">行为特征</label>
                      <textarea v-model="socialContentState.inputs.behavior" class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all resize-none h-24" placeholder="描述人物的行为习惯..." />
                    </div>
                  </div>

                  <!-- 右列 -->
                  <div class="space-y-6">
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">价值观</label>
                      <input
                        v-model="socialContentState.inputs.values"
                        type="text"
                        class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all"
                        placeholder="例如：独立自主、追求自由"
                      >
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">世界观</label>
                      <input
                        v-model="socialContentState.inputs.worldview"
                        type="text"
                        class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all"
                        placeholder="例如：世界是多元包容的"
                      >
                    </div>
                    <div class="space-y-2">
                      <label class="text-sm font-bold text-[#c4c7c5] uppercase tracking-wider">人生观</label>
                      <input
                        v-model="socialContentState.inputs.lifeView"
                        type="text"
                        class="w-full bg-[#1e1f20] border border-[#444746] rounded-xl px-4 py-3 text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none transition-all"
                        placeholder="例如：活在当下，享受生活"
                      >
                    </div>
                  </div>
                </div>

                <div class="mt-8 flex justify-end">
                  <button
                    :disabled="socialContentState.isGenerating"
                    class="flex items-center gap-3 bg-[#a8c7fa] text-black px-8 py-3 rounded-xl text-base font-black hover:bg-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    @click="generateSocialContent"
                  >
                    <span v-if="socialContentState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
                    <span v-else class="material-symbols-outlined">auto_awesome</span>
                    生成发布文案 (Qwen-Plus)
                  </button>
                </div>
              </div>

              <!-- 结果展示区域 -->
              <div v-if="socialContentState.results.douyin.content || socialContentState.results.xiaohongshu.content" class="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <!-- 抖音 -->
                <div class="bg-[#161823] rounded-[40px] border border-[#2f3035] overflow-hidden flex flex-col shadow-2xl relative group hover:-translate-y-2 transition-transform duration-300">
                  <!-- 顶部状态栏模拟 -->
                  <div class="bg-black/20 p-4 flex justify-between items-center backdrop-blur-sm">
                    <img src="/icon/dou.svg" class="w-8 h-8 opacity-90" alt="Douyin">
                    <span class="text-white/50 text-xs font-medium">预览模式</span>
                  </div>

                  <!-- 内容区 -->
                  <div class="p-8 flex-1 space-y-6">
                    <h4 class="text-xl font-bold text-white leading-snug">
                      {{ socialContentState.results.douyin.title }}
                    </h4>

                    <div class="flex flex-wrap gap-2">
                      <span v-for="tag in socialContentState.results.douyin.tags" :key="tag" class="text-[#face15] text-sm font-bold">#{{ tag }}</span>
                    </div>

                    <div class="text-white/90 text-base leading-relaxed whitespace-pre-wrap font-medium">
                      {{ socialContentState.results.douyin.content }}
                    </div>
                  </div>

                  <!-- 底部操作栏模拟 -->
                  <div class="p-4 border-t border-white/10 flex justify-between items-center bg-black/40 backdrop-blur-md">
                    <div class="flex gap-4 text-white/60">
                      <span class="material-symbols-outlined">favorite</span>
                      <span class="material-symbols-outlined">chat_bubble</span>
                      <span class="material-symbols-outlined">bookmark</span>
                    </div>
                    <span class="material-symbols-outlined text-white/60">share</span>
                  </div>
                </div>

                <!-- 小红书 -->
                <div class="bg-white rounded-[40px] border border-gray-200 overflow-hidden flex flex-col shadow-2xl relative group hover:-translate-y-2 transition-transform duration-300">
                  <!-- 顶部状态栏模拟 -->
                  <div class="bg-gray-50 p-4 flex justify-between items-center">
                    <img src="/icon/red.svg" class="w-20 h-auto" alt="Xiaohongshu">
                    <span class="text-gray-400 text-xs font-medium">预览模式</span>
                  </div>

                  <!-- 内容区 -->
                  <div class="p-8 flex-1 space-y-6">
                    <h4 class="text-xl font-bold text-[#333] leading-snug">
                      {{ socialContentState.results.xiaohongshu.title }}
                    </h4>

                    <div class="text-[#333]/90 text-base leading-relaxed whitespace-pre-wrap font-medium">
                      {{ socialContentState.results.xiaohongshu.content }}
                    </div>

                    <div class="flex flex-wrap gap-2 pt-4">
                      <span v-for="tag in socialContentState.results.xiaohongshu.tags" :key="tag" class="text-[#13386c] text-sm font-bold">#{{ tag }}</span>
                    </div>
                  </div>

                  <!-- 底部操作栏模拟 -->
                  <div class="p-4 border-t border-gray-100 flex justify-between items-center bg-white">
                    <div class="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-gray-500 text-sm font-medium w-full mr-4">
                      <span class="material-symbols-outlined text-lg">edit</span>
                      说点什么...
                    </div>
                    <div class="flex gap-3 text-[#333]">
                      <span class="material-symbols-outlined">favorite_border</span>
                      <span class="material-symbols-outlined">star_border</span>
                      <span class="material-symbols-outlined">share</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 5. 创作脚本 (Creation) -->
            <div v-if="activeTab === 'creation'" class="space-y-10 max-w-5xl mx-auto">
              <!-- 口播二创内容 -->
              <div v-if="analysisResult.narration" class="space-y-6">
                <div class="flex items-center justify-between">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl text-pink-400">record_voice_over</span> 口播二创内容
                    <span v-if="analysisResult.narration.wordCount" class="text-sm text-[#5f6368] font-black tracking-widest uppercase">
                      ({{ analysisResult.narration.wordCount }} 字)
                    </span>
                  </h3>
                  <button
                    :disabled="isRewritingNarration"
                    class="flex items-center gap-3 bg-[#353637] text-[#c4c7c5] px-6 py-3 rounded-2xl text-base font-bold hover:bg-[#a8c7fa] hover:text-black transition-all border border-[#444746] disabled:opacity-50 shadow-lg"
                    title="生成相似仿写版本"
                    @click="rewriteNarration"
                  >
                    <span v-if="isRewritingNarration" class="material-symbols-outlined text-xl animate-spin">sync</span>
                    <span v-else class="material-symbols-outlined text-xl">auto_fix</span>
                    相似仿写
                  </button>
                </div>
                <div class="bg-[#28292a] rounded-3xl border border-[#444746] overflow-hidden shadow-2xl">
                  <div class="p-8 space-y-8">
                    <!-- 原始口播内容 -->
                    <div>
                      <div class="text-sm font-black text-[#c4c7c5] mb-4 flex items-center gap-3 tracking-widest uppercase">
                        <span class="material-symbols-outlined text-xl">description</span>
                        原始口播稿
                      </div>
                      <textarea
                        v-model="analysisResult.narration.content"
                        class="w-full bg-[#1e1f20] text-[#e3e3e3] p-6 rounded-2xl border border-[#444746] text-lg leading-loose resize-none min-h-[180px] focus:outline-none focus:border-[#a8c7fa] transition-all shadow-inner font-medium"
                        placeholder="口播内容将显示在这里..."
                        @input="updateNarrationWordCount"
                      />
                      <div class="text-xs text-[#5f6368] mt-2 text-right font-black tracking-widest">
                        {{ getWordCount(analysisResult.narration.content) }} 字
                      </div>
                    </div>

                    <!-- 相似仿写版本 -->
                    <div v-if="narrationRewrite" class="animate-in fade-in slide-in-from-top-4 duration-500">
                      <div class="text-sm font-black text-[#c4c7c5] mb-4 flex items-center gap-3 tracking-widest uppercase">
                        <span class="material-symbols-outlined text-xl text-green-400">auto_awesome</span>
                        相似仿写版本
                      </div>
                      <textarea
                        v-model="narrationRewrite"
                        class="w-full bg-[#1e1f20] text-[#e3e3e3] p-6 rounded-2xl border border-green-500/30 text-lg leading-loose resize-none min-h-[180px] focus:outline-none focus:border-green-500 transition-all shadow-inner font-medium"
                        placeholder="相似仿写内容..."
                      />
                      <div class="text-xs text-[#5f6368] mt-2 text-right font-black tracking-widest">
                        {{ getWordCount(narrationRewrite) }} 字
                      </div>
                      <div class="flex gap-4 mt-6">
                        <button
                          class="flex-1 py-4 bg-green-500/20 text-green-400 rounded-2xl text-base font-black hover:bg-green-500 hover:text-black transition-all border border-green-500/30 shadow-lg"
                          @click="useRewrittenNarration"
                        >
                          使用此版本
                        </button>
                        <button
                          class="px-8 py-4 bg-[#353637] text-[#c4c7c5] rounded-2xl text-base font-black hover:bg-[#444746] transition-all border border-[#444746]"
                          @click="narrationRewrite = ''"
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-indigo-400">terminal</span> AI 复刻提示词
                </h3>
                <div class="space-y-4">
                  <div v-for="(prompt, idx) in analysisResult.prompts" :key="idx" class="bg-[#1e1f20] p-6 rounded-2xl border border-[#444746] font-mono text-sm text-[#c4c7c5] relative group hover:border-[#a8c7fa]/50 transition-all shadow-md leading-relaxed">
                    {{ prompt }}
                    <button class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2.5 bg-[#3c4043] hover:bg-[#a8c7fa] hover:text-black rounded-xl transition-all shadow-lg">
                      <span class="material-symbols-outlined text-lg">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="space-y-6">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                  <span class="material-symbols-outlined text-3xl text-yellow-400">movie_edit</span> 生成分镜头脚本
                </h3>

                <!-- Script Tools Toolbar -->
                <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] mb-6 flex flex-wrap items-center justify-between gap-6 shadow-xl">
                  <div class="flex items-center gap-4">
                    <span class="text-base text-[#c4c7c5] font-black tracking-widest uppercase">脚本优化控制:</span>
                    <div class="flex items-center gap-3 bg-[#1e1f20] rounded-xl border border-[#444746] px-4 py-2 shadow-inner">
                      <span class="text-xs font-black text-[#5f6368] uppercase">时长(s)</span>
                      <input
                        v-model.number="extensionDuration"
                        type="number"
                        class="w-16 bg-transparent text-[#e3e3e3] text-base font-black text-center outline-none focus:text-[#a8c7fa]"
                        min="3"
                        max="60"
                      >
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <button
                      class="flex items-center gap-2 bg-[#3c4043] text-[#e3e3e3] px-6 py-3 rounded-2xl text-sm font-black hover:bg-[#a8c7fa] hover:text-black transition-all border border-[#444746] shadow-lg"
                      title="按照设定时长重写脚本"
                      @click="optimizeScriptWithDuration"
                    >
                      <span class="material-symbols-outlined text-xl">timer</span>
                      按时长重拍
                    </button>

                    <button
                      class="flex items-center gap-2 bg-[#3c4043] text-[#e3e3e3] px-6 py-3 rounded-2xl text-sm font-black hover:bg-[#a8c7fa] hover:text-black transition-all border border-[#444746] shadow-lg"
                      title="在当前脚本前插入前传"
                      @click="continueScript"
                    >
                      <span class="material-symbols-outlined text-xl">first_page</span>
                      AI续写(前传)
                    </button>

                    <button
                      class="flex items-center gap-2 bg-[#3c4043] text-[#e3e3e3] px-6 py-3 rounded-2xl text-sm font-black hover:bg-[#a8c7fa] hover:text-black transition-all border border-[#444746] shadow-lg"
                      title="在当前脚本后追加后续"
                      @click="expandScript"
                    >
                      <span class="material-symbols-outlined text-xl">last_page</span>
                      AI扩写(后传)
                    </button>
                  </div>
                </div>

                <!-- Batch Actions (Video Generation) -->
                <div class="flex items-center justify-between bg-[#28292a] p-3 rounded-lg border border-[#444746] mb-3">
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        :checked="isAllSelected"
                        class="form-checkbox bg-transparent border-[#444746] rounded text-[#a8c7fa] focus:ring-0"
                        @change="toggleSelectAll"
                      >
                      <span class="text-xs text-[#c4c7c5]">全选</span>
                    </label>
                    <span v-if="selectedSceneIndices.size > 0" class="text-xs text-[#a8c7fa]">
                      已选 {{ selectedSceneIndices.size }} 项
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <!-- Model Selector -->
                    <select v-model="videoGenerationConfig.model" class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] text-xs rounded px-2 py-1 outline-none focus:border-[#a8c7fa]">
                      <option v-for="m in availableModels" :key="m.value" :value="m.value">
                        {{ m.label }}
                      </option>
                    </select>

                    <!-- Ratio Selector -->
                    <select v-model="videoGenerationConfig.aspectRatio" class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] text-xs rounded px-2 py-1 outline-none focus:border-[#a8c7fa]">
                      <option value="16:9">
                        16:9 横屏
                      </option>
                      <option value="9:16">
                        9:16 竖屏
                      </option>
                    </select>

                    <button
                      :disabled="selectedSceneIndices.size === 0"
                      class="flex items-center gap-1 bg-[#a8c7fa] text-black px-3 py-1.5 rounded text-xs font-medium hover:bg-[#d3e3fd] transition disabled:opacity-50 disabled:cursor-not-allowed"
                      @click="batchGenerateVideos"
                    >
                      <span class="material-symbols-outlined text-sm">auto_videocam</span>
                      一键AI生成
                    </button>
                  </div>
                </div>

                <div class="bg-[#28292a] rounded-xl border border-[#444746] overflow-hidden">
                  <div class="p-3 bg-[#1e1f20] border-b border-[#444746] text-xs font-bold text-[#e3e3e3]">
                    {{ analysisResult.script.title }}
                  </div>
                  <div class="divide-y divide-[#444746]">
                    <div v-for="(scene, idx) in analysisResult.script.scenes" :key="idx" class="p-3 flex gap-3 hover:bg-[#353637] transition group">
                      <div class="text-xs text-[#5f6368] font-mono w-6 pt-0.5">
                        Sc{{ idx + 1 }}
                      </div>
                      <div class="flex-1 space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] bg-[#a8c7fa]/10 text-[#a8c7fa] px-1.5 rounded">{{ scene.shot }}</span>
                          <!-- 可编辑的脚本内容 -->
                          <textarea
                            v-model="scene.content"
                            class="flex-1 text-xs text-[#e3e3e3] bg-[#1e1f20] border border-[#444746] rounded px-2 py-1 focus:outline-none focus:border-[#a8c7fa] resize-none min-h-[24px] max-h-[120px] transition-colors"
                            rows="1"
                            placeholder="输入脚本内容..."
                            @blur="saveScriptChanges"
                          />
                        </div>
                        <div class="text-[10px] text-[#c4c7c5] flex items-center gap-1">
                          <span class="material-symbols-outlined text-[10px]">volume_up</span>
                          {{ scene.audio }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 6. 剪映导出 (Jianying) -->
            <div v-if="activeTab === 'jianying'" class="space-y-6">
              <!-- 配置区域 -->
              <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] space-y-4">
                <div>
                  <label class="text-xs text-[#c4c7c5] block mb-2">剪映草稿保存路径 (Drafts Path)</label>
                  <div class="flex gap-2">
                    <input
                      v-model="jianyingDraftPath"
                      type="text"
                      class="flex-1 bg-[#1e1f20] text-[#e3e3e3] px-3 py-2 rounded border border-[#444746] text-xs font-mono focus:border-[#a8c7fa] outline-none"
                    >
                    <button class="px-3 py-2 bg-[#353637] rounded border border-[#444746] text-[#c4c7c5] hover:text-white" title="重置为默认">
                      <span class="material-symbols-outlined text-sm">restore</span>
                    </button>
                  </div>
                  <p class="text-[10px] text-[#5f6368] mt-1">
                    Windows 默认路径: %LocalAppData%\JianyingPro\User Data\Projects\com.lveditor.draft
                  </p>
                </div>
              </div>

              <!-- 生成预览 -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">video_settings</span> 生成内容预览
                  </h3>
                  <!-- 视频生成设置 -->
                  <div class="flex items-center gap-3">
                    <select v-model="videoGenerationConfig.model" class="bg-[#1e1f20] text-[#c4c7c5] text-[10px] px-2 py-1 rounded border border-[#444746] focus:border-[#a8c7fa] outline-none">
                      <option v-for="m in availableModels" :key="m.value" :value="m.value">
                        {{ m.label }}
                      </option>
                    </select>
                    <select v-model="videoGenerationConfig.aspectRatio" class="bg-[#1e1f20] text-[#c4c7c5] text-[10px] px-2 py-1 rounded border border-[#444746] focus:border-[#a8c7fa] outline-none">
                      <option value="16:9">
                        横屏 (16:9)
                      </option>
                      <option value="9:16">
                        竖屏 (9:16)
                      </option>
                    </select>
                    <select v-model.number="videoGenerationConfig.duration" class="bg-[#1e1f20] text-[#c4c7c5] text-[10px] px-2 py-1 rounded border border-[#444746] focus:border-[#a8c7fa] outline-none">
                      <option :value="5">
                        5秒
                      </option>
                      <option :value="10">
                        10秒
                      </option>
                      <option :value="15">
                        15秒
                      </option>
                    </select>
                    <button class="text-[10px] bg-[#a8c7fa] text-black px-2 py-1 rounded hover:opacity-90 transition flex items-center gap-1" @click="batchGenerateVideos">
                      <span class="material-symbols-outlined text-[10px]">auto_videocam</span>
                      一键AI生成
                    </button>
                  </div>
                </div>

                <div v-if="analysisResult?.script?.scenes" class="bg-[#28292a] rounded-xl border border-[#444746] overflow-hidden">
                  <!-- 头部信息 -->
                  <div class="p-3 bg-[#1e1f20] border-b border-[#444746] flex justify-between items-center">
                    <div>
                      <div class="text-xs font-bold text-[#e3e3e3]">
                        {{ analysisResult.script.title }}
                      </div>
                      <div class="text-[10px] text-[#c4c7c5] mt-0.5">
                        预计生成 {{ analysisResult.script.scenes.length }} 个片段 · 总时长约 {{ analysisResult.script.scenes.length * 3 }} 秒
                      </div>
                    </div>
                    <span class="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">Ready to Export</span>
                  </div>

                  <!-- 时间线列表 -->
                  <div class="max-h-60 overflow-y-auto custom-scroll p-2 space-y-1">
                    <div
                      v-for="(scene, idx) in analysisResult.script.scenes"
                      :key="idx"
                      class="flex gap-2 p-2 hover:bg-[#353637] rounded transition items-center group relative cursor-pointer border border-transparent"
                      :class="{ 'bg-[#353637] border-[#a8c7fa]/50': selectedSceneIndices.has(idx) }"
                      @click="toggleSceneSelection(idx)"
                    >
                      <!-- 选中复选框 -->
                      <div
                        class="w-4 h-4 rounded border border-[#5f6368] flex items-center justify-center transition-colors"
                        :class="{ 'bg-[#a8c7fa] border-[#a8c7fa]': selectedSceneIndices.has(idx) }"
                      >
                        <span v-if="selectedSceneIndices.has(idx)" class="material-symbols-outlined text-black text-[10px]">check</span>
                      </div>
                      <div class="w-4 flex items-center justify-center">
                        <div
                          :class="[
                            'w-3 h-3 border rounded transition flex items-center justify-center',
                            selectedSceneIndices.has(idx) ? 'bg-[#a8c7fa] border-[#a8c7fa]' : 'border-[#5f6368]'
                          ]"
                        >
                          <span v-if="selectedSceneIndices.has(idx)" class="material-symbols-outlined text-[10px] text-black">check</span>
                        </div>
                      </div>

                      <div class="w-8 text-[10px] font-mono text-[#5f6368] text-center">
                        00:{{ (idx * 3).toString().padStart(2, '0') }}
                      </div>

                      <!-- 缩略图/视频预览 -->
                      <!-- 逻辑调整：这里只显示该位置当前对应的队列视频预览（只读，不绑定） -->
                      <div class="w-12 h-8 bg-[#1e1f20] rounded overflow-hidden flex-shrink-0 relative border border-[#444746]">
                        <video
                          v-if="generatedVideos.filter(v => v.status === 'succeeded')[idx]"
                          :src="generatedVideos.filter(v => v.status === 'succeeded')[idx].url"
                          class="w-full h-full object-cover"
                          muted
                          autoplay
                          loop
                        />
                        <div v-else class="w-full h-full flex items-center justify-center text-[#5f6368]">
                          <span class="material-symbols-outlined text-xs">movie</span>
                        </div>
                      </div>

                      <div class="flex-1 min-w-0 z-10">
                        <div class="text-xs text-[#e3e3e3] truncate">
                          {{ scene.content }}
                        </div>
                        <div class="text-[10px] text-[#a8c7fa] truncate mt-0.5">
                          {{ scene.audio }}
                        </div>
                      </div>

                      <!-- 操作按钮 -->
                      <div class="flex items-center gap-2 z-10">
                        <div class="text-[10px] bg-[#444746] px-1.5 rounded text-[#c4c7c5]">
                          3s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-8 text-[#5f6368] text-xs">
                  暂无生成内容，请先进行视频分析
                </div>
              </div>

              <!-- 操作按钮 -->
              <button
                :disabled="!analysisResult?.script?.scenes"
                class="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                @click="createJianyingDraft"
              >
                <span class="material-symbols-outlined">movie_edit</span>
                一键生成剪映草稿 (插入脚本与音频)
              </button>

              <!-- 本地草稿列表 -->
              <div class="space-y-3 pt-4 border-t border-[#444746]">
                <h3 class="text-sm font-medium text-[#c4c7c5] flex items-center justify-between">
                  <span>本地草稿箱</span>
                  <button class="text-[10px] text-[#a8c7fa] hover:underline" @click="fetchJianyingDrafts">
                    刷新
                  </button>
                </h3>
                <div class="grid grid-cols-1 gap-2">
                  <div v-for="draft in jianyingDrafts" :key="draft.id" class="bg-[#1e1f20] p-3 rounded border border-[#444746] flex justify-between items-center">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 bg-[#353637] rounded flex items-center justify-center text-[#5f6368]">
                        <span class="material-symbols-outlined text-sm">folder</span>
                      </div>
                      <div>
                        <div class="text-xs text-[#e3e3e3]">
                          {{ draft.name }}
                        </div>
                        <div class="text-[10px] text-[#5f6368] font-mono">
                          {{ new Date(draft.modified).toLocaleString() }}
                        </div>
                      </div>
                    </div>
                    <button class="p-1.5 hover:bg-[#353637] rounded text-[#c4c7c5]">
                      <span class="material-symbols-outlined text-sm">open_in_new</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 7. 语音克隆 (Voice) -->
            <div v-if="activeTab === 'voice'" class="space-y-6">
              <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] space-y-4">
                <div class="text-center p-6 border-2 border-dashed border-[#444746] rounded-lg hover:border-[#a8c7fa] transition cursor-pointer relative">
                  <input
                    type="file"
                    accept="audio/*"
                    class="absolute inset-0 opacity-0 cursor-pointer"
                    @change="handleVoiceSampleUpload"
                  >
                  <span class="material-symbols-outlined text-4xl text-[#5f6368] mb-2">graphic_eq</span>
                  <p class="text-sm text-[#e3e3e3]">
                    上传语音样本 (10s+)
                  </p>
                  <p class="text-xs text-[#c4c7c5] mt-1">
                    支持 MP3, WAV
                  </p>
                </div>

                <div v-if="voiceCloningState.sampleUrl" class="bg-[#1e1f20] p-3 rounded flex items-center gap-3">
                  <audio :src="voiceCloningState.sampleUrl" controls class="h-8 w-full" />
                </div>

                <div v-if="voiceCloningState.clonedVoiceId" class="space-y-2">
                  <label class="text-xs text-[#c4c7c5]">TTS 文字转语音</label>
                  <textarea
                    v-model="voiceCloningState.inputText"
                    class="w-full bg-[#1e1f20] text-[#e3e3e3] p-3 rounded border border-[#444746] text-xs resize-none h-24 focus:border-[#a8c7fa] outline-none"
                    placeholder="输入要生成的文案..."
                  />
                  <button
                    :disabled="voiceCloningState.isRecording"
                    class="w-full py-2 bg-[#a8c7fa] text-black rounded font-medium text-xs hover:bg-[#d3e3fd] transition disabled:opacity-50"
                    @click="generateVoice"
                  >
                    {{ voiceCloningState.isRecording ? '生成中...' : '生成语音' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 5. 修改意见 (Advice) -->
            <div v-if="activeTab === 'advice'" class="space-y-6">
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">model_training</span> PDCA 爆款迭代建议
                </h3>
                <div class="grid grid-cols-1 gap-4">
                  <!-- P - Plan -->
                  <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] border-l-4 border-l-blue-500 relative overflow-hidden">
                    <div class="absolute right-4 top-4 opacity-5">
                      <span class="text-6xl font-black text-blue-500">P</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="material-symbols-outlined text-blue-400">assignment</span>
                      <span class="text-sm font-bold text-blue-400">Plan (策划优化)</span>
                    </div>
                    <p class="text-md text-[#e3e3e3] leading-relaxed relative z-10">
                      {{ analysisResult.pdcaAdvice.plan }}
                    </p>
                  </div>

                  <!-- D - Do -->
                  <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] border-l-4 border-l-yellow-500 relative overflow-hidden">
                    <div class="absolute right-4 top-4 opacity-5">
                      <span class="text-6xl font-black text-yellow-500">D</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="material-symbols-outlined text-yellow-400">movie_filter</span>
                      <span class="text-sm font-bold text-yellow-400">Do (执行建议)</span>
                    </div>
                    <p class="text-md text-[#e3e3e3] leading-relaxed relative z-10">
                      {{ analysisResult.pdcaAdvice.do }}
                    </p>
                  </div>

                  <!-- C - Check -->
                  <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] border-l-4 border-l-green-500 relative overflow-hidden">
                    <div class="absolute right-4 top-4 opacity-5">
                      <span class="text-6xl font-black text-green-500">C</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="material-symbols-outlined text-green-400">analytics</span>
                      <span class="text-sm font-bold text-green-400">Check (数据预判)</span>
                    </div>
                    <p class="text-md text-[#e3e3e3] leading-relaxed relative z-10">
                      {{ analysisResult.pdcaAdvice.check }}
                    </p>
                  </div>

                  <!-- A - Act -->
                  <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746] border-l-4 border-l-red-500 relative overflow-hidden">
                    <div class="absolute right-4 top-4 opacity-5">
                      <span class="text-6xl font-black text-red-500">A</span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="material-symbols-outlined text-red-400">update</span>
                      <span class="text-sm font-bold text-red-400">Act (迭代方向)</span>
                    </div>
                    <p class="text-md text-[#e3e3e3] leading-relaxed relative z-10">
                      {{ analysisResult.pdcaAdvice.act }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 素材提取 (Extraction) -->
            <div v-if="activeTab === 'extraction'" class="space-y-8">
              <!-- 1. 字幕提取 (OCR) -->
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl">subtitles</span> 字幕提取 (多模态分析)
                  </h3>
                </div>
                <div v-if="analysisResult?.subtitles" class="bg-[#1e1f20] p-6 rounded-xl border border-[#444746] shadow-inner">
                  <div class="text-[#e3e3e3] text-lg leading-relaxed whitespace-pre-wrap">
                    {{ analysisResult.subtitles }}
                  </div>
                </div>
                <div v-else class="text-[#c4c7c5] text-sm flex flex-col items-center py-8 gap-2 bg-[#1e1f20] rounded-xl border border-[#444746] border-dashed">
                  <span class="material-symbols-outlined text-4xl text-[#5f6368]">search_off</span>
                  <p>暂无字幕数据</p>
                  <p class="text-xs opacity-60">
                    请点击左侧“开始爆款解析”，AI 将在分析过程中自动提取画面字幕
                  </p>
                </div>
              </div>

              <!-- 2. 音频提取 -->
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl">headphones</span> 原视频音频提取
                  </h3>
                </div>

                <div v-if="videoUrl" class="space-y-6">
                  <!-- 音频提取配置 -->
                  <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746] space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                      <!-- 音频格式选择 -->
                      <div>
                        <label class="text-sm text-[#c4c7c5] block mb-2">音频格式:</label>
                        <select
                          v-model="audioExtractState.format"
                          class="w-full bg-[#2d2e30] border border-[#444746] text-[#e3e3e3] px-3 py-2 rounded-lg focus:border-[#a8c7fa] outline-none font-bold"
                        >
                          <option value="mp3">
                            MP3 - 最常用，文件小
                          </option>
                          <option value="wav">
                            WAV - 无损，文件大
                          </option>
                          <option value="aac">
                            AAC - 高质量，文件适中
                          </option>
                          <option value="m4a">
                            M4A - Apple格式
                          </option>
                          <option value="ogg">
                            OGG - 开源格式
                          </option>
                        </select>
                      </div>

                      <!-- 音频质量选择 -->
                      <div>
                        <label class="text-sm text-[#c4c7c5] block mb-2">音频质量:</label>
                        <select
                          v-model="audioExtractState.quality"
                          class="w-full bg-[#2d2e30] border border-[#444746] text-[#e3e3e3] px-3 py-2 rounded-lg focus:border-[#a8c7fa] outline-none font-bold"
                        >
                          <option value="low">
                            低质量 (64k) - 文件最小
                          </option>
                          <option value="medium">
                            中等质量 (128k) - 推荐
                          </option>
                          <option value="high">
                            高质量 (320k) - 文件较大
                          </option>
                        </select>
                      </div>
                    </div>

                    <!-- 提取按钮 -->
                    <button
                      :disabled="audioExtractState.isProcessing"
                      class="w-full px-4 py-3 bg-[#a8c7fa] text-black rounded-xl font-bold hover:bg-[#d3e3fd] transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                      @click="extractAudio"
                    >
                      <span v-if="audioExtractState.isProcessing" class="material-symbols-outlined animate-spin">refresh</span>
                      <span v-else class="material-symbols-outlined">audio_file</span>
                      {{ audioExtractState.isProcessing ? '正在提取音频...' : '提取音频文件' }}
                    </button>
                  </div>

                  <!-- 进度显示 -->
                  <div v-if="audioExtractState.isProcessing" class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                    <div class="flex items-center gap-3">
                      <div class="animate-spin rounded-full h-4 w-4 border-2 border-[#a8c7fa] border-t-transparent" />
                      <span class="text-[#e3e3e3]">{{ audioExtractState.status }}</span>
                    </div>
                  </div>

                  <!-- 提取结果 -->
                  <div v-if="audioExtractState.status && audioExtractState.status.includes('完成')" class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746] space-y-4">
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-[#4caf50] text-2xl">check_circle</span>
                      <div>
                        <p class="text-[#e3e3e3] font-bold">
                          {{ audioExtractState.status }}
                        </p>
                        <p class="text-[#c4c7c5] text-sm">
                          格式: {{ audioExtractState.format.toUpperCase() }} |
                          质量: {{ audioExtractState.quality }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 错误显示 -->
                  <div v-if="audioExtractState.error" class="bg-[#b91c1c] bg-opacity-20 border border-[#b91c1c] p-4 rounded-xl">
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-[#ef4444] text-xl">error</span>
                      <div>
                        <p class="text-[#ef4444] font-bold">
                          提取失败
                        </p>
                        <p class="text-[#fca5a5] text-sm">
                          {{ audioExtractState.error }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 生成结果音频播放器 -->
                  <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                    <p class="text-[#c4c7c5] text-sm mb-2">
                      生成结果音频:
                    </p>

                    <!-- 音频播放器 -->
                    <div v-if="audioExtractState.audioUrl" class="space-y-3">
                      <audio :src="audioExtractState.audioUrl" controls class="w-full h-10" />

                      <!-- 下载按钮 -->
                      <button
                        class="w-full px-4 py-2 bg-[#4caf50] text-white rounded-lg font-bold hover:bg-[#45a049] transition flex items-center justify-center gap-2"
                        @click="downloadAudioFile"
                      >
                        <span class="material-symbols-outlined">download</span>
                        下载音频文件
                      </button>
                    </div>

                    <!-- 未生成音频时的提示 -->
                    <div v-else class="text-[#c4c7c5] text-sm flex flex-col items-center py-4 gap-2">
                      <span class="material-symbols-outlined text-3xl text-[#5f6368]">music_note</span>
                      <p>请先提取音频</p>
                    </div>
                  </div>
                </div>

                <div v-else class="text-[#c4c7c5] text-sm flex flex-col items-center py-8 gap-2 bg-[#1e1f20] rounded-xl border border-[#444746] border-dashed">
                  <span class="material-symbols-outlined text-4xl text-[#5f6368]">music_off</span>
                  <p>请先上传视频</p>
                </div>
              </div>

              <!-- 3. ASR 语音内容提取 (原功能) -->
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <div class="flex items-center justify-between mb-6">
                  <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3">
                    <span class="material-symbols-outlined text-3xl">mic</span> ASR 语音内容提取 (Paraformer-v2)
                  </h3>
                </div>

                <div class="space-y-4">
                  <!-- Model Selection -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">ASR 模型:</label>
                    <select
                      v-model="asrState.model"
                      class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-1 rounded focus:border-[#a8c7fa] outline-none font-bold"
                    >
                      <option value="paraformer-v2">
                        Paraformer-v2 (多语种)
                      </option>
                      <option value="paraformer-8k-v2">
                        Paraformer-8k-v2 (中文8kHz)
                      </option>
                    </select>
                  </div>

                  <!-- Language Hints -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">语言识别 (Language Hints):</label>
                    <div class="flex gap-2">
                      <label class="flex items-center gap-1 text-xs text-[#c4c7c5]">
                        <input
                          v-model="asrState.languageHints"
                          type="checkbox"
                          value="zh"
                          class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                        >
                        中文
                      </label>
                      <label class="flex items-center gap-1 text-xs text-[#c4c7c5]">
                        <input
                          v-model="asrState.languageHints"
                          type="checkbox"
                          value="en"
                          class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                        >
                        英文
                      </label>
                      <label v-if="asrState.model === 'paraformer-v2'" class="flex items-center gap-1 text-xs text-[#c4c7c5]">
                        <input
                          v-model="asrState.languageHints"
                          type="checkbox"
                          value="ja"
                          class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                        >
                        日语
                      </label>
                      <label v-if="asrState.model === 'paraformer-v2'" class="flex items-center gap-1 text-xs text-[#c4c7c5]">
                        <input
                          v-model="asrState.languageHints"
                          type="checkbox"
                          value="ko"
                          class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                        >
                        韩语
                      </label>
                    </div>
                  </div>

                  <!-- Speaker Diarization -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">说话人分离 (Diarization):</label>
                    <input
                      v-model="asrState.diarizationEnabled"
                      type="checkbox"
                      class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                    >
                    <span class="text-xs text-[#5f6368]">启用后可区分不同说话人</span>
                  </div>

                  <!-- Speaker Count (only show when diarization is enabled) -->
                  <div v-if="asrState.diarizationEnabled" class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">说话人数量 (Speaker Count):</label>
                    <input
                      v-model.number="asrState.speakerCount"
                      type="number"
                      min="1"
                      max="10"
                      class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-1 rounded w-20 focus:border-[#a8c7fa] outline-none text-center font-bold"
                    >
                    <span class="text-xs text-[#5f6368]">预估说话人数量</span>
                  </div>

                  <!-- Timestamp Alignment -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">时间戳校准:</label>
                    <input
                      v-model="asrState.timestampAlignmentEnabled"
                      type="checkbox"
                      class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                    >
                    <span class="text-xs text-[#5f6368]">启用时间戳精确对齐</span>
                  </div>

                  <!-- Disfluency Removal -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">过滤语气词:</label>
                    <input
                      v-model="asrState.disfluencyRemovalEnabled"
                      type="checkbox"
                      class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                    >
                    <span class="text-xs text-[#5f6368]">过滤"嗯、啊"等语气词</span>
                  </div>

                  <!-- Channel ID -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">音轨索引:</label>
                    <input
                      v-model="asrState.channelId"
                      type="number"
                      min="0"
                      max="10"
                      class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-1 rounded w-20 focus:border-[#a8c7fa] outline-none text-center font-bold"
                    >
                    <span class="text-xs text-[#5f6368]">多音轨文件指定音轨</span>
                  </div>

                  <!-- Vocabulary ID -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">热词ID:</label>
                    <input
                      v-model="asrState.vocabularyId"
                      type="text"
                      placeholder="vocab-xxxxx"
                      class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-1 rounded focus:border-[#a8c7fa] outline-none font-bold"
                    >
                    <span class="text-xs text-[#5f6368]">自定义热词词典</span>
                  </div>

                  <!-- Special Word Filter -->
                  <div class="flex items-center gap-4">
                    <label class="text-sm text-[#c4c7c5]">敏感词过滤:</label>
                    <input
                      v-model="asrState.specialWordFilter"
                      type="text"
                      placeholder="{&quot;filter_with_signed&quot;: {&quot;word_list&quot;: [&quot;测试&quot;]}}"
                      class="bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-1 rounded focus:border-[#a8c7fa] outline-none font-bold"
                    >
                    <span class="text-xs text-[#5f6368]">JSON格式配置</span>
                  </div>

                  <button
                    :disabled="!videoFile || asrState.isProcessing"
                    class="px-6 py-3 bg-[#a8c7fa] text-black rounded-xl font-bold hover:bg-[#d3e3fd] transition disabled:opacity-50 flex items-center gap-2 shadow-lg"
                    @click="startAsr"
                  >
                    <span v-if="asrState.isProcessing" class="material-symbols-outlined animate-spin">sync</span>
                    <span v-else class="material-symbols-outlined">play_arrow</span>
                    {{ asrState.isProcessing ? asrState.status : '开始语音提取' }}
                  </button>

                  <div v-if="asrState.error" class="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                    <span class="font-bold">错误:</span> {{ asrState.error }}
                  </div>
                </div>
              </div>

              <!-- ASR 结果展示 -->
              <div v-if="asrState.result" class="bg-[#28292a] p-6 rounded-2xl border border-[#444746] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div class="flex justify-between items-center mb-4">
                  <h4 class="text-lg font-bold text-[#e3e3e3]">
                    识别结果
                  </h4>
                  <div class="flex items-center gap-2">
                    <span class="text-xs bg-[#353637] text-[#a8c7fa] px-2 py-1 rounded border border-[#a8c7fa]/20">{{ asrState.model }}</span>
                    <span v-if="asrState.diarizationEnabled" class="text-xs bg-[#353637] text-[#4ade80] px-2 py-1 rounded border border-[#4ade80]/20">说话人分离</span>
                  </div>
                </div>

                <!-- Display transcripts (Paraformer-v2 format) -->
                <div v-if="asrState.result.transcripts && asrState.result.transcripts.length > 0" class="space-y-3 max-h-[600px] overflow-y-auto custom-scroll pr-2">
                  <div v-for="(transcript, idx) in asrState.result.transcripts" :key="idx" class="p-4 bg-[#1e1f20] hover:bg-[#353637] rounded-xl transition border border-[#444746]">
                    <div class="flex justify-between items-start mb-2">
                      <span class="text-xs bg-[#353637] text-[#a8c7fa] px-2 py-1 rounded">音轨 {{ transcript.channel_id || 0 }}</span>
                      <span class="text-xs text-[#5f6368]">{{ formatDuration(transcript.content_duration_in_milliseconds) }}</span>
                    </div>
                    <div class="text-[#e3e3e3] text-base leading-relaxed">
                      {{ transcript.text }}
                    </div>

                    <!-- Display sentences with timestamps -->
                    <div v-if="transcript.sentences && transcript.sentences.length > 0" class="mt-3 space-y-2">
                      <div v-for="(sentence, sIdx) in transcript.sentences" :key="sIdx" class="flex gap-3 p-3 bg-[#28292a] rounded-lg border border-[#444746]/50">
                        <div class="text-[#a8c7fa] font-mono text-xs whitespace-nowrap pt-1 opacity-70">
                          {{ formatTime(sentence.begin_time) }}
                        </div>
                        <div class="flex-1">
                          <div v-if="sentence.speaker_id !== undefined" class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold bg-[#a8c7fa]/20 text-[#a8c7fa] px-1.5 py-0.5 rounded">Speaker {{ sentence.speaker_id }}</span>
                          </div>
                          <div class="text-[#e3e3e3] text-sm">
                            {{ sentence.text }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Display sentences (alternative format) -->
                <div v-else-if="asrState.result.sentences" class="space-y-3 max-h-[600px] overflow-y-auto custom-scroll pr-2">
                  <div v-for="(sentence, idx) in asrState.result.sentences" :key="idx" class="flex gap-4 p-4 bg-[#1e1f20] hover:bg-[#353637] rounded-xl transition border border-[#444746] group">
                    <div class="text-[#a8c7fa] font-mono text-xs whitespace-nowrap pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {{ formatTime(sentence.begin_time) }}
                    </div>
                    <div class="flex-1">
                      <div v-if="sentence.speaker_id !== undefined" class="flex items-center gap-2 mb-1.5">
                        <span class="text-[10px] font-bold bg-[#a8c7fa]/20 text-[#a8c7fa] px-1.5 py-0.5 rounded">Speaker {{ sentence.speaker_id }}</span>
                      </div>
                      <div class="text-[#e3e3e3] text-base leading-relaxed">
                        {{ sentence.text }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Fallback: display raw JSON -->
                <pre v-else class="text-xs text-[#c4c7c5] overflow-auto max-h-96 bg-[#1e1f20] p-4 rounded-xl font-mono">{{ JSON.stringify(asrState.result, null, 2) }}</pre>

                <!-- Copy transcription button -->
                <div class="mt-4 flex justify-end">
                  <button
                    class="px-4 py-2 bg-[#353637] text-[#e3e3e3] rounded-lg text-sm hover:bg-[#444746] transition flex items-center gap-2"
                    @click="copyTranscription"
                  >
                    <span class="material-symbols-outlined text-sm">content_copy</span>
                    复制转录文本
                  </button>
                </div>
              </div>
            </div>

            <!-- 6. 内容生成 (Content Generation) -->
            <ContentGenerationTab 
              v-if="activeTab === 'content_generation' " 
              :analysis-result="analysisResult"
              :content-generation-state="contentGenerationState"
              @generate-content="generateContent"
              @export-to-jianying="exportToJianying"
              @copy-jianying-script="copyJianyingScript"
            />
            
            <!-- 7. 数字人视频 (Digital Human Video) -->
            <div v-if="activeTab === 'digital_human'" class="space-y-6">
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3 mb-6">
                  <span class="material-symbols-outlined text-3xl">face</span> 数字人视频生成
                </h3>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- 左侧：照片上传 -->
                  <div class="space-y-4">
                    <h4 class="text-lg font-bold text-[#e3e3e3]">上传照片</h4>
                    <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#444746] border-dashed text-center">
                      <input 
                        type="file" 
                        accept="image/*" 
                        class="hidden" 
                        id="photo-upload" 
                        @change="handlePhotoUpload"
                      >
                      <label for="photo-upload" class="cursor-pointer">
                        <span class="material-symbols-outlined text-4xl text-[#5f6368]">add_photo_alternate</span>
                        <p class="text-[#c4c7c5] mt-2">点击上传照片</p>
                        <p class="text-[#5f6368] text-xs mt-1">支持 JPG、PNG 格式</p>
                      </label>
                    </div>
                    
                    <!-- 照片预览 -->
                    <div v-if="digitalHumanState.photoUrl" class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                      <img :src="digitalHumanState.photoUrl" class="w-full h-auto rounded-lg object-cover" alt="照片预览">
                      <div class="mt-3 flex justify-between items-center">
                        <div>
                          <p class="text-[#e3e3e3] font-bold">{{ digitalHumanState.photoInfo?.name }}</p>
                          <p class="text-[#c4c7c5] text-sm">{{ formatFileSize(digitalHumanState.photoInfo?.size || 0) }}</p>
                        </div>
                        <button 
                          class="px-4 py-2 bg-[#a8c7fa] text-black rounded-lg font-bold hover:bg-[#d3e3fd] transition"
                          @click="detectFace"
                          :disabled="digitalHumanState.faceDetectState.isDetecting"
                        >
                          <span v-if="digitalHumanState.faceDetectState.isDetecting" class="material-symbols-outlined animate-spin">refresh</span>
                          <span v-else class="material-symbols-outlined">face</span>
                          {{ digitalHumanState.faceDetectState.isDetecting ? '检测中...' : '检测人脸' }}
                        </button>
                      </div>
                      
                      <!-- 人脸检测结果 -->
                      <div v-if="digitalHumanState.faceDetectState.message" class="mt-3 p-3 rounded-lg" :class="digitalHumanState.faceDetectState.pass ? 'bg-[#4caf50]/20 border border-[#4caf50]/30' : 'bg-[#ef4444]/20 border border-[#ef4444]/30'">
                        <p :class="digitalHumanState.faceDetectState.pass ? 'text-[#4caf50]' : 'text-[#ef4444]'">
                          {{ digitalHumanState.faceDetectState.message }}
                        </p>
                      </div>
                      
                      <!-- 人脸检测错误 -->
                      <div v-if="digitalHumanState.faceDetectState.error" class="mt-3 p-3 bg-[#ef4444]/20 border border-[#ef4444]/30 rounded-lg">
                        <p class="text-[#ef4444]">{{ digitalHumanState.faceDetectState.error }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- 右侧：音频上传和文本输入 -->
                  <div class="space-y-4">
                    <h4 class="text-lg font-bold text-[#e3e3e3]">音频设置</h4>
                    
                    <!-- 音频上传 -->
                    <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#444746] border-dashed text-center">
                      <input 
                        type="file" 
                        accept="audio/*" 
                        class="hidden" 
                        id="audio-upload" 
                        @change="handleAudioUpload"
                      >
                      <label for="audio-upload" class="cursor-pointer">
                        <span class="material-symbols-outlined text-4xl text-[#5f6368]">mic</span>
                        <p class="text-[#c4c7c5] mt-2">点击上传音频</p>
                        <p class="text-[#5f6368] text-xs mt-1">支持 MP3、WAV 格式</p>
                      </label>
                    </div>
                    
                    <!-- 音频预览 -->
                    <div v-if="digitalHumanState.audioUrl" class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                      <audio :src="digitalHumanState.audioUrl" controls class="w-full h-10"></audio>
                      <div class="mt-3">
                        <p class="text-[#e3e3e3] font-bold">{{ digitalHumanState.audioInfo?.name }}</p>
                        <p class="text-[#c4c7c5] text-sm">{{ formatFileSize(digitalHumanState.audioInfo?.size || 0) }}</p>
                      </div>
                    </div>
                    
                    <!-- 文本输入和TTS -->
                    <div class="space-y-3">
                      <h5 class="text-md font-bold text-[#c4c7c5]">或输入文本生成语音</h5>
                      <textarea 
                        v-model="digitalHumanState.inputText"
                        placeholder="请输入要转换为语音的文本..."
                        class="w-full bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-4 py-3 rounded-lg focus:border-[#a8c7fa] outline-none font-bold"
                        rows="4"
                      ></textarea>
                      <button 
                        class="w-full px-4 py-3 bg-[#a8c7fa] text-black rounded-xl font-bold hover:bg-[#d3e3fd] transition disabled:opacity-50"
                        @click="generateTTS"
                        :disabled="digitalHumanState.ttsState.isGenerating || !digitalHumanState.inputText.trim()"
                      >
                        <span v-if="digitalHumanState.ttsState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined">text_to_speech</span>
                        {{ digitalHumanState.ttsState.isGenerating ? '生成中...' : '生成语音' }}
                      </button>
                      
                      <!-- TTS音频预览 -->
                      <div v-if="digitalHumanState.ttsState.audioUrl" class="bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                        <p class="text-[#c4c7c5] text-sm mb-2">生成的语音：</p>
                        <audio :src="digitalHumanState.ttsState.audioUrl" controls class="w-full h-10"></audio>
                      </div>
                      
                      <!-- TTS错误 -->
                      <div v-if="digitalHumanState.ttsState.error" class="bg-[#ef4444]/20 border border-[#ef4444]/30 p-3 rounded-lg">
                        <p class="text-[#ef4444]">{{ digitalHumanState.ttsState.error }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 参数设置 -->
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3 mb-6">
                  <span class="material-symbols-outlined text-3xl">tune</span> 参数设置
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-[#c4c7c5] text-sm mb-2">模板类型</label>
                    <select 
                      v-model="digitalHumanState.parameters.templateId"
                      class="w-full bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-2 rounded-lg focus:border-[#a8c7fa] outline-none font-bold"
                    >
                      <option value="normal">标准模板</option>
                      <option value="professional">专业模板</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[#c4c7c5] text-sm mb-2">眼睛移动频率</label>
                    <input 
                      type="range" 
                      v-model.number="digitalHumanState.parameters.eyeMoveFreq"
                      min="0" 
                      max="1" 
                      step="0.1"
                      class="w-full"
                    >
                    <p class="text-[#5f6368] text-xs text-center">{{ digitalHumanState.parameters.eyeMoveFreq }}</p>
                  </div>
                  <div>
                    <label class="block text-[#c4c7c5] text-sm mb-2">头部移动强度</label>
                    <input 
                      type="range" 
                      v-model.number="digitalHumanState.parameters.headMoveStrength"
                      min="0" 
                      max="1" 
                      step="0.1"
                      class="w-full"
                    >
                    <p class="text-[#5f6368] text-xs text-center">{{ digitalHumanState.parameters.headMoveStrength }}</p>
                  </div>
                  <div>
                    <label class="block text-[#c4c7c5] text-sm mb-2">嘴巴动作强度</label>
                    <input 
                      type="range" 
                      v-model.number="digitalHumanState.parameters.mouthMoveStrength"
                      min="0.5" 
                      max="2" 
                      step="0.1"
                      class="w-full"
                    >
                    <p class="text-[#5f6368] text-xs text-center">{{ digitalHumanState.parameters.mouthMoveStrength }}</p>
                  </div>
                  <div>
                    <label class="block text-[#c4c7c5] text-sm mb-2">视频帧率</label>
                    <select 
                      v-model.number="digitalHumanState.parameters.videoFps"
                      class="w-full bg-[#1e1f20] border border-[#444746] text-[#e3e3e3] px-3 py-2 rounded-lg focus:border-[#a8c7fa] outline-none font-bold"
                    >
                      <option value="24">24 FPS</option>
                      <option value="30">30 FPS</option>
                    </select>
                  </div>
                  <div>
                    <label class="flex items-center gap-2 text-[#c4c7c5] text-sm">
                      <input 
                        type="checkbox" 
                        v-model="digitalHumanState.parameters.pasteBack"
                        class="rounded border-[#444746] bg-[#1e1f20] text-[#a8c7fa] focus:ring-[#a8c7fa]"
                      >
                      背景融合
                    </label>
                  </div>
                </div>
              </div>

              <!-- 生成视频 -->
              <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
                <h3 class="text-xl font-bold text-[#a8c7fa] flex items-center gap-3 mb-6">
                  <span class="material-symbols-outlined text-3xl">videocam</span> 生成视频
                </h3>
                <button 
                  class="w-full px-6 py-4 bg-[#a8c7fa] text-black rounded-xl font-bold hover:bg-[#d3e3fd] transition disabled:opacity-50 flex items-center justify-center gap-3 text-lg"
                  @click="generateDigitalHumanVideo"
                  :disabled="digitalHumanState.videoGenerateState.isGenerating || !digitalHumanState.remotePhotoUrl || (!digitalHumanState.audioFile && !digitalHumanState.ttsState.audioUrl)"
                >
                  <span v-if="digitalHumanState.videoGenerateState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
                  <span v-else class="material-symbols-outlined">play_circle</span>
                  {{ digitalHumanState.videoGenerateState.isGenerating ? '生成中...' : '开始生成视频' }}
                </button>
                
                <!-- 生成进度 -->
                <div v-if="digitalHumanState.videoGenerateState.isGenerating" class="mt-6 bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                  <div class="flex justify-between items-center mb-2">
                    <p class="text-[#e3e3e3]">生成进度</p>
                    <p class="text-[#a8c7fa]">{{ Math.round(digitalHumanState.videoGenerateState.progress * 100) }}%</p>
                  </div>
                  <div class="w-full bg-[#3c4043] rounded-full h-2.5">
                    <div 
                      class="bg-[#a8c7fa] h-2.5 rounded-full transition-all duration-300"
                      :style="{ width: digitalHumanState.videoGenerateState.progress * 100 + '%' }"
                    ></div>
                  </div>
                  <p class="text-[#c4c7c5] text-sm mt-3">状态：{{ digitalHumanState.videoGenerateState.status }}</p>
                </div>
                
                <!-- 生成结果 -->
                <div v-if="digitalHumanState.videoGenerateState.videoUrl" class="mt-6 bg-[#1e1f20] p-4 rounded-xl border border-[#444746]">
                  <p class="text-[#e3e3e3] font-bold mb-3">生成的视频：</p>
                  <video :src="digitalHumanState.videoGenerateState.videoUrl" controls class="w-full h-auto rounded-lg" alt="生成的视频"></video>
                  <div class="mt-4 flex justify-between">
                    <a 
                      :href="digitalHumanState.videoGenerateState.videoUrl" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="px-4 py-2 bg-[#4caf50] text-white rounded-lg font-bold hover:bg-[#45a049] transition flex items-center gap-2"
                    >
                      <span class="material-symbols-outlined">open_in_new</span>
                      打开视频
                    </a>
                    <button 
                      class="px-4 py-2 bg-[#353637] text-[#e3e3e3] rounded-lg font-bold hover:bg-[#444746] transition flex items-center gap-2"
                      @click="() => { digitalHumanState.videoGenerateState.videoUrl = '' }"
                    >
                      <span class="material-symbols-outlined">refresh</span>
                      重新生成
                    </button>
                  </div>
                </div>
                
                <!-- 生成错误 -->
                <div v-if="digitalHumanState.videoGenerateState.error" class="mt-6 bg-[#ef4444]/20 border border-[#ef4444]/30 p-4 rounded-xl">
                  <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-[#ef4444] text-xl mt-0.5">error</span>
                    <div>
                      <p class="text-[#ef4444] font-bold">生成失败</p>
                      <p class="text-[#fca5a5]">{{ digitalHumanState.videoGenerateState.error }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 8. 历史记录 (History) -->
            <div v-if="activeTab === 'history'" class="space-y-4">
              <div v-for="(item, idx) in historyList" :key="idx" class="bg-[#28292a] p-4 rounded-xl border border-[#444746] hover:border-[#a8c7fa] transition group relative">
                <div class="flex justify-between items-start mb-2">
                  <h4 class="text-sm font-bold text-[#e3e3e3]">
                    {{ item.script?.title || '未命名分析' }}
                  </h4>
                  <span class="text-[10px] bg-[#353637] text-[#c4c7c5] px-2 py-1 rounded">{{ item.savedAt }}</span>
                </div>
                <div class="flex gap-2 mb-3">
                  <span v-for="tag in item.viralReasons?.slice(0, 3)" :key="tag" class="text-[10px] text-[#a8c7fa] bg-[#a8c7fa]/10 px-1.5 py-0.5 rounded">
                    {{ tag }}
                  </span>
                </div>
                <button
                  class="w-full py-2 bg-[#353637] text-[#e3e3e3] rounded text-xs hover:bg-[#444746] transition flex items-center justify-center gap-2"
                  @click="loadHistoryItem(item)"
                >
                  <span class="material-symbols-outlined text-sm">visibility</span>
                  查看详情
                </button>
              </div>

              <div v-if="historyList.length === 0" class="text-center py-10 text-[#5f6368] text-xs">
                暂无历史记录
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 使用CSS变量以匹配全局样式 */
.custom-scroll::-webkit-scrollbar {
  width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: var(--border-primary);
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--border-secondary);
}

/* 适配全局样式 */
.bg-\[\#1e1f20\] {
  background-color: var(--bg-primary) !important;
}
.bg-\[\#28292a\] {
  background-color: var(--bg-secondary) !important;
}
.bg-\[\#131314\] {
  background-color: var(--bg-tertiary) !important;
}
.text-\[\#e3e3e3\] {
  color: var(--text-primary) !important;
}
.text-\[\#c4c7c5\] {
  color: var(--text-secondary) !important;
}
.border-\[\#444746\] {
  border-color: var(--border-primary) !important;
}
.border-\[\#5f6368\] {
  border-color: var(--border-secondary) !important;
}
.text-\[\#a8c7fa\] {
  color: var(--primary) !important;
}
.bg-\[\#a8c7fa\] {
  background-color: var(--primary) !important;
}
.bg-\[\#3c4043\] {
  background-color: var(--bg-input) !important;
}
.text-\[\#5f6368\] {
  color: var(--text-tertiary) !important;
}
.text-\[\#81c995\] {
  color: var(--success) !important;
}
.text-\[\#f28b82\] {
  color: var(--error) !important;
}
.bg-\[\#28292a\] {
  background-color: var(--bg-secondary) !important;
}
.bg-\[\#1e1f20\] {
  background-color: var(--bg-primary) !important;
}
.bg-\[\#0f0f10\] {
  background-color: var(--bg-tertiary) !important;
}

/* 全屏模式样式 */
.fullscreen-mode .h-full {
  height: 100vh !important;
}

.fullscreen-mode .flex {
  min-height: 100vh;
}

.fullscreen-mode .flex-col {
  height: 100vh;
}

.fullscreen-mode .overflow-hidden {
  overflow: hidden;
}

.fullscreen-mode .overflow-y-auto {
  overflow-y: auto;
}

/* 对比分析全屏模式 */
.fullscreen-comparison {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background-color: var(--bg-primary);
  padding: 20px;
  box-sizing: border-box;
}

.fullscreen-comparison .flex-1 {
  flex: 1;
  overflow: auto;
}
</style>

