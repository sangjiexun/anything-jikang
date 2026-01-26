<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { useNotification } from '../../composables/useNotification'
import { useApi } from '../../composables/useApi'
import { useStorageConfig } from '../../composables/useStorageConfig'

interface Props {
  modelValue: string
  id?: string
  disabled?: boolean
  imageGenModel?: string
  klingSubmodel?: string
  markdownMode?: boolean
  height?: number | string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'generate-image', imageData: ImageGenerationData): void
}

interface ImageGenerationData {
  prompt: string
  model?: string
  images?: string[]
  size: string
  count: number
  seed: number
  negativePrompt: string
  promptExtend: boolean
  addWatermark: boolean
  onTaskIdGenerated?: (taskId: string) => void
  onProgress?: (progressPercent: number, currentImage: number, totalImages: number, imageUrl?: string) => void
}

const props = withDefaults(defineProps<Props>(), {
  id: 'tinymce-editor',
  disabled: false,
  imageGenModel: 'wan2.6-image',
  klingSubmodel: 'kling-v2-1',
  markdownMode: true,
  height: 420
})

const emit = defineEmits<Emits>()

const { add: notify } = useNotification()
const api = useApi()
const { uploadToStorageWithDetails, loadStorageConfig } = useStorageConfig()
const fileInput = ref<HTMLInputElement | null>(null)
const editorRef = ref<any>(null)
const selectedImageId = ref<string | null>(null)
const showImagePromptDialog = ref(false)
const imagePrompt = ref('')
const isGeneratingImage = ref(false)
const imageSize = ref('1280*1280')
const imageCount = ref(1)
const imageSeed = ref(Math.floor(Math.random() * 2147483647))
const negativePrompt = ref('')
const promptExtend = ref(true)
const addWatermark = ref(false)
const editorInitialized = ref(false)
const isMarkdownContent = ref(false)
const generatedImages = ref<string[]>([])

// 图像翻译相关
interface TranslatingImage {
  node: HTMLImageElement
  src: string
}

// 支持的翻译语言
const supportedLanguages = [
  { name: '英文', code: 'en', fullName: 'English' },
  { name: '韩语', code: 'ko', fullName: 'Korean' },
  { name: '日语', code: 'ja', fullName: 'Japanese' },
  { name: '俄语', code: 'ru', fullName: 'Russian' }
]

const showImageTranslateDialog = ref(false)
const currentTranslatingImage = ref<TranslatingImage | null>(null)
const targetLang = ref('en') // 默认翻译成英文
const isTranslating = ref(false)
const translateProgress = ref(0)
const translateTaskId = ref<string | null>(null)
const translatePollingInterval = ref<NodeJS.Timeout | null>(null)

// 系统图片选择功能
const showSystemImageDialog = ref(false)
const systemImages = ref<Array<{ id: string, url: string, name: string }>>([])
const selectedSystemImage = ref<string | null>(null)
const isUploadingSystemImage = ref(false)

// 素材选择相关
interface MaterialItem {
  id: string
  url: string
  name: string
}
const selectedMaterials = ref<MaterialItem[]>([])
const generationMode = ref('generate') // generate, edit, translate, extend, fusion
const activeModel = ref('wan2.6-image')

// 文件上传和转换相关
const documentFileInput = ref<HTMLInputElement | null>(null)
const showMarkdownPreviewDialog = ref(false)
const markdownPreviewContent = ref('')
const markdownPreviewTitle = ref('')
const uploadedFile = ref<File | null>(null)
const activeMarkdownTab = ref<'preview' | 'source'>('preview')

// 监听素材变化，自动切换模式和模型
watch(selectedMaterials, (newMaterials) => {
  if (newMaterials.length === 0) {
    generationMode.value = 'generate'
    activeModel.value = 'wan2.6-image'
    imageCount.value = 1
  } else if (newMaterials.length === 1) {
    // 默认为编辑模式
    if (generationMode.value === 'generate' || generationMode.value === 'fusion') {
      generationMode.value = 'edit'
    }
    updateModelByMode()
  } else if (newMaterials.length === 2) {
    generationMode.value = 'fusion'
    activeModel.value = 'qwen-image-edit' // 融合使用 qwen-image-edit
    imageCount.value = 1 // 融合通常生成一张
  } else {
    // 最多支持2张，多余的移除
    selectedMaterials.value = newMaterials.slice(0, 2)
  }
}, { deep: true })

// 监听模式变化，更新模型
watch(generationMode, () => {
  updateModelByMode()
})

const updateModelByMode = () => {
  if (selectedMaterials.value.length === 0) {
    activeModel.value = 'wan2.6-image'
    return
  }

  switch (generationMode.value) {
    case 'edit':
      activeModel.value = 'qwen-image-edit'
      break
    case 'translate':
      activeModel.value = 'qwen-mt-image'
      // 切换到翻译模式时清空提示词
      imagePrompt.value = ''
      break
    case 'extend':
      activeModel.value = 'image-out-painting'
      break
    case 'fusion':
      activeModel.value = 'qwen-image-edit'
      break
    default:
      activeModel.value = 'qwen-image-edit'
  }
}

// 图片压缩函数
const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<File> => {
  // 检查是否在浏览器环境中
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // SSR环境下，直接返回原始文件
    return Promise.resolve(file)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const img = new Image()
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result
      }

      img.onload = () => {
        // 计算缩放比例
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // 创建画布并绘制压缩后的图片
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为Blob
          canvas.toBlob((blob) => {
            if (blob) {
              // 创建压缩后的文件
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              reject(new Error('图片压缩失败'))
            }
          }, 'image/jpeg', quality)
        }
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }
    }

    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
  })
}

// 处理本地图片上传（压缩并上传到COS）
const handleLocalImageUpload = async (file: File, callback: (url: string) => void) => {
  try {
    useNotification().add({
      title: '正在处理图片',
      description: '正在压缩并上传图片...',
      type: 'info'
    })

    // 确保存储配置已加载
    await loadStorageConfig()

    // 压缩图片
    const compressedFile = await compressImage(file)

    // 使用COS上传
    const uploadResult = await uploadToStorageWithDetails(compressedFile, 'images')

    if (uploadResult && uploadResult.url) {
      const imageUrl = uploadResult.url

      useNotification().add({
        title: '图片上传成功',
        description: '图片已成功上传到服务器',
        type: 'success'
      })

      // 调用callback返回图片URL给TinyMCE
      callback(imageUrl)
    } else {
      throw new Error('图片上传失败：未能获取有效的上传结果')
    }
  } catch (error: any) {
    console.error('处理本地图片失败:', error)
    useNotification().add({
      title: '图片上传失败',
      description: error.message || error.toString() || '未知错误',
      type: 'error'
    })
  }
}

// 图片替换处理
const handleImageReplace = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]

    try {
      // 使用我们的handleLocalImageUpload函数处理图片压缩和上传
      await handleLocalImageUpload(file, (imageUrl) => {
        // 确保 URL 是完整的
        // 如果后端返回的是相对路径，并且 useApi 没有自动处理（通常 useApi 只处理请求 URL），我们需要拼接
        // 但这里为了安全起见，我们假设 imageUrl 是相对路径，需要拼接 apiBase
        // 注意：useRuntimeConfig 需要 import，或者直接假定它是全局可用的（在 Nuxt 中通常是）
        // 如果 imageUrl 已经是完整的，就不拼接
        let finalImageUrl = imageUrl
        if (finalImageUrl.startsWith('/')) {
          const config = useRuntimeConfig()
          // 简单的拼接逻辑，实际可能需要更严谨的处理
          finalImageUrl = `${config.public.apiBase.replace(/\/api\/?$/, '')}${finalImageUrl}`
        }

        if (editorRef.value) {
          let targetNode = null

          // 1. 尝试通过ID查找
          if (selectedImageId.value) {
            targetNode = editorRef.value.dom.select('#' + selectedImageId.value)[0]
          }

          // 2. 如果ID查找失败，尝试使用当前选区
          if (!targetNode || !editorRef.value.dom.is(targetNode, 'img')) {
            const selectedNode = editorRef.value.selection.getNode()
            if (selectedNode && selectedNode.nodeName === 'IMG') {
              targetNode = selectedNode
            }
          }

          if (targetNode && editorRef.value.dom.is(targetNode, 'img')) {
            // 添加时间戳强制刷新缓存
            const timestamp = Date.now()
            const noCacheUrl = finalImageUrl.includes('?') ? `${finalImageUrl}&t=${timestamp}` : `${finalImageUrl}?t=${timestamp}`

            // 1. 更新属性
            editorRef.value.dom.setAttribs(targetNode, {
              'src': noCacheUrl,
              'data-mce-src': noCacheUrl,
              'data-mce-placeholder': null // 移除占位符标记（如果有）
            })

            // 2. 强制重绘：通过选区操作触发更新
            editorRef.value.selection.select(targetNode)

            // 3. 终极手段：如果上述操作仍未刷新，尝试替换整个节点 HTML
            // 获取当前节点的所有属性
            const attrs = editorRef.value.dom.getAttribs(targetNode)
            // 更新 src
            attrs['src'] = noCacheUrl
            attrs['data-mce-src'] = noCacheUrl

            // 构建新的 img 标签字符串
            let imgHtml = '<img'
            for (const key in attrs) {
              if (attrs.hasOwnProperty(key)) {
                const val = attrs[key]
                if (val !== null && val !== undefined && val !== '') {
                  imgHtml += ` ${key}="${val}"`
                }
              }
            }
            imgHtml += ' />'

            // 使用 setContent 替换选中内容（即当前图片）
            editorRef.value.selection.setContent(imgHtml)

            editorRef.value.fire('change')

            useNotification().add({
              title: '替换成功',
              description: '图片已强制替换',
              type: 'success'
            })
          } else {
            useNotification().add({
              title: '替换失败',
              description: '未找到目标图片，请重新选中图片',
              type: 'warning'
            })
          }
        }
      })
    } finally {
      if (fileInput.value) {
        fileInput.value.value = ''
      }
      selectedImageId.value = null
    }
  }
}

