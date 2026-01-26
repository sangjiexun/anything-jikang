<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
// PDF导出功能（使用动态导入）

const props = defineProps<{
  analysisData: any
  topic: string
}>()

const emit = defineEmits<{
  (e: 'export-pdf'): void
}>()

// 图表引用
const trendChartRef = ref<HTMLDivElement | null>(null)
const sentimentChartRef = ref<HTMLDivElement | null>(null)
const wordCloudRef = ref<HTMLDivElement | null>(null)
const heatmapRef = ref<HTMLDivElement | null>(null)
const mindmapRef = ref<HTMLDivElement | null>(null)

let trendChart: ECharts | null = null
let sentimentChart: ECharts | null = null
let wordCloudChart: ECharts | null = null
let heatmapChart: ECharts | null = null
let mindmapChart: ECharts | null = null

// 当前激活的选项卡
const activeTab = ref('overview')

// 导出PDF
const exportToPDF = async () => {
  const element = document.getElementById('hot-topic-analysis-content')
  if (!element) return

  try {
    // 尝试使用html2pdf.js
    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule.default

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `${props.topic || '热点分析'}_${new Date().getTime()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      await html2pdf().set(opt).from(element).save()
      emit('export-pdf')
      return
    } catch (importError: any) {
      // 如果html2pdf未安装，使用备选方案
      console.warn('html2pdf.js未安装，使用浏览器打印功能:', importError)
    }

    // 备选方案：使用浏览器打印功能
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('无法打开打印窗口，请允许弹出窗口')
      return
    }

    // 创建打印内容
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${props.topic || '热点分析'} - 分析报告</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              color: #333;
            }
            h2 { color: #3b82f6; margin-bottom: 10px; }
            h3 { color: #6366f1; margin-top: 20px; margin-bottom: 10px; }
            .chart-container { margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()

    // 等待内容加载后打印
    setTimeout(() => {
      printWindow.print()
      emit('export-pdf')
    }, 500)
  } catch (error: any) {
    console.error('PDF导出失败:', error)
    alert('PDF导出失败: ' + (error.message || '未知错误'))
  }
}

// 初始化趋势图
const initTrendChart = () => {
  if (!trendChartRef.value || !props.analysisData?.trend_prediction) return

  const days = props.analysisData.trend_prediction.days || []
  if (days.length === 0) return

  const dates = days.map((d: any) => d.date || d.day)
  const values = days.map((d: any) => d.predicted_heat || 0)

  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    backgroundColor: 'transparent',
    textStyle: {
      color: 'var(--text-primary)'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: 'var(--border-primary)' } },
      axisLabel: { color: 'var(--text-secondary)' }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { lineStyle: { color: 'var(--border-primary)' } },
      axisLabel: { color: 'var(--text-secondary)' },
      splitLine: { lineStyle: { color: 'var(--border-primary)', opacity: 0.3 } }
    },
    series: [{
      data: values,
      type: 'line',
      smooth: true,
      lineStyle: { color: '#3b82f6', width: 3 },
      itemStyle: { color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
          ]
        }
      }
    }]
  })
}

// 初始化舆情分析图
const initSentimentChart = () => {
  if (!sentimentChartRef.value || !props.analysisData?.sentiment) return

  const sentiment = props.analysisData.sentiment
  const distribution = sentiment.distribution || { positive: 0, neutral: 0, negative: 0 }

  sentimentChart = echarts.init(sentimentChartRef.value)
  sentimentChart.setOption({
    backgroundColor: 'transparent',
    textStyle: {
      color: 'var(--text-primary)'
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}% ({d}%)'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: 'var(--bg-primary)',
        borderWidth: 2
      },
      label: {
        show: true,
        color: 'var(--text-primary)'
      },
      data: [
        { value: (distribution.positive * 100).toFixed(1), name: '正面', itemStyle: { color: '#10b981' } },
        { value: (distribution.neutral * 100).toFixed(1), name: '中性', itemStyle: { color: '#f59e0b' } },
        { value: (distribution.negative * 100).toFixed(1), name: '负面', itemStyle: { color: '#ef4444' } }
      ]
    }]
  })
}

// 初始化词云（简化版，使用柱状图代替）
const initWordCloud = () => {
  if (!wordCloudRef.value || !props.analysisData?.related_info?.keywords) return

  const keywords = props.analysisData.related_info.keywords || []
  if (keywords.length === 0) return

  // 为每个关键词生成权重（简化处理）
  const data = keywords.slice(0, 20).map((keyword: string, index: number) => ({
    name: keyword,
    value: 100 - index * 4
  }))

  wordCloudChart = echarts.init(wordCloudRef.value)
  wordCloudChart.setOption({
    backgroundColor: 'transparent',
    textStyle: {
      color: 'var(--text-primary)'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: 'var(--border-primary)' } },
      axisLabel: { color: 'var(--text-secondary)' }
    },
    yAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLine: { lineStyle: { color: 'var(--border-primary)' } },
      axisLabel: { color: 'var(--text-secondary)' }
    },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#8b5cf6' }
          ]
        }
      }
    }]
  })
}

// 初始化热力图（知识图谱关系热力图）
const initHeatmap = () => {
  if (!heatmapRef.value || !props.analysisData?.knowledge_graph) return

  const entities = props.analysisData.knowledge_graph.entities || []
  const relations = props.analysisData.knowledge_graph.relations || []

  if (entities.length === 0) return

  // 构建关系矩阵
  const entityNames = entities.slice(0, 10).map((e: any) => e.name)
  const matrix: number[][] = Array(entityNames.length).fill(0).map(() => Array(entityNames.length).fill(0))

  relations.forEach((rel: any) => {
    const sourceIdx = entityNames.findIndex((name: string) => name === rel.source || entities.find((e: any) => e.id === rel.source)?.name === name)
    const targetIdx = entityNames.findIndex((name: string) => name === rel.target || entities.find((e: any) => e.id === rel.target)?.name === name)
    if (sourceIdx >= 0 && targetIdx >= 0) {
      matrix[sourceIdx][targetIdx] = 1
      matrix[targetIdx][sourceIdx] = 1
    }
  })

  const data: any[] = []
  entityNames.forEach((name1, i) => {
    entityNames.forEach((name2, j) => {
      if (matrix[i][j] > 0) {
        data.push([i, j, matrix[i][j]])
      }
    })
  })

  heatmapChart = echarts.init(heatmapRef.value)
  heatmapChart.setOption({
    backgroundColor: 'transparent',
    textStyle: {
      color: 'var(--text-primary)'
    },
    tooltip: {
      position: 'top'
    },
    grid: {
      height: '50%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: entityNames,
      splitArea: { show: true },
      axisLabel: { color: 'var(--text-secondary)', rotate: 45 }
    },
    yAxis: {
      type: 'category',
      data: entityNames,
      splitArea: { show: true },
      axisLabel: { color: 'var(--text-secondary)' }
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '15%',
      inRange: {
        color: ['#3b82f6', '#8b5cf6']
      }
    },
    series: [{
      name: '关系强度',
      type: 'heatmap',
      data: data,
      label: {
        show: true,
        color: 'var(--text-primary)'
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  })
}

// 初始化思维导图（使用树状图）
const initMindmap = () => {
  if (!mindmapRef.value || !props.analysisData?.knowledge_graph) return

  const entities = props.analysisData.knowledge_graph.entities || []
  const relations = props.analysisData.knowledge_graph.relations || []

  if (entities.length === 0) return

  // 构建树状结构
  const rootEntity = entities.find((e: any) => e.level === 0) || entities[0]
  const buildTree = (entity: any, level: number = 0): any => {
    if (level > 3) return null // 限制深度

    const children: any[] = []
    relations.forEach((rel: any) => {
      if (rel.source === entity.id || (typeof rel.source === 'object' && rel.source.id === entity.id)) {
        const targetId = typeof rel.target === 'object' ? rel.target.id : rel.target
        const childEntity = entities.find((e: any) => e.id === targetId)
        if (childEntity) {
          const child = buildTree(childEntity, level + 1)
          if (child) children.push(child)
        }
      }
    })

    return {
      name: entity.name,
      value: entity.level || 0,
      children: children.length > 0 ? children : undefined
    }
  }

  const treeData = buildTree(rootEntity)
  if (!treeData) return

  mindmapChart = echarts.init(mindmapRef.value)
  mindmapChart.setOption({
    backgroundColor: 'transparent',
    textStyle: {
      color: 'var(--text-primary)'
    },
    series: [{
      type: 'tree',
      data: [treeData],
      top: '5%',
      left: '7%',
      bottom: '5%',
      right: '20%',
      symbolSize: 7,
      label: {
        position: 'left',
        verticalAlign: 'middle',
        align: 'right',
        color: 'var(--text-primary)'
      },
      leaves: {
        label: {
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          color: 'var(--text-secondary)'
        }
      },
      emphasis: {
        focus: 'descendant'
      },
      expandAndCollapse: true,
      animationDuration: 550,
      animationDurationUpdate: 750,
      lineStyle: {
        color: 'var(--border-primary)',
        width: 2
      }
    }]
  })
}

// 监听数据变化
watch(() => props.analysisData, () => {
  nextTick(() => {
    initTrendChart()
    initSentimentChart()
    initWordCloud()
    initHeatmap()
    initMindmap()
  })
}, { deep: true, immediate: true })

// 窗口大小变化时调整图表
const handleResize = () => {
  trendChart?.resize()
  sentimentChart?.resize()
  wordCloudChart?.resize()
  heatmapChart?.resize()
  mindmapChart?.resize()
}

// 组件挂载时初始化
onMounted(() => {
  nextTick(() => {
    initTrendChart()
    initSentimentChart()
    initWordCloud()
    initHeatmap()
    initMindmap()
  })

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  sentimentChart?.dispose()
  wordCloudChart?.dispose()
  heatmapChart?.dispose()
  mindmapChart?.dispose()
})

// 计算属性
const trendDirection = computed(() => {
  return props.analysisData?.trend_prediction?.overall_trend || '平稳'
})

const sentimentOverall = computed(() => {
  return props.analysisData?.sentiment?.overall || 'neutral'
})
</script>

<template>
  <div id="hot-topic-analysis-content" class="w-full bg-[var(--bg-primary)]">
    <!-- 头部：标题和导出按钮 -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-primary)]">
      <div>
        <h2 class="text-2xl font-bold text-[var(--text-primary)] mb-1">
          {{ topic }}
        </h2>
        <p class="text-sm text-[var(--text-secondary)]">
          热点分析报告
        </p>
      </div>
      <button
        class="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-all flex items-center gap-2"
        @click="exportToPDF"
      >
        <span class="material-symbols-outlined text-lg">picture_as_pdf</span>
        <span>导出PDF</span>
      </button>
    </div>

    <!-- 选项卡导航 -->
    <div class="flex gap-2 mb-6 border-b border-[var(--border-primary)]">
      <button
        v-for="tab in [
          { id: 'overview', label: '概览', icon: 'dashboard' },
          { id: 'causes', label: '成因分析', icon: 'psychology' },
          { id: 'knowledge', label: '知识图谱', icon: 'account_tree' },
          { id: 'sentiment', label: '舆情分析', icon: 'sentiment_satisfied' },
          { id: 'trend', label: '趋势预测', icon: 'trending_up' },
          { id: 'related', label: '相关信息', icon: 'link' }
        ]"
        :key="tab.id"
        :class="[
          'px-4 py-2 rounded-t-lg transition-all flex items-center gap-2',
          activeTab === tab.id
            ? 'bg-[var(--accent-primary)] text-white'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
        ]"
        @click="activeTab = tab.id"
      >
        <span class="material-symbols-outlined text-lg">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- 选项卡内容 -->
    <div class="space-y-6">
      <!-- 概览 -->
      <div v-show="activeTab === 'overview'" class="space-y-6">
        <!-- 趋势预测图表 -->
        <div v-if="analysisData?.trend_prediction" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            5日趋势预测
          </h3>
          <div ref="trendChartRef" class="h-80 w-full" />
        </div>

        <!-- 舆情分析图表 -->
        <div v-if="analysisData?.sentiment" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            舆情分布
          </h3>
          <div ref="sentimentChartRef" class="h-80 w-full" />
        </div>
      </div>

      <!-- 成因分析 -->
      <div v-show="activeTab === 'causes'" class="space-y-6">
        <div v-if="analysisData?.causes?.root_causes?.length" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            根本原因
          </h3>
          <div class="space-y-4">
            <div
              v-for="(cause, index) in analysisData.causes.root_causes"
              :key="index"
              class="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border-primary)]"
            >
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center shrink-0">
                  <span class="text-sm font-bold text-[var(--accent-primary)]">{{ index + 1 }}</span>
                </div>
                <div class="flex-1">
                  <div v-if="typeof cause === 'object' && cause.category" class="mb-2">
                    <span class="px-2 py-1 text-xs font-semibold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded">
                      {{ cause.category }}
                    </span>
                  </div>
                  <h4 class="font-semibold text-[var(--text-primary)] mb-2">
                    {{ typeof cause === 'object' ? cause.cause : cause }}
                  </h4>
                  <p v-if="typeof cause === 'object' && cause.description" class="text-sm text-[var(--text-secondary)]">
                    {{ cause.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="analysisData?.causes?.trigger_factors?.length" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            触发因素
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="(factor, index) in analysisData.causes.trigger_factors"
              :key="index"
              class="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border-primary)]"
            >
              <h4 class="font-semibold text-[var(--text-primary)] mb-2">
                {{ typeof factor === 'object' ? factor.factor : factor }}
              </h4>
              <p v-if="typeof factor === 'object' && factor.description" class="text-sm text-[var(--text-secondary)]">
                {{ factor.description }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 知识图谱 -->
      <div v-show="activeTab === 'knowledge'" class="space-y-6">
        <div v-if="analysisData?.knowledge_graph" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            知识图谱关系热力图
          </h3>
          <div ref="heatmapRef" class="h-96 w-full" />
        </div>

        <div v-if="analysisData?.knowledge_graph" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            思维导图
          </h3>
          <div ref="mindmapRef" class="h-96 w-full" />
        </div>
      </div>

      <!-- 舆情分析 -->
      <div v-show="activeTab === 'sentiment'" class="space-y-6">
        <div v-if="analysisData?.sentiment" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            舆情分布
          </h3>
          <div ref="sentimentChartRef" class="h-80 w-full" />
          <p v-if="analysisData.sentiment.analysis" class="mt-4 text-sm text-[var(--text-secondary)]">
            {{ analysisData.sentiment.analysis }}
          </p>
        </div>
      </div>

      <!-- 趋势预测 -->
      <div v-show="activeTab === 'trend'" class="space-y-6">
        <div v-if="analysisData?.trend_prediction" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            5日趋势预测
          </h3>
          <div ref="trendChartRef" class="h-80 w-full" />
        </div>
      </div>

      <!-- 相关信息 -->
      <div v-show="activeTab === 'related'" class="space-y-6">
        <div v-if="analysisData?.related_info?.keywords?.length" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            关键词词云
          </h3>
          <div ref="wordCloudRef" class="h-80 w-full" />
        </div>

        <div v-if="analysisData?.related_info?.related_topics?.length" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            相关话题
          </h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(topic, index) in analysisData.related_info.related_topics"
              :key="index"
              class="px-3 py-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)]"
            >
              {{ topic }}
            </span>
          </div>
        </div>

        <div v-if="analysisData?.related_info?.summary" class="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-primary)]">
          <h3 class="text-xl font-bold text-[var(--text-primary)] mb-4">
            相关信息摘要
          </h3>
          <p class="text-sm text-[var(--text-secondary)] leading-relaxed">
            {{ analysisData.related_info.summary }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 确保图表容器有正确的尺寸 */
.chart-container {
  width: 100%;
  height: 100%;
}
</style>
