<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'

const { token } = useAuth()
const runtimeConfig = useRuntimeConfig()

// 知识图谱节点和边的类型定义
interface GraphNode {
  'id': string
  'name': string
  'type': string
  'level'?: number // 层级（0-10）
  '5w2h_dimension'?: string // 5W2H维度：What/Why/Who/When/Where/How/How much
  'x': number
  'y': number
  'vx': number
  'vy': number
  'fx'?: number | null
  'fy'?: number | null
  'children'?: GraphNode[] // 子节点（用于树状结构）
  'parent'?: GraphNode | null // 父节点
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
}

const props = defineProps<{
  topic: string
  analysisData: any
  loading: boolean
  estimatedTime?: number // 预估时间（秒）
  remainingTime?: number // 剩余时间（秒）
  stages?: Array<{ id: string, label: string, progress: number }> // 分析阶段
  currentStage?: { id: string, label: string, progress: number } // 当前阶段
  receivedTokens?: number // 已接收的token数
  totalTokens?: number // 总token数
  onClose?: () => void // 原生风格的关闭回调函数
}>()

// 引导动画相关状态
const guideSteps = ref([
  { id: 'step1', label: '数据收集', icon: 'cloud_download', active: false, completed: false },
  { id: 'step2', label: '信息提取', icon: 'auto_awesome', active: false, completed: false },
  { id: 'step3', label: '趋势分析', icon: 'trending_up', active: false, completed: false },
  { id: 'step4', label: '知识图谱构建', icon: 'account_tree', active: false, completed: false },
  { id: 'step5', label: '结果生成', icon: 'description', active: false, completed: false }
])

const currentGuideStep = ref(0)
const progressBarProgress = ref(0) // 大进度条进度（0-100）
const progressBarTimer = ref<number | null>(null)
const progressBarStartTime = ref<number>(0)
const PROGRESS_DURATION = 120000 // 2分钟 = 120秒 = 120000毫秒

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'use-title', title: string): void
  (e: 'reanalyze'): void
  (e: 'copy-success', message: string): void
  (e: 'copy-error', message: string): void
  (e: 'generate-content', analysisData: any): void
  (e: 'open-editor', content: string, title: string): void
}>()