// 系统图片选择功能
// 上传系统图片到 RustFS
const uploadSystemImage = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const file = input.files[0]
  try {
    isUploadingSystemImage.value = true
    notify('正在上传图片...', 'info')

    // 上传图片到 RustFS
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_type', 'image')

    const uploadResponse = await fetch(`${useRuntimeConfig().public.apiBase}/api/rustfs/upload`, {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error('图片上传失败')
    }

    const uploadResult = await uploadResponse.json()
    if (!uploadResult.success) {
      throw new Error(uploadResult.message || '图片上传失败')
    }

    // 将新上传的图片添加到系统图片列表
    const newImage = {
      id: `img_${Date.now()}`,
      url: uploadResult.data.url,
      name: file.name
    }
    systemImages.value.push(newImage)
    selectedSystemImage.value = newImage.id

    notify('图片上传成功', 'success')
  } catch (error) {
    console.error('Upload system image error:', error)
    notify('图片上传失败', 'error')
  } finally {
    isUploadingSystemImage.value = false
    // 重置文件输入，允许重新选择同一文件
    input.value = ''
  }
}

// 插入选中的系统图片到编辑器
const insertSelectedSystemImage = async () => {
  if (!selectedSystemImage.value) return

  const editor = editorRef.value
  if (!editor) return

  try {
    // 查找选中的图片
    const selectedImage = systemImages.value.find(img => img.id === selectedSystemImage.value)
    if (!selectedImage) return

    // 在当前光标位置插入图片
    editor.insertContent(`<img src="${selectedImage.url}" alt="${selectedImage.name}" class="max-w-full h-auto" />`)
    
    // 关闭对话框
    showSystemImageDialog.value = false
    notify('图片插入成功', 'success')
  } catch (error) {
    console.error('Insert system image error:', error)
    notify('图片插入失败', 'error')
  }
}

// 添加素材
const addMaterial = (item: any) => {
  // 确保URL是字符串
  const safeUrl = typeof item.url === 'string' ? item.url : 
                (typeof item.content === 'string' ? item.content : '')

  // 根据来源区分处理方式
  // 如果是拖拽来的，type是'image', 'video'等
  // 如果是点击插入来的，type是具体的MIME类型如'image/png'
  const isImageType = item.type === 'image' || (item.type && item.type.startsWith('image/'))
  const isVideoType = item.type === 'video' || (item.type && item.type.startsWith('video/'))
  const isAudioType = item.type === 'audio' || (item.type && item.type.startsWith('audio/'))

  if (isImageType && safeUrl) {
    // 直接插入图片到编辑器
    const imgHtml = `<img src="${safeUrl}" alt="${item.name}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0;" />`
    editorRef.value?.execCommand('mceInsertContent', false, imgHtml)
    
    notify({
      title: '图片已插入',
      description: `已成功插入图片: ${item.name}`,
      type: 'success',
      duration: 2000
    })
  } else if (isVideoType && safeUrl) {
    // 插入视频
    const videoHtml = `<video src="${safeUrl}" controls style="max-width: 100%; border-radius: 8px; margin: 16px 0;"></video>`
    editorRef.value?.execCommand('mceInsertContent', false, videoHtml)
    
    notify({
      title: '视频已插入',
      description: `已成功插入视频: ${item.name}`,
      type: 'success',
      duration: 2000
    })
  } else if (isAudioType && safeUrl) {
    // 插入音频
    const audioHtml = `<audio src="${safeUrl}" controls style="margin: 16px 0;"></audio>`
    editorRef.value?.execCommand('mceInsertContent', false, audioHtml)
    
    notify({
      title: '音频已插入',
      description: `已成功插入音频: ${item.name}`,
      type: 'success',
      duration: 2000
    })
  } else {
    // 对于非媒体文件，检查是否是文档类型
    const isFileType = item.type === 'file' || item.type === 'application/pdf' || (typeof item.type === 'string' && (
      item.type === 'application/pdf' || 
      item.type.includes('document') || 
      item.type.includes('word') || 
      item.type.includes('excel') || 
      item.type.includes('powerpoint') ||
      item.type.includes('text')
    ))
    
    if (isFileType) {
      // 如果是文档类型，可能需要特殊处理
      // 这里可以保留原有的逻辑用于图像生成功能
      if (selectedMaterials.value.some(m => m.id === item.id)) return

      if (selectedMaterials.value.length >= 2) {
        // 替换最后一张
        selectedMaterials.value.pop()
      }

      selectedMaterials.value.push({
        id: item.id,
        url: item.imageUrl || safeUrl,
        name: item.name
      })

      // 打开对话框
      showImagePromptDialog.value = true
    } else if (safeUrl) {
      // 对于其他类型的文件，插入链接
      const linkHtml = `<a href="${safeUrl}" target="_blank" style="color: #3b82f6;">${item.name}</a>`
      editorRef.value?.execCommand('mceInsertContent', false, linkHtml)
      
      notify({
        title: '链接已插入',
        description: `已成功插入链接: ${item.name}`,
        type: 'success',
        duration: 2000
      })
    } else {
      notify({
        title: '插入失败',
        description: `无法获取有效的文件URL: ${item.name}`,
        type: 'error',
        duration: 3000
      })
    }
  }
}

// 移除素材
const removeMaterial = (index: number) => {
  selectedMaterials.value.splice(index, 1)
}

// 图片生成轮询相关变量
const currentTaskId = ref<string | null>(null)
// const currentMaskId 已废弃
const pollingInterval = ref<NodeJS.Timeout | null>(null)
const isPolling = ref(false)

// 图像翻译核心函数
async function createImageTranslationTask(imageUrl: string, targetLanguage: string): Promise<string> {
  try {
    const response = await api.post('/writing-assistant/dashscope/image-translate', {
      image_url: imageUrl,
      source_lang: 'zh', // 源语言固定为中文
      target_lang: targetLanguage,
      model: 'qwen-mt-image' // 指定使用qwen-mt-image模型
    })

    if (response.success && response.data && response.data.task_id) {
      return response.data.task_id
    } else {
      throw new Error('创建翻译任务失败')
    }
  } catch (error) {
    console.error('创建翻译任务失败:', error)
    throw error
  }
}

async function checkTranslationTaskStatus(taskId: string): Promise<{ status: string, imageUrl?: string, message?: string }> {
  try {
    const response = await api.get(`/writing-assistant/dashscope/tasks/${taskId}`)

    if (response.success && response.data) {
      return {
        status: response.data.task_status,
        imageUrl: response.data.image_url,
        message: response.data.message
      }
    } else {
      throw new Error('查询翻译任务状态失败')
    }
  } catch (error) {
    console.error('查询翻译任务状态失败:', error)
    throw error
  }
}

async function startImageTranslation() {
  if (!currentTranslatingImage.value) return

  try {
    isTranslating.value = true
    translateProgress.value = 0

    // 创建翻译任务
    const taskId = await createImageTranslationTask(currentTranslatingImage.value.src, targetLang.value)
    translateTaskId.value = taskId

    // 开始轮询任务结果
    startTranslationPolling(taskId)

    notify({
      title: '翻译任务已创建',
      description: '正在翻译图像中的文字...',
      type: 'info'
    })
  } catch (error) {
    isTranslating.value = false
    notify({
      title: '翻译任务创建失败',
      description: '请稍后重试',
      type: 'error'
    })
  }
}

