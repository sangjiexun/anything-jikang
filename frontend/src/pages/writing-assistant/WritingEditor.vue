<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { getChatModelConfig } from '~/config/model.config'

interface Props {
  llmConfig?: any
}

interface Emits {
  (e: 'close'): void
  (e: 'article-generated', content: string): void
}

const props = withDefaults(defineProps<Props>(), {
  llmConfig: () => ({})
})

const emit = defineEmits<Emits>()

const { token } = useAuth()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

// 编辑器相关状态
const editorRef = ref<any>(null)
const editorId = 'writing-editor-nested'
const editorContent = ref('')
const editorInitialized = ref(false)

// 自动写文相关
const isAutoWriting = ref(false)
const autoWritePrompt = ref('')
const isGenerating = ref(false)

// 自动采集文章相关
const isCollecting = ref(false)
const collectUrl = ref('')

// 右键菜单
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

// 本地缓存键名
const CACHE_KEY = 'writing-editor-content'

// SVG 图标定义
const svgIcons = {
  autoWrite: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  collect: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  format: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  paste: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`
}

// 加载本地缓存
const loadFromCache = () => {
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        // 确保是字符串，不是对象
        const content = typeof cached === 'string' ? cached : JSON.stringify(cached)
        editorContent.value = content
        // 注意：这里不直接设置内容，让 init_instance_callback 处理
        return content
      }
    } catch (error) {
      console.error('加载缓存失败:', error)
    }
  }
  return null
}

// 保存到本地缓存
const saveToCache = (content: string) => {
  if (typeof window !== 'undefined') {
    try {
      // 确保保存的是字符串
      const contentStr = typeof content === 'string' ? content : JSON.stringify(content)
      localStorage.setItem(CACHE_KEY, contentStr)
    } catch (error) {
      console.error('保存缓存失败:', error)
    }
  }
}

// 自动保存（防抖）
let saveTimer: any = null
const autoSave = (content: string) => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveToCache(content)
  }, 1000) // 1秒后保存
}

// 初始化 TinyMCE
const initTinyMCE = () => {
  if (typeof window !== 'undefined' && (window as any).tinymce) {
    const existingEditor = (window as any).tinymce.get(editorId)
    if (existingEditor) {
      existingEditor.remove()
    }

    (window as any).tinymce.init({
      selector: `#${editorId}`,
      height: '100%',
      plugins: [
        'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
        'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
        'insertdatetime', 'media', 'table', 'help', 'wordcount', 'autoresize'
      ],
      toolbar: 'undo redo | formatselect | bold italic underline strikethrough | forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image | code fullscreen | autoWrite collect format',
      language: 'zh_CN',
      language_url: '/tinymce/langs/zh_CN.js',
      promotion: false,
      license_key: 'gpl',
      paste_as_text: false,
      paste_data_images: true,
      automatic_uploads: true,
      convert_urls: true,
      link_default_target: '_blank',
      link_title: false,
      content_style: `
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.8;
          color: var(--text-primary);
          padding: 20px;
          max-width: 100%;
          margin: 0 auto;
          background-color: var(--bg-primary);
        }
        body.mce-content-body {
          max-width: 100% !important;
        }
        img {
          max-width: 100%;
          height: auto;
          margin: 10px 0;
        }
        a {
          color: var(--accent-primary);
          text-decoration: underline;
        }
        a:hover {
          color: var(--accent-hover);
        }
        p {
          margin: 10px 0;
        }
      `,
      setup: (editor: any) => {
        editorRef.value = editor

        // 监听内容变化
        editor.on('input change', () => {
          const content = editor.getContent()
          // 确保是字符串
          const contentStr = typeof content === 'string' ? content : ''
          editorContent.value = contentStr
          autoSave(contentStr)
        })

        // 处理粘贴事件
        editor.on('paste', (e: any) => {
          const clipboardData = e.clipboardData || (window as any).clipboardData
          if (clipboardData) {
            const items = clipboardData.items
            for (let i = 0; i < items.length; i++) {
              const item = items[i]
              if (item.type.indexOf('image') !== -1) {
                e.preventDefault()
                const file = item.getAsFile()
                const reader = new FileReader()
                reader.onload = (e: any) => {
                  const base64 = e.target.result
                  if (typeof base64 === 'string') {
                    editor.insertContent(`<img src="${base64}" alt="粘贴的图片" style="max-width: 100%; height: auto; margin: 10px 0;" />`)
                  }
                }
                reader.readAsDataURL(file)
              }
            }
          }
        })

        // 右键菜单
        editor.on('contextmenu', (e: any) => {
          e.preventDefault()
          contextMenuX.value = e.clientX
          contextMenuY.value = e.clientY
          contextMenuVisible.value = true
        })

        // 添加自定义工具栏按钮
        editor.ui.registry.addButton('autoWrite', {
          tooltip: '自动写文',
          icon: 'auto-write',
          onAction: () => {
            showAutoWriteDialog()
          }
        })

        editor.ui.registry.addButton('collect', {
          tooltip: '自动采集文章',
          icon: 'collect',
          onAction: () => {
            showCollectDialog()
          }
        })

        editor.ui.registry.addButton('format', {
          tooltip: '一键排版',
          icon: 'format',
          onAction: () => {
            formatContent()
          }
        })

        // 注册 SVG 图标
        editor.ui.registry.addIcon('auto-write', svgIcons.autoWrite)
        editor.ui.registry.addIcon('collect', svgIcons.collect)
        editor.ui.registry.addIcon('format', svgIcons.format)
      },
      init_instance_callback: (editor: any) => {
        editorInitialized.value = true

        // 加载缓存内容
        const cachedContent = loadFromCache()
        if (cachedContent) {
          editor.setContent(cachedContent)
        } else {
          // 如果没有缓存，设置空内容
          editor.setContent('<p><br></p>')
        }

        // 设置光标到第一行开始位置
        setTimeout(() => {
          try {
            const body = editor.getBody()
            if (body) {
              // 强制将光标移动到第一行开始位置
              const firstP = body.querySelector('p:first-of-type')
              if (firstP) {
                // 创建范围并设置到第一个段落的开始
                const range = editor.dom.createRng()

                // 尝试找到第一个文本节点
                const targetNode = firstP.firstChild
                const offset = 0

                // 如果第一个子节点是文本节点，使用它
                if (targetNode && targetNode.nodeType === 3) {
                  range.setStart(targetNode, 0)
                  range.setEnd(targetNode, 0)
                } else {
                  // 否则直接设置到段落开始
                  range.setStart(firstP, 0)
                  range.setEnd(firstP, 0)
                }

                editor.selection.setRng(range)
                editor.selection.collapse(true) // 折叠到开始位置
              } else {
                // 如果没有段落，设置到body开始
                editor.selection.setCursorLocation(body, 0)
              }

              // 滚动到顶部并聚焦编辑器
              const win = editor.getWin()
              if (win) {
                win.scrollTo(0, 0)
              }
              editor.focus()
            }
          } catch (error) {
            console.error('设置光标位置失败:', error)
            // 如果出错，至少确保编辑器获得焦点
            try {
              editor.focus()
            } catch (e) {
              // 忽略焦点错误
            }
          }
        }, 200)
      }
    })
  }
}