// 复制标签（带#号）
const copyKeywordsWithHashtags = async () => {
  if (!props.analysisData?.related_info?.keywords?.length) return

  // 将标签加上#号，用空格分隔
  const hashtags = props.analysisData.related_info.keywords
    .map((keyword: string) => `#${keyword}`)
    .join(' ')

  try {
    await navigator.clipboard.writeText(hashtags)
    emit('copy-success', '标签已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    emit('copy-error', '复制失败，请手动复制')
  }
}

const expandedSections = ref<Set<string>>(new Set())
const trendChartRef = ref<HTMLDivElement | null>(null)
const knowledgeGraphRef = ref<HTMLDivElement | null>(null)
const knowledgeGraphSvgRef = ref<SVGSVGElement | null>(null)
let trendChart: ECharts | null = null
const knowledgeGraphChart: ECharts | null = null
const layoutRefreshTimer: number | null = null // 布局刷新定时器

// SVG 知识图谱相关状态
const graphNodes = ref<GraphNode[]>([])
const graphLinks = ref<GraphLink[]>([])
const selectedNode = ref<GraphNode | null>(null)
const hoveredNode = ref<GraphNode | null>(null)
const hoveredLink = ref<GraphLink | null>(null)
const svgTransform = ref({ x: 0, y: 0, scale: 1 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const draggedNode = ref<GraphNode | null>(null)
let animationFrameId: number | null = null
const forceSimulation: any = null

// 深度挖掘相关状态
const isDeepMining = ref(false)
const deepMiningResult = ref<string>('')
const showDeepMiningPanel = ref(false)
const nodeClickStartTime = ref(0)
const nodeClickPosition = ref({ x: 0, y: 0 })
const CLICK_THRESHOLD = 200 // 200ms内视为点击，超过视为拖拽
const MOVE_THRESHOLD = 5 // 移动超过5px视为拖拽

// 手风琴效果：切换展开/收起（单选模式：点击一个分项时，关闭其他分项）
const toggleSection = (section: string) => {
  // 创建新的 Set 以确保响应式更新
  const newSet = new Set<string>(expandedSections.value)

  if (newSet.has(section)) {
    // 如果当前分项已展开，则关闭它
    newSet.delete(section)
  } else {
    // 如果当前分项未展开，则先清空所有，再展开当前分项（单选模式）
    newSet.clear()
    newSet.add(section)
  }

  // 重新赋值以触发响应式更新
  expandedSections.value = newSet
}

// 初始化趋势图表
const initTrendChart = () => {
  if (!trendChartRef.value || !props.analysisData?.trend_prediction) return

  try {
    const days = props.analysisData.trend_prediction.days || []
    if (days.length === 0) return

    // 格式化日期显示：确保日期格式一致且清晰
    const dates = days.map((d: any) => {
      if (d.date) {
        // 如果已经是 YYYY-MM-DD 格式，直接使用
        if (/^\d{4}-\d{2}-\d{2}$/.test(d.date)) {
          return d.date
        }
        // 尝试解析其他格式的日期
        try {
          const date = new Date(d.date)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
        } catch (e) {
          // 解析失败，继续使用原始值
        }
        return d.date
      }
      if (d.day) return `第${d.day}天`
      return ''
    }).filter(Boolean)
    const heats = days.map((d: any) => d.predicted_heat || 0)
    const trends = days.map((d: any) => d.trend || '平稳')

    if (dates.length === 0 || heats.length === 0) return

    // 如果图表已存在，先调整大小，然后更新数据
    if (trendChart) {
      // 确保容器有尺寸
      if (trendChartRef.value.clientWidth === 0 || trendChartRef.value.clientHeight === 0) {
        // 如果容器还没有尺寸，延迟初始化
        setTimeout(() => {
          initTrendChart()
        }, 100)
        return
      }
      trendChart.resize()
    } else {
      // 确保容器有尺寸
      if (trendChartRef.value.clientWidth === 0 || trendChartRef.value.clientHeight === 0) {
        // 如果容器还没有尺寸，延迟初始化
        setTimeout(() => {
          initTrendChart()
        }, 100)
        return
      }
      // 创建新图表
      trendChart = echarts.init(trendChartRef.value)
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        textStyle: { color: '#fff', fontSize: 18 },
        formatter: (params: any) => {
          const param = params[0]
          const index = param.dataIndex
          return `<div style="font-size: 18px; line-height: 1.8;">
          <div style="font-weight: bold; margin-bottom: 4px;">${dates[index]}</div>
          <div>热度: <span style="font-weight: bold;">${param.value}</span></div>
          <div>趋势: ${trends[index]}</div>
        </div>`
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLine: { lineStyle: { color: '#666', width: 2 } },
        axisLabel: { color: '#999', fontSize: 18, fontWeight: 'normal' }
      },
      yAxis: {
        type: 'value',
        name: '热度指数',
        axisLine: { lineStyle: { color: '#666', width: 2 } },
        axisLabel: { color: '#999', fontSize: 18, fontWeight: 'normal' },
        nameTextStyle: { color: '#999', fontSize: 20, fontWeight: 'bold' },
        splitLine: { lineStyle: { color: '#333', type: 'dashed', width: 1 } }
      },
      series: [
        {
          name: '预测热度',
          type: 'line',
          smooth: true,
          data: heats,
          lineStyle: { color: '#f59e0b', width: 3 },
          itemStyle: { color: '#f59e0b' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
                { offset: 1, color: 'rgba(245, 158, 11, 0.05)' }
              ]
            }
          },
          symbol: 'circle',
          symbolSize: 10,
          emphasis: {
            focus: 'series',
            itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 2 }
          }
        }
      ]
    }

    trendChart.setOption(option, true) // 使用 true 参数表示不合并，完全替换配置
  } catch (error) {
    console.error('初始化趋势图表失败:', error)
  }
}

