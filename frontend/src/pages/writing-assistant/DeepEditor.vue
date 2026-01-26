<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { getChatModelConfig } from '~/config/model.config'

interface Props {
  modelValue?: boolean
  initialContent?: string
  llmConfig?: any
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
  (e: 'article-generated', content: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  initialContent: '',
  llmConfig: () => ({})
})

const emit = defineEmits<Emits>()

const { token } = useAuth()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

// 加载 KaTeX 库用于渲染 LaTeX 公式
useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      crossorigin: 'anonymous'
    }
  ],
  script: [
    {
      src: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
      defer: true
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
      defer: true
    }
  ]
})

// 编辑器相关状态
const editorRef = ref<any>(null)
const editorId = 'deep-editor'
const editorContent = ref('')
const editorTitle = ref('')
const editorInitialized = ref(false)
const formulaPreviewRef = ref<HTMLElement | null>(null)

// 大模型配置
const showLLMConfig = ref(false)
const llmConfigForm = ref({
  baseUrl: '',
  model: '',
  apiKey: '',
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.95
})

// LaTeX 代码优化相关
const isOptimizing = ref(false)
const isAnalyzing = ref(false)
const extractedLatex = ref('')
const showLatexDialog = ref(false)
const showFormulaAnalysis = ref(false)
const selectedFormula = ref('')
const formulaAnalysisResult = ref('')
const isAnalyzingFormula = ref(false)

// AI 内容生成相关
const isGenerating = ref(false)
const generatePrompt = ref('')
const showGenerateDialog = ref(false)

// 保存到知识库相关
const showSaveToKbDialog = ref(false)
const knowledgeBases = ref<any[]>([])
const selectedKbId = ref('')
const isSavingToKb = ref(false)
const api = useApi()

// 本地缓存键名
const CACHE_KEY = 'deep-editor-content'
const TITLE_CACHE_KEY = 'deep-editor-title'
const LLM_CONFIG_CACHE_KEY = 'deep-editor-llm-config'

// 加载配置
const loadConfig = () => {
  if (typeof window !== 'undefined') {
    try {
      // 加载内容
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        editorContent.value = typeof cached === 'string' ? cached : JSON.stringify(cached)
      } else if (props.initialContent) {
        editorContent.value = props.initialContent
      }

      // 加载标题
      const cachedTitle = localStorage.getItem(TITLE_CACHE_KEY)
      if (cachedTitle) {
        editorTitle.value = cachedTitle
      } else {
        editorTitle.value = `深度编辑_${new Date().toLocaleString()}`
      }

      // 加载大模型配置
      const cachedLLMConfig = localStorage.getItem(LLM_CONFIG_CACHE_KEY)
      if (cachedLLMConfig) {
        try {
          const config = JSON.parse(cachedLLMConfig)
          llmConfigForm.value = { ...llmConfigForm.value, ...config }
        } catch (e) {
          // 解析失败，使用默认配置
        }
      }

      // 如果缓存中没有配置，使用传入的配置或默认值
      if (!cachedLLMConfig && props.llmConfig) {
        llmConfigForm.value = {
          baseUrl: props.llmConfig.baseUrl || '',
          model: props.llmConfig.model || '',
          apiKey: props.llmConfig.apiKey || '',
          maxTokens: props.llmConfig.maxTokens || props.llmConfig.max_tokens || 4096,
          temperature: props.llmConfig.temperature || 0.7,
          topP: props.llmConfig.topP || props.llmConfig.top_p || 0.95
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }
}

// 保存配置
const saveConfig = () => {
  if (typeof window !== 'undefined') {
    try {
      if (editorContent.value) {
        localStorage.setItem(CACHE_KEY, typeof editorContent.value === 'string' ? editorContent.value : JSON.stringify(editorContent.value))
      }
      if (editorTitle.value) {
        localStorage.setItem(TITLE_CACHE_KEY, editorTitle.value)
      }
      localStorage.setItem(LLM_CONFIG_CACHE_KEY, JSON.stringify(llmConfigForm.value))
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }
}

// 自动保存（防抖）
let saveTimer: any = null
const autoSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    saveConfig()
  }, 1000)
}

