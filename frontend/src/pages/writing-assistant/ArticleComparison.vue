<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'

import { extractKeywords } from '~/utils/textProcessor'
import { useApi } from '~/composables/useApi'
import { useToast } from 'vue-toastification'
import TinyMCEEditor from './TinyMCEEditor.vue'
import StructureAnalysisPanel from './StructureAnalysisPanel.vue'
import KnowledgeBriefcase from './KnowledgeBriefcase.vue'
import MaterialLibrary from './MaterialLibrary.vue'
import AnalysisCharts from './AnalysisCharts.vue'

interface KnowledgeBase {
  id: string
  name: string
  type: string
  description?: string
}

const props = defineProps<{
  selectedKnowledgeBase?: KnowledgeBase | null
  knowledgeBases?: KnowledgeBase[]
}>()

const emit = defineEmits(['analysisComplete', 'apply-improvements', 'reference-updated', 'update:selectedKnowledgeBase'])

const runtimeConfig = useRuntimeConfig()
const { token } = useAuth()
const api = useApi()
const toast = useToast()

const editorLeftRef = ref<any>(null)
const editorRightRef = ref<any>(null)

const handleMaterialSelect = (material: any) => {
  // 默认添加到右侧编辑器（写作区）
  if (editorRightRef.value) {
    editorRightRef.value.addMaterial(material)
  }
}

// 处理参考片段更新
const handleReferenceUpdated = (references: any[]) => {
  // 发出事件通知父组件
  emit('reference-updated', references)
}

// 处理知识库更新
const handleKnowledgeBaseUpdate = (kb: KnowledgeBase) => {
  // 发出事件通知父组件
  emit('update:selectedKnowledgeBase', kb)
}

const activeRightTab = ref<'analysis' | 'knowledge' | 'material'>('analysis')
const showParamsToolbar = ref(true)
const isRewriting = ref(false)

const writingParams = ref({
  institution: 'xiaohongshu', // 默认选中小红书爆款
  sentiment: 'objective',
  targetAudience: '大众', // 默认选大众
  religion: '无宗教信仰', // 默认选无宗教信仰
  keywords: '',
  language: 'Chinese'
})



// 计算当前受众值对应的标签
const currentAudienceLabel = computed(() => {
  const option = targetAudienceOptions.find(opt => opt.value === writingParams.value.targetAudience)
  return option ? option.label : writingParams.value.targetAudience
})

// 计算当前宗教信仰值对应的标签
const currentReligionLabel = computed(() => {
  const option = religionOptions.find(opt => opt.value === writingParams.value.religion)
  return option ? option.label : writingParams.value.religion
})

const institutionOptions = [
  { label: '爆款网感分析', value: 'viral_analysis' },
  { label: '纽约时报 (NYT)', value: 'nyt' },
  { label: 'BuzzFeed', value: 'buzzfeed' },
  { label: '哈佛商业评论 (HBR)', value: 'hbr' },
  { label: '小红书爆款', value: 'xiaohongshu' }
]

const sentimentOptions = [
  { label: '客观中立', value: 'objective' },
  { label: '情绪饱满', value: 'emotional' },
  { label: '批判性', value: 'critical' },
  { label: '幽默风趣', value: 'humorous' }
]

const languageOptions = [
  { label: '中文', value: 'Chinese' },
  { label: '英文', value: 'English' },
  { label: '俄文', value: 'Russian' },
  { label: '日文', value: 'Japanese' },
  { label: '韩文', value: 'Korean' }
]

// 受众选项列表
const targetAudienceOptions = [
  { label: '大众', value: 'general' },
  { label: '95后', value: '95后' },
  { label: '职场新人', value: '职场新人' },
  { label: '创业者', value: '创业者' },
  { label: '学生', value: '学生' },
  { label: '专业人士', value: '专业人士' },
  { label: '家庭主妇', value: '家庭主妇' },
  { label: '年轻人', value: '年轻人' },
  { label: '中年人', value: '中年人' },
  { label: '老年人', value: '老年人' }
]

// 宗教信仰选项列表
const religionOptions = [
  { label: '无宗教信仰', value: 'none' },
  { label: '基督教', value: 'christianity' },
  { label: '伊斯兰教', value: 'islam' },
  { label: '佛教', value: 'buddhism' },
  { label: '道教', value: 'taoism' },
  { label: '天主教', value: 'catholicism' },
  { label: '犹太教', value: 'judaism' },
  { label: '印度教', value: 'hinduism' },
  { label: '其他', value: 'other' }
]



const leftContent = ref('')
const rightContent = ref('')
const isAnalyzingCompare = ref(false)
const isAnalyzingStructure = ref(false)
const isAnalyzingSingle = ref(false)
const isImproving = ref(false)
let improveAbortController: AbortController | null = null
const showSingleDiagnosis = ref(false)
const currentDiagnosisTarget = ref<'left' | 'right' | null>(null)
const singleTocResult = ref<any>(null)
const analysisResult = ref<any>(null)
const tocResult = ref<any>(null)
const highlightedContent = ref<{ left: string, right: string }>({ left: '', right: '' })
const isAnalysisPanelOpen = ref(true)

const activeTab = ref<'overview' | 'smart' | 'structure' | 'preview'>('overview')

const currentDiagnosisContent = computed({
  get: () => {
    if (currentDiagnosisTarget.value === 'left') return leftContent.value
    if (currentDiagnosisTarget.value === 'right') return rightContent.value
    return ''
  },
  set: (val) => {
    if (currentDiagnosisTarget.value === 'left') leftContent.value = val
    if (currentDiagnosisTarget.value === 'right') rightContent.value = val
  }
})

const closeSingleDiagnosis = () => {
  showSingleDiagnosis.value = false
  currentDiagnosisTarget.value = null
  singleTocResult.value = null
}

const openSingleDiagnosis = async (target: 'left' | 'right') => {
  currentDiagnosisTarget.value = target
  showSingleDiagnosis.value = true
  singleTocResult.value = null

  const content = target === 'left' ? leftContent.value : rightContent.value
  if (content) {
    await analyzeSingleStructure(content)
  }
}