// 初始化知识图谱 - 使用 SVG 实现
const initKnowledgeGraph = () => {
  if (!props.analysisData?.knowledge_graph) {
    console.warn('[知识图谱] 数据不存在')
    return
  }

  if (!knowledgeGraphSvgRef.value) {
    console.warn('[知识图谱] SVG 引用不存在，等待 DOM 渲染')
    return
  }

  try {
    // 停止之前的动画
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    const entities = props.analysisData.knowledge_graph.entities || []
    const relations = props.analysisData.knowledge_graph.relations || []

    if (entities.length === 0) {
      console.warn('[知识图谱] 实体为空')
      return
    }

    console.log('[知识图谱] 开始初始化', {
      实体数量: entities.length,
      关系数量: relations.length,
      实体列表: entities.map(e => e.name),
      关系列表: relations.map(r => `${r.source} -> ${r.target}`)
    })

    // 获取容器尺寸
    const container = knowledgeGraphSvgRef.value.parentElement
    if (!container) {
      console.warn('[知识图谱] 容器元素不存在')
      return
    }

    const width = container.clientWidth || 800
    const height = container.clientHeight || 500

    console.log('[知识图谱] 容器尺寸', { 宽度: width, 高度: height })

    // 初始化 SVG 尺寸
    knowledgeGraphSvgRef.value.setAttribute('width', String(width))
    knowledgeGraphSvgRef.value.setAttribute('height', String(height))
    knowledgeGraphSvgRef.value.setAttribute('viewBox', `0 0 ${width} ${height}`)

    // 构建节点数据（包含level和5W2H维度信息）
    const nodes: GraphNode[] = entities.map((e: any, index: number) => {
      return {
        'id': e.id || `节点_${index}`,
        'name': e.name,
        'type': e.type || 'concept',
        'level': e.level !== undefined ? e.level : 0, // 使用level字段，默认为0
        '5w2h_dimension': e['5w2h_dimension'] || e['5W2H_dimension'] || '', // 5W2H维度
        'x': 0, // 初始位置，将在树状布局中计算
        'y': 0,
        'vx': 0,
        'vy': 0,
        'fx': null,
        'fy': null,
        'children': [],
        'parent': null
      }
    })

    // 构建边数据（将字符串 ID 转换为节点引用）
    const links: GraphLink[] = relations.map((r: any) => {
      const sourceNode = nodes.find(n => n.id === r.source || n.name === r.source)
      const targetNode = nodes.find(n => n.id === r.target || n.name === r.target)

      return {
        source: sourceNode || r.source,
        target: targetNode || r.target,
        type: r.type || ''
      }
    }).filter((link) => {
      // 过滤掉无效的边（源节点或目标节点不存在）
      return typeof link.source !== 'string' && typeof link.target !== 'string'
    })

    // 构建树状结构（基于level和关系）
    // 找到根节点（level 0的节点，如果没有则选择第一个）
    const rootNodes = nodes.filter(n => n.level === 0)
    const rootNode = rootNodes.length > 0 ? rootNodes[0] : nodes[0]

    // 构建父子关系
    links.forEach((link) => {
      if (typeof link.source !== 'string' && typeof link.target !== 'string') {
        const source = link.source as GraphNode
        const target = link.target as GraphNode
        // 如果source的level小于target的level，则source是target的父节点
        if (source.level !== undefined && target.level !== undefined && source.level < target.level) {
          if (!source.children) source.children = []
          source.children.push(target)
          target.parent = source
        } else if (source.level !== undefined && target.level !== undefined && target.level < source.level) {
          if (!target.children) target.children = []
          target.children.push(source)
          source.parent = target
        }
      }
    })

    graphNodes.value = nodes
    graphLinks.value = links

    console.log('[知识图谱] 节点和边已构建（思维导图风格）', {
      节点数量: nodes.length,
      边数量: links.length,
      最大层级: Math.max(...nodes.map(n => n.level || 0))
    })

    // 使用树状布局算法
    layoutMindMap(rootNode, width, height)

    // 渲染图谱
    renderGraph()

    console.log('[知识图谱] 初始化完成')
  } catch (error) {
    console.error('[知识图谱] 初始化失败:', error)
  }
}

// 思维导图树状布局算法
const layoutMindMap = (rootNode: GraphNode, width: number, height: number) => {
  if (!rootNode) return

  const nodeSpacing = { x: 200, y: 120 } // 节点间距
  const startX = width / 2 // 中心X坐标
  const startY = 80 // 顶部Y坐标

  // 递归计算每个节点的位置
  const layoutNode = (node: GraphNode, x: number, y: number, level: number) => {
    node.x = x
    node.y = y
    node.fx = x // 固定位置
    node.fy = y

    if (!node.children || node.children.length === 0) return

    // 计算子节点的总宽度
    const childrenCount = node.children.length
    const totalWidth = (childrenCount - 1) * nodeSpacing.x
    const startChildX = x - totalWidth / 2

    // 布局子节点
    node.children.forEach((child, index) => {
      const childX = startChildX + index * nodeSpacing.x
      const childY = y + nodeSpacing.y
      layoutNode(child, childX, childY, level + 1)
    })
  }

  // 从根节点开始布局
  layoutNode(rootNode, startX, startY, 0)

  // 处理所有节点，确保每个节点都有位置
  graphNodes.value.forEach((node) => {
    if (node.fx === null || node.fy === null) {
      // 如果节点没有通过树状结构布局，使用默认位置
      const level = node.level || 0
      node.x = startX + (Math.random() - 0.5) * 400
      node.y = startY + level * nodeSpacing.y
      node.fx = node.x
      node.fy = node.y
    }
  })

  console.log('[知识图谱] 思维导图布局完成')
}