// 等待 TinyMCE 加载
onMounted(() => {
  if (typeof window !== 'undefined') {
    const checkTinyMCE = () => {
      if (!document.getElementById(editorId)) return

      if ((window as any).tinymce) {
        initTinyMCE()
      } else {
        setTimeout(checkTinyMCE, 100)
      }
    }
    nextTick(() => {
      checkTinyMCE()
    })
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && (window as any).tinymce) {
    const editor = (window as any).tinymce.get(editorId)
    if (editor) {
      editor.remove()
    }
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
})

// 显示自动写文对话框
const showAutoWriteDialog = () => {
  autoWritePrompt.value = ''
  isAutoWriting.value = true
}

// 执行自动写文（使用与 workstation 相同的 API 调用方式）
const handleAutoWrite = async () => {
  if (!autoWritePrompt.value.trim()) {
    toast.add({
      title: '请输入写作主题',
      color: 'warning'
    })
    return
  }

  isGenerating.value = true
  isAutoWriting.value = false // 关闭对话框，回到编辑器

  try {
    // 使用与 workstation 相同的模型配置
    const chatModelConfig = getChatModelConfig(false)
    const llmConfigToSend: any = {
      ...props.llmConfig,
      model: chatModelConfig.model,
      baseUrl: chatModelConfig.baseUrl,
      provider: chatModelConfig.provider || 'google',
      stream: true
    }

    const apiEndpoint = `${runtimeConfig.public.apiBase}/chat/send`

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: `请帮我写一篇文章，主题是：${autoWritePrompt.value}。要求文章结构清晰，内容丰富，语言流畅，使用HTML格式输出。`,
        stream: true,
        llmConfig: llmConfigToSend,
        enableDeepThinking: false,
        enableInternetAccess: false,
        kbMode: false
      })
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let generatedText = ''

    if (editorRef.value) {
      const currentContent = editorRef.value.getContent()
      if (currentContent && typeof currentContent === 'string') {
        generatedText = currentContent + '<br/><br/>'
      }
    }

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const message = JSON.parse(data)
              if (message.type === 'content' && message.data) {
                // 确保是字符串
                const content = typeof message.data === 'string' ? message.data : String(message.data)
                generatedText += content
                if (editorRef.value) {
                  // 实时更新编辑器内容
                  editorRef.value.setContent(generatedText)
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    // 确保最终内容是字符串
    const finalContent = typeof generatedText === 'string' ? generatedText : String(generatedText)
    editorContent.value = finalContent
    saveToCache(finalContent)

    // 发送事件通知父组件
    emit('article-generated', finalContent)

    // 发送通知（通过父组件）
    // 这里通过事件通知，由父组件处理通知
  } catch (error: any) {
    toast.add({
      title: '生成文章失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}

// 显示采集文章对话框
const showCollectDialog = () => {
  collectUrl.value = ''
  isCollecting.value = true
}

// 执行自动采集文章
const handleCollectArticle = async () => {
  if (!collectUrl.value.trim()) {
    toast.add({
      title: '请输入文章链接',
      color: 'warning'
    })
    return
  }

  try {
    toast.add({
      title: '正在采集文章...',
      color: 'info'
    })

    // 使用与 workstation 相同的模型配置
    const chatModelConfig = getChatModelConfig(true) // 启用联网
    const llmConfigToSend: any = {
      ...props.llmConfig,
      model: chatModelConfig.model,
      baseUrl: chatModelConfig.baseUrl,
      provider: chatModelConfig.provider || 'google',
      stream: true
    }

    const apiEndpoint = `${runtimeConfig.public.apiBase}/chat/send`

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: `请帮我采集并整理以下链接的文章内容，以HTML格式输出：${collectUrl.value}`,
        stream: true,
        llmConfig: llmConfigToSend,
        enableDeepThinking: false,
        enableInternetAccess: true,
        kbMode: false
      })
    })

    if (!response.ok) {
      throw new Error('请求失败')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let collectedText = ''

    if (editorRef.value) {
      const currentContent = editorRef.value.getContent()
      if (currentContent && typeof currentContent === 'string') {
        collectedText = currentContent + '<br/><br/>'
      }
    }

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const message = JSON.parse(data)
              if (message.type === 'content' && message.data) {
                const content = typeof message.data === 'string' ? message.data : String(message.data)
                collectedText += content
                if (editorRef.value) {
                  editorRef.value.setContent(collectedText)
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    const finalContent = typeof collectedText === 'string' ? collectedText : String(collectedText)
    editorContent.value = finalContent
    saveToCache(finalContent)

    toast.add({
      title: '文章采集成功',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: '采集文章失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isCollecting.value = false
  }
}

// 一键排版
const formatContent = () => {
  if (!editorRef.value) return

  const content = editorRef.value.getContent()

  // 确保是字符串
  const contentStr = typeof content === 'string' ? content : String(content)

  // 清理格式
  let formatted = contentStr
    .replace(/<p><br\s*\/?><\/p>/gi, '') // 移除空段落
    .replace(/\s+/g, ' ') // 合并多个空格
    .replace(/<p>\s*<\/p>/gi, '') // 移除空白段落

  // 确保段落格式正确
  formatted = formatted.replace(/([^>])\n([^<])/g, '$1<br/>$2')

  // 设置内容
  editorRef.value.setContent(formatted)
  editorContent.value = formatted
  saveToCache(formatted)

  toast.add({
    title: '排版完成',
    color: 'success'
  })
}

// 处理右键菜单 - 插入配图
const handleInsertImage = () => {
  contextMenuVisible.value = false
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: any) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e: any) => {
        const base64 = e.target.result
        if (typeof base64 === 'string' && editorRef.value) {
          editorRef.value.insertContent(`<img src="${base64}" alt="配图" style="max-width: 100%; height: auto; margin: 10px 0;" />`)
        }
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

// 处理右键菜单 - 粘贴剪贴板
const handlePasteFromClipboard = async () => {
  contextMenuVisible.value = false
  try {
    const text = await navigator.clipboard.readText()
    if (editorRef.value && text) {
      editorRef.value.insertContent(`<p>${text}</p>`)
    }
  } catch (error) {
    // 如果剪贴板 API 不可用，尝试使用传统方法
    if (editorRef.value) {
      editorRef.value.execCommand('paste')
    }
  }
}

// 处理右键菜单 - 粘贴图片
const handlePasteImage = async () => {
  contextMenuVisible.value = false
  try {
    const clipboardItems = await navigator.clipboard.read()
    for (const clipboardItem of clipboardItems) {
      for (const type of clipboardItem.types) {
        if (type.startsWith('image/')) {
          const blob = await clipboardItem.getType(type)
          const reader = new FileReader()
          reader.onload = (e: any) => {
            const base64 = e.target.result
            if (typeof base64 === 'string' && editorRef.value) {
              editorRef.value.insertContent(`<img src="${base64}" alt="粘贴的图片" style="max-width: 100%; height: auto; margin: 10px 0;" />`)
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  } catch (error) {
    toast.add({
      title: '无法读取剪贴板',
      description: '请确保剪贴板中有图片',
      color: 'warning'
    })
  }
}

// 点击外部关闭右键菜单
const handleClickOutside = (e: MouseEvent) => {
  if (contextMenuVisible.value) {
    contextMenuVisible.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="h-full flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <!-- 顶部工具栏 -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] shrink-0">
      <div class="flex items-center gap-4">
        <button
          class="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          title="返回"
          @click="emit('close')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold text-[var(--text-primary)]">
          AI 写作编辑器
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2"
          title="一键排版"
          @click="formatContent"
        >
          <span class="w-4 h-4" v-html="svgIcons.format" />
          <span>一键排版</span>
        </button>
      </div>
    </div>

    <!-- 编辑器容器 -->
    <div class="flex-1 overflow-hidden px-4 py-4">
      <div class="h-full max-w-5xl mx-auto bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
        <textarea :id="editorId" />
      </div>
    </div>

    <!-- 自动写文对话框 -->
    <div v-if="isAutoWriting" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-[var(--bg-primary)] rounded-lg shadow-lg max-w-md w-full p-6 space-y-4 border border-[var(--border-primary)]">
        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
          自动写文
        </h3>
        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">写作主题</label>
          <textarea
            v-model="autoWritePrompt"
            placeholder="请输入您想要写作的主题，例如：人工智能的发展趋势"
            rows="4"
            class="w-full px-4 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          />
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 px-4 py-2 border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            @click="isAutoWriting = false"
          >
            取消
          </button>
          <button
            :disabled="isGenerating"
            class="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleAutoWrite"
          >
            {{ isGenerating ? '生成中...' : '开始写作' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 采集文章对话框 -->
    <div v-if="isCollecting" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-[var(--bg-primary)] rounded-lg shadow-lg max-w-md w-full p-6 space-y-4 border border-[var(--border-primary)]">
        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
          自动采集文章
        </h3>
        <div>
          <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">文章链接</label>
          <input
            v-model="collectUrl"
            type="url"
            placeholder="请输入文章链接，例如：https://example.com/article"
            class="w-full px-4 py-2 border border-[var(--border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          >
        </div>
        <div class="flex gap-3">
          <button
            class="flex-1 px-4 py-2 border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            @click="isCollecting = false"
          >
            取消
          </button>
          <button
            class="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            @click="handleCollectArticle"
          >
            开始采集
          </button>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenuVisible"
      class="fixed bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-[60] min-w-[180px] py-1"
      :style="{ top: `${contextMenuY}px`, left: `${contextMenuX}px` }"
    >
      <button
        class="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
        @click="handleInsertImage"
      >
        <span class="w-4 h-4" v-html="svgIcons.image" />
        <span>插入配图</span>
      </button>
      <button
        class="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
        @click="handlePasteFromClipboard"
      >
        <span class="w-4 h-4" v-html="svgIcons.paste" />
        <span>粘贴文字</span>
      </button>
      <button
        class="w-full px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2"
        @click="handlePasteImage"
      >
        <span class="w-4 h-4" v-html="svgIcons.image" />
        <span>粘贴图片</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
:deep(.tox-tinymce) {
  border: none !important;
}

:deep(.tox-toolbar) {
  background: var(--bg-secondary) !important;
  border-bottom: 1px solid var(--border-primary) !important;
}

:deep(.tox-edit-area) {
  background: var(--bg-primary) !important;
}

:deep(.tox-edit-area__iframe) {
  background: var(--bg-primary) !important;
}

/* 限制编辑器内容区域宽度，避免遮挡侧边栏 */
:deep(.tox-edit-area__iframe body) {
  max-width: 100% !important;
}

:deep(.mce-content-body) {
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* 确保编辑器容器不会超出父容器 */
:deep(.tox-tinymce) {
  max-width: 100% !important;
}
</style>