const analyzeSingleStructure = async (content: string) => {
  if (!content) return

  // Check cache first
  const cachedResult = checkCache('toc_single', content, 'single')
  if (cachedResult) {
    singleTocResult.value = cachedResult
    return
  }

  isAnalyzingSingle.value = true

  const prompt = `请对以下文章进行图文内容的结构诊断分析，判断如果要成为一篇爆款图文（适用于小红书/公众号/头条等）需要做哪些调整。

文章内容:
${content}

请输出如下JSON格式的分析结果：
{
    "currentStructure": {
        "title": "当前标题",
        "sections": ["章节1", "章节2", "章节3"],
        "hookStrength": "钩子强度评分(1-10)",
        "readabilityScore": "可读性评分(1-10)"
    },
    "tocAnalysis": {
        "structureScore": "85%", // 结构评分
        "hookAnalysis": {
            "strengths": ["优点1", "优点2"],
            "weaknesses": ["缺点1", "缺点2"],
            "suggestions": ["建议1", "建议2"]
        },
        "flowAnalysis": {
            "pacing": "阅读节奏分析",
            "transitions": "段落衔接与逻辑跳转分析",
            "engagement": "互动引导与评论转化分析"
        }
    },
    "viralRecommendations": {
        "titleOptimizations": ["标题优化建议1", "标题优化建议2"],
        "contentAdjustments": ["内容调整建议1", "内容调整建议2"],
        "structureChanges": ["结构变更建议1", "结构变更建议2"],
        "engagementTactics": ["互动策略1", "互动策略2"]
    },
    "specificImprovements": [
        {
            "section": "具体章节",
            "currentIssue": "当前问题",
            "improvement": "改进方案",
            "expectedImpact": "预期影响"
        }
    ]
}`

  try {
    const resData = await throttledApiRequest('toc', prompt, 'You are a helpful assistant specializing in viral image-text article structure diagnosis and optimization.')

    // 获取 AI 回复内容
    const contentStr = resData.choices?.[0]?.message?.content

    if (resData.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: resData.usage.total_tokens
        }
      }))
    }

    if (!contentStr) {
      throw new Error('模型未返回有效内容')
    }

    let jsonStr = contentStr.trim()

    // 多种方式尝试提取JSON内容
    let jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    } else {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      jsonStr = jsonStr.replace(/^data:\s*/i, '')
      jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
    }

    let parsedResult
    try {
      parsedResult = JSON.parse(jsonStr)
    } catch (e) {
      console.error('JSON解析失败:', e)
      throw new Error('AI返回的格式不正确，无法解析JSON')
    }

    singleTocResult.value = parsedResult

    // Store in cache (using 'single' as distinct marker)
    storeInCache('toc_single', content, 'single', parsedResult)
    
    // 缓存结果到localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('article_single_toc_result', JSON.stringify(parsedResult))
    }
  } catch (e: any) {
    console.error('Single Structure Analysis Error:', e)
    // Error handling similar to analyzeArticleStructure...
    // For brevity, using a simple alert here, but ideally reuse the robust error handling block
    const errorMsg = e.data?.message || e.message || '未知错误'
    alert(`分析过程中发生错误: ${errorMsg}`)
  } finally {
    isAnalyzingSingle.value = false
  }
}

const hasAnyResult = computed(() => Boolean(
  analysisResult.value
  || tocResult.value
  || highlightedContent.value.left
  || highlightedContent.value.right
))

const metrics = computed(() => {
  const a = analysisResult.value || {}
  return [
    { label: '近似度', value: a.approximation || '—' },
    { label: '似然度', value: a.likelihood || '—' },
    { label: '拟合度', value: a.fit || '—' }
  ]
})

// Request deduplication and throttling
const lastRequestTime = ref(0)
const pendingRequest = ref<Promise<any> | null>(null)
const requestCache = ref<Map<string, { data: any, timestamp: number }>>(new Map())
const REQUEST_THROTTLE = 2000 // 2 seconds minimum between requests
const CACHE_DURATION = 300000 // 5 minutes cache

// Load cached content on mount
onMounted(() => {
  if (typeof window !== 'undefined') {
    const cachedLeft = localStorage.getItem('article_comparison_left')
    const cachedRight = localStorage.getItem('article_comparison_right')
    const cachedResult = localStorage.getItem('article_comparison_result')
    const cachedTocResult = localStorage.getItem('article_toc_result')
    const cachedSingleTocResult = localStorage.getItem('article_single_toc_result')
    const cachedHighlights = localStorage.getItem('article_preview')

    if (cachedLeft) leftContent.value = cachedLeft
    if (cachedRight) rightContent.value = cachedRight
    if (cachedResult) {
      try {
        let jsonStr = cachedResult.trim()

        // 处理可能包含"data:"前缀的内容
        jsonStr = jsonStr.replace(/^data:\s*/i, '')

        // 尝试直接解析
        analysisResult.value = JSON.parse(jsonStr)
      } catch (e) {
        console.error('Failed to parse cached analysis result', e)
        // 清除损坏的缓存
        localStorage.removeItem('article_comparison_result')
      }
    }
    if (cachedTocResult) {
      try {
        let jsonStr = cachedTocResult.trim()
        jsonStr = jsonStr.replace(/^data:\s*/i, '')
        tocResult.value = JSON.parse(jsonStr)
      } catch (e) {
        console.error('Failed to parse cached TOC result', e)
        localStorage.removeItem('article_toc_result')
      }
    }
    if (cachedSingleTocResult) {
      try {
        singleTocResult.value = JSON.parse(cachedSingleTocResult)
      } catch (e) {
        console.error('Failed to parse cached single TOC result', e)
        localStorage.removeItem('article_single_toc_result')
      }
    }
    
    if (cachedHighlights) {
      try {
        highlightedContent.value = JSON.parse(cachedHighlights)
      } catch (e) {
        console.error('Failed to parse cached highlights', e)
        localStorage.removeItem('article_preview')
      }
    }
  }
})

// Watch for content changes and cache them
watch([leftContent, rightContent], ([newLeft, newRight]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('article_comparison_left', newLeft)
    localStorage.setItem('article_comparison_right', newRight)
    
    // 添加额外的备份机制，防止优化迭代时内容丢失
    if (newRight && newRight.trim()) {
      localStorage.setItem('article_comparison_right_backup', newRight)
    }
  }
}, { deep: true })

// Generate cache key based on content and request type
const generateCacheKey = (type: 'analysis' | 'toc' | 'toc_single' | 'rewrite', left: string, right: string): string => {
  const content = `${type}:${left.slice(0, 120)}:${right.slice(0, 120)}`

  // FNV-1a 32-bit hash (Unicode-safe)
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return `${type}_${(hash >>> 0).toString(36)}`
}

// Check cache for existing results
const checkCache = (type: 'analysis' | 'toc' | 'toc_single' | 'rewrite', left: string, right: string) => {
  const key = generateCacheKey(type, left, right)
  const cached = requestCache.value.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  return null
}

// Store results in cache
const storeInCache = (type: 'analysis' | 'toc' | 'toc_single' | 'rewrite', left: string, right: string, data: any) => {
  const key = generateCacheKey(type, left, right)
  requestCache.value.set(key, { data, timestamp: Date.now() })
}