// 初始化 TinyMCE（修复插件加载问题）
const initTinyMCE = () => {
  if (typeof window !== 'undefined' && (window as any).tinymce) {
    const existingEditor = (window as any).tinymce.get(editorId)
    if (existingEditor) {
      existingEditor.remove()
    }

    (window as any).tinymce.init({
      selector: `#${editorId}`,
      height: '100%',
      // 只使用核心插件，避免加载外部插件导致401错误
      plugins: [
        'advlist', 'autolink', 'lists', 'link', 'visualblocks', 'code', 'fullscreen',
        'insertdatetime', 'media', 'table'
      ],
      toolbar: 'undo redo | extractLatex optimizeLatex analyzeLatex | generate | code fullscreen | llmConfig',
      language: 'zh_CN',
      language_url: '/tinymce/langs/zh_CN.js',
      promotion: false,
      license_key: 'gpl',
      // 禁用图标CDN加载，使用内置图标
      icons: 'material',
      icon_urls: {
        default: ''
      },
      paste_as_text: false,
      paste_data_images: true,
      automatic_uploads: true,
      convert_urls: true,
      link_default_target: '_blank',
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
          editorContent.value = typeof content === 'string' ? content : ''
          autoSave()

          // 延迟渲染公式，避免频繁渲染
          if (typeof window !== 'undefined' && (window as any).renderMathInElement) {
            clearTimeout((editor as any)._formulaRenderTimer)
            ;(editor as any)._formulaRenderTimer = setTimeout(() => {
              const editorBody = editor.getBody()
              if (editorBody) {
                (window as any).renderMathInElement(editorBody, {
                  delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                  ],
                  throwOnError: false
                })
              }
            }, 500)
          }
        })

        // 添加提取 LaTeX 代码按钮
        editor.ui.registry.addButton('extractLatex', {
          text: '📄 提取LaTeX',
          tooltip: '提取编辑器中的 LaTeX 代码',
          onAction: () => {
            handleExtractLatex()
          }
        })

        // 添加分析 LaTeX 代码按钮
        editor.ui.registry.addButton('analyzeLatex', {
          text: '🔍 分析算法',
          tooltip: '分析 LaTeX 代码中的算法',
          onAction: () => {
            handleAnalyzeLatex()
          }
        })

        // 添加优化 LaTeX 代码按钮
        editor.ui.registry.addButton('optimizeLatex', {
          text: '⚡ 优化算法',
          tooltip: '通过大模型优化 LaTeX 代码',
          onAction: () => {
            handleOptimizeLatex()
          }
        })

        // 添加 AI 内容生成按钮
        editor.ui.registry.addButton('generate', {
          text: '✨ 生成',
          tooltip: 'AI 一键生成内容',
          onAction: () => {
            showGenerateDialog.value = true
          }
        })

        // 添加大模型配置按钮
        editor.ui.registry.addButton('llmConfig', {
          text: '⚙️ 配置',
          tooltip: '大模型配置',
          onAction: () => {
            showLLMConfig.value = !showLLMConfig.value
          }
        })
      },
      init_instance_callback: (editor: any) => {
        loadConfig()
        // 优先使用 props.initialContent，如果没有则使用缓存的 editorContent
        const contentToSet = props.initialContent || editorContent.value
        if (contentToSet) {
          editor.setContent(contentToSet)
          editorContent.value = contentToSet
        }
        editorInitialized.value = true

        // 设置光标到第一行开始
        setTimeout(() => {
          try {
            const body = editor.getBody()
            if (body) {
              const firstP = body.querySelector('p:first-of-type')
              if (firstP) {
                const range = editor.dom.createRng()
                range.setStart(firstP, 0)
                range.setEnd(firstP, 0)
                editor.selection.setRng(range)
                editor.selection.collapse(true)
              }
              editor.getWin()?.scrollTo(0, 0)
              editor.focus()
            }

            // 渲染编辑器中的公式
            if (typeof window !== 'undefined' && (window as any).renderMathInElement) {
              setTimeout(() => {
                const editorBody = editor.getBody()
                if (editorBody && (window as any).renderMathInElement) {
                  (window as any).renderMathInElement(editorBody, {
                    delimiters: [
                      { left: '$$', right: '$$', display: true },
                      { left: '$', right: '$', display: false },
                      { left: '\\[', right: '\\]', display: true },
                      { left: '\\(', right: '\\)', display: false }
                    ],
                    throwOnError: false
                  })
                }
              }, 1000)
            }
          } catch (error) {
            console.error('设置光标位置失败:', error)
          }
        }, 200)
      }
    })
  }
}

// 监听 initialContent 变化，更新编辑器内容
watch(() => props.initialContent, (newContent) => {
  if (newContent && editorRef.value) {
    const currentContent = editorRef.value.getContent()
    // 追加新内容而不是替换
    const separator = currentContent && !currentContent.endsWith('\n\n') ? '\n\n' : ''
    editorRef.value.setContent(currentContent + separator + newContent)
    editorContent.value = editorRef.value.getContent()
  }
}, { immediate: false })

// 等待 TinyMCE 加载
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (typeof window !== 'undefined') {
        const checkTinyMCE = () => {
          if (!document.getElementById(editorId)) return

          if ((window as any).tinymce) {
            initTinyMCE()
          } else {
            setTimeout(checkTinyMCE, 100)
          }
        }
        checkTinyMCE()
      }
    })
  } else {
    // 关闭时清理
    if (typeof window !== 'undefined' && (window as any).tinymce) {
      const editor = (window as any).tinymce.get(editorId)
      if (editor) {
        editor.remove()
      }
    }
  }
}, { immediate: true })

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
  saveConfig()
})

// 显示生成对话框（已通过 ref 控制）

// 提取 LaTeX 代码
const handleExtractLatex = () => {
  if (!editorRef.value) {
    toast.add({
      title: '编辑器未初始化',
      color: 'warning'
    })
    return
  }

  const content = editorRef.value.getContent()
  if (!content || !content.trim()) {
    toast.add({
      title: '编辑器内容为空',
      color: 'warning'
    })
    return
  }

  // 提取 LaTeX 代码块（支持多种格式）
  const latexPatterns = [
    /\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, // \begin{...}...\end{...}
    /\$\$[\s\S]*?\$\$/g, // $$...$$
    /\$[^$\n]+\$/g, // $...$
    /\\\[[\s\S]*?\\\]/g, // \[...\]
    /\\\([\s\S]*?\\\)/g // \(...\)
  ]

  let extracted: string[] = []
  for (const pattern of latexPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      extracted.push(...matches)
    }
  }

  // 也尝试从纯文本中提取（去除HTML标签）
  const textContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  for (const pattern of latexPatterns) {
    const matches = textContent.match(pattern)
    if (matches) {
      extracted.push(...matches)
    }
  }

  // 去重
  extracted = [...new Set(extracted)]

  if (extracted.length === 0) {
    toast.add({
      title: '未找到 LaTeX 代码',
      description: '请在编辑器中输入 LaTeX 代码（支持 \\begin{...}...\\end{...}、$$...$$、$...$ 等格式）',
      color: 'warning'
    })
    return
  }

  extractedLatex.value = extracted.join('\n\n---\n\n')
  showLatexDialog.value = true

  toast.add({
    title: '提取成功',
    description: `找到 ${extracted.length} 个 LaTeX 代码块`,
    color: 'success'
  })
}