function startTranslationPolling(taskId: string) {
  // 清除可能存在的旧轮询
  if (translatePollingInterval.value) {
    clearInterval(translatePollingInterval.value)
  }

  // 开始新的轮询
  let elapsedTime = 0
  const maxTime = 300000 // 5分钟超时
  const pollInterval = 5000 // 5秒轮询一次

  translatePollingInterval.value = setInterval(async () => {
    try {
      const result = await checkTranslationTaskStatus(taskId)

      // 更新进度
      elapsedTime += pollInterval
      translateProgress.value = Math.min(90, Math.floor((elapsedTime / maxTime) * 100))

      if (result.status === 'SUCCEEDED') {
        // 翻译完成
        clearInterval(translatePollingInterval.value)
        translatePollingInterval.value = null
        isTranslating.value = false
        translateProgress.value = 100

        if (result.message === 'No text detected for translation') {
          // 没有可翻译的文本
          notify({
            title: '翻译提示',
            description: '图像中无可翻译文本',
            type: 'info'
          })
        } else if (result.imageUrl) {
          // 翻译成功，更新图片
          if (currentTranslatingImage.value) {
            currentTranslatingImage.value.node.src = result.imageUrl
            notify({
              title: '翻译成功',
              description: '图像文字已翻译完成',
              type: 'success'
            })
          }
        }

        // 关闭对话框
        showImageTranslateDialog.value = false
      } else if (result.status === 'FAILED') {
        // 翻译失败
        clearInterval(translatePollingInterval.value)
        translatePollingInterval.value = null
        isTranslating.value = false

        notify({
          title: '翻译失败',
          description: '图像翻译失败，请稍后重试',
          type: 'error'
        })

        // 关闭对话框
        showImageTranslateDialog.value = false
      } else if (result.status === 'CANCELED' || result.status === 'UNKNOWN') {
        // 任务被取消或未知状态
        clearInterval(translatePollingInterval.value)
        translatePollingInterval.value = null
        isTranslating.value = false

        notify({
          title: '翻译任务已取消',
          type: 'warning'
        })

        // 关闭对话框
        showImageTranslateDialog.value = false
      }

      // 超时处理
      if (elapsedTime > maxTime) {
        clearInterval(translatePollingInterval.value)
        translatePollingInterval.value = null
        isTranslating.value = false

        notify({
          title: '翻译超时',
          description: '翻译任务超时，请稍后重试',
          type: 'error'
        })

        // 关闭对话框
        showImageTranslateDialog.value = false
      }
    } catch (error) {
      console.error('轮询翻译任务状态失败:', error)
    }
  }, pollInterval)
}

function cancelImageTranslation() {
  if (translatePollingInterval.value) {
    clearInterval(translatePollingInterval.value)
    translatePollingInterval.value = null
  }

  isTranslating.value = false
  translateProgress.value = 0
  translateTaskId.value = null

  showImageTranslateDialog.value = false

  notify({
    title: '翻译已取消',
    type: 'info'
  })
}