// 力导向布局算法（保留作为备用）
const startForceSimulation = () => {
  if (!knowledgeGraphSvgRef.value) return

  const width = knowledgeGraphSvgRef.value.clientWidth || 800
  const height = knowledgeGraphSvgRef.value.clientHeight || 500
  const centerX = width / 2
  const centerY = height / 2

  // 力导向布局参数 - 优化防止堆叠
  const alpha = 1 // 初始温度
  const alphaDecay = 0.015 // 温度衰减率（更慢，让布局更充分）
  const alphaMin = 0.0005 // 最小温度（更低，让布局更稳定）
  // 根据节点数量动态调整斥力，节点越多斥力越大
  const nodeCount = graphNodes.value.length
  const chargeStrength = -800 - (nodeCount * 50) // 节点间斥力（大幅增加）
  const linkDistance = 200 + (nodeCount * 10) // 理想边长度（增加，让节点更分散）
  const linkStrength = 0.3 // 边强度（降低，让斥力更占主导）
  const gravityStrength = 0.05 // 重力强度（降低，减少向中心聚集）
  const minDistance = 80 // 最小节点距离，防止重叠

  let currentAlpha = alpha
  let iteration = 0

  const simulate = () => {
    if (currentAlpha < alphaMin || !knowledgeGraphSvgRef.value) {
      return
    }

    const nodes = graphNodes.value
    const links = graphLinks.value

    // 1. 重置速度
    nodes.forEach((node) => {
      node.vx = 0
      node.vy = 0
    })

    // 2. 计算节点间斥力（电荷力）- 增强版，防止堆叠
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1

        // 如果距离太近，强制推开
        if (distance < minDistance) {
          const pushForce = (minDistance - distance) * 2 * currentAlpha
          const fx = (dx / distance) * pushForce
          const fy = (dy / distance) * pushForce

          a.vx -= fx
          a.vy -= fy
          b.vx += fx
          b.vy += fy
        }

        // 常规斥力（使用平方反比定律）
        const force = (chargeStrength * currentAlpha) / (distance * distance)

        const fx = (dx / distance) * force
        const fy = (dy / distance) * force

        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }

    // 3. 计算边的引力
    links.forEach((link) => {
      const source = typeof link.source === 'string'
        ? graphNodes.value.find(n => n.id === link.source)
        : link.source
      const target = typeof link.target === 'string'
        ? graphNodes.value.find(n => n.id === link.target)
        : link.target

      if (!source || !target) return

      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      const difference = distance - linkDistance
      const force = difference * linkStrength * currentAlpha

      const fx = (dx / distance) * force
      const fy = (dy / distance) * force

      source.vx += fx
      source.vy += fy
      target.vx -= fx
      target.vy -= fy
    })

    // 4. 应用重力（向中心）
    nodes.forEach((node) => {
      if (node.fx === null && node.fy === null) {
        const dx = centerX - node.x
        const dy = centerY - node.y
        node.vx += dx * gravityStrength * currentAlpha
        node.vy += dy * gravityStrength * currentAlpha
      }
    })

    // 5. 应用速度阻尼（防止节点移动过快）
    const damping = 0.6
    nodes.forEach((node) => {
      node.vx *= damping
      node.vy *= damping
    })

    // 6. 更新位置
    nodes.forEach((node) => {
      if (node.fx === null && node.fy === null) {
        node.x += node.vx
        node.y += node.vy

        // 边界约束（增加边距，给节点更多空间）
        const padding = 80
        node.x = Math.max(padding, Math.min(width - padding, node.x))
        node.y = Math.max(padding, Math.min(height - padding, node.y))
      }
    })

    // 7. 检查并修复节点重叠
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.sqrt(dx * dx + dy * dy) || 1

        if (distance < minDistance) {
          // 强制分离重叠的节点
          const separation = (minDistance - distance) / 2
          const angle = Math.atan2(dy, dx)

          if (a.fx === null && a.fy === null) {
            a.x -= Math.cos(angle) * separation
            a.y -= Math.sin(angle) * separation
          }
          if (b.fx === null && b.fy === null) {
            b.x += Math.cos(angle) * separation
            b.y += Math.sin(angle) * separation
          }
        }
      }
    }

    // 8. 衰减温度
    currentAlpha *= (1 - alphaDecay)
    iteration++

    // 每次模拟后都渲染一次（但降低渲染频率以提高性能）
    if (iteration % 2 === 0) {
      renderGraph()
    }

    // 继续模拟（增加最大迭代次数，让布局更充分）
    const maxIterations = 500
    if (currentAlpha >= alphaMin && iteration < maxIterations) {
      animationFrameId = requestAnimationFrame(simulate)
    } else {
      // 布局完成后，再渲染一次最终状态
      animationFrameId = null
      renderGraph()
      console.log('[知识图谱] 布局完成', { 迭代次数: iteration })
    }
  }

  simulate()
}