// Throttled API request function
const throttledApiRequest = async (type: 'analysis' | 'toc' | 'toc_single' | 'rewrite', prompt: string, systemContent: string) => {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime.value

  // Throttle requests
  if (timeSinceLastRequest < REQUEST_THROTTLE) {
    const waitTime = REQUEST_THROTTLE - timeSinceLastRequest
    console.log(`请求被限流，等待 ${waitTime}ms`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  lastRequestTime.value = Date.now()

  const resData = await api.post('/chat/completions', {
    model: 'qwen-plus',
    messages: [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3
  })

  return resData
}

let rewriteAbortController: AbortController | null = null

const oneClickRewrite = async () => {
  if (!leftContent.value) {
    alert('请先在左侧输入原文')
    return
  }

  // 如果正在改写，则取消请求
  if (isRewriting.value && rewriteAbortController) {
    rewriteAbortController.abort()
    isRewriting.value = false
    rewriteAbortController = null
    return
  }

  isRewriting.value = true
  rewriteAbortController = new AbortController()

  const prompt = `请作为一名专业的写作专家，根据以下参数重写这篇文章，使其符合目标风格和受众。

参考参数：
- 目标风格/机构：${writingParams.value.institution}
- 情感基调：${writingParams.value.sentiment}
- 目标受众：${writingParams.value.targetAudience}
- 关键词/重点：${writingParams.value.keywords}
- 文章语言：${writingParams.value.language}

原文：
${leftContent.value}

请直接输出重写后的文章内容，不要包含解释性语言。`

  try {
    const resData = await throttledApiRequest('rewrite', prompt, 'You are a professional editor and writer.')
    const content = resData.choices?.[0]?.message?.content

    if (content) {
      rightContent.value = content

      // Auto analyze after rewrite
      setTimeout(() => {
        analyzeArticles()
      }, 1000)
    }
  } catch (e: any) {
    console.error('Rewrite Error:', e)
    alert('改写过程中发生错误: ' + (e.message || '未知错误'))
  } finally {
    isRewriting.value = false
    rewriteAbortController = null
  }
}

// 保存文章相关状态
const showSaveDialog = ref(false);
const saveTitle = ref('');
const selectedKbId = ref('');
const knowledgeBases = ref<any[]>([]);
const isLoadingKb = ref(false);
const isSaving = ref(false);

// 打开保存对话框
const openSaveDialog = async () => {
  if (!rightContent.value) {
    toast.add({
      title: '内容为空',
      description: '文章B没有内容，请先生成或输入内容',
      color: 'warning'
    });
    return;
  }
  
  // 加载知识库列表
  isLoadingKb.value = true;
  try {
    const kbResponse = await api.get('/knowledge-bases');
    
    if (kbResponse.success && kbResponse.data && kbResponse.data.length > 0) {
      knowledgeBases.value = kbResponse.data;
      selectedKbId.value = kbResponse.data[0].id;
      
      // 设置默认标题
      const firstSentence = rightContent.value.split(/[。！？]/)[0]?.trim() || '';
      saveTitle.value = firstSentence ? firstSentence.substring(0, 30) : '未命名文章';
      
      showSaveDialog.value = true;
    } else {
      toast.add({
        title: '无可用知识库',
        description: '请先创建知识库',
        color: 'warning'
      });
    }
  } catch (error) {
    console.error('Failed to load knowledge bases:', error);
    toast.add({
      title: '加载知识库失败',
      color: 'error'
    });
  } finally {
    isLoadingKb.value = false;
  }
};

// 保存文章到知识库
const handleSaveArticle = async () => {
  openSaveDialog();
};

// 确认保存
const confirmSave = async () => {
  if (!saveTitle.value) {
    toast.add({
      title: '标题不能为空',
      color: 'warning'
    });
    return;
  }
  
  if (!selectedKbId.value) {
    toast.add({
      title: '请选择知识库',
      color: 'warning'
    });
    return;
  }
  
  isSaving.value = true;
  try {
    const selectedKb = knowledgeBases.value.find(kb => kb.id === selectedKbId.value);
    
    // 创建MD格式内容
    const mdContent = `# ${saveTitle.value}\n\n${rightContent.value}`;
    
    // 调用API保存到知识库
    const response = await api.post('/chat/save-to-kb', {
      kbId: selectedKbId.value,
      content: mdContent,
      title: saveTitle.value
    });
    
    if (response.success) {
      // 保存成功的提示
      toast.add({
        title: '保存成功',
        description: `文章已保存到「${selectedKb?.name}」知识库`,
        color: 'success'
      });
      showSaveDialog.value = false;
    } else {
      toast.add({
        title: '保存失败',
        description: response.message || '未知错误',
        color: 'error'
      });
    }
  } catch (error: any) {
    console.error('Failed to save article:', error);
    const errorMessage = error?.data?.message || error?.message || '网络错误或服务器异常';
    toast.add({
      title: '保存失败',
      description: errorMessage,
      color: 'error'
    });
  } finally {
    isSaving.value = false;
  }
};

// 处理优化迭代事件
const handleOptimizeIterate = (data: any) => {
  console.log('优化迭代:', data)
  // 可以在这里添加具体的优化迭代逻辑
}

// 处理应用改进事件
const handleApplyImprovements = (improvements: any) => {
  console.log('应用改进:', improvements)
  // 可以在这里添加具体的应用改进逻辑
}

const analyzeArticles = async () => {
  if (!leftContent.value && !rightContent.value) {
    alert('请至少输入一篇文章内容')
    return
  }

  // Check if already analyzing
  if (isAnalyzingCompare.value) {
    console.log('分析正在进行中，请稍候')
    return
  }

  // Check cache first
  const cachedResult = checkCache('analysis', leftContent.value, rightContent.value)
  if (cachedResult) {
    console.log('使用缓存的分析结果')
    analysisResult.value = cachedResult
    return
  }

  isAnalyzingCompare.value = true

  const prompt = `请对比分析以下两篇文章，并进行AI味儿诊断、拟合度分析和结构诊断。

参考参数：
- 目标风格：${writingParams.value.institution}
- 情感基调：${writingParams.value.sentiment}
- 目标受众：${writingParams.value.targetAudience}
- 关键词：${writingParams.value.keywords}

文章 A (原文/参考):
${leftContent.value || '（无内容）'}

文章 B (修改/对比):
${rightContent.value || '（无内容）'}

请输出如下JSON格式的分析结果：
{
    "approximation": "90%", // 近似度，百分比字符串
    "likelihood": "85%", // 似然度，百分比字符串
    "fit": "88%", // 拟合度，百分比字符串
    "aiFlavorScore": 65, // 0-100, 100表示非常像AI生成的
    "fittingScore": 80, // 0-100, 与目标风格的拟合程度
    "viralScore": 85, // 0-100, 爆款潜质
    "sentimentScore": 70, // 0-100, 情感浓度
    "smartAnalysis": {
        "specific": "具体的分析...",
        "measurable": "可衡量的分析...",
        "achievable": "可实现的分析...",
        "relevant": "相关的分析...",
        "timeBound": "有时限的分析..."
    },
    "tocAnalysis": {
        "structureScore": "85",
        "hookAnalysis": { "strengths": [], "weaknesses": [], "suggestions": [] },
        "flowAnalysis": { "pacing": "", "transitions": "", "engagement": "" }
    },
    "suggestions": [
        "优化建议1",
        "优化建议2",
        "优化建议3"
    ],
    "paragraphAnnotations": [
        {
            "paragraph": "需要标注的段落文本",
            "analysis": "标注分析内容",
            "type": "improvement" // improvement, warning, highlight
        }
    ]
}`

  try {
    const resData = await throttledApiRequest('analysis', prompt, 'You are a helpful assistant specializing in article analysis, style fitting, and AI detection.')

    // 获取 AI 回复内容
    const content = resData.choices?.[0]?.message?.content

    if (resData.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: resData.usage.total_tokens
        }
      }))
    }

    if (!content) {
      throw new Error('模型未返回有效内容')
    }

    let jsonStr = content.trim()

    // 多种方式尝试提取JSON内容
    let jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    } else {
      // 如果没有找到JSON结构，尝试移除代码块标记
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      // 处理可能包含"data:"前缀的内容
      jsonStr = jsonStr.replace(/^data:\s*/i, '')
      // 再次尝试提取JSON
      jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
    }

    try {
      const result = JSON.parse(jsonStr)
      analysisResult.value = result

      // Store in cache
      storeInCache('analysis', leftContent.value, rightContent.value, result)

      // 缓存结果到localStorage
      localStorage.setItem('article_comparison_result', JSON.stringify(result))

      // Generate highlights for annotated paragraphs
      if (result.paragraphAnnotations) {
        const leftAnnotations = result.paragraphAnnotations.filter((a: any) => !a.target || a.target === 'left')
        const rightAnnotations = result.paragraphAnnotations.filter((a: any) => a.target === 'right')

        if (leftAnnotations.length > 0) {
          highlightedContent.value.left = highlightAnnotations(leftContent.value, leftAnnotations)
        }
        if (rightAnnotations.length > 0) {
          highlightedContent.value.right = highlightAnnotations(rightContent.value, rightAnnotations)
        }

        localStorage.setItem('article_preview', JSON.stringify(highlightedContent.value))
      } else {
        highlightedContent.value = { left: '', right: '' }
        localStorage.removeItem('article_preview')
      }
    } catch (e) {
      console.error('JSON Parse Error:', e, '原始内容:', content, '提取的JSON:', jsonStr)
      throw new Error('AI返回内容无法解析为JSON格式，请重试')
    }
  } catch (e: any) {
    console.error('Analysis Error:', e)

    // Handle specific API account arrears error
    if (e.data?.error === 'API_ACCOUNT_ARREARAGE' || e.data?.code === 'Arrearage') {
      alert('API账户已欠费，暂时无法使用AI分析功能。请联系管理员充值后再试。')
      return
    }

    // Handle thinking mode errors
    if (e.data?.error === 'THINKING_MODE_NOT_SUPPORTED') {
      alert('当前模型不支持思考模式。请移除相关参数或使用支持思考模式的模型。')
      return
    }

    if (e.data?.error === 'THINKING_BUDGET_INVALID') {
      alert('思考预算参数无效。请检查thinking_budget参数的值。')
      return
    }

    // Handle stream mode errors
    if (e.data?.error === 'STREAM_MODE_REQUIRED') {
      alert('当前模型仅支持流式输出。请使用流式输出方式调用模型。')
      return
    }

    // Handle parameter range errors
    if (e.data?.error === 'PARAMETER_OUT_OF_RANGE') {
      const invalidParams = e.data?.invalidParams || []
      const errorDetails = invalidParams.map((param: any) =>
        `${param.field}: ${param.reason}\n期望: ${param.expected}\n收到: ${param.received}`
      ).join('\n\n')

      alert(`参数值超出有效范围:\n\n${errorDetails}\n\n请调整参数值。`)
      return
    }

    // Handle file errors
    if (e.data?.error === 'FILE_INVALID') {
      alert('输入文件无效。请检查文件格式、大小和内容是否符合要求。')
      return
    }

    // Handle free tier exhausted
    if (e.data?.error === 'FREE_TIER_EXHAUSTED') {
      alert('免费额度已用完。请关闭免费额度用完即停模式或升级到付费版本。')
      return
    }

    // Handle content policy violations
    if (e.data?.error === 'CONTENT_POLICY_VIOLATION') {
      alert('内容包含敏感信息。请修改输入内容后重试。')
      return
    }

    // Handle invalid parameters error
    if (e.data?.error === 'INVALID_PARAMETERS') {
      const invalidParams = e.data?.invalidParams || []
      const errorDetails = invalidParams.map((param: any) =>
        `${param.field}: ${param.reason}\n期望: ${param.expected}\n收到: ${param.received}`
      ).join('\n\n')

      alert(`请求参数无效:\n\n${errorDetails}\n\n请检查输入内容格式。`)
      return
    }

    // Handle model not found error
    if (e.data?.error === 'MODEL_NOT_FOUND') {
      alert(`模型不存在: ${e.data?.details}\n\n${e.data?.resolution}`)
      return
    }

    // Handle rate limit error
    if (e.data?.error === 'RATE_LIMIT_EXCEEDED') {
      alert('请求过于频繁，请稍后再试。\n\n建议：降低使用频率或联系管理员升级API套餐。')
      return
    }

    // Handle quota exceeded error
    if (e.data?.error === 'QUOTA_EXCEEDED') {
      alert('API配额已用完，请稍后再试。\n\n建议：等待配额重置或联系管理员升级API套餐。')
      return
    }

    // Handle service unavailable error
    if (e.data?.error === 'SERVICE_UNAVAILABLE') {
      alert('Dashscope服务暂时不可用，请稍后再试。\n\n建议：检查网络连接或联系技术支持。')
      return
    }

    // 检查是否是API不可用或响应异常
    if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
      alert('登录状态已过期，请重新登录')
    } else {
      const errorMsg = e.data?.message || e.message || '未知错误'
      const resolution = e.data?.resolution || ''
      alert(`分析过程中发生错误: ${errorMsg}${resolution ? '\n\n解决方案: ' + resolution : ''}`)
    }
  } finally {
    isAnalyzingCompare.value = false
  }
}