// 分析 LaTeX 代码中的算法
const handleAnalyzeLatex = async () => {
  if (!editorRef.value) {
    toast.add({
      title: '编辑器未初始化',
      color: 'warning'
    })
    return
  }

  const content = editorRef.value.getContent()
  if (!content || !content.trim()) {
    toast.add({
      title: '编辑器内容为空',
      color: 'warning'
    })
    return
  }

  // 先提取 LaTeX 代码
  handleExtractLatex()

  if (!extractedLatex.value) {
    return
  }

  if (!llmConfigForm.value.baseUrl || !llmConfigForm.value.model) {
    toast.add({
      title: '请先配置大模型',
      description: '请点击配置按钮设置大模型端点、模型等信息',
      color: 'warning'
    })
    showLLMConfig.value = true
    return
  }

  isAnalyzing.value = true

  try {
    const systemPrompt = `你是一个专业的算法分析专家。你的任务是分析 LaTeX 代码中描述的算法，包括：

1. 算法名称和类型
2. 算法的核心思想和原理
3. 关键步骤和流程
4. 时间复杂度和空间复杂度
5. 算法的优缺点
6. 应用场景

请用清晰、专业的中文进行分析。`

    const userPrompt = `请分析以下 LaTeX 代码中描述的算法：

\`\`\`latex
${extractedLatex.value}
\`\`\`

请提供详细的分析报告。`

    const requestBody: any = {
      model: llmConfigForm.value.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: llmConfigForm.value.maxTokens,
      temperature: llmConfigForm.value.temperature,
      top_p: llmConfigForm.value.topP,
      stream: false
    }

    const apiUrl = llmConfigForm.value.baseUrl.endsWith('/chat/completions')
      ? llmConfigForm.value.baseUrl
      : `${llmConfigForm.value.baseUrl.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfigForm.value.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const analysisResult = data.choices?.[0]?.message?.content || '分析失败'

    // 渲染公式并提取公式列表
    const formulas = extractFormulas(analysisResult)
    let renderedResult = renderLatexFormulas(analysisResult.replace(/\n/g, '<br/>'))

    // 为每个公式添加分析按钮
    formulas.forEach((formula, index) => {
      const formulaId = `formula-${Date.now()}-${index}`
      const formulaHtml = typeof window !== 'undefined' && (window as any).katex
        ? (window as any).katex.renderToString(formula, { throwOnError: false, displayMode: true })
        : `$$${formula}$$`

      // 在公式附近添加分析按钮
      renderedResult = renderedResult.replace(
        new RegExp(formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        `<div style="margin: 15px 0; text-align: center;">
          <div id="${formulaId}" class="formula-display" style="margin: 10px 0;">${formulaHtml}</div>
          <button onclick="window.analyzeFormula_${editorId}('${formula.replace(/'/g, '\\\'')}')" 
                  style="padding: 6px 12px; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px;">
            🔍 分析公式
          </button>
        </div>`
      )
    })

    // 将分析结果追加到编辑器
    if (editorRef.value) {
      const currentContent = editorRef.value.getContent()
      const separator = currentContent && !currentContent.endsWith('\n\n') ? '\n\n' : ''
      const newContent = `${currentContent}${separator}<h2>算法分析报告</h2><div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin: 20px 0;">${renderedResult}</div>`
      editorRef.value.setContent(newContent)
      editorContent.value = newContent

      // 注册全局函数用于按钮点击
      if (typeof window !== 'undefined') {
        ;(window as any)[`analyzeFormula_${editorId}`] = (formula: string) => {
          handleAnalyzeFormula(formula)
        }
      }

      // 延迟渲染公式
      nextTick(() => {
        setTimeout(() => {
          if (editorRef.value && typeof window !== 'undefined' && (window as any).renderMathInElement) {
            const editorBody = editorRef.value.getBody()
            if (editorBody) {
              (window as any).renderMathInElement(editorBody, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false },
                  { left: '\\[', right: '\\]', display: true },
                  { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
              })
            }
          }
        }, 500)
      })
    }

    saveConfig()

    toast.add({
      title: '分析完成',
      description: '算法分析结果已添加到编辑器',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: '分析失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isAnalyzing.value = false
  }
}