// 渲染图谱
const renderGraph = () => {
  if (!knowledgeGraphSvgRef.value) return

  const render = () => {
    if (!knowledgeGraphSvgRef.value) return

    // 清空 SVG（保留 g 元素）
    const g = knowledgeGraphSvgRef.value.querySelector('g.图谱内容')
    if (g) {
      g.innerHTML = ''
    } else {
      const newG = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      newG.setAttribute('class', '图谱内容')
      newG.setAttribute('transform', `translate(${svgTransform.value.x}, ${svgTransform.value.y}) scale(${svgTransform.value.scale})`)
      knowledgeGraphSvgRef.value.appendChild(newG)
    }

    const graphG = knowledgeGraphSvgRef.value.querySelector('g.图谱内容') as SVGGElement
    if (!graphG) return

    // 更新 transform
    graphG.setAttribute('transform', `translate(${svgTransform.value.x}, ${svgTransform.value.y}) scale(${svgTransform.value.scale})`)

    // 渲染边
    graphLinks.value.forEach((link) => {
      const source = typeof link.source === 'string'
        ? graphNodes.value.find(n => n.id === link.source)
        : link.source
      const target = typeof link.target === 'string'
        ? graphNodes.value.find(n => n.id === link.target)
        : link.target

      if (!source || !target) return

      // 麦肯锡风格：边更简洁专业
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(source.x))
      line.setAttribute('y1', String(source.y))
      line.setAttribute('x2', String(target.x))
      line.setAttribute('y2', String(target.y))
      // 麦肯锡风格：使用更专业的灰色系
      const isSelectedEdge = selectedNode.value && (
        (typeof source === 'object' && source.id === selectedNode.value.id)
        || (typeof target === 'object' && target.id === selectedNode.value.id)
      )
      line.setAttribute('stroke', isSelectedEdge ? '#4a5568' : hoveredLink.value === link ? '#718096' : '#a0aec0')
      line.setAttribute('stroke-width', isSelectedEdge ? '2.5' : hoveredLink.value === link ? '2' : '1.5')
      line.setAttribute('opacity', isSelectedEdge ? '1' : '0.6')
      line.setAttribute('class', '图谱边')
      line.setAttribute('data-link-type', link.type)

      graphG.appendChild(line)

      // 添加标签
      if (link.type) {
        const midX = (source.x + target.x) / 2
        const midY = (source.y + target.y) / 2

        // 翻译关系类型为中文
        const translatedType = translateRelationType(link.type)

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.textContent = translatedType
        text.setAttribute('x', String(midX))
        text.setAttribute('y', String(midY - 5))
        text.setAttribute('fill', '#ffffff')
        text.setAttribute('font-size', '11')
        text.setAttribute('font-weight', 'bold')
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('dominant-baseline', 'middle')
        text.setAttribute('class', '图谱边标签')
        text.setAttribute('opacity', '0') // 先隐藏，计算后再显示

        // 先添加到 DOM 才能计算 bbox
        graphG.appendChild(text)

        // 计算文本背景
        try {
          const bbox = text.getBBox()
          const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          textBg.setAttribute('x', String(bbox.x - 4))
          textBg.setAttribute('y', String(bbox.y - 2))
          textBg.setAttribute('width', String(bbox.width + 8))
          textBg.setAttribute('height', String(bbox.height + 4))
          textBg.setAttribute('fill', 'rgba(0, 0, 0, 0.8)')
          textBg.setAttribute('rx', '4')
          textBg.setAttribute('stroke', '#f59e0b')
          textBg.setAttribute('stroke-width', '1')

          // 将背景插入到文本之前
          graphG.insertBefore(textBg, text)
          text.setAttribute('opacity', '1') // 显示文本
        } catch (e) {
          // 如果 getBBox 失败，使用估算值
          const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          const estimatedWidth = link.type.length * 7
          const estimatedHeight = 14
          textBg.setAttribute('x', String(midX - estimatedWidth / 2 - 4))
          textBg.setAttribute('y', String(midY - 5 - estimatedHeight / 2 - 2))
          textBg.setAttribute('width', String(estimatedWidth + 8))
          textBg.setAttribute('height', String(estimatedHeight + 4))
          textBg.setAttribute('fill', 'rgba(0, 0, 0, 0.8)')
          textBg.setAttribute('rx', '4')
          textBg.setAttribute('stroke', '#f59e0b')
          textBg.setAttribute('stroke-width', '1')
          graphG.insertBefore(textBg, text)
          text.setAttribute('opacity', '1')
        }
      }
    })

    // 渲染节点（麦肯锡风格）
    graphNodes.value.forEach((node) => {
      const nodeColor = getNodeColor(node.type)
      const isSelected = selectedNode.value?.id === node.id
      const isHovered = hoveredNode.value?.id === node.id

      // 麦肯锡风格：选中节点显示光圈效果
      if (isSelected) {
        // 外圈光圈（动画效果）
        for (let i = 0; i < 3; i++) {
          const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          const radius = 40 + i * 8
          const opacity = 0.3 - i * 0.1
          halo.setAttribute('cx', String(node.x))
          halo.setAttribute('cy', String(node.y))
          halo.setAttribute('r', String(radius))
          halo.setAttribute('fill', 'none')
          halo.setAttribute('stroke', nodeColor)
          halo.setAttribute('stroke-width', '2')
          halo.setAttribute('opacity', String(opacity))
          halo.setAttribute('class', '节点光圈')
          halo.style.animation = `pulse 2s ease-in-out infinite ${i * 0.3}s`
          graphG.appendChild(halo)
        }
      }

      // 节点圆圈（麦肯锡风格：更简洁、专业）
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', String(node.x))
      circle.setAttribute('cy', String(node.y))
      circle.setAttribute('r', isSelected ? '32' : isHovered ? '28' : '26')
      // 麦肯锡风格：使用更专业的颜色和样式
      circle.setAttribute('fill', isSelected ? nodeColor : 'rgba(255, 255, 255, 0.95)')
      circle.setAttribute('stroke', isSelected ? nodeColor : '#4a5568')
      circle.setAttribute('stroke-width', isSelected ? '3' : '2')
      circle.setAttribute('opacity', '1')
      circle.setAttribute('class', '图谱节点')
      circle.setAttribute('data-node-id', node.id)
      circle.setAttribute('style', isSelected
        ? `filter: drop-shadow(0 4px 8px ${nodeColor}60)`
        : `filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2))`)
      circle.style.cursor = 'pointer'

      // 节点标签（麦肯锡风格：更专业的样式，包含5W2H维度信息）
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      const nodeLabel = node['5w2h_dimension']
        ? `${node.name} [${node['5w2h_dimension']}]`
        : node.name
      text.textContent = nodeLabel
      text.setAttribute('x', String(node.x))
      text.setAttribute('y', String(node.y + 45))
      text.setAttribute('fill', isSelected ? nodeColor : '#2d3748')
      text.setAttribute('font-size', isSelected ? '15' : isHovered ? '14' : '13')
      text.setAttribute('font-weight', isSelected ? 'bold' : '600')
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('class', '图谱节点标签')
      text.setAttribute('data-node-id', node.id)
      text.setAttribute('opacity', '0') // 先隐藏，计算后再显示
      text.style.cursor = 'pointer'

      // 先添加到 DOM 才能计算 bbox
      graphG.appendChild(text)

      // 计算文本背景
      try {
        const bbox = text.getBBox()
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        textBg.setAttribute('x', String(bbox.x - 6))
        textBg.setAttribute('y', String(bbox.y - 3))
        textBg.setAttribute('width', String(bbox.width + 12))
        textBg.setAttribute('height', String(bbox.height + 6))
        // 麦肯锡风格：标签背景更简洁
        textBg.setAttribute('fill', isSelected ? `${nodeColor}15` : 'rgba(255, 255, 255, 0.95)')
        textBg.setAttribute('rx', '6')
        textBg.setAttribute('stroke', isSelected ? nodeColor : '#cbd5e0')
        textBg.setAttribute('stroke-width', isSelected ? '2' : '1')

        // 将背景插入到文本之前
        graphG.insertBefore(textBg, text)
        text.setAttribute('opacity', '1') // 显示文本
      } catch (e) {
        // 如果 getBBox 失败，使用估算值
        const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        const estimatedWidth = node.name.length * 8
        const estimatedHeight = 18
        textBg.setAttribute('x', String(node.x - estimatedWidth / 2 - 6))
        textBg.setAttribute('y', String(node.y + 45 - estimatedHeight / 2 - 3))
        textBg.setAttribute('width', String(estimatedWidth + 12))
        textBg.setAttribute('height', String(estimatedHeight + 6))
        // 麦肯锡风格：标签背景更简洁
        textBg.setAttribute('fill', isSelected ? `${nodeColor}15` : 'rgba(255, 255, 255, 0.95)')
        textBg.setAttribute('rx', '6')
        textBg.setAttribute('stroke', isSelected ? nodeColor : '#cbd5e0')
        textBg.setAttribute('stroke-width', isSelected ? '2' : '1')
        graphG.insertBefore(textBg, text)
        text.setAttribute('opacity', '1')
      }

      graphG.appendChild(circle)
    })
  }

  render()
}