// 检测是否为 Markdown 内容
const detectMarkdown = (content: string) => {
  return /(^#+\s|.+\*\*|^\*|.+\[.+\]\(.+\)|`[^`]+`)/m.test(content)
}

// 轮询任务状态
const pollTaskStatus = async (taskId: string) => {
  if (isPolling.value) return

  isPolling.value = true
  const maxPolls = 60 // 最多轮询60次（10分钟）
  let pollCount = 0

  const poll = async () => {
    try {
      pollCount++

      // 构建API请求 - 使用 useApi 处理认证
      const result = await api.get(`/writing-assistant/task-status/${taskId}`)

      const taskStatus = result.data?.status || 'UNKNOWN'

      // 更新进度和状态
      switch (taskStatus) {
        case 'PENDING':
        case 'RUNNING':
          // 显示通知
          if (pollCount === 1) {
            useNotification().add({
              title: '图片生成',
              description: '任务已提交，正在处理...',
              type: 'info',
              duration: 2000
            })
          }
          // 更新进度条通知
          const progress = Math.min(90, pollCount * 5)
          useNotification().add({
            title: '图片生成进度',
            description: `正在生成图片 (${progress}%)`,
            type: 'info',
            duration: 1000
          })
          break
        case 'SUCCEEDED':
          // 获取生成的图片URL（可能是一个或多个）
          const resultData = result.data
          
          // 清理URL的辅助函数
          const cleanUrl = (url: string): string => {
            if (typeof url === 'string') {
              // 移除首尾的引号、反引号和空格
              return url.replace(/^[`'\s]+|[`'\s]+$/g, '')
            }
            return ''
          }
          
          let images: string[] = []
          if (resultData?.imageUrls && Array.isArray(resultData.imageUrls) && resultData.imageUrls.length > 0) {
            images = resultData.imageUrls.map(cleanUrl)
          } else if (resultData?.imageUrl) {
            images = [cleanUrl(resultData.imageUrl)]
          } else {
            images = []
          }

          if (images && images.length > 0) {
            // 直接插入图片，不使用遮罩
            setTimeout(() => {
              generatedImages.value = images
              
              // 将左上角的原图替换为生成后的图片
              if (selectedMaterials.value.length > 0) {
                selectedMaterials.value[0] = {
                  ...selectedMaterials.value[0],
                  url: images[0] // 替换为生成的第一张图片
                }
              }
              
              isGeneratingImage.value = false // 标记生成完成，显示右下角完成按钮
              
              stopPolling()
              // 通知完成
              useNotification().add({
                title: '配图生成完成',
                description: `成功生成 ${images.length} 张图片，点击右下角按钮插入`,
                type: 'success',
                duration: 3000
              })
            }, 500)
            return
          }
          break
        case 'FAILED':
          useNotification().add({
            title: '图片生成失败',
            description: result.message || '未知错误',
            type: 'error'
          })
          stopPolling()
          return
        default:
          break
      }

      // 检查是否超过最大轮询次数或任务已完成
      if (pollCount >= maxPolls || taskStatus === 'SUCCEEDED' || taskStatus === 'FAILED') {
        if (taskStatus !== 'SUCCEEDED') {
          useNotification().add({
            title: '图片生成超时',
            description: '请稍后重试',
            type: 'error'
          })
        }
        stopPolling()
        return
      }

      // 继续轮询
      pollingInterval.value = setTimeout(poll, 10000) // 10秒间隔
    } catch (error: any) {
      console.error('轮询任务状态失败:', error)
      pollCount++

      if (pollCount >= maxPolls) {
        useNotification().add({
          title: '图片生成失败',
          description: error.message || '网络错误',
          type: 'error'
        })
        stopPolling()
        return
      }

      // 继续轮询
      pollingInterval.value = setTimeout(poll, 10000)
    }
  }

  // 开始第一次轮询
  poll()
}

// 停止轮询
const stopPolling = () => {
  if (pollingInterval.value) {
    clearTimeout(pollingInterval.value)
    pollingInterval.value = null
  }
  isPolling.value = false
  currentTaskId.value = null
  // currentMaskId 已废弃
}

// 移除遮罩功能已废弃

// Markdown 格式化函数
const formatMarkdown = (content: string) => {
  if (!content) return ''

  let formatted = content

  // 标题转换
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>')

  // 粗体转换
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 斜体转换
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // 代码块转换
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

  // 行内代码转换
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 链接转换
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // 列表转换
  formatted = formatted.replace(/^\* (.+)$/gm, '<li>$1</li>')
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

  // 段落转换
  formatted = formatted.replace(/\n\n/g, '</p><p>')
  formatted = '<p>' + formatted + '</p>'

  return formatted
}

// 防盗链图片处理函数
const processImageForAntiHotlink = (img: HTMLImageElement) => {
  if (!img.src) return

  // 如果是 base64 图片，不需要防盗链处理
  if (img.src.startsWith('data:')) {
    img.setAttribute('data-processed', 'true')
    return
  }

  // 检查是否是微信图片格式
  if (img.hasAttribute('data-src')) {
    const dataSrc = img.getAttribute('data-src')
    if (dataSrc && dataSrc.includes('mmbiz.qpic.cn')) {
      // 提取微信图片的真实URL
      const realUrl = extractWechatImageUrl(dataSrc)
      if (realUrl) {
        img.setAttribute('data-original-url', realUrl)
        img.setAttribute('data-wechat-image', 'true')

        // 通过后端代理处理微信图片防盗链
        processWechatImage(img, realUrl)
        return
      }
    }
  }

  // 对于外部图片，添加防盗链属性
  try {
    // 创建代理图片 URL（通过后端代理）
    const originalUrl = img.src
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`

    // 替换图片源
    img.src = proxyUrl
    img.setAttribute('data-original-url', originalUrl)
    img.setAttribute('data-proxy', 'true')
    img.setAttribute('data-processed', 'true')

    // 添加错误处理
    img.onerror = () => {
      // 如果代理失败，显示原始图片
      img.src = originalUrl
      img.setAttribute('data-proxy-failed', 'true')
    }
  } catch (error) {
    console.warn('图片防盗链处理失败:', error)
  }
}

// 提取微信图片真实URL
const extractWechatImageUrl = (dataSrc: string): string | null => {
  try {
    console.log('原始微信图片URL:', dataSrc)

    // 微信图片格式示例:
    // https://mmbiz.qpic.cn/mmbiz_png/micIkLqRFobBLIhHqPQlpKKPUmgP7TmGSLa1x3wcxMI4Z1Gk0RUYZUeoc8xrrSdCvMGChPaxE78lK2F4bRib9yTw/640?wx_fmt=png&from=appmsg&watermark=1#imgIndex=6

    // 首先检查是否包含微信图片域名
    if (!dataSrc.includes('mmbiz.qpic.cn')) {
      console.warn('不是微信图片URL:', dataSrc)
      return dataSrc
    }

    // 查找 wx_fmt 参数的位置
    const wxFmtIndex = dataSrc.indexOf('?wx_fmt=')
    if (wxFmtIndex === -1) {
      console.warn('未找到wx_fmt参数，返回完整URL')
      return dataSrc
    }

    // 提取基础URL（到 ?wx_fmt= 之前）
    const baseUrl = dataSrc.substring(0, wxFmtIndex)
    console.log('基础URL:', baseUrl)

    // 提取图片格式
    const formatMatch = dataSrc.match(/\?wx_fmt=(\w+)/)
    if (!formatMatch) {
      console.warn('无法提取图片格式')
      return dataSrc
    }

    const format = formatMatch[1]
    console.log('图片格式:', format)

    // 构建清理后的URL
    // 移除所有不必要的参数，只保留核心URL和格式
    const cleanUrl = `${baseUrl}?wx_fmt=${format}`
    console.log('清理后的URL:', cleanUrl)

    return cleanUrl
  } catch (error) {
    console.error('提取微信图片URL失败:', error)
    return dataSrc
  }
}

// 处理微信图片防盗链
const processWechatImage = (img: HTMLImageElement, realUrl: string) => {
  try {
    console.log('开始处理微信图片:', realUrl)

    // 微信图片需要特殊处理，使用专门的代理端点
    const proxyUrl = `/api/wechat-image-proxy?url=${encodeURIComponent(realUrl)}`
    console.log('微信图片代理URL:', proxyUrl)

    // 替换图片源
    img.src = proxyUrl
    img.setAttribute('data-wechat-proxy', 'true')
    img.setAttribute('data-processed', 'true')
    img.setAttribute('data-original-url', realUrl)

    // 添加加载状态指示
    img.style.opacity = '0.7'
    img.style.border = '2px dashed #007bff'

    // 添加错误处理
    img.onerror = () => {
      console.error('微信图片代理失败，尝试直接访问:', realUrl)
      img.src = realUrl
      img.setAttribute('data-wechat-proxy-failed', 'true')
      img.style.opacity = '1'
      img.style.border = '2px dashed #dc3545'

      // 显示错误提示
      const errorMsg = document.createElement('div')
      errorMsg.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: #dc3545;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
      `
      errorMsg.textContent = '加载失败'
      img.parentElement?.appendChild(errorMsg)

      // 3秒后移除错误提示
      setTimeout(() => {
        if (errorMsg.parentElement) {
          errorMsg.parentElement.removeChild(errorMsg)
        }
      }, 3000)
    }

    // 添加成功处理
    img.onload = () => {
      console.log('微信图片代理成功:', realUrl)
      img.setAttribute('data-wechat-proxy-success', 'true')
      img.style.opacity = '1'
      img.style.border = '2px solid #28a745'

      // 显示成功提示
      const successMsg = document.createElement('div')
      successMsg.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: #28a745;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        z-index: 1000;
      `
      successMsg.textContent = '已处理'
      img.parentElement?.appendChild(successMsg)

      // 2秒后移除成功提示
      setTimeout(() => {
        if (successMsg.parentElement) {
          successMsg.parentElement.removeChild(successMsg)
        }
      }, 2000)
    }

    // 设置超时处理
    setTimeout(() => {
      if (img.getAttribute('data-wechat-proxy-success') !== 'true'
        && img.getAttribute('data-wechat-proxy-failed') !== 'true') {
        console.warn('微信图片加载超时')
        img.style.opacity = '1'
        img.style.border = '2px dashed #ffc107'

        const timeoutMsg = document.createElement('div')
        timeoutMsg.style.cssText = `
          position: absolute;
          top: 5px;
          right: 5px;
          background: #ffc107;
          color: black;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          z-index: 1000;
        `
        timeoutMsg.textContent = '加载中...'
        img.parentElement?.appendChild(timeoutMsg)
      }
    }, 5000) // 5秒超时
  } catch (error) {
    console.error('微信图片处理失败:', error)
    // 回退到原始URL
    img.src = realUrl
    img.setAttribute('data-wechat-proxy-failed', 'true')
    img.style.border = '2px dashed #dc3545'
  }
}

// Markdown 转 HTML 函数（用于粘贴处理）
const convertMarkdownToHtml = (content: string): string => {
  if (!content || !content.includes('\n')) return content

  let formatted = content

  // 转换行内代码
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 转换代码块
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

  // 转换图片 (![alt](url))
  formatted = formatted.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 10px 0;" />')

  // 转换链接 ([text](url))
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // 转换无序列表
  formatted = formatted.replace(/^\* (.+)$/gm, '<li>$1</li>')
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

  // 转换有序列表
  formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

  // 转换引用
  formatted = formatted.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

  // 转换换行
  formatted = formatted.replace(/\n\n/g, '</p><p>')
  formatted = formatted.replace(/\n/g, '<br>')

  // 包装段落
  if (!formatted.startsWith('<')) {
    formatted = '<p>' + formatted + '</p>'
  }

  return formatted
}

const openImageDialogWithImage = async (imageUrl: string, mode: string) => {
  // 先设置模式，避免被 watcher 覆盖
  generationMode.value = mode

  // 检查是否为本地URL，如果是，则下载图片并转换为可访问的URL
  let processedUrl = imageUrl
  const isLocalUrl = imageUrl.startsWith('http://192.168') || imageUrl.startsWith('http://localhost') || imageUrl.startsWith('http://127.0.0.1')

  if (isLocalUrl) {
    try {
      // 下载图片
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error('下载图片失败')
      }

      // 转换为File对象
      const blob = await response.blob()

      // 从URL中提取文件名
      let fileName = 'local-image.png'

      try {
        // 解析URL
        const url = new URL(imageUrl)

        // 检查是否是RustFS预览URL格式
        if (url.pathname.includes('/api/rustfs/preview')) {
          // 从查询参数中提取key值
          const keyParam = url.searchParams.get('key')
          if (keyParam) {
            // 从key中提取文件名（key格式类似"8/face.png"）
            fileName = decodeURIComponent(keyParam.split('/').pop() || 'local-image.png')
          }
        } else {
          // 普通URL，从路径中提取文件名
          const urlPath = url.pathname
          fileName = decodeURIComponent(urlPath.split('/').pop() || 'local-image.png')
        }
      } catch (error) {
        console.error('解析URL失败:', error)
      }

      // 确保文件名格式正确，不包含特殊字符
      let safeFileName = fileName.replace(/[^a-zA-Z0-9_\-\.\u4e00-\u9fa5]/g, '_')

      // 确保文件名有扩展名
      const hasExt = safeFileName.match(/\.[^.]+$/)
      if (!hasExt) {
        // 根据blob类型添加适当的扩展名
        const extension = blob.type.split('/')[1] || 'png'
        safeFileName += `.${extension}`
      }

      // 添加调试信息
      console.log('文件名处理:', {
        originalUrl: imageUrl,
        extractedFileName: fileName,
        safeFileName: safeFileName,
        blobType: blob.type
      })

      // 强制确保文件名有扩展名（最终保障）
      if (!safeFileName.match(/\.[^.]+$/)) {
        safeFileName += '.png'
      }

      const file = new File([blob], safeFileName, { type: blob.type })

      // 使用现有的handleLocalImageUpload函数处理上传
      await new Promise((resolve, reject) => {
        handleLocalImageUpload(file, (url) => {
          processedUrl = url
          resolve(url)
        })
      })
    } catch (error) {
      console.error('处理本地图片失败:', error)
      notify({
        title: '图片处理失败',
        description: '无法处理本地图片，请尝试其他方式',
        type: 'error'
      })
    }
  }

  // 设置选中图片
  selectedMaterials.value = [{
    id: 'img-' + Date.now(),
    url: processedUrl,
    name: '选中的图片'
  }]

  // 确保模型更新
  updateModelByMode()

  // 打开对话框
  showImagePromptDialog.value = true
}

onMounted(async () => {
  // 加载存储配置
  await loadStorageConfig()
  
  // 等待 TinyMCE 加载完成
  if (typeof window !== 'undefined') {
    const checkTinyMCE = () => {
      // 检查 DOM 元素是否存在，如果组件已卸载或 DOM 尚未渲染，则停止
      if (!document.getElementById(props.id)) return

      if ((window as any).tinymce) {
        initTinyMCE()
      } else {
        setTimeout(checkTinyMCE, 100)
      }
    }
    // 确保在下一个 tick 且 DOM 更新后执行检查
    nextTick(() => {
      checkTinyMCE()
    })
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && (window as any).tinymce) {
    const editor = (window as any).tinymce.get(props.id)
    if (editor) {
      editor.remove()
    }
  }
  editorRef.value = null
})

const initTinyMCE = () => {
  if (typeof window !== 'undefined' && (window as any).tinymce) {
    // 移除已存在的同ID实例，防止ID冲突
    const existingEditor = (window as any).tinymce.get(props.id)
    if (existingEditor) {
      existingEditor.remove()
    }

    (window as any).tinymce.init({
      selector: `#${props.id}`,
      height: props.height,
      plugins: 'lists link table code',
      toolbar: 'paragraph-edit | upload-document',
      menubar: 'file edit view insert format tools custom',
      language: 'zh_CN',
      language_url: '/tinymce/langs/zh_CN.js',
      promotion: false,
      license_key: 'gpl',
      // 配置资源加载路径
      base_url: 'https://cdn.tiny.cloud/1/no-api-key/tinymce/7',
      suffix: '.min',
      // 使用内置默认图标
      icons: 'default',
      content_style: `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #e5e7eb; /* gray-200 */
          background: #111827; /* gray-900 */
          padding: 16px;
          margin: 0;
        }
        /* TinyMCE dropdown menus */
        .tox .tox-menu {
          background-color: #1f2937 !important; /* gray-800 */
          border-color: #374151 !important; /* gray-700 */
        }
        .tox .tox-menu .tox-menu__list-item {
          color: #e5e7eb !important; /* gray-200 */
        }
        .tox .tox-menu .tox-menu__list-item:hover {
          background-color: #374151 !important; /* gray-700 */
        }
        .tox .tox-menu .tox-menu__list-item--active {
          background-color: #3b82f6 !important; /* blue-500 */
          color: #ffffff !important;
        }
        /* 加载动画 */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        /* .loading-mask 样式已废弃 */
        
        /* Markdown 样式 */
        h1, h2, h3, h4, h5, h6 {
          color: #f9fafb; /* gray-50 */
          font-weight: 600;
          margin: 24px 0 16px 0;
          line-height: 1.3;
        }
        h1 { font-size: 2em; border-bottom: 2px solid #374151; padding-bottom: 8px; } /* gray-700 */
        h2 { font-size: 1.5em; border-bottom: 1px solid #374151; padding-bottom: 6px; } /* gray-700 */
        h3 { font-size: 1.25em; }
        h4 { font-size: 1.1em; }
        
        p {
          margin: 16px 0;
          color: #e5e7eb; /* gray-200 */
        }
        
        strong {
          color: #f9fafb; /* gray-50 */
          font-weight: 600;
        }
        
        em {
          color: #9ca3af; /* gray-400 */
          font-style: italic;
        }
        
        code {
          background: #1f2937; /* gray-800 */
          color: #fbbf24; /* amber-400 */
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Fira Code', 'Monaco', 'Menlo', monospace;
          font-size: 0.9em;
        }
        
        pre {
          background: #1f2937; /* gray-800 */
          border: 1px solid #374151; /* gray-700 */
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          overflow-x: auto;
        }
        
        pre code {
          background: none;
          padding: 0;
          color: #e5e7eb; /* gray-200 */
        }
        
        ul, ol {
          margin: 16px 0;
          padding-left: 24px;
          color: #e5e7eb; /* gray-200 */
        }
        
        li {
          margin: 8px 0;
          line-height: 1.6;
        }
        
        a {
          color: #3b82f6; /* blue-500 */
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }
        
        a:hover {
          border-bottom-color: #3b82f6;
        }
        
        blockquote {
          border-left: 4px solid #3b82f6;
          margin: 16px 0;
          padding: 8px 16px;
          background: #1f2937; /* gray-800 */
          color: #9ca3af; /* gray-400 */
          font-style: italic;
        }
        
        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 16px 0;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 16px 0;
          background: #1f2937; /* gray-800 */
        }
        
        th, td {
          border: 1px solid #374151; /* gray-700 */
          padding: 12px;
          text-align: left;
          color: #e5e7eb; /* gray-200 */
        }
        
        th {
          background: #374151; /* gray-700 */
          font-weight: 600;
        }
      `,
      skin: 'oxide-dark',
      content_css: 'dark',
      resize_img_proportional: false,

      // 启用图片上传
      images_upload_url: '/writing-assistant/upload-image',
      images_upload_base_path: '/uploads',
      images_upload_credentials: true,

      // 图片上传处理器
      images_upload_handler: (blobInfo: any, progress: any) => {
        return new Promise((resolve, reject) => {
          // 转换为File对象
          const file = new File([blobInfo.blob()], blobInfo.filename(), {
            type: blobInfo.blob().type
          })

          // 使用相同的处理逻辑
          handleLocalImageUpload(file, (url) => {
            resolve(url)
          }).catch((error) => {
            reject(error.message)
          })
        })
      },

      // 本地图片选择器配置
      file_picker_callback: (callback: any, value: any, meta: any) => {
        // 文件类型过滤
        if (meta.filetype === 'image') {
          // 创建隐藏的文件输入
          const input = document.createElement('input')
          input.setAttribute('type', 'file')
          input.setAttribute('accept', 'image/*')

          // 监听文件选择
          input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement
            if (target.files && target.files.length > 0) {
              const file = target.files[0]

              // 处理图片文件
              handleLocalImageUpload(file, callback)
            }
          }

          // 触发文件选择
          input.click()
        }
      },

      // 粘贴配置
      paste_data_images: true, // 允许粘贴图片
      paste_enable_default_filters: false, // 禁用默认过滤器，自定义处理
      paste_as_text: false, // 不强制转为纯文本
      paste_merge_formats: true, // 合并格式
      paste_auto_cleanup_on_paste: false, // 禁用自动清理

      // 自定义粘贴处理
      paste_preprocess: (editor: any, args: any) => {
        const content = args.content

        // 处理微信图片格式 - 检测 data-src 属性
        if (content.includes('data-src=') && content.includes('mmbiz.qpic.cn')) {
          console.log('检测到微信图片格式，开始处理...')

          const processedContent = content.replace(/<img[^>]*data-src="([^"]*mmbiz\.qpic\.cn[^"]*)"[^>]*>/g, (match: string, dataSrc: string) => {
            console.log('找到微信图片，原始data-src:', dataSrc)

            // 提取微信图片的真实URL
            const realUrl = extractWechatImageUrl(dataSrc)
            if (realUrl && realUrl !== dataSrc) {
              console.log('提取到真实URL:', realUrl)

              // 生成唯一ID
              const imgId = 'wechat-img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

              // 创建新的img标签，使用提取的URL
              const newImgTag = `<img src="${realUrl}" id="${imgId}" class="wechat-pasted-image" data-wechat-image="true" data-original-url="${realUrl}" data-data-src="${dataSrc}" style="max-width: 100%; height: auto;">`

              console.log('生成的新img标签:', newImgTag)
              return newImgTag
            }

            console.log('URL提取失败，返回原始标签')
            return match
          })

          if (processedContent !== content) {
            console.log('微信图片处理完成')
            args.content = processedContent
          }
        }

        // 处理剪贴板中的图片
        if (content.includes('<img src="data:image')) {
          // 处理 base64 图片
          const processedContent = content.replace(/<img src="data:image\/([^;]+);([^"]+)"([^>]*)>/g, (match: string, mimeType: string, base64Data: string, rest: string) => {
            // 生成唯一ID
            const imgId = 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

            // 创建包装器，支持后续操作
            return `<img src="data:image/${mimeType};${base64Data}" id="${imgId}" class="pasted-image" data-base64="true"${rest}>`
          })

          args.content = processedContent
        }

        // 检测并转换 Markdown 格式
        if (props.markdownMode && detectMarkdown(content)) {
          // 如果内容看起来像 Markdown，转换为 HTML
          const markdownContent = convertMarkdownToHtml(content)
          if (markdownContent !== content) {
            args.content = markdownContent
            isMarkdownContent.value = true
          }
        }
      },

      // 粘贴后处理
      paste_postprocess: (editor: any, args: any) => {
        // 处理粘贴的微信图片
        const wechatImages = editor.dom.select('img.wechat-pasted-image')
        wechatImages.forEach((img: HTMLImageElement) => {
          // 处理微信图片防盗链
          processImageForAntiHotlink(img)
        })

        // 处理粘贴的base64图片，自动上传到S3
        const pastedImages = editor.dom.select('img.pasted-image[data-base64="true"]')
        pastedImages.forEach(async (img: HTMLImageElement) => {
          try {
            // 显示处理中状态
            img.setAttribute('data-processing', 'true')
            img.style.opacity = '0.5'
            
            // 提取base64数据
            const src = img.getAttribute('src')
            const mimeType = src.match(/data:image\/([^;]+);/)?.[1] || 'jpeg'
            const base64Data = src.split(',')[1]
            
            // 转换为File对象
            const blob = atob(base64Data)
            const arrayBuffer = new ArrayBuffer(blob.length)
            const uint8Array = new Uint8Array(arrayBuffer)
            for (let i = 0; i < blob.length; i++) {
              uint8Array[i] = blob.charCodeAt(i)
            }
            
            const file = new File([arrayBuffer], `pasted-image-${Date.now()}.${mimeType}`, {
              type: `image/${mimeType}`
            })

            // 上传到S3
            await handleLocalImageUpload(file, (imageUrl) => {
              // 更新图片src为S3 URL
              img.setAttribute('src', imageUrl)
              img.removeAttribute('data-base64')
              img.classList.remove('pasted-image')
              img.classList.add('s3-uploaded-image')
              img.setAttribute('data-s3-url', imageUrl)
              img.style.opacity = '1'
              img.removeAttribute('data-processing')
              
              console.log('粘贴图片已上传到S3:', imageUrl)
            })
          } catch (error) {
            console.error('粘贴图片上传失败:', error)
            img.style.opacity = '1'
            img.removeAttribute('data-processing')
            // 保留base64图片作为备用
          }
        })

        // 处理其他粘贴图片（非base64，可能是网络图片）
        const otherImages = editor.dom.select('img:not(.pasted-image):not(.wechat-pasted-image):not(.s3-uploaded-image)')
        otherImages.forEach((img: HTMLImageElement) => {
          // 添加防盗链处理
          processImageForAntiHotlink(img)
        })
      },

      setup: (editor: any) => {
        editorRef.value = editor

        // 图片点击事件处理 - 只选中图片，不直接打开对话框
        editor.on('click', (e: any) => {
          const node = e.target
          if (node && node.nodeName === 'IMG') {
            // 记录当前选中的图片信息
            selectedImageId.value = node.id
            // 不直接打开对话框，让用户通过工具栏按钮或其他方式触发修改操作
            // 用户可以通过点击工具栏上的"图片修改"按钮来打开大模型修图界面
          }
        })

        // 图片变换辅助函数
        const updateImageTransform = (node: HTMLElement, changes: { rotate?: number, flipH?: boolean, flipV?: boolean }) => {
          // 获取当前状态
          let rotate = parseInt(node.getAttribute('data-rotate') || '0')
          let scaleX = parseInt(node.getAttribute('data-scale-x') || '1')
          let scaleY = parseInt(node.getAttribute('data-scale-y') || '1')

          // 更新状态
          if (changes.rotate !== undefined) {
            rotate = (rotate + changes.rotate) % 360
          }
          if (changes.flipH) {
            scaleX *= -1
          }
          if (changes.flipV) {
            scaleY *= -1
          }

          // 保存状态
          node.setAttribute('data-rotate', rotate.toString())
          node.setAttribute('data-scale-x', scaleX.toString())
          node.setAttribute('data-scale-y', scaleY.toString())

          // 应用样式
          node.style.transform = `rotate(${rotate}deg) scale(${scaleX}, ${scaleY})`
          // 确保图片有过渡效果，看起来更顺滑
          node.style.transition = 'transform 0.3s ease'
        }

        // 注册图片工具栏按钮

        // 1. 图片修改
        editor.ui.registry.addButton('image-edit', {
          text: '图片修改',
          icon: 'editimage',
          onAction: () => {
            const node = editor.selection.getNode()
            if (node && node.nodeName === 'IMG') {
              // 使用图生图模式
              openImageDialogWithImage(node.src, 'edit')
            }
          }
        })

        // 2. 删除图片
        editor.ui.registry.addButton('image-delete', {
          text: '删除',
          icon: 'delete',
          onAction: () => {
            const node = editor.selection.getNode()
            if (node && node.nodeName === 'IMG') {
              // 删除当前选中的图片
              editor.dom.remove(node)
              notify({
                title: '删除成功',
                description: '图片已成功删除',
                type: 'success'
              })
            }
          }
        })

        // 3. 图像翻译
        editor.ui.registry.addButton('image-translate', {
          text: '图像翻译',
          icon: 'language',
          onAction: () => {
            const node = editor.selection.getNode()
            if (node && node.nodeName === 'IMG') {
              // 保存当前选中的图片
              currentTranslatingImage.value = {
                node: node,
                src: node.src
              }
              // 打开翻译对话框
              showImageTranslateDialog.value = true
            } else {
              notify({
                title: '请先选择图片',
                description: '请先选择要翻译的图片',
                type: 'warning'
              })
            }
          }
        })

        // 段落编辑对话框
        function openParagraphEditDialog(editor) {
          editor.windowManager.open({
            title: '段落编辑',
            body: {
              type: 'panel',
              items: [
                {
                  type: 'selectbox',
                  name: 'template',
                  label: '排版模板',
                  items: [
                    { text: '自定义', value: 'custom' },
                    { text: '书信体', value: 'letter' },
                    { text: '小红书体', value: 'xiaohongshu' },
                    { text: '论文体', value: 'paper' }
                  ],
                  value: 'custom'
                },
                {
                  type: 'selectbox',
                  name: 'alignment',
                  label: '对齐方式',
                  items: [
                    { text: '左对齐', value: 'left' },
                    { text: '居中对齐', value: 'center' },
                    { text: '右对齐', value: 'right' },
                    { text: '两端对齐', value: 'justify' }
                  ],
                  value: 'left'
                },
                {
                  type: 'selectbox',
                  name: 'indent',
                  label: '缩进',
                  items: [
                    { text: '无缩进', value: '0' },
                    { text: '首行缩进', value: 'first' },
                    { text: '悬挂缩进', value: 'hanging' }
                  ],
                  value: '0'
                },
                {
                  type: 'input',
                  name: 'lineSpacing',
                  label: '行间距',
                  value: '1.5',
                  suffix: '倍'
                },
                {
                  type: 'input',
                  name: 'beforeSpacing',
                  label: '段前间距',
                  value: '0',
                  suffix: 'pt'
                },
                {
                  type: 'input',
                  name: 'afterSpacing',
                  label: '段后间距',
                  value: '0',
                  suffix: 'pt'
                }
              ]
            },
            buttons: [
              {
                type: 'cancel',
                text: '取消'
              },
              {
                type: 'button',
                text: '智能排版',
                onAction: () => {
                  // 调用智能排版功能
                  smartTypesetting(editor)
                }
              },
              {
                type: 'submit',
                text: '确定',
                primary: true
              }
            ],
            onSubmit: (api) => {
              const data = api.getData()
              
              // 检查是否选择了模板
              if (data.template !== 'custom') {
                // 使用智能排版处理模板
                applyTemplateTypesetting(editor, data.template)
                api.close()
                return
              }
              
              // 获取选中的纯文本内容（保留回车换行）
              const selectedText = editor.selection.getContent({ format: 'text' })
              
              // 处理文本：保留回车换行，只删除每行开头的缩进空格
              const processedText = selectedText.split('\n').map(line => {
                // 删除行开头的缩进空格
                return line.replace(/^\s+/, '')
              }).join('\n')
              
              // 构建新的段落格式
              let style = `text-align: ${data.alignment}; line-height: ${data.lineSpacing}; margin-top: ${data.beforeSpacing}pt; margin-bottom: ${data.afterSpacing}pt;`
              
              // 添加缩进样式
              if (data.indent === 'first') {
                style += 'text-indent: 2em;'
              } else if (data.indent === 'hanging') {
                style += 'text-indent: -2em; padding-left: 2em;'
              }
              
              // 创建新的带格式的内容
              const styledContent = `<p style="${style}">${processedText}</p>`
              
              // 替换选中内容
              editor.selection.setContent(styledContent)
              api.close()
              
              notify({
                title: '段落编辑',
                description: '段落格式已应用',
                type: 'success'
              })
            }
          })
        }

        // 智能排版函数
        function smartTypesetting(editor) {
          const selectedText = editor.selection.getContent({ format: 'text' })
          if (!selectedText) {
            notify({
              title: '请先选择文本',
              description: '请先选择要排版的文本',
              type: 'warning'
            })
            return
          }
          
          // 显示加载状态
          notify({
            title: '智能排版中',
            description: '正在使用 AI 进行智能排版，请稍候...',
            type: 'info'
          })
          
          // 调用后端 API 进行智能排版
          fetch('/api/ai/text-process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'qwen-plus',
              prompt: `请对以下文本进行智能排版，使其更加美观易读：\n\n${selectedText}`,
              max_tokens: 1000
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.success && data.result) {
              // 替换选中内容
              editor.selection.setContent(`<p>${data.result}</p>`)
              
              notify({
                title: '智能排版成功',
                description: '文本已成功进行智能排版',
                type: 'success'
              })
            } else {
              notify({
                title: '智能排版失败',
                description: data.message || '排版过程中出现错误',
                type: 'error'
              })
            }
          })
          .catch(error => {
            console.error('智能排版失败:', error)
            notify({
              title: '智能排版失败',
              description: '网络错误，请稍后重试',
              type: 'error'
            })
          })
        }

        // 应用模板排版函数
        function applyTemplateTypesetting(editor, template) {
          const selectedText = editor.selection.getContent({ format: 'text' })
          if (!selectedText) {
            notify({
              title: '请先选择文本',
              description: '请先选择要排版的文本',
              type: 'warning'
            })
            return
          }
          
          // 显示加载状态
          notify({
            title: '模板排版中',
            description: `正在应用${getTemplateName(template)}模板，请稍候...`,
            type: 'info'
          })
          
          // 调用后端 API 进行模板排版
          fetch('/api/ai/text-process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'qwen-plus',
              prompt: `请将以下文本按照${getTemplateName(template)}的格式进行排版：\n\n${selectedText}`,
              max_tokens: 1000
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.success && data.result) {
              // 替换选中内容
              editor.selection.setContent(`<p>${data.result}</p>`)
              
              notify({
                title: '模板排版成功',
                description: `文本已成功应用${getTemplateName(template)}模板`,
                type: 'success'
              })
            } else {
              notify({
                title: '模板排版失败',
                description: data.message || '排版过程中出现错误',
                type: 'error'
              })
            }
          })
          .catch(error => {
            console.error('模板排版失败:', error)
            notify({
              title: '模板排版失败',
              description: '网络错误，请稍后重试',
              type: 'error'
            })
          })
        }

        // 获取模板名称
        function getTemplateName(template) {
          const templateMap = {
            'letter': '书信体',
            'xiaohongshu': '小红书体',
            'paper': '论文体'
          }
          return templateMap[template] || template
        }

        // 4. 段落编辑功能
        editor.ui.registry.addButton('paragraph-edit', {
          text: '段落编辑',
          icon: 'paragraph',
          onAction: () => {
            const selectedText = editor.selection.getContent({ format: 'text' })
            if (selectedText) {
              // 打开段落编辑对话框
              openParagraphEditDialog(editor)
            } else {
              notify({
                title: '请先选择段落',
                description: '请先选择要编辑的段落文本',
                type: 'warning'
              })
            }
          }
        })

        // 6. 图像生成功能
        editor.ui.registry.addButton('generate-image', {
          text: '文生图',
          icon: 'image',
          onAction: () => {
            const selectedText = editor.selection.getContent({ format: 'text' })
            if (selectedText) {
              // 打开图像生成对话框
              showImagePromptDialog.value = true
            } else {
              notify({
                title: '请先选择文本',
                description: '请先选择要生成图像的描述文本',
                type: 'warning'
              })
            }
          }
        })

        // 7. 上传文档功能
        editor.ui.registry.addButton('upload-document', {
          text: '上传文档',
          icon: 'document',
          onAction: () => {
            // 触发文档上传
            if (documentFileInput.value) {
              documentFileInput.value.click()
            }
          }
        })

        // 监听内容变化
        editor.on('change', () => {
          const content = editor.getContent()
          emit('update:modelValue', content)
        })
      },
      init_instance_callback: (editor: any) => {
        editor.setContent(props.modelValue)
        editorInitialized.value = true
      }
    })
  }
}