// 优化 LaTeX 代码
const handleOptimizeLatex = async () => {
  if (!editorRef.value) {
    toast.add({
      title: '编辑器未初始化',
      color: 'warning'
    })
    return
  }

  const content = editorRef.value.getContent()
  if (!content || !content.trim()) {
    toast.add({
      title: '编辑器内容为空',
      color: 'warning'
    })
    return
  }

  // 先提取 LaTeX 代码
  handleExtractLatex()

  if (!extractedLatex.value) {
    return
  }

  if (!llmConfigForm.value.baseUrl || !llmConfigForm.value.model) {
    toast.add({
      title: '请先配置大模型',
      description: '请点击配置按钮设置大模型端点、模型等信息',
      color: 'warning'
    })
    showLLMConfig.value = true
    return
  }

  isOptimizing.value = true

  try {
    const systemPrompt = `你是一个专业的 LaTeX 代码优化专家。你的任务是：

1. 分析 LaTeX 代码的结构和逻辑
2. 识别可以优化的地方（性能、可读性、规范性等）
3. 提供优化后的 LaTeX 代码
4. 说明优化的原因和改进点

请确保优化后的代码：
- 保持原有功能不变
- 提高代码的可读性和规范性
- 优化算法效率（如果可能）
- 遵循 LaTeX 最佳实践

输出格式：
1. 首先提供优化后的完整 LaTeX 代码（用 \`\`\`latex 代码块包裹）
2. 然后提供优化说明（用中文说明）`

    const userPrompt = `请优化以下 LaTeX 代码：

\`\`\`latex
${extractedLatex.value}
\`\`\`

请提供优化后的代码和详细的优化说明。`

    const requestBody: any = {
      model: llmConfigForm.value.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: llmConfigForm.value.maxTokens,
      temperature: llmConfigForm.value.temperature,
      top_p: llmConfigForm.value.topP,
      stream: false
    }

    const apiUrl = llmConfigForm.value.baseUrl.endsWith('/chat/completions')
      ? llmConfigForm.value.baseUrl
      : `${llmConfigForm.value.baseUrl.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfigForm.value.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const optimizationResult = data.choices?.[0]?.message?.content || '优化失败'

    // 提取优化后的 LaTeX 代码
    const optimizedLatexMatch = optimizationResult.match(/```latex\s*([\s\S]*?)\s*```/)
      || optimizationResult.match(/```\s*([\s\S]*?)\s*```/)
    const optimizedLatex = optimizedLatexMatch ? optimizedLatexMatch[1].trim() : null

    // 提取公式并渲染
    const formulas = optimizedLatex ? extractFormulas(optimizedLatex) : []
    const allFormulas = [...formulas, ...extractFormulas(optimizationResult)]

    // 渲染优化说明中的公式
    let renderedExplanation = renderLatexFormulas(optimizationResult.replace(/```latex[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim().replace(/\n/g, '<br/>'))

    // 为优化后的代码中的公式添加可视化
    let renderedOptimizedLatex = optimizedLatex || ''
    if (optimizedLatex && typeof window !== 'undefined' && (window as any).katex) {
      // 渲染代码中的公式（保留代码结构）
      formulas.forEach((formula, index) => {
        const formulaHtml = (window as any).katex.renderToString(formula, { throwOnError: false, displayMode: true })
        const formulaId = `opt-formula-${Date.now()}-${index}`
        renderedOptimizedLatex = renderedOptimizedLatex.replace(
          new RegExp(formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          `<div id="${formulaId}" class="formula-display" style="margin: 10px 0; text-align: center;">${formulaHtml}</div>`
        )
      })
    }

    // 将优化结果追加到编辑器
    if (editorRef.value) {
      const currentContent = editorRef.value.getContent()
      const separator = currentContent && !currentContent.endsWith('\n\n') ? '\n\n' : ''

      let newContent = `${currentContent}${separator}<h2>算法优化结果</h2>`

      if (optimizedLatex) {
        newContent += `<div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>优化后的代码：</h3>
          <div style="background: var(--bg-tertiary); padding: 15px; border-radius: 4px; overflow-x: auto; margin: 10px 0;">
            ${renderedOptimizedLatex.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&lt;div/g, '<div').replace(/&lt;\/div&gt;/g, '</div>')}
          </div>
          ${formulas.length > 0 ? `<div style="margin-top: 15px;"><strong>公式可视化：</strong></div>` : ''}
        </div>`
      }

      // 添加优化说明（包含渲染后的公式）
      const explanation = optimizationResult.replace(/```latex[\s\S]*?```/g, '').replace(/```[\s\S]*?```/g, '').trim()
      if (explanation) {
        // 为说明中的公式添加分析按钮
        const explanationFormulas = extractFormulas(explanation)
        explanationFormulas.forEach((formula, index) => {
          const formulaId = `expl-formula-${Date.now()}-${index}`
          const formulaHtml = typeof window !== 'undefined' && (window as any).katex
            ? (window as any).katex.renderToString(formula, { throwOnError: false, displayMode: true })
            : `$$${formula}$$`

          renderedExplanation = renderedExplanation.replace(
            new RegExp(formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            `<div style="margin: 15px 0; text-align: center;">
              <div id="${formulaId}" class="formula-display" style="margin: 10px 0;">${formulaHtml}</div>
              <button onclick="window.analyzeFormula_${editorId}('${formula.replace(/'/g, '\\\'')}')" 
                      style="padding: 6px 12px; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px;">
                🔍 分析公式
              </button>
            </div>`
          )
        })

        newContent += `<div style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin: 20px 0;"><h3>优化说明：</h3><div>${renderedExplanation}</div></div>`
      }

      editorRef.value.setContent(newContent)
      editorContent.value = newContent

      // 注册全局函数用于按钮点击
      if (typeof window !== 'undefined') {
        ;(window as any)[`analyzeFormula_${editorId}`] = (formula: string) => {
          handleAnalyzeFormula(formula)
        }
      }

      // 延迟渲染公式
      nextTick(() => {
        setTimeout(() => {
          if (editorRef.value && typeof window !== 'undefined' && (window as any).renderMathInElement) {
            const editorBody = editorRef.value.getBody()
            if (editorBody) {
              (window as any).renderMathInElement(editorBody, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false },
                  { left: '\\[', right: '\\]', display: true },
                  { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
              })
            }
          }
        }, 500)
      })
    }

    saveConfig()

    toast.add({
      title: '优化完成',
      description: '优化后的代码已添加到编辑器',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: '优化失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isOptimizing.value = false
  }
}

// AI 一键生成内容
const handleGenerateArticle = async () => {
  if (!generatePrompt.value.trim()) {
    toast.add({
      title: '请输入生成提示',
      color: 'warning'
    })
    return
  }

  if (!llmConfigForm.value.baseUrl || !llmConfigForm.value.model) {
    toast.add({
      title: '请先配置大模型',
      description: '请点击配置按钮设置大模型端点、模型等信息',
      color: 'warning'
    })
    showLLMConfig.value = true
    return
  }

  isGenerating.value = true

  try {
    // 保存配置
    saveConfig()

    // 构建请求体
    const requestBody: any = {
      model: llmConfigForm.value.model,
      messages: [
        {
          role: 'user',
          content: `请帮我写一篇文章，主题是：${generatePrompt.value}。要求文章结构清晰，内容丰富，语言流畅，使用HTML格式输出。`
        }
      ],
      max_tokens: llmConfigForm.value.maxTokens,
      temperature: llmConfigForm.value.temperature,
      top_p: llmConfigForm.value.topP,
      stream: true
    }

    // 使用配置的端点
    const apiUrl = llmConfigForm.value.baseUrl.endsWith('/chat/completions')
      ? llmConfigForm.value.baseUrl
      : `${llmConfigForm.value.baseUrl.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfigForm.value.apiKey}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
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
              if (message.choices && message.choices[0] && message.choices[0].delta) {
                const content = message.choices[0].delta.content
                if (content) {
                  generatedText += content
                  if (editorRef.value) {
                    editorRef.value.setContent(generatedText)
                  }
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }

    const finalContent = typeof generatedText === 'string' ? generatedText : String(generatedText)
    editorContent.value = finalContent
    saveConfig()

    // 关闭生成对话框
    showGenerateDialog.value = false
    generatePrompt.value = ''

    // 发送事件通知父组件（用于显示通知）
    emit('article-generated', finalContent)

    toast.add({
      title: '内容生成成功',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: '生成内容失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isGenerating.value = false
  }
}

// 加载知识库列表
const loadKnowledgeBases = async () => {
  try {
    console.log('开始加载知识库列表')
    const res = await api.get('/knowledge-bases')
    console.log('知识库API响应:', res)

    if (res.success && res.data) {
      knowledgeBases.value = Array.isArray(res.data) ? res.data : []
      console.log('知识库列表加载成功:', { count: knowledgeBases.value.length })

      // 如果有知识库，默认选中第一个
      if (knowledgeBases.value.length > 0 && !selectedKbId.value) {
        selectedKbId.value = knowledgeBases.value[0].id
        console.log('默认选中知识库:', selectedKbId.value)
      }
    } else {
      console.warn('知识库API返回异常:', res)
      knowledgeBases.value = []
    }
  } catch (error: any) {
    console.error('加载知识库失败:', error)
    knowledgeBases.value = []
    toast.add({
      title: '加载知识库失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
    throw error // 重新抛出错误，让调用者知道失败
  }
}

// 打开保存到知识库对话框
const handleOpenSaveToKb = async () => {
  console.log('点击保存到知识库按钮')

  // 检查编辑器内容
  let hasContent = false
  if (editorRef.value) {
    const content = editorRef.value.getContent()
    hasContent = content && content.trim().length > 0
    console.log('编辑器内容检查:', { hasContent, contentLength: content?.length || 0 })
  } else if (editorContent.value) {
    // 如果是HTML内容，需要检查是否有实际文本内容
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = editorContent.value
    const textContent = tempDiv.textContent || tempDiv.innerText || ''
    hasContent = textContent.trim().length > 0
    console.log('编辑器内容检查（HTML）:', { hasContent, textLength: textContent.length })
  }

  if (!hasContent) {
    toast.add({
      title: '内容为空',
      description: '请先编辑内容后再保存',
      color: 'warning'
    })
    return
  }

  try {
    // 加载知识库列表
    await loadKnowledgeBases()

    if (knowledgeBases.value.length === 0) {
      toast.add({
        title: '没有可用的知识库',
        description: '请先创建知识库',
        color: 'warning'
      })
      return
    }

    // 默认选中第一个知识库
    if (knowledgeBases.value.length > 0 && !selectedKbId.value) {
      selectedKbId.value = knowledgeBases.value[0].id
    }

    showSaveToKbDialog.value = true
    console.log('知识库对话框已打开', { kbCount: knowledgeBases.value.length, selectedKbId: selectedKbId.value })
  } catch (error: any) {
    console.error('打开保存对话框失败:', error)
    toast.add({
      title: '加载失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  }
}

// 保存到知识库
const handleSaveToKnowledgeBase = async () => {
  if (!selectedKbId.value) {
    toast.add({
      title: '请选择知识库',
      color: 'warning'
    })
    return
  }

  if (!editorContent.value || !editorContent.value.trim()) {
    toast.add({
      title: '内容为空',
      description: '请先编辑内容后再保存',
      color: 'warning'
    })
    return
  }

  isSavingToKb.value = true

  try {
    // 获取编辑器内容
    let content = editorContent.value

    // 如果编辑器有内容，优先从编辑器获取
    if (editorRef.value) {
      const editorContentRaw = editorRef.value.getContent({ format: 'raw' })
      if (editorContentRaw) {
        content = editorContentRaw
      } else {
        content = editorContent.value
      }
    }

    // 如果是HTML内容，保留HTML格式（知识库可以处理HTML）
    // 如果需要纯文本，可以在这里转换
    // 目前保留HTML格式，以便保留格式和公式

    const title = editorTitle.value || `文档_${new Date().toLocaleString()}`

    const res = await api.post('/chat/save-to-kb', {
      kbId: selectedKbId.value,
      content: content,
      title: title
    })

    if (res.success) {
      toast.add({
        title: '保存成功',
        description: '内容已保存到知识库，正在处理中...',
        color: 'success'
      })
      showSaveToKbDialog.value = false
    } else {
      throw new Error(res.message || '保存失败')
    }
  } catch (error: any) {
    toast.add({
      title: '保存失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isSavingToKb.value = false
  }
}

// 关闭编辑器
const handleClose = () => {
  saveConfig()
  emit('update:modelValue', false)
  emit('close')
}

// 监听标题变化
watch(editorTitle, () => {
  autoSave()
})

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// 监听公式分析对话框打开，自动渲染公式
watch(showFormulaAnalysis, (isOpen) => {
  if (isOpen && selectedFormula.value) {
    nextTick(() => {
      setTimeout(() => {
        if (formulaPreviewRef.value && typeof window !== 'undefined' && (window as any).katex) {
          try {
            formulaPreviewRef.value.innerHTML = (window as any).katex.renderToString(selectedFormula.value, {
              throwOnError: false,
              displayMode: true
            })
          } catch (e) {
            console.error('渲染公式预览失败:', e)
            if (formulaPreviewRef.value) {
              formulaPreviewRef.value.innerHTML = `<code>$$${selectedFormula.value}$$</code>`
            }
          }
        } else if (formulaPreviewRef.value) {
          formulaPreviewRef.value.innerHTML = `<code>$$${selectedFormula.value}$$</code>`
        }
      }, 300)
    })
  }
})

// 渲染 LaTeX 公式到 HTML
const renderLatexFormulas = (html: string): string => {
  if (typeof window === 'undefined' || !(window as any).katex) {
    return html
  }

  const katex = (window as any).katex

  // 匹配行内公式 $...$ 和 $$...$$
  let processedHtml = html

  // 处理行内公式 $...$（不换行）
  processedHtml = processedHtml.replace(/\$([^$\n]+?)\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), { throwOnError: false, displayMode: false })
    } catch (e) {
      return match
    }
  })

  // 处理块级公式 $$...$$ 或 \[...\]
  processedHtml = processedHtml.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    try {
      return `<div style="text-align: center; margin: 20px 0;">${katex.renderToString(formula.trim(), { throwOnError: false, displayMode: true })}</div>`
    } catch (e) {
      return match
    }
  })

  processedHtml = processedHtml.replace(/\\\[([\s\S]*?)\\\]/g, (match, formula) => {
    try {
      return `<div style="text-align: center; margin: 20px 0;">${katex.renderToString(formula.trim(), { throwOnError: false, displayMode: true })}</div>`
    } catch (e) {
      return match
    }
  })

  // 处理 \begin{equation}...\end{equation} 等环境
  processedHtml = processedHtml.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (match, formula) => {
    try {
      return `<div style="text-align: center; margin: 20px 0;">${katex.renderToString(formula.trim(), { throwOnError: false, displayMode: true })}</div>`
    } catch (e) {
      return match
    }
  })

  return processedHtml
}

// 提取文本中的 LaTeX 公式
const extractFormulas = (text: string): string[] => {
  const formulas: string[] = []

  // 提取各种格式的公式
  const patterns = [
    /\$\$([\s\S]*?)\$\$/g,
    /\$([^$\n]+?)\$/g,
    /\\\[([\s\S]*?)\\\]/g,
    /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
    /\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g
  ]

  patterns.forEach((pattern) => {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        formulas.push(match[1].trim())
      }
    }
  })

  return [...new Set(formulas)] // 去重
}

// 分析单个公式
const handleAnalyzeFormula = async (formula: string) => {
  if (!formula || !formula.trim()) {
    toast.add({
      title: '公式为空',
      color: 'warning'
    })
    return
  }

  if (!llmConfigForm.value.baseUrl || !llmConfigForm.value.model) {
    toast.add({
      title: '请先配置大模型',
      description: '请点击配置按钮设置大模型端点、模型等信息',
      color: 'warning'
    })
    showLLMConfig.value = true
    return
  }

  selectedFormula.value = formula
  showFormulaAnalysis.value = true
  isAnalyzingFormula.value = true
  formulaAnalysisResult.value = ''

  // 立即渲染公式预览
  nextTick(() => {
    setTimeout(() => {
      if (formulaPreviewRef.value && typeof window !== 'undefined' && (window as any).katex) {
        try {
          formulaPreviewRef.value.innerHTML = (window as any).katex.renderToString(formula, {
            throwOnError: false,
            displayMode: true
          })
        } catch (e) {
          console.error('渲染公式预览失败:', e)
          if (formulaPreviewRef.value) {
            formulaPreviewRef.value.innerHTML = `<code>$$${formula}$$</code>`
          }
        }
      } else if (formulaPreviewRef.value) {
        formulaPreviewRef.value.innerHTML = `<code>$$${formula}$$</code>`
      }
    }, 300)
  })

  try {
    const systemPrompt = `你是一个专业的数学公式分析专家。你的任务是分析 LaTeX 数学公式，包括：

1. 公式的数学含义和物理意义
2. 公式中各个符号的含义
3. 公式的推导过程（如果可能）
4. 公式的应用场景
5. 相关的数学概念和定理

请用清晰、专业的中文进行解释，并确保解释准确、易懂。`

    const userPrompt = `请详细分析以下 LaTeX 数学公式：

\`\`\`latex
${formula}
\`\`\`

请提供：
1. 公式的可视化表示（使用 LaTeX 格式）
2. 公式的详细含义解释
3. 各个符号的含义
4. 公式的应用场景`

    const requestBody: any = {
      model: llmConfigForm.value.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: llmConfigForm.value.maxTokens,
      temperature: llmConfigForm.value.temperature,
      top_p: llmConfigForm.value.topP,
      stream: false
    }

    const apiUrl = llmConfigForm.value.baseUrl.endsWith('/chat/completions')
      ? llmConfigForm.value.baseUrl
      : `${llmConfigForm.value.baseUrl.replace(/\/$/, '')}/chat/completions`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfigForm.value.apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    formulaAnalysisResult.value = data.choices?.[0]?.message?.content || '分析失败'

    // 等待 KaTeX 加载后渲染公式
    nextTick(() => {
      setTimeout(() => {
        if (typeof window !== 'undefined' && (window as any).renderMathInElement) {
          const container = document.getElementById('formula-analysis-content')
          if (container) {
            (window as any).renderMathInElement(container, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false }
              ],
              throwOnError: false
            })
          }
        }
      }, 500)
    })
  } catch (error: any) {
    toast.add({
      title: '公式分析失败',
      description: error.message || '请稍后重试',
      color: 'error'
    })
  } finally {
    isAnalyzingFormula.value = false
  }
}
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black/60 flex items-center justify-center z-[90] backdrop-blur-[2px]"
    @click.self="handleClose"
  >
    <div
      class="bg-[var(--bg-primary)] w-[90vw] h-[90vh] rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden transform transition-all flex flex-col"
      @click.stop
    >
      <!-- 顶部工具栏 -->
      <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)] shrink-0">
        <div class="flex items-center gap-3">
          <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
            <svg
              class="w-5 h-5 text-[var(--text-accent)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            深度编辑器
          </h3>
          <input
            v-model="editorTitle"
            class="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-1 text-sm focus:border-[var(--border-hover)] outline-none"
            placeholder="文档标题"
          >
        </div>
        <div class="flex items-center gap-2">
          <button
            class="p-2 hover:bg-[var(--bg-tertiary)] rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            title="大模型配置"
            @click="showLLMConfig = !showLLMConfig"
          >
            <span class="material-symbols-outlined text-[20px]">settings</span>
          </button>
          <button
            class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            @click="handleClose"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>

      <!-- 大模型配置面板 -->
      <div v-if="showLLMConfig" class="px-6 py-4 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)] shrink-0">
        <div class="grid grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">端点URL</label>
            <input
              v-model="llmConfigForm.baseUrl"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="https://api.openai.com/v1"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">模型ID</label>
            <input
              v-model="llmConfigForm.model"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="gpt-4"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">API Key</label>
            <input
              v-model="llmConfigForm.apiKey"
              type="password"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="sk-..."
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Token最大值</label>
            <input
              v-model.number="llmConfigForm.maxTokens"
              type="number"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="4096"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Temperature</label>
            <input
              v-model.number="llmConfigForm.temperature"
              type="number"
              step="0.1"
              min="0"
              max="2"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="0.7"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-[var(--text-secondary)] mb-1">Top P</label>
            <input
              v-model.number="llmConfigForm.topP"
              type="number"
              step="0.1"
              min="0"
              max="1"
              class="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded px-3 py-2 text-sm focus:border-[var(--border-hover)] outline-none"
              placeholder="0.95"
            >
          </div>
        </div>
      </div>

      <!-- TinyMCE编辑器容器 -->
      <div class="flex-1 p-6 overflow-hidden">
        <div class="h-full bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
          <textarea :id="editorId" />
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="p-4 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] flex justify-between items-center shrink-0">
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 算法优化工具组 -->
          <div class="flex items-center gap-2 border-r border-[var(--border-primary)] pr-2">
            <button
              class="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm hover:bg-[var(--bg-primary)] transition flex items-center gap-2"
              @click="handleExtractLatex"
            >
              <span class="material-symbols-outlined text-[16px]">description</span>
              提取 LaTeX
            </button>
            <button
              :disabled="isAnalyzing"
              class="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm hover:bg-[var(--bg-primary)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="handleAnalyzeLatex"
            >
              <span v-if="isAnalyzing" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-[16px]">search</span>
              {{ isAnalyzing ? '分析中...' : '分析算法' }}
            </button>
            <button
              :disabled="isOptimizing"
              class="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm hover:bg-[var(--bg-primary)] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="handleOptimizeLatex"
            >
              <span v-if="isOptimizing" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-[16px]">auto_awesome</span>
              {{ isOptimizing ? '优化中...' : '优化算法' }}
            </button>
          </div>

          <!-- AI 内容生成工具组 -->
          <div class="flex items-center gap-2">
            <input
              v-model="generatePrompt"
              type="text"
              placeholder="输入内容主题，然后点击生成..."
              class="px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm focus:border-[var(--border-hover)] outline-none w-64"
              @keyup.enter="handleGenerateArticle"
            >
            <button
              :disabled="isGenerating || !generatePrompt.trim()"
              class="px-5 py-2 bg-[var(--accent-primary)] text-white font-medium rounded-lg text-sm hover:opacity-90 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="handleGenerateArticle"
            >
              <span v-if="isGenerating" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-[16px]">auto_awesome</span>
              {{ isGenerating ? '生成中...' : 'AI 生成' }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="px-5 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
            @click="handleClose"
          >
            取消
          </button>
          <button
            type="button"
            class="px-5 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] font-medium rounded-lg text-sm hover:opacity-90 transition shadow-md cursor-pointer"
            @click.stop="handleOpenSaveToKb"
          >
            保存文章
          </button>
        </div>
      </div>

      <!-- LaTeX 代码提取对话框 -->
      <div v-if="showLatexDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" @click.self="showLatexDialog = false">
        <div class="bg-[var(--bg-primary)] w-[80vw] max-w-4xl h-[80vh] rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden flex flex-col">
          <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)] shrink-0">
            <h3 class="text-lg font-medium text-[var(--text-primary)]">
              提取的 LaTeX 代码
            </h3>
            <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" @click="showLatexDialog = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="flex-1 p-6 overflow-auto">
            <pre class="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)] text-sm text-[var(--text-primary)] whitespace-pre-wrap overflow-x-auto"><code>{{ extractedLatex || '未找到 LaTeX 代码' }}</code></pre>
          </div>
          <div class="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end gap-2 bg-[var(--bg-secondary)] shrink-0">
            <button class="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition" @click="showLatexDialog = false">
              关闭
            </button>
          </div>
        </div>
      </div>

      <!-- AI 内容生成对话框 -->
      <div v-if="showGenerateDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" @click.self="showGenerateDialog = false">
        <div class="bg-[var(--bg-primary)] w-[90vw] max-w-2xl rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden">
          <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)]">
            <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <span class="material-symbols-outlined text-[var(--text-accent)]">auto_awesome</span>
              AI 内容生成
            </h3>
            <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" @click="showGenerateDialog = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="p-6">
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-2">生成主题</label>
              <input
                v-model="generatePrompt"
                type="text"
                placeholder="例如：写一篇关于人工智能发展的文章"
                class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm focus:border-[var(--border-hover)] outline-none"
                @keyup.enter="handleGenerateArticle"
              >
            </div>
            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                @click="showGenerateDialog = false"
              >
                取消
              </button>
              <button
                :disabled="isGenerating || !generatePrompt.trim()"
                class="px-5 py-2 bg-[var(--accent-primary)] text-white font-medium rounded-lg text-sm hover:opacity-90 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                @click="handleGenerateArticle"
              >
                <span v-if="isGenerating" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span v-else class="material-symbols-outlined text-[16px]">auto_awesome</span>
                {{ isGenerating ? '生成中...' : '开始生成' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 公式分析对话框 -->
      <div v-if="showFormulaAnalysis" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" @click.self="showFormulaAnalysis = false">
        <div class="bg-[var(--bg-primary)] w-[90vw] max-w-4xl h-[85vh] rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden flex flex-col">
          <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)] shrink-0">
            <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <span class="material-symbols-outlined text-[var(--text-accent)]">functions</span>
              公式分析
            </h3>
            <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" @click="showFormulaAnalysis = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="flex-1 p-6 overflow-auto">
            <!-- 公式显示 -->
            <div class="mb-6">
              <h4 class="text-sm font-medium text-[var(--text-secondary)] mb-3">
                LaTeX 公式：
              </h4>
              <div class="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-primary)] mb-3">
                <code class="text-sm text-[var(--text-primary)]">{{ selectedFormula }}</code>
              </div>
              <h4 class="text-sm font-medium text-[var(--text-secondary)] mb-3">
                可视化公式：
              </h4>
              <div id="formula-preview" class="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)] text-center" style="min-height: 80px; display: flex; align-items: center; justify-content: center;">
                <div v-if="selectedFormula" ref="formulaPreviewRef" />
                <div v-else class="text-[var(--text-secondary)]">
                  暂无公式
                </div>
              </div>
            </div>

            <!-- 分析结果 -->
            <div v-if="isAnalyzingFormula" class="flex items-center justify-center py-8">
              <div class="text-center">
                <span class="material-symbols-outlined text-[48px] text-[var(--text-accent)] animate-spin">sync</span>
                <p class="text-sm text-[var(--text-secondary)] mt-2">
                  正在分析公式...
                </p>
              </div>
            </div>
            <div v-else-if="formulaAnalysisResult" id="formula-analysis-content" class="prose prose-sm max-w-none">
              <div class="bg-[var(--bg-secondary)] p-6 rounded-lg border border-[var(--border-primary)]">
                <div v-html="formulaAnalysisResult.replace(/\n/g, '<br/>')" />
              </div>
            </div>
            <div v-else class="text-center py-8 text-[var(--text-secondary)]">
              <p>点击"分析公式"按钮开始分析</p>
            </div>
          </div>
          <div class="px-6 py-4 border-t border-[var(--border-primary)] flex justify-end gap-2 bg-[var(--bg-secondary)] shrink-0">
            <button
              class="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
              @click="showFormulaAnalysis = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      <!-- 保存到知识库对话框 -->
      <div v-if="showSaveToKbDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" @click.self="showSaveToKbDialog = false">
        <div class="bg-[var(--bg-primary)] w-[90vw] max-w-2xl rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden">
          <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)]">
            <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <span class="material-symbols-outlined text-[var(--text-accent)]">folder</span>
              保存到知识库
            </h3>
            <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" @click="showSaveToKbDialog = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="p-6">
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-2">选择知识库</label>
              <div v-if="knowledgeBases.length === 0" class="text-sm text-[var(--text-secondary)] py-4 text-center">
                暂无可用知识库，请先创建知识库
              </div>
              <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                <div
                  v-for="kb in knowledgeBases"
                  :key="kb.id"
                  :class="[
                    'p-4 rounded-lg border cursor-pointer transition-all',
                    selectedKbId === kb.id
                      ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-secondary)]'
                  ]"
                  @click="selectedKbId = kb.id"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="material-symbols-outlined text-[20px] text-[var(--text-accent)]">folder</span>
                        <h4 class="text-sm font-medium text-[var(--text-primary)]">
                          {{ kb.name }}
                        </h4>
                        <span v-if="kb.is_public" class="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded">公开</span>
                      </div>
                      <p v-if="kb.description" class="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                        {{ kb.description }}
                      </p>
                      <div class="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
                        <span>文档: {{ kb.document_count || 0 }}</span>
                        <span>大小: {{ formatFileSize(kb.total_size || 0) }}</span>
                      </div>
                    </div>
                    <div v-if="selectedKbId === kb.id" class="ml-3">
                      <span class="material-symbols-outlined text-[var(--accent-primary)] text-[24px]">check_circle</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-2">文档标题</label>
              <input
                v-model="editorTitle"
                type="text"
                placeholder="输入文档标题"
                class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm focus:border-[var(--border-hover)] outline-none"
              >
            </div>
            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                @click="showSaveToKbDialog = false"
              >
                取消
              </button>
              <button
                :disabled="isSavingToKb || !selectedKbId"
                class="px-5 py-2 bg-[var(--accent-primary)] text-white font-medium rounded-lg text-sm hover:opacity-90 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                @click="handleSaveToKnowledgeBase"
              >
                <span v-if="isSavingToKb" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span v-else class="material-symbols-outlined text-[16px]">save</span>
                {{ isSavingToKb ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
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

:deep(.mce-content-body) {
  max-width: 100% !important;
  box-sizing: border-box !important;
}

/* KaTeX 公式样式 */
.formula-display {
  overflow-x: auto;
  padding: 10px;
}

.formula-display .katex {
  font-size: 1.2em;
}

/* 公式分析对话框样式 */
#formula-analysis-content {
  line-height: 1.8;
}

#formula-analysis-content :deep(.katex) {
  font-size: 1.1em;
}

#formula-analysis-content :deep(.katex-display) {
  margin: 20px 0;
  text-align: center;
}
</style>