// 获取节点颜色（支持中英文类型）
const getNodeColor = (type: string) => {
  const colors: Record<string, string> = {
    person: '#f59e0b',
    event: '#3b82f6',
    concept: '#10b981',
    人物: '#f59e0b',
    事件: '#3b82f6',
    概念: '#10b981'
  }
  return colors[type] || '#6b7280'
}

// 翻译关系类型为中文
const translateRelationType = (type: string): string => {
  if (!type) return ''

  // 如果已经是中文，直接返回
  if (/[\u4e00-\u9fa5]/.test(type)) {
    return type
  }

  // 英文关系类型翻译映射
  const translationMap: Record<string, string> = {
    'supports': '支持',
    'stabilizes': '稳定',
    'released': '释放',
    'measures': '措施',
    'operates': '操作',
    'interact': '交互',
    'interacts': '交互',
    'Hold': '持有',
    'Operate': '操作',
    'ref.': '参考',
    'ref': '参考',
    'relates': '关联',
    'relates to': '关联',
    'contains': '包含',
    'belongs to': '属于',
    'causes': '导致',
    'affects': '影响',
    'influences': '影响',
    'creates': '创建',
    'produces': '产生',
    'uses': '使用',
    'requires': '需要',
    'depends on': '依赖',
    'part of': '部分',
    'related to': '相关',
    'connected to': '连接',
    'associated with': '关联',
    'similar to': '相似',
    'opposite to': '相反',
    'precedes': '先于',
    'follows': '跟随',
    'enables': '启用',
    'prevents': '阻止',
    'improves': '改善',
    'reduces': '减少',
    'increases': '增加',
    'decreases': '减少',
    'manages': '管理',
    'controls': '控制',
    'regulates': '调节',
    'governs': '治理',
    'owns': '拥有',
    'has': '拥有',
    'is': '是',
    'was': '曾是',
    'will be': '将是'
  }

  // 转换为小写进行匹配
  const lowerType = type.toLowerCase().trim()

  // 精确匹配
  if (translationMap[lowerType]) {
    return translationMap[lowerType]
  }

  // 部分匹配（处理带空格的短语）
  for (const [en, zh] of Object.entries(translationMap)) {
    if (lowerType.includes(en) || en.includes(lowerType)) {
      return zh
    }
  }

  // 如果没有匹配，返回原值（可能是中文或未知的英文）
  return type
}