const analyzeArticleStructure = async () => {
  if (!leftContent.value && !rightContent.value) {
    alert('请至少输入一篇文章内容')
    return
  }

  // Check if already analyzing
  if (isAnalyzingStructure.value) {
    console.log('分析正在进行中，请稍候')
    return
  }

  // Check cache first
  const cachedResult = checkCache('toc', leftContent.value, rightContent.value)
  if (cachedResult) {
    console.log('使用缓存的TOC分析结果')
    tocResult.value = cachedResult
    return
  }

  isAnalyzingStructure.value = true

  const prompt = `请对以下文章进行图文内容的结构诊断分析，判断如果要成为一篇爆款图文（适用于小红书/公众号/头条等）需要做哪些调整。

文章内容:
${leftContent.value || rightContent.value}

请输出如下JSON格式的分析结果：
{
    "currentStructure": {
        "title": "当前标题",
        "sections": ["章节1", "章节2", "章节3"],
        "hookStrength": "钩子强度评分(1-10)",
        "readabilityScore": "可读性评分(1-10)"
    },
    "tocAnalysis": {
        "structureScore": "85%", // 结构评分
        "hookAnalysis": {
            "strengths": ["优点1", "优点2"],
            "weaknesses": ["缺点1", "缺点2"],
            "suggestions": ["建议1", "建议2"]
        },
        "flowAnalysis": {
            "pacing": "阅读节奏分析",
            "transitions": "段落衔接与逻辑跳转分析",
            "engagement": "互动引导与评论转化分析"
        }
    },
    "viralRecommendations": {
        "titleOptimizations": ["标题优化建议1", "标题优化建议2"],
        "contentAdjustments": ["内容调整建议1", "内容调整建议2"],
        "structureChanges": ["结构变更建议1", "结构变更建议2"],
        "engagementTactics": ["互动策略1", "互动策略2"]
    },
    "specificImprovements": [
        {
            "section": "具体章节",
            "currentIssue": "当前问题",
            "improvement": "改进方案",
            "expectedImpact": "预期影响"
        }
    ]
}`

  try {
    const resData = await throttledApiRequest('toc', prompt, 'You are a helpful assistant specializing in viral image-text article structure diagnosis and optimization.')

    // 获取 AI 回复内容
    const content = resData.choices?.[0]?.message?.content

    if (resData.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: resData.usage.total_tokens
        }
      }))
    }

    if (!content) {
      throw new Error('模型未返回有效内容')
    }

    let jsonStr = content.trim()

    // 多种方式尝试提取JSON内容
    let jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    } else {
      // 如果没有找到JSON结构，尝试移除代码块标记
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      // 处理可能包含"data:"前缀的内容
      jsonStr = jsonStr.replace(/^data:\s*/i, '')
      // 再次尝试提取JSON
      jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
    }

    let parsedResult
    try {
      parsedResult = JSON.parse(jsonStr)
    } catch (e) {
      console.error('JSON解析失败:', e)
      console.error('原始内容:', content)
      throw new Error('AI返回的格式不正确，无法解析JSON')
    }

    tocResult.value = parsedResult

    // Store in cache
    storeInCache('toc', leftContent.value, rightContent.value, parsedResult)

    // 缓存结果到localStorage
    localStorage.setItem('article_toc_result', JSON.stringify(parsedResult))
  } catch (e: any) {
    console.error('Structure Analysis Error:', e)

    // Handle specific API account arrears error
    if (e.data?.error === 'API_ACCOUNT_ARREARAGE' || e.data?.code === 'Arrearage') {
      alert('API账户已欠费，暂时无法使用AI分析功能。请联系管理员充值后再试。')
      return
    }

    // Handle thinking mode errors
    if (e.data?.error === 'THINKING_MODE_NOT_SUPPORTED') {
      alert('当前模型不支持思考模式。请移除相关参数或使用支持思考模式的模型。')
      return
    }

    if (e.data?.error === 'THINKING_BUDGET_INVALID') {
      alert('思考预算参数无效。请检查thinking_budget参数的值。')
      return
    }

    // Handle stream mode errors
    if (e.data?.error === 'STREAM_MODE_REQUIRED') {
      alert('当前模型仅支持流式输出。请使用流式输出方式调用模型。')
      return
    }

    // Handle parameter range errors
    if (e.data?.error === 'PARAMETER_OUT_OF_RANGE') {
      const invalidParams = e.data?.invalidParams || []
      const errorDetails = invalidParams.map((param: any) =>
        `${param.field}: ${param.reason}\n期望: ${param.expected}\n收到: ${param.received}`
      ).join('\n\n')

      alert(`参数值超出有效范围:\n\n${errorDetails}\n\n请调整参数值。`)
      return
    }

    // Handle file errors
    if (e.data?.error === 'FILE_INVALID') {
      alert('输入文件无效。请检查文件格式、大小和内容是否符合要求。')
      return
    }

    // Handle free tier exhausted
    if (e.data?.error === 'FREE_TIER_EXHAUSTED') {
      alert('免费额度已用完。请关闭免费额度用完即停模式或升级到付费版本。')
      return
    }

    // Handle content policy violations
    if (e.data?.error === 'CONTENT_POLICY_VIOLATION') {
      alert('内容包含敏感信息。请修改输入内容后重试。')
      return
    }

    // Handle invalid parameters error
    if (e.data?.error === 'INVALID_PARAMETERS') {
      const invalidParams = e.data?.invalidParams || []
      const errorDetails = invalidParams.map((param: any) =>
        `${param.field}: ${param.reason}\n期望: ${param.expected}\n收到: ${param.received}`
      ).join('\n\n')

      alert(`请求参数无效:\n\n${errorDetails}\n\n请检查输入内容格式。`)
      return
    }

    // Handle model not found error
    if (e.data?.error === 'MODEL_NOT_FOUND') {
      alert(`模型不存在: ${e.data?.details}\n\n${e.data?.resolution}`)
      return
    }

    // Handle rate limit error
    if (e.data?.error === 'RATE_LIMIT_EXCEEDED') {
      alert('请求过于频繁，请稍后再试。\n\n建议：降低使用频率或联系管理员升级API套餐。')
      return
    }

    // Handle quota exceeded error
    if (e.data?.error === 'QUOTA_EXCEEDED') {
      alert('API配额已用完，请稍后再试。\n\n建议：等待配额重置或联系管理员升级API套餐。')
      return
    }

    // Handle service unavailable error
    if (e.data?.error === 'SERVICE_UNAVAILABLE') {
      alert('Dashscope服务暂时不可用，请稍后再试。\n\n建议：检查网络连接或联系技术支持。')
      return
    }

    // 提供更友好的错误提示
    if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
      alert('登录状态已过期，请重新登录')
      // 可以在这里触发登出逻辑
    } else {
      const errorMsg = e.data?.message || e.message || '未知错误'
      const resolution = e.data?.resolution || ''
      alert(`结构诊断过程中发生错误: ${errorMsg}${resolution ? '\n\n解决方案: ' + resolution : ''}`)
    }
  }
}