const insertImage = (imageInput: string | string[]) => {
  // 确保编辑器实例存在
  let editor = editorRef.value
  if (!editor && typeof window !== 'undefined' && (window as any).tinymce) {
    editor = (window as any).tinymce.activeEditor
    if (editor) editorRef.value = editor
  }

  if (editor) {
    // 统一处理为数组
    const imageUrls = Array.isArray(imageInput) ? imageInput : [imageInput]
    if (imageUrls.length === 0) return

    // 构建 HTML 字符串
    let htmlContent = ''

    if (imageUrls.length === 1) {
      // 单图情况
      const url = imageUrls[0].trim() // 去除可能的空白字符
      const timestamp = Date.now()
      const noCacheUrl = url.includes('?') ? `${url}&t=${timestamp}` : `${url}?t=${timestamp}`

      // 直接插入图片URL
      htmlContent = `<img src="${noCacheUrl}" alt="" data-mce-src="${noCacheUrl}" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 10px 0;">`
    } else {
      // 多图情况，创建一个容器
      const containerId = `img-container-${Date.now()}`
      let imagesHtml = ''

      imageUrls.forEach((url) => {
        const cleanUrl = url.trim()
        const timestamp = Date.now()
        const noCacheUrl = cleanUrl.includes('?') ? `${cleanUrl}&t=${timestamp}` : `${cleanUrl}?t=${timestamp}`

        imagesHtml += `<img src="${noCacheUrl}" alt="生成的配图" style="max-width: 100%; height: auto; border-radius: 8px; display: block;" />`
      })

      htmlContent = `<div id="${containerId}" style="display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0;">${imagesHtml}</div>`
    }

    // 直接插入图片内容
    // 如果是新插入的图片，通常包裹在 p 标签中比较好，保持文档结构
    if (imageUrls.length === 1 && !htmlContent.startsWith('<p>') && !htmlContent.startsWith('<div')) {
      // 检查是否已经在块级元素中，如果不是，则包裹
      htmlContent = `<p>${htmlContent}</p>`
    }
    // 使用 insertContent 确保内容被插入
    editor.insertContent(htmlContent)

    // 强制触发 change 事件
    editor.fire('change')
  }
}