// SVG 知识图谱交互处理
const handleNodeClick = (event: MouseEvent, node: GraphNode) => {
  event.stopPropagation()
  // 切换节点选择状态
  if (selectedNode.value?.id === node.id) {
    selectedNode.value = null
    showDeepMiningPanel.value = false
    deepMiningResult.value = ''
  } else {
    selectedNode.value = node
    // 如果已有结果，保持显示；否则隐藏结果面板
    if (!deepMiningResult.value) {
      showDeepMiningPanel.value = false
    }
  }
  renderGraph()
}

const handleNodeMouseDown = (event: MouseEvent, node: GraphNode) => {
  event.stopPropagation()
  // 记录点击开始时间和位置
  nodeClickStartTime.value = Date.now()
  nodeClickPosition.value = { x: event.clientX, y: event.clientY }
  isDragging.value = true
  draggedNode.value = node
  dragStart.value = { x: event.clientX, y: event.clientY }
  // 固定节点位置，开始拖拽
  node.fx = node.x
  node.fy = node.y
}

const handleNodeMouseMove = (event: MouseEvent) => {
  if (isDragging.value && draggedNode.value) {
    // 获取SVG坐标
    const svg = knowledgeGraphSvgRef.value
    if (!svg) return

    const svgPoint = svg.createSVGPoint()
    svgPoint.x = event.clientX
    svgPoint.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (ctm) {
      const invertedCTM = ctm.inverse()
      const svgCoord = svgPoint.matrixTransform(invertedCTM)

      // 考虑transform的偏移和缩放
      const transformedX = (svgCoord.x - svgTransform.value.x) / svgTransform.value.scale
      const transformedY = (svgCoord.y - svgTransform.value.y) / svgTransform.value.scale

      draggedNode.value.fx = transformedX
      draggedNode.value.fy = transformedY
      draggedNode.value.x = transformedX
      draggedNode.value.y = transformedY
    } else {
      // 降级方案：使用相对计算
      const dx = (event.clientX - dragStart.value.x) / svgTransform.value.scale
      const dy = (event.clientY - dragStart.value.y) / svgTransform.value.scale
      draggedNode.value.fx = (draggedNode.value.fx || draggedNode.value.x) + dx
      draggedNode.value.fy = (draggedNode.value.fy || draggedNode.value.y) + dy
      draggedNode.value.x = draggedNode.value.fx
      draggedNode.value.y = draggedNode.value.fy
      dragStart.value = { x: event.clientX, y: event.clientY }
    }
    renderGraph()
  }
}

const handleNodeMouseUp = (event?: MouseEvent) => {
  if (draggedNode.value) {
    const clickDuration = Date.now() - nodeClickStartTime.value
    const movedDistance = event
      ? Math.sqrt(
          Math.pow(event.clientX - nodeClickPosition.value.x, 2)
          + Math.pow(event.clientY - nodeClickPosition.value.y, 2)
        )
      : 0

    // 如果是短时间点击且移动距离小，视为点击选择
    if (clickDuration < CLICK_THRESHOLD && movedDistance < MOVE_THRESHOLD) {
      handleNodeClick(event || new MouseEvent('click'), draggedNode.value)
    }

    // 保持节点在当前位置（固定位置），用户可以通过一键布局重新布局
  }
  isDragging.value = false
  draggedNode.value = null
}

// SVG 缩放和平移
const handleSvgWheel = (event: WheelEvent) => {
  event.preventDefault()
  event.stopPropagation() // 阻止事件冒泡，防止关闭模态框
  const delta = event.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.5, Math.min(2, svgTransform.value.scale * delta))
  svgTransform.value.scale = newScale
  renderGraph()
}

const handleSvgMouseDown = (event: MouseEvent) => {
  // 阻止事件冒泡，防止关闭模态框
  event.stopPropagation()

  if (event.target && (event.target as Element).classList.contains('图谱节点')) {
    const nodeId = (event.target as Element).getAttribute('data-node-id')
    const node = graphNodes.value.find(n => n.id === nodeId)
    if (node) {
      handleNodeMouseDown(event, node)
    }
  } else if (event.target && (event.target as Element).classList.contains('图谱节点标签')) {
    // 点击节点标签，选择对应节点
    const textElement = event.target as SVGTextElement
    const nodeId = textElement.getAttribute('data-node-id')
      || textElement.previousElementSibling?.getAttribute('data-node-id')
    if (nodeId) {
      const node = graphNodes.value.find(n => n.id === nodeId)
      if (node) {
        handleNodeClick(event, node)
      }
    }
    return
  } else if (event.target && (
    (event.target as Element).classList.contains('图谱边')
    || (event.target as Element).classList.contains('图谱边标签')
  )) {
    // 点击边或边标签，不执行任何操作，只阻止冒泡
    return
  } else {
    // 点击空白区域，取消节点选择
    selectedNode.value = null
    renderGraph()
    // 开始平移
    isDragging.value = true
    dragStart.value = { x: event.clientX, y: event.clientY }
  }
}