// Extract keywords from optimization suggestions
const extractKeywordsFromSuggestions = (suggestions: string[]): string[] => {
  const keywords: string[] = []
  
  suggestions.forEach(suggestion => {
    // Extract keywords from Chinese text patterns
    const chineseKeywords = suggestion.match(/[\u4e00-\u9fa5]{2,6}/g) || []
    
    // Extract technical terms and important concepts
    const importantTerms = suggestion.match(/(优化|改进|增强|提升|调整|重构|重写|精简|扩充)([\u4e00-\u9fa5]+)/g) || []
    
    // Extract quoted phrases (often important concepts)
    const quotedPhrases = suggestion.match(/["'「」](.+?)["'「」]/g) || []
    
    keywords.push(...chineseKeywords, ...importantTerms, ...quotedPhrases.map(p => p.replace(/["'「」]/g, '')))
  })
  
  // Remove duplicates and filter out common words
  const commonWords = ['建议', '优化', '改进', '可以', '需要', '应该', '进行', '文章', '内容']
  return [...new Set(keywords)]
    .filter(word => word && !commonWords.includes(word) && word.length > 1)
    .slice(0, 10) // Limit to top 10 keywords
}

// Generate highlights for annotated paragraphs
const highlightAnnotations = (content: string, annotations: any[]) => {
  let highlightedContent = content

  annotations.forEach((annotation, index) => {
    const paragraph = annotation.paragraph
    if (paragraph && highlightedContent.includes(paragraph)) {
      const tooltipContent = annotation.analysis || '标注分析'
      const annotationType = annotation.type || 'improvement'

      highlightedContent = highlightedContent.replace(paragraph,
        `<span class="highlighted-annotation" data-tooltip="${tooltipContent}" data-index="${index}" data-type="${annotationType}">${paragraph}</span>`
      )
    }
  })

  return highlightedContent
}

// Handle optimize iterate functionality
const showPromptPreview = ref(false)
const currentPrompt = ref('')

const closePromptDialog = () => {
  console.log('关闭按钮被点击')
  showPromptPreview.value = false
}

// 添加遮罩层点击关闭功能
const handleBackdropClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.classList.contains('backdrop-overlay')) {
    closePromptDialog()
  }
}

// 添加键盘ESC关闭功能
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && showPromptPreview.value) {
    closePromptDialog()
  }
}

// 添加键盘监听器
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const copyPrompt = async () => {
  try {
    await navigator.clipboard.writeText(currentPrompt.value)
    alert('提示词已复制到剪贴板！')
  } catch (err) {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制')
  }
}

const showPromptDialog = async () => {
  if (!analysisResult.value?.suggestions || !rightContent.value) {
    alert('请先进行对比分析，确保有优化建议和文章B内容')
    return
  }

  const suggestions = analysisResult.value.suggestions
  const articleB = rightContent.value

  // Extract keywords from suggestions for better AI generation
  const keywordSuggestions = extractKeywordsFromSuggestions(suggestions)
  
  // Combine with existing keywords from writing parameters
  const allKeywords = [...new Set([
    ...writingParams.value.keywords.split(/[,，\s]+/).filter(Boolean),
    ...keywordSuggestions
  ])].join('、')

  // Generate the prompt without sending it
  currentPrompt.value = `作为一名专业的写作优化专家，请根据以下优化建议和关键词，对文章B进行全面的迭代优化：

优化目标：
- 风格拟合：${writingParams.value.institution}
- 情感基调：${writingParams.value.sentiment}  
- 目标受众：${writingParams.value.targetAudience}
- 核心关键词：${allKeywords}

优化建议（请逐一应用到文章中）：
${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

原文内容（文章B）：
${articleB}

优化要求：
1. 严格保持原文的核心信息、主题和基本结构
2. 充分应用所有优化建议，提升文章质量
3. 自然地融入关键词，增强内容相关性
4. 保持${writingParams.value.institution}的风格特色和${writingParams.value.sentiment}的情感表达
5. 优化阅读流畅度，确保适合${writingParams.value.targetAudience}阅读
6. 保留所有原有图片，不改变图片位置和内容

请输出优化后的完整文章内容，不需要解释说明。`

  showPromptPreview.value = true
}

const applySuggestion = async () => {
  if (!analysisResult.value?.suggestions || !rightContent.value) {
    alert('请先进行对比分析，确保有优化建议和文章B内容')
    return
  }

  const suggestions = analysisResult.value.suggestions
  const articleB = rightContent.value

  // Extract keywords from suggestions for better prompt generation
  const keywordSuggestions = extractKeywordsFromSuggestions(suggestions)
  
  // Combine with existing keywords from writing parameters
  const allKeywords = [...new Set([
    ...writingParams.value.keywords.split(/[,，\s]+/).filter(Boolean),
    ...keywordSuggestions
  ])].join('、')

  // Update writing parameters with extracted keywords
  writingParams.value.keywords = allKeywords

  // Generate the prompt
  currentPrompt.value = `作为一名专业的写作优化专家，请根据以下优化建议和关键词改进文章：

🎯 优化目标：
• 风格拟合：${writingParams.value.institution}
• 情感基调：${writingParams.value.sentiment}  
• 目标受众：${writingParams.value.targetAudience}
• 核心关键词：${allKeywords}

📋 优化建议（请逐条应用）：
${suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

📝 原文内容（文章B）：
${articleB}

✨ 优化要求：
1. 保持原文核心信息，但让表达更生动自然
2. 充分应用所有优化建议，提升文章质量
3. 自然地融入关键词，增强内容相关性
4. 保持${writingParams.value.institution}的风格特色
5. 确保适合${writingParams.value.targetAudience}阅读
6. 保留所有原有图片，不改变图片位置和内容

请直接输出优化后的完整文章内容，不需要解释说明。`

  try {
    const optimizedContent = await generateWithModel(currentPrompt.value, improveAbortController?.signal)
    
    if (optimizedContent) {
      // 更新目标内容
      if (currentDiagnosisTarget.value === 'left') {
        leftContent.value = optimizedContent
      } else {
        rightContent.value = optimizedContent
      }
      
      // 保存到localStorage
      if (typeof window !== 'undefined') {
        if (currentDiagnosisTarget.value === 'left') {
          localStorage.setItem('article_comparison_left', optimizedContent)
        } else {
          localStorage.setItem('article_comparison_right', optimizedContent)
          localStorage.setItem('article_comparison_right_backup', optimizedContent)
        }
      }
      
      // 重新分析
      await analyzeArticles()
      
      alert('一键改进成功！内容已根据优化建议进行加工创作。')
    } else {
      throw new Error('生成内容为空')
    }
    
    // 关闭弹窗
    showPromptPreview.value = false
    
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      console.error('一键改进失败:', error)
      alert(`一键改进失败: ${error.message || '未知错误'}`)
    }
  } finally {
    isImproving.value = false
    improveAbortController = null
  }
}

// 修改generateWithModel函数支持中止信号
const generateWithModel = async (prompt: string, signal?: AbortSignal): Promise<string> => {
  const runtimeConfig = useRuntimeConfig()
  
  const response = await fetch(`${runtimeConfig.public.apiBase}/writing-assistant/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token.value ? `Bearer ${token.value}` : ''
    },
    body: JSON.stringify({
      prompt: prompt,
      systemPrompt: '你是一名专业的写作优化专家，擅长根据优化建议改进文章内容。请直接输出优化后的完整文章内容，不需要解释说明。',
      temperature: 0.3,
      maxTokens: 4000,
      model: 'qwen-plus'
    }),
    signal
  }).catch(err => {
    if (err.name === 'AbortError') {
      console.log('生成请求已取消')
    }
    throw err
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || '大模型调用失败')
  }

  let responseData = await response.text()
  
  // 处理可能的SSE格式 (data: {...})
  if (responseData.startsWith('data: ')) {
    responseData = responseData.substring(6).trim()
  }
  
  // 尝试解析JSON
  let parsedData
  try {
    parsedData = JSON.parse(responseData)
  } catch (e) {
    console.error('JSON解析失败:', e, '原始响应:', responseData)
    throw new Error('模型返回格式不正确，无法解析JSON')
  }

  const content = parsedData.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('模型未返回有效内容')
  }

  return content
}
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <div class="flex flex-none items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div class="flex items-center gap-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-sky-500">auto_awesome</span>
            <h2 class="truncate text-base font-semibold text-gray-900 dark:text-gray-50">
              智能图文工作台
            </h2>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

        <button
          class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          :title="isAnalysisPanelOpen ? '收起分析面板' : '展开分析面板'"
          @click="isAnalysisPanelOpen = !isAnalysisPanelOpen"
        >
          <span class="material-symbols-outlined">{{ isAnalysisPanelOpen ? 'dock_to_right' : 'dock_to_left' }}</span>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1 min-h-0 overflow-hidden flex-col">
      <!-- Writing Parameters Toolbar -->
      <div v-if="showParamsToolbar" class="flex-none bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center gap-2 overflow-x-auto dark:bg-gray-800 dark:border-gray-700 z-20 shadow-sm">
        <div class="flex items-center gap-1.5 min-w-fit px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">风格:</span>
          <select
            v-model="writingParams.institution"
            class="text-xs bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option v-for="option in institutionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-1.5 min-w-fit px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">情感:</span>
          <select
            v-model="writingParams.sentiment"
            class="text-xs bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option v-for="option in sentimentOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-1.5 min-w-[160px] px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">受众:</span>
          <select
            v-model="writingParams.targetAudience"
            class="w-full min-w-[100px] text-xs bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="" disabled>选择受众</option>
            <option v-for="option in targetAudienceOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <!-- 宗教信仰下拉菜单 -->
        <div class="flex items-center gap-1.5 min-w-[160px] px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">宗教:</span>
          <select
            v-model="writingParams.religion"
            class="w-full min-w-[100px] text-xs bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option value="" disabled>选择宗教</option>
            <option v-for="option in religionOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-1.5 min-w-fit px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">语言:</span>
          <select
            v-model="writingParams.language"
            class="text-xs bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          >
            <option v-for="option in languageOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-1.5 min-w-[200px] flex-1 px-2 py-1.5 bg-white rounded-lg border border-gray-200 dark:bg-gray-900 dark:border-gray-700">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">关键词:</span>
          <input
            v-model="writingParams.keywords"
            placeholder="输入关键词..."
            type="text"
            class="text-xs flex-1 bg-white border border-gray-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
        </div>

        <div class="flex items-center gap-2 ml-1">
          <!-- 保存文章按钮 -->
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm bg-green-600 text-white hover:bg-green-700 hover:shadow-md"
            @click="handleSaveArticle"
          >
            <span class="material-symbols-outlined text-[14px]">save</span>
            保存文章
          </button>
          
          <button
            :class="[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm',
              isRewriting 
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-700 hover:to-orange-700 hover:shadow-md' 
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 hover:shadow-md'
            ]"
            @click="oneClickRewrite"
          >
            <span class="material-symbols-outlined text-[14px]">{{ isRewriting ? 'close' : 'auto_fix' }}</span>
            {{ isRewriting ? '取消' : '拟合' }}
          </button>
          
          <button
            :disabled="isAnalyzingCompare"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm bg-sky-600 text-white hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            @click="analyzeArticles"
          >
            <span class="material-symbols-outlined text-[14px]">{{ isAnalyzingCompare ? 'sync' : 'analytics' }}</span>
            {{ isAnalyzingCompare ? '分析中' : '分析' }}
          </button>
          
          <button
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showPromptDialog"
          >
            <span class="material-symbols-outlined text-[14px]">visibility</span>
            提示词
          </button>
        </div>
      </div>

      <div class="flex flex-1 min-h-0 overflow-hidden">
        <!-- Editors Area -->
        <div class="flex flex-1 flex-col min-w-0 bg-gray-50 p-4 dark:bg-gray-950 overflow-y-auto">
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 h-full min-h-[500px]">
            <!-- Editor A -->
            <div class="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 h-full">
              <div class="flex-none border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  文章 A（原文/参考）
                </h3>
                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                  粘贴爆款参考/原文，作为对照基准。
                </p>
              </div>
              <div class="flex-1 min-h-0 p-3">
                <TinyMCEEditor
                  id="editor-left"
                  ref="editorLeftRef"
                  v-model="leftContent"
                  :height="'100%'"
                  placeholder="请输入文章A内容…"
                />
              </div>
              <div class="flex-none border-t border-gray-100 px-4 py-2 dark:border-gray-800 flex justify-end">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                  @click="openSingleDiagnosis('left')"
                >
                  <span class="material-symbols-outlined text-[16px]">account_tree</span>
                  单篇诊断
                </button>
              </div>
            </div>

            <!-- Editor B -->
            <div class="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 h-full">
              <div class="flex-none border-b border-gray-100 px-4 py-2 dark:border-gray-800">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  文章 B（待优化/对比）
                </h3>
                <p class="text-[11px] text-gray-500 dark:text-gray-400">
                  粘贴你的改写稿或待优化稿，用于差距分析。
                </p>
              </div>
              <div class="flex-1 min-h-0 p-3">
                <TinyMCEEditor
                  id="editor-right"
                  ref="editorRightRef"
                  v-model="rightContent"
                  :height="'100%'"
                  placeholder="请输入文章B内容…"
                />
              </div>
              <div class="flex-none border-t border-gray-100 px-4 py-2 dark:border-gray-800 flex justify-end">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                  @click="openSingleDiagnosis('right')"
                >
                  <span class="material-symbols-outlined text-[16px]">account_tree</span>
                  单篇诊断
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Analysis Panel -->
        <div
          class="flex flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-all duration-300 shadow-xl z-10"
          :class="[isAnalysisPanelOpen ? 'w-[400px]' : 'w-0 overflow-hidden']"
        >
          <div class="flex flex-none flex-col border-b border-gray-100 dark:border-gray-800">
            <!-- Main Tabs Switcher -->
            <div class="flex items-center px-4 py-2 gap-4 border-b border-gray-100 dark:border-gray-800">
              <button
                class="text-sm font-semibold pb-1 border-b-2 transition-colors"
                :class="activeRightTab === 'analysis' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="activeRightTab = 'analysis'"
              >
                智能分析
              </button>
              <button
                class="text-sm font-semibold pb-1 border-b-2 transition-colors"
                :class="activeRightTab === 'knowledge' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="activeRightTab = 'knowledge'"
              >
                知识库
              </button>
              <button
                class="text-sm font-semibold pb-1 border-b-2 transition-colors"
                :class="activeRightTab === 'material' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="activeRightTab = 'material'"
              >
                素材库
              </button>
            </div>

            <!-- Sub Tabs for Analysis -->
            <div v-if="activeRightTab === 'analysis'" class="flex gap-1 px-2 py-2 overflow-x-auto no-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
              <button class="flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition" :class="activeTab === 'overview' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'" @click="activeTab = 'overview'">
                概览
              </button>
              <button class="flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition" :class="activeTab === 'smart' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'" @click="activeTab = 'smart'">
                SMART
              </button>
              <button class="flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition" :class="activeTab === 'structure' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'" @click="activeTab = 'structure'">
                结构
              </button>
              <button class="flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition" :class="activeTab === 'preview' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'" @click="activeTab = 'preview'">
                预览
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-hidden flex flex-col">
            <!-- Knowledge Briefcase -->
            <div v-if="activeRightTab === 'knowledge'" class="h-full">
              <KnowledgeBriefcase :selected-knowledge-base="props.selectedKnowledgeBase" :knowledge-bases="props.knowledgeBases" @select-material="handleMaterialSelect" @reference-updated="handleReferenceUpdated" @update:selectedKnowledgeBase="handleKnowledgeBaseUpdate" />
            </div>

            <!-- Material Library -->
            <div v-else-if="activeRightTab === 'material'" class="h-full">
              <MaterialLibrary @select-material="handleMaterialSelect" />
            </div>

            <!-- Analysis Content -->
            <div v-else class="flex-1 overflow-y-auto p-4">
              <div v-if="!analysisResult" class="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-gray-900/40">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-50">
                  暂无分析
                </div>
                <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  点击顶部“对比分析”开始
                </div>
              </div>

              <div v-else>
                <!-- Overview Tab -->
                <div v-show="activeTab === 'overview'" class="flex flex-col gap-4">
                  <AnalysisCharts :result="analysisResult" @optimize-iterate="handleOptimizeIterate" />

                  <div v-if="analysisResult.suggestions" class="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-lg dark:border-orange-800 dark:from-orange-900/20 dark:to-amber-900/20">
                    <h4 class="mb-4 text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-600 flex items-center gap-2">
                      <span class="material-symbols-outlined text-orange-500">tips_and_updates</span>
                      💡 优化建议
                    </h4>
                    <ul class="space-y-3">
                      <li v-for="(suggestion, index) in analysisResult.suggestions" :key="index" class="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 p-3 rounded-lg shadow-sm border border-orange-100 dark:border-orange-800">
                        <span class="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-md">
                          {{ Number(index) + 1 }}
                        </span>
                        <span class="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
                          {{ suggestion }}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- SMART Analysis Tab -->
                <div v-show="activeTab === 'smart'" class="space-y-4">
                  <div v-if="analysisResult.smartAnalysis" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <h4 class="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">SMART 分析</h4>
                    <div class="space-y-3 text-sm">
                      <div v-if="analysisResult.smartAnalysis.specific">
                        <span class="font-medium text-blue-600 dark:text-blue-400">具体性:</span>
                        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ analysisResult.smartAnalysis.specific }}</span>
                      </div>
                      <div v-if="analysisResult.smartAnalysis.measurable">
                        <span class="font-medium text-green-600 dark:text-green-400">可衡量:</span>
                        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ analysisResult.smartAnalysis.measurable }}</span>
                      </div>
                      <div v-if="analysisResult.smartAnalysis.achievable">
                        <span class="font-medium text-yellow-600 dark:text-yellow-400">可实现:</span>
                        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ analysisResult.smartAnalysis.achievable }}</span>
                      </div>
                      <div v-if="analysisResult.smartAnalysis.relevant">
                        <span class="font-medium text-purple-600 dark:text-purple-400">相关性:</span>
                        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ analysisResult.smartAnalysis.relevant }}</span>
                      </div>
                      <div v-if="analysisResult.smartAnalysis.timeBound">
                        <span class="font-medium text-red-600 dark:text-red-400">时限性:</span>
                        <span class="ml-2 text-gray-700 dark:text-gray-300">{{ analysisResult.smartAnalysis.timeBound }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Structure Tab -->
                <div v-show="activeTab === 'structure'" class="space-y-4">
                  <StructureAnalysisPanel 
                    :toc-result="tocResult" 
                    :is-analyzing="isAnalyzingStructure"
                    @apply-improvements="handleApplyImprovements"
                  />
                </div>

                <!-- Preview Tab -->
                <div v-show="activeTab === 'preview'" class="space-y-4">
                  <div v-if="highlightedContent.left || highlightedContent.right" class="space-y-4">
                    <div v-if="highlightedContent.left" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-50">文章 A 标注预览</h4>
                      <div class="prose prose-sm dark:prose-invert max-w-none" v-html="highlightedContent.left" />
                    </div>
                    <div v-if="highlightedContent.right" class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-50">文章 B 标注预览</h4>
                      <div class="prose prose-sm dark:prose-invert max-w-none" v-html="highlightedContent.right" />
                    </div>
                  </div>
                  <div v-else class="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-gray-900/40">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-50">暂无预览</div>
                    <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">完成分析后可查看标注预览</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Single Diagnosis Modal -->
    <Teleport to="body">
      <div v-if="showSingleDiagnosis" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-50">
              单篇结构诊断 - 文章 {{ currentDiagnosisTarget === 'left' ? 'A' : 'B' }}
            </h3>
            <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" @click="closeSingleDiagnosis">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div v-if="isAnalyzingSingle" class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
            <span class="ml-3 text-gray-600 dark:text-gray-400">正在分析...</span>
          </div>
          
          <div v-else-if="singleTocResult" class="space-y-4">
            <StructureAnalysisPanel 
              :toc-result="singleTocResult" 
              :is-analyzing="false"
              @apply-improvements="handleApplyImprovements"
            />
          </div>
          
          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            暂无分析结果
          </div>
        </div>
      </div>

      <!-- 保存文章对话框 -->
      <div v-if="showSaveDialog" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" @click.self="showSaveDialog = false">
        <div class="bg-[var(--bg-primary)] w-[90vw] max-w-md rounded-2xl border border-[var(--border-primary)] shadow-2xl overflow-hidden">
          <div class="px-6 py-4 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)]">
            <h3 class="text-lg font-medium text-[var(--text-primary)] flex items-center gap-2">
              <span class="material-symbols-outlined text-[var(--text-accent)]">save</span>
              保存文章
            </h3>
            <button class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition" @click="showSaveDialog = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="p-6">
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-2">文章标题</label>
              <input
                v-model="saveTitle"
                type="text"
                placeholder="请输入文章标题"
                class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm focus:border-[var(--border-hover)] outline-none"
              >
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-[var(--text-primary)] mb-2">选择知识库</label>
              <div v-if="isLoadingKb" class="flex items-center justify-center py-4">
                <span class="material-symbols-outlined text-[var(--text-accent)] animate-spin">sync</span>
                <span class="ml-2 text-sm text-[var(--text-secondary)]">加载中...</span>
              </div>
              <select
                v-else
                v-model="selectedKbId"
                class="w-full px-4 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded-lg text-sm focus:border-[var(--border-hover)] outline-none"
              >
                <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
                  {{ kb.name }}
                </option>
              </select>
            </div>
            <div class="flex justify-end gap-2">
              <button
                class="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                @click="showSaveDialog = false"
              >
                取消
              </button>
              <button
                :disabled="isSaving"
                class="px-5 py-2 bg-[var(--accent-primary)] text-white font-medium rounded-lg text-sm hover:opacity-90 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                @click="confirmSave"
              >
                <span v-if="isSaving" class="material-symbols-outlined text-[16px] animate-spin">sync</span>
                <span v-else class="material-symbols-outlined text-[16px]">save</span>
                {{ isSaving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 段落红色下划线标注样式 */
.highlighted-annotation {
  position: relative;
  background-color: rgba(239, 68, 68, 0.1);
  border-bottom: 2px solid #ef4444;
  border-radius: 2px;
  padding: 1px 2px;
  cursor: help;
  transition: all 0.2s ease;
}

.highlighted-annotation:hover {
  background-color: rgba(239, 68, 68, 0.2);
  border-bottom-color: #dc2626;
}

.highlighted-annotation[data-type="improvement"] {
  background-color: rgba(34, 197, 94, 0.1);
  border-bottom-color: #22c55e;
}

.highlighted-annotation[data-type="improvement"]:hover {
  background-color: rgba(34, 197, 94, 0.2);
  border-bottom-color: #16a34a;
}

.highlighted-annotation[data-type="warning"] {
  background-color: rgba(251, 191, 36, 0.1);
  border-bottom-color: #fbbf24;
}

.highlighted-annotation[data-type="warning"]:hover {
  background-color: rgba(251, 191, 36, 0.2);
  border-bottom-color: #f59e0b;
}

.highlighted-annotation[data-type="highlight"] {
  background-color: rgba(59, 130, 246, 0.1);
  border-bottom-color: #3b82f6;
}

.highlighted-annotation[data-type="highlight"]:hover {
  background-color: rgba(59, 130, 246, 0.2);
  border-bottom-color: #2563eb;
}
</style>