defineExpose({
  insertImage,
  addMaterial,
  insertContent: (content: string) => editorRef.value?.execCommand('mceInsertContent', false, content),
  getContent: () => editorRef.value?.getContent() || '',
  setContent: (content: string) => editorRef.value?.setContent(content)
})
</script>

<template>
  <div class="tinymce-editor-wrapper h-full">
    <!-- TinyMCE 编辑器 -->
    <div
      class="relative h-full"
      @dragover.prevent
      @drop="handleFileDrop"
    >
      <!-- Markdown 模式指示器 -->
      <div v-if="isMarkdownContent" class="absolute top-2 right-2 z-10 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
        <span class="material-symbols-outlined text-xs">auto_fix_high</span>
        Markdown 已启用
      </div>

      <textarea :id="id" :disabled="disabled" />
    </div>

    <!-- 图片替换文件输入框 -->
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept="image/*"
      style="display: none;"
      @change="handleImageReplace"
    >

    <!-- 文档上传文件输入框 -->
    <input
      ref="documentFileInput"
      type="file"
      class="hidden"
      accept=".md,.markdown,.txt,.doc,.docx,.pdf"
      style="display: none;"
      @change="handleDocumentFileUpload"
    >

    <!-- 图像翻译对话框 -->
    <div v-if="showImageTranslateDialog" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-lg w-full p-6 space-y-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span class="material-symbols-outlined text-blue-500">language</span>
            图像翻译
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            @click="cancelImageTranslation"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- 图片预览 -->
        <div v-if="currentTranslatingImage" class="flex justify-center">
          <img
            :src="currentTranslatingImage.src"
            class="max-w-full max-h-60 object-contain rounded-md border border-gray-200 dark:border-gray-700"
          >
        </div>

        <!-- 目标语言选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            目标语言
          </label>
          <select
            v-model="targetLang"
            class="w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            :disabled="isTranslating"
          >
            <option v-for="lang in supportedLanguages" :key="lang.code" :value="lang.code">
              {{ lang.name }} ({{ lang.fullName }})
            </option>
          </select>
        </div>

        <!-- 翻译进度 -->
        <div v-if="isTranslating" class="space-y-2">
          <div class="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>正在翻译...</span>
            <span>{{ translateProgress }}%</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${translateProgress}%` }"
            />
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 text-center">
            图像翻译可能需要15-30秒，请耐心等待
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="cancelImageTranslation"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            :disabled="isTranslating"
            @click="startImageTranslation"
          >
            开始翻译
          </button>
        </div>
      </div>
    </div>

    <!-- 系统图片选择对话框 -->
    <div v-if="showSystemImageDialog" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6 space-y-6 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span class="material-symbols-outlined text-green-500">gallery</span>
            插入系统图片
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            @click="showSystemImageDialog = false"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- 系统图片列表 -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto">
          <div
            v-for="image in systemImages"
            :key="image.id"
            class="relative cursor-pointer border-2 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            :class="selectedSystemImage === image.id ? 'border-green-500' : 'border-gray-200 dark:border-gray-700'"
            @click="selectedSystemImage = image.id"
          >
            <img
              :src="image.url"
              :alt="image.name"
              class="w-full h-24 object-cover"
            />
            <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span class="material-symbols-outlined text-white">check_circle</span>
            </div>
          </div>
        </div>

        <!-- 上传图片按钮 -->
        <div class="flex justify-center">
          <label class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
            <span class="material-symbols-outlined">upload</span>
            上传本地图片
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="uploadSystemImage"
            />
          </label>
        </div>

        <!-- 确认按钮 -->
        <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="showSystemImageDialog = false"
          >
            取消
          </button>
          <button
            :disabled="!selectedSystemImage || isUploadingSystemImage"
            class="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            @click="insertSelectedSystemImage"
          >
            <span v-if="isUploadingSystemImage" class="animate-spin material-symbols-outlined text-sm">sync</span>
            <span>{{ isUploadingSystemImage ? '上传中...' : '插入图片' }}</span>
          </button>
        </div>
      </div>
    </div>



    <!-- 配图生成对话框 -->
    <div v-if="showImagePromptDialog" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full p-6 space-y-6 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span class="material-symbols-outlined text-blue-500">brush</span>
            生成配图 - {{ activeModel }}
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            @click="showImagePromptDialog = false"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- 素材选择与模式切换 -->
        <div v-if="selectedMaterials.length > 0" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-blue-800 dark:text-blue-300">已选参考图 ({{ selectedMaterials.length }}/2)</label>

            <!-- 单图模式选择 -->
            <div v-if="selectedMaterials.length === 1" class="flex items-center gap-2">
              <select v-model="generationMode" class="text-xs border-blue-200 rounded py-1 px-2 dark:bg-gray-800 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                <option value="edit">
                  图片编辑 (qwen-image-edit)
                </option>
                <option value="translate">
                  翻译修改 (qwen-mt-image)
                </option>
                <option value="extend">
                  图像扩展 (image-out-painting)
                </option>
              </select>
            </div>
            <div v-else-if="selectedMaterials.length === 2" class="text-xs text-blue-600 dark:text-blue-400 font-medium">
              多图融合模式 (qwen-image-edit)
            </div>
          </div>

          <div class="flex gap-3 overflow-x-auto pb-1">
            <div v-for="(item, index) in selectedMaterials" :key="item.id" class="relative group flex-none">
              <img :src="item.url" class="w-20 h-20 object-cover rounded-md border border-gray-200 dark:border-gray-700">
              <button
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                @click="removeMaterial(index)"
              >
                <span class="material-symbols-outlined text-[14px]">close</span>
              </button>
              <div class="text-[10px] text-gray-500 truncate w-20 mt-1">
                {{ item.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- 配图描述 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            配图描述 <span class="text-red-500">*</span>
          </label>
          <textarea
            v-model="imagePrompt"
            :placeholder="generationMode === 'translate' ? '选择目标语言即可进行图像翻译，无需额外描述' : (selectedMaterials.length > 0 ? '描述您想如何修改或融合这些图片...' : '描述您想要的配图内容，例如：一个现代化的办公室场景，温暖的灯光，干净整洁')"
            rows="4"
            class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        
        <!-- 目标语言选择 (仅在翻译模式显示) -->
        <div v-if="generationMode === 'translate'">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            目标语言
          </label>
          <select
            v-model="targetLang"
            class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="ko">韩语</option>
            <option value="ja">日语</option>
            <option value="ru">俄语</option>
          </select>
        </div>

        <!-- 尺寸和数量设置 -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">图片尺寸</label>
            <select
              v-model="imageSize"
              class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
            >
              <option value="1280*1280">
                1:1 方形 (1280×1280)
              </option>
              <option value="1472*1104">
                4:3 横向 (1472×1104)
              </option>
              <option value="1104*1472">
                3:4 竖向 (1104×1472)
              </option>
              <option value="1696*960">
                16:9 超宽屏 (1696×960)
              </option>
              <option value="960*1696">
                9:16 竖屏 (960×1696)
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">图片数量</label>
            <select
              v-model="imageCount"
              :disabled="selectedMaterials.length > 0 && generationMode !== 'generate'"
              class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 disabled:opacity-50"
            >
              <option value="1">
                1 张图片
              </option>
              <option value="2">
                2 张图片
              </option>
              <option value="3">
                3 张图片
              </option>
              <option value="4">
                4 张图片
              </option>
            </select>
          </div>
        </div>

        <!-- Seed 和高级设置 -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              随机种子 (Seed)
            </label>
            <div class="flex gap-2">
              <input
                v-model="imageSeed"
                type="number"
                min="0"
                max="2147483647"
                class="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              >
              <button
                class="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="随机生成种子"
                @click="imageSeed = Math.floor(Math.random() * 2147483647)"
              >
                <span class="material-symbols-outlined text-sm">shuffle</span>
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              相同种子可生成相似图片
            </p>
          </div>
        </div>

        <!-- 负面提示词 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            负面提示词 <span class="text-gray-400">(可选)</span>
          </label>
          <textarea
            v-model="negativePrompt"
            placeholder="描述不希望出现在图片中的内容，例如：低分辨率、错误、最差质量、低质量"
            rows="2"
            class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <!-- 高级选项 -->
        <div class="space-y-3">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">高级选项</label>
          <div class="space-y-2">
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="promptExtend"
                type="checkbox"
                class="w-4 h-4 text-blue-600 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              >
              <span class="text-sm text-gray-700 dark:text-gray-300">启用提示词智能改写</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer">
              <input
                v-model="addWatermark"
                type="checkbox"
                class="w-4 h-4 text-blue-600 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              >
              <span class="text-sm text-gray-700 dark:text-gray-300">添加水印标识</span>
            </label>
          </div>
        </div>

        <!-- 生成结果展示 -->
        <div v-if="generatedImages.length > 0" class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">生成结果</label>
          <div class="grid grid-cols-2 gap-4">
            <div v-for="(url, index) in generatedImages" :key="index" class="relative group bg-gray-50 dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
              <img :src="url" class="w-full h-32 object-contain rounded mb-2 bg-checkerboard">
              <div class="flex gap-2">
                <button
                  class="flex-1 px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                  @click="insertImage([url])"
                >
                  <span class="material-symbols-outlined text-xs">add_photo_alternate</span>
                  插入
                </button>
                <button
                  class="flex-1 px-2 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-1"
                  @click="replaceSelectedImage(url)"
                >
                  <span class="material-symbols-outlined text-xs">image_update</span>
                  替换
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 按钮 -->
        <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="showImagePromptDialog = false"
          >
            取消
          </button>
          <button
            :disabled="isGeneratingImage && !generatedImages.length"
            class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            @click="generatedImages.length > 0 ? insertImage(generatedImages) : handleGenerateImage"
          >
            <span v-if="isGeneratingImage" class="animate-spin material-symbols-outlined text-sm">sync</span>
            <span v-else-if="generatedImages.length > 0" class="material-symbols-outlined text-sm">done</span>
            <span v-else class="material-symbols-outlined text-sm">brush</span>
            {{ isGeneratingImage ? '生成中...' : (generatedImages.length > 0 ? '完成可插入' : '开始生成') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Markdown 预览对话框 -->
    <div v-if="showMarkdownPreviewDialog" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
              <span class="material-symbols-outlined text-[20px]">description</span>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Markdown 预览
              </h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ markdownPreviewTitle }}
              </p>
            </div>
          </div>
          <button
            class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
            @click="cancelMarkdownPreview"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="flex-1 overflow-hidden flex flex-col">
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            <button
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
              :class="activeMarkdownTab === 'preview' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
              @click="activeMarkdownTab = 'preview'"
            >
              <span class="material-symbols-outlined text-[18px] align-middle mr-1">visibility</span>
              预览
            </button>
            <button
              class="flex-1 px-4 py-3 text-sm font-medium transition-colors"
              :class="activeMarkdownTab === 'source' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
              @click="activeMarkdownTab = 'source'"
            >
              <span class="material-symbols-outlined text-[18px] align-middle mr-1">code</span>
              源码
            </button>
          </div>

          <div class="flex-1 overflow-auto p-4">
            <div v-if="activeMarkdownTab === 'preview'" class="prose prose-sm dark:prose-invert max-w-none">
              <div v-html="convertMarkdownToHtml(markdownPreviewContent)" />
            </div>
            <pre v-else class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto">{{ markdownPreviewContent }}</pre>
          </div>
        </div>

        <div class="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            @click="cancelMarkdownPreview"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-2"
            @click="confirmInsertMarkdown"
          >
            <span class="material-symbols-outlined text-[18px]">add_circle</span>
            插入编辑器
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tinymce-editor-wrapper {
  width: 100%;
  height: 100%;
}

/* 图片上传状态样式 */
:deep(.img[data-processing="true"]) {
  opacity: 0.5;
  filter: blur(1px);
  transition: all 0.3s ease;
}

:deep(.img.s3-uploaded-image) {
  border: 2px solid #10b981;
  border-radius: 4px;
  transition: all 0.3s ease;
}

:deep(.img.s3-uploaded-image:hover) {
  border-color: #059669;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

/* 图片上传提示 */
:deep(.img[data-processing="true"]):after {
  content: "上传中...";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
}

/* TinyMCE Base Styles (Light Mode Default) */
:deep(.tox-tinymce) {
  border: 1px solid #e5e7eb; /* gray-200 */
  border-radius: 0.5rem;
  background: #ffffff;
}

/* Dark Mode Overrides */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-tinymce) {
  border-color: #374151; /* gray-700 */
  background: #111827; /* gray-900 */
}

/* Toolbar */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-toolbar),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-toolbar__primary),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-toolbar__overflow),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-toolbar-overlord) {
  background: #1f2937; /* gray-800 */
  border-bottom-color: #374151; /* gray-700 */
}

/* Menubar */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-menubar) {
  background: #1f2937; /* gray-800 */
  border-bottom-color: #374151; /* gray-700 */
}

/* Menu Items */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-menu) {
  background: #1f2937; /* gray-800 */
  border-color: #374151; /* gray-700 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-menu__item) {
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-menu__item:hover),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-menu__item.tox-selected-menu-item) {
  background: #374151; /* gray-700 */
}

/* Buttons */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-button) {
  background: #374151; /* gray-700 */
  border-color: #4b5563; /* gray-600 */
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-button:hover) {
  background: #4b5563; /* gray-600 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-button--enabled) {
  background: #3b82f6; /* blue-500 */
  border-color: #3b82f6;
  color: white;
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-tbtn) {
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-tbtn:hover) {
  background: #374151; /* gray-700 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-tbtn--enabled) {
  background: #3b82f6; /* blue-500 */
  color: white;
}

/* Statusbar */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-statusbar) {
  background: #1f2937; /* gray-800 */
  border-top-color: #374151; /* gray-700 */
  color: #9ca3af; /* gray-400 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-statusbar__text-container),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-statusbar__path),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-statusbar__wordcount) {
  color: #9ca3af; /* gray-400 */
}

/* Edit Area */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-edit-area) {
  background: #111827; /* gray-900 */
}

/* Dialogs */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-dialog) {
  background: #1f2937; /* gray-800 */
  border-color: #374151; /* gray-700 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-dialog__header) {
  background: #111827; /* gray-900 */
  border-bottom-color: #374151; /* gray-700 */
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-dialog__title) {
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-dialog__body) {
  background: #1f2937; /* gray-800 */
  color: #e5e7eb; /* gray-200 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-dialog__footer) {
  background: #111827; /* gray-900 */
  border-top-color: #374151; /* gray-700 */
}

/* Inputs in Dialogs */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-textfield),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-textarea),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-listbox),
:global(.dark) .tinymce-editor-wrapper :deep(.tox-selectbox) {
  background: #111827; /* gray-900 */
  color: #e5e7eb; /* gray-200 */
  border-color: #374151; /* gray-700 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-label) {
  color: #e5e7eb; /* gray-200 */
}

/* Sidebar */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-sidebar-wrap) {
  background: #111827; /* gray-900 */
}

:global(.dark) .tinymce-editor-wrapper :deep(.tox-sidebar) {
  background: #1f2937; /* gray-800 */
  border-right-color: #374151; /* gray-700 */
}

/* Toolbar Groups */
:global(.dark) .tinymce-editor-wrapper :deep(.tox-toolbar__group) {
  border-right-color: #374151; /* gray-700 */
}

/* Context Menu */
.bg-checkerboard {
  background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
                    linear-gradient(-45deg, #ccc 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #ccc 75%),
                    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #fff;
}
:global(.dark) .bg-checkerboard {
  background-image: linear-gradient(45deg, #444 25%, transparent 25%),
                    linear-gradient(-45deg, #444 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #444 75%),
                    linear-gradient(-45deg, transparent 75%, #444 75%);
  background-color: #222;
}
</style>