const handleSvgMouseMove = (event: MouseEvent) => {
  // 阻止事件冒泡
  event.stopPropagation()

  if (isDragging.value) {
    if (draggedNode.value) {
      handleNodeMouseMove(event)
    } else {
      // 平移整个图谱
      const dx = event.clientX - dragStart.value.x
      const dy = event.clientY - dragStart.value.y
      svgTransform.value.x += dx
      svgTransform.value.y += dy
      dragStart.value = { x: event.clientX, y: event.clientY }
      renderGraph()
    }
  } else {
    // 悬停效果
    const target = event.target as Element
    if (target && target.classList.contains('图谱节点')) {
      const nodeId = target.getAttribute('data-node-id')
      hoveredNode.value = graphNodes.value.find(n => n.id === nodeId) || null
    } else if (target && target.classList.contains('图谱边')) {
      const linkType = target.getAttribute('data-link-type')
      hoveredLink.value = graphLinks.value.find(l => l.type === linkType) || null
    } else {
      hoveredNode.value = null
      hoveredLink.value = null
    }
    renderGraph()
  }
}

const handleSvgMouseUp = (event?: MouseEvent) => {
  handleNodeMouseUp(event)
}

// 重置视图
const resetView = () => {
  svgTransform.value = { x: 0, y: 0, scale: 1 }
  renderGraph()
}

// 深度挖掘功能
const performDeepMining = async () => {
  if (!selectedNode.value) return

  isDeepMining.value = true
  showDeepMiningPanel.value = true
  deepMiningResult.value = ''

  try {
    // 获取节点相关信息
    const node = selectedNode.value
    const relatedLinks = graphLinks.value.filter((link) => {
      const source = typeof link.source === 'string' ? graphNodes.value.find(n => n.id === link.source) : link.source
      const target = typeof link.target === 'string' ? graphNodes.value.find(n => n.id === link.target) : link.target
      return (source && source.id === node.id) || (target && target.id === node.id)
    })

    // 构建分析提示词（麦肯锡风格）
    const prompt = `请使用麦肯锡分析方法，对以下知识图谱节点进行深度挖掘分析：

**节点信息：**
- 名称：${node.name}
- 类型：${node.type}
- 关联关系：${relatedLinks.length}个

**关联节点：**
${relatedLinks.map((link) => {
  const source = typeof link.source === 'string' ? graphNodes.value.find(n => n.id === link.source) : link.source
  const target = typeof link.target === 'string' ? graphNodes.value.find(n => n.id === link.target) : link.target
  const otherNode = source && source.id === node.id ? target : source
  return `- ${otherNode?.name || '未知'} (${link.type || '关联'})`
}).join('\n')}

**分析要求（麦肯锡MECE原则）：**
1. **问题定义**：明确该节点在整体知识图谱中的核心作用
2. **结构化分析**：使用金字塔原理，从现象到本质逐层分析
3. **关键洞察**：识别该节点的关键特征、影响力和潜在价值
4. **关联分析**：分析该节点与其他节点的关系网络和依赖关系
5. **战略建议**：基于分析结果，提供针对性的策略建议
`

    // 这里可以添加API调用或其他逻辑来执行深度挖掘
    // 例如：const result = await api.deepMine(prompt)
    // deepMiningResult.value = result
  } catch (error) {
    console.error('深度挖掘失败:', error)
    deepMiningResult.value = '深度挖掘失败，请稍后重试'
  } finally {
    isDeepMining.value = false
  }
}

// 重置进度条
const resetProgressBar = () => {
  progressBarProgress.value = 0
  progressBarStartTime.value = 0
  if (progressBarTimer.value) {
    clearInterval(progressBarTimer.value)
    progressBarTimer.value = null
  }
}
</script>

<template>
  <div class="hot-topic-analysis">
    <!-- 热点分析组件的基本结构 -->
    <div class="analysis-container">
      <div class="analysis-header">
        <h3>热点分析</h3>
        <button class="close-button" @click="onClose?.() || emit('close')">
          <span class="icon">×</span>
        </button>
      </div>

      <!-- 分析内容区域 -->
      <div class="analysis-content">
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner" />
          <div class="loading-text">
            正在分析中...
          </div>
        </div>

        <div v-else-if="analysisData" class="result-container">
          <!-- 分析结果内容 -->
          <div class="analysis-result">
            <div class="result-section">
              <h4>分析摘要</h4>
              <div class="summary-content" v-html="analysisData.summary" />
            </div>
          </div>
        </div>

        <div v-else class="no-data">
          <div class="no-data-icon">
            📊
          </div>
          <div class="no-data-text">
            暂无分析数据
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hot-topic-analysis {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.analysis-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.analysis-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.3s;
}

.close-button:hover {
  background: #f0f0f0;
  color: #666;
}

.analysis-content {
  flex: 1;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1890ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #666;
  font-size: 14px;
}

.result-container {
  padding: 20px;
}

.analysis-result {
  line-height: 1.6;
}

.result-section {
  margin-bottom: 24px;
}

.result-section h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 8px;
}

.summary-content {
  color: #666;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  color: #999;
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.no-data-text {
  font-size: 16px;
}
</style>
