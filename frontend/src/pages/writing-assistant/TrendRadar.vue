<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

const emit = defineEmits<{
  (e: 'analysis-complete', result: any): void
}>()

const platforms = [
  { id: 'xiaohongshu', name: '小红书', icon: 'book_2', color: 'text-red-400' },
  { id: 'douyin', name: '抖音', icon: 'music_note', color: 'text-white' }, // music_note as closest to tiktok note
  { id: 'weibo', name: '微博', icon: 'public', color: 'text-yellow-500' },
  { id: 'baidu', name: '百度', icon: 'search', color: 'text-blue-500' },
  { id: 'zhihu', name: '知乎', icon: 'psychology', color: 'text-blue-400' },
  { id: 'bilibili', name: 'B站', icon: 'tv', color: 'text-pink-400' },
  { id: 'wechat', name: '公众号', icon: 'chat', color: 'text-green-500' }
]

const timeRanges = [
  { id: 'daily', label: '日榜 (24h)' },
  { id: 'weekly', label: '周榜 (7天)' },
  { id: 'monthly', label: '月度趋势' },
  { id: 'yearly', label: '年度盘点' }
]

const currentTab = ref<'search' | 'analysis'>('search')
const currentPlatform = ref('xiaohongshu')
const currentTime = ref('weekly')
const nicheInput = ref('')
const isAnalyzing = ref(false)
const analysisResult = ref<any>(null)
const showChartModal = ref(false)
const chartKeyword = ref('')
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let trendChart: any = null

// Content Analysis State
const analysisUrl = ref('')
const collectedContents = ref<any[]>([]) // Changed from single result to array
const isContentAnalyzing = ref(false)
const selectedContentItems = ref<any[]>([]) // Selection for content tab

// Multi-select & Save State
const selectedItems = ref<any[]>([])
const showSaveModal = ref(false)
const knowledgeBases = ref<any[]>([])
const selectedKbId = ref('')
const isSaving = ref(false)

const selectPlatform = (id: string) => {
  currentPlatform.value = id
}

const selectTime = (id: string) => {
  currentTime.value = id
}

const toggleSelection = (item: any) => {
  const index = selectedItems.value.findIndex(i => (item.url && i.url === item.url) || (item.keyword && i.keyword === item.keyword))
  if (index === -1) {
    selectedItems.value.push(item)
  } else {
    selectedItems.value.splice(index, 1)
  }
}

const toggleContentSelection = (item: any) => {
  const index = selectedContentItems.value.findIndex(i => i === item) // Use object reference or unique ID if available
  if (index === -1) {
    selectedContentItems.value.push(item)
  } else {
    selectedContentItems.value.splice(index, 1)
  }
}

const isSelected = (item: any) => {
  return selectedItems.value.some(i => (item.url && i.url === item.url) || (item.keyword && i.keyword === item.keyword))
}

const isContentSelected = (item: any) => {
  return selectedContentItems.value.includes(item)
}

const fetchKnowledgeBases = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/knowledge-base', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const res = await response.json()
    if (res.success) {
      knowledgeBases.value = res.data
      if (knowledgeBases.value.length > 0) {
        selectedKbId.value = knowledgeBases.value[0].id
      }
    }
  } catch (e) {
    console.error('Failed to fetch knowledge bases', e)
  }
}

const openSaveModal = (items: any[] = []) => {
  if (items.length > 0) {
    // If specific items passed (e.g. from content analysis), use them
    // But currently logic uses selectedItems for batch
  }
  fetchKnowledgeBases()
  showSaveModal.value = true
}

const saveToKb = async () => {
  if (!selectedKbId.value) return
  isSaving.value = true

  try {
    const token = localStorage.getItem('auth_token')

    // Determine what to save
    let itemsToSave = []

    if (currentTab.value === 'search') {
      // Save selected search trends OR search results
      itemsToSave = selectedItems.value.map((item) => {
        if (item.url) {
          // It's a search result (Xiaohongshu note)
          return {
            title: item.title,
            summary: `Author: ${item.author}, Likes: ${item.likes}`,
            tags: [currentPlatform.value, 'Search Result', nicheInput.value],
            content: `Title: ${item.title}\nAuthor: ${item.author}\nLink: ${item.url}\nLikes: ${item.likes}`,
            score: parseInt(item.likes) || 0,
            reason: 'Search Result',
            isSoft: false,
            type: 'note',
            mediaUrl: item.url,
            cover: item.cover
          }
        } else {
          // It's a trend item
          return {
            title: `Trend: ${item.keyword}`,
            summary: `Rank: ${item.rank}, Heat: ${item.heat}, Trend: ${item.trend}`,
            tags: [currentPlatform.value, 'Trend Radar', item.keyword],
            content: `Trend Analysis for ${item.keyword} on ${currentPlatform.value}.\nHeat: ${item.heat}\nTrend: ${item.trend}`,
            score: item.heat,
            reason: 'Search Trend',
            isSoft: false,
            type: 'trend'
          }
        }
      })
    } else {
      // Save selected content analysis results
      itemsToSave = selectedContentItems.value
    }

    if (itemsToSave.length === 0) {
      alert('没有可保存的内容')
      return
    }

    // Batch save
    const response = await fetch('/api/trend-radar/batch-save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        kbId: selectedKbId.value,
        items: itemsToSave
      })
    })

    const res = await response.json()
    if (!res.success) {
      throw new Error(res.message || 'Batch save failed')
    }

    alert(`保存成功! 处理了 ${res.data.length} 项`)
    showSaveModal.value = false
    selectedItems.value = []
    selectedContentItems.value = []
  } catch (e) {
    console.error(e)
    alert('保存失败')
  } finally {
    isSaving.value = false
  }
}

const analyzeContent = async () => {
  if (!analysisUrl.value) return
  isContentAnalyzing.value = true

  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch('/api/trend-radar/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url: analysisUrl.value })
    })

    const res = await response.json()
    if (res.success) {
      // Add to collection (prepend)
      collectedContents.value.unshift(res.data)
      analysisUrl.value = '' // Clear input
    } else {
      throw new Error(res.message)
    }
  } catch (e: any) {
    alert(`分析失败: ${e.message}`)
  } finally {
    isContentAnalyzing.value = false
  }
}

const startAnalysis = async () => {
  if (!nicheInput.value && currentPlatform.value === 'xiaohongshu') {
    // If no keyword, maybe ask for one or use default?
    // For now let's allow "trend" simulation if no keyword
  }

  isAnalyzing.value = true
  analysisResult.value = null // Reset previous results
  selectedItems.value = [] // Reset selection

  try {
    const token = localStorage.getItem('auth_token')

    // If we have a keyword (nicheInput) and platform is supported for search
    if (nicheInput.value && currentPlatform.value === 'xiaohongshu') {
      const response = await fetch('/api/trend-radar/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keyword: nicheInput.value,
          platform: currentPlatform.value
        })
      })

      const res = await response.json()
      if (res.success) {
        analysisResult.value = {
          searchResults: res.data,
          type: 'search_result'
        }
        isAnalyzing.value = false
        return
      }
      // If failed, fall through to simulation? No, throw error.
      throw new Error(res.message || '搜索失败')
    }

    // Fallback to existing LLM simulation for Trends / Other platforms
    const platformObj = platforms.find(p => p.id === currentPlatform.value)
    const platformName = platformObj ? `${platformObj.name} (${platformObj.id})` : currentPlatform.value

    const timeObj = timeRanges.find(t => t.id === currentTime.value)
    const timeDesc = timeObj ? timeObj.label : currentTime.value

    const nicheDesc = nicheInput.value ? nicheInput.value : ''

    const response = await fetch('/api/trend-radar/trend-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        platform: platformName,
        timeRange: timeDesc,
        niche: nicheDesc
      })
    })

    const res = await response.json()
    if (res.success) {
      // Dispatch token usage event if available
      if (res.data && res.data.usage) {
        window.dispatchEvent(new CustomEvent('token_usage', {
          detail: {
            tokens: res.data.usage.total_tokens
          }
        }))
      }

      analysisResult.value = res.data
      // Emit result for history logging
      emit('analysis-complete', {
        platform: platformName,
        time: timeDesc,
        niche: nicheDesc,
        data: res.data
      })
    } else {
      throw new Error(res.message || 'Analysis failed')
    }
  } catch (e: any) {
    console.error(e)
    alert(`分析失败: ${e.message}`)
  } finally {
    isAnalyzing.value = false
  }
}

const showTrend = (keyword: string, currentHeat: number) => {
  chartKeyword.value = keyword
  showChartModal.value = true

  nextTick(() => {
    if (!chartCanvas.value) return

    // Check if Chart is available
    if (typeof (window as any).Chart === 'undefined') {
      alert('Chart.js 未加载，无法显示图表')
      return
    }

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) return

    // Generate simulated data
    const labels = []
    const dataPoints = []
    let pointsCount
    let labelFormat: (i: number) => string

    switch (currentTime.value) {
      case 'daily':
        pointsCount = 24
        labelFormat = i => `${i}时`
        break
      case 'weekly':
        pointsCount = 7
        labelFormat = i => `第${i + 1}天`
        break
      case 'monthly':
        pointsCount = 30
        labelFormat = i => `${i + 1}日`
        break
      case 'yearly':
        pointsCount = 12
        labelFormat = i => `${i + 1}月`
        break
      default:
        pointsCount = 7
        labelFormat = i => `第${i + 1}天`
    }

    // Simulation algorithm
    for (let i = 0; i < pointsCount; i++) {
      labels.push(labelFormat(i))
      const volatility = (Math.random() - 0.5) * 0.4 * currentHeat
      const trendFactor = (i / (pointsCount - 1))
      let simulatedValue = Math.max(0, Math.min(100, (currentHeat * trendFactor) + volatility + (currentHeat * 0.2 * Math.random())))

      if (i === pointsCount - 1) simulatedValue = currentHeat

      dataPoints.push(Math.round(simulatedValue))
    }

    if (trendChart) {
      trendChart.destroy()
    }

    // @ts-ignore
    trendChart = new (window as any).Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: '热度指数',
          data: dataPoints,
          borderColor: '#a8c7fa', // Adapted color
          backgroundColor: 'rgba(168, 199, 250, 0.2)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: '#444746' },
            ticks: { color: '#c4c7c5' }
          },
          x: {
            grid: { color: '#444746' },
            ticks: { color: '#c4c7c5' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    })
  })
}

const closeModal = () => {
  showChartModal.value = false
  if (trendChart) {
    trendChart.destroy()
    trendChart = null
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-[#1e1f20] text-[#e3e3e3] overflow-hidden relative">
    <!-- Header -->
    <div class="p-4 border-b border-[#444746] flex justify-between items-center bg-[#28292a]">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-indigo-400">radar</span>
          <h2 class="text-sm font-medium">
            全网热搜趋势雷达
          </h2>
        </div>
        <!-- Tab Switcher -->
        <div class="flex bg-[#1e1f20] rounded-lg p-1 border border-[#444746]">
          <button
            :class="['px-3 py-1 text-xs rounded-md transition', currentTab === 'search' ? 'bg-[#3c4043] text-white shadow-sm' : 'text-[#c4c7c5] hover:text-white']"
            @click="currentTab = 'search'"
          >
            热搜挖掘
          </button>
          <button
            :class="['px-3 py-1 text-xs rounded-md transition', currentTab === 'analysis' ? 'bg-[#3c4043] text-white shadow-sm' : 'text-[#c4c7c5] hover:text-white']"
            @click="currentTab = 'analysis'"
          >
            内容深度分析
          </button>
        </div>
      </div>
      <div class="text-xs text-[#c4c7c5]">
        Google Search & Qwen Omni 驱动
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto custom-scroll p-6">
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Tab 1: Search Trends -->
        <div v-show="currentTab === 'search'" class="space-y-6">
          <!-- Controls -->
          <div class="bg-[#28292a] rounded-xl p-6 border border-[#444746] space-y-6">
            <!-- Platform Select -->
            <div class="space-y-3">
              <label class="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                <span class="material-symbols-outlined text-xs">layers</span> 选择目标平台
              </label>
              <div class="grid grid-cols-4 md:grid-cols-7 gap-2">
                <button
                  v-for="platform in platforms"
                  :key="platform.id"
                  :class="[
                    'flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all',
                    currentPlatform === platform.id
                      ? 'bg-[#3c4043] border-[#a8c7fa] text-[#a8c7fa]'
                      : 'bg-[#1e1f20] border-[#444746] text-[#c4c7c5] hover:bg-[#353637]'
                  ]"
                  @click="selectPlatform(platform.id)"
                >
                  <span :class="['material-symbols-outlined', currentPlatform === platform.id ? 'text-[#a8c7fa]' : platform.color]">{{ platform.icon }}</span>
                  <span class="text-xs font-medium">{{ platform.name }}</span>
                </button>
              </div>
            </div>

            <!-- Time & Niche -->
            <div class="grid md:grid-cols-2 gap-6">
              <div class="space-y-3">
                <label class="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                  <span class="material-symbols-outlined text-xs">schedule</span> 时间维度
                </label>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="time in timeRanges"
                    :key="time.id"
                    :class="[
                      'px-4 py-2 rounded-full text-xs font-medium border transition-all',
                      currentTime === time.id
                        ? 'bg-[#3c4043] border-[#a8c7fa] text-[#a8c7fa]'
                        : 'bg-[#1e1f20] border-[#444746] text-[#c4c7c5] hover:bg-[#353637]'
                    ]"
                    @click="selectTime(time.id)"
                  >
                    {{ time.label }}
                  </button>
                </div>
              </div>

              <div class="space-y-3">
                <label class="text-sm font-bold text-[#e3e3e3] flex items-center gap-2">
                  <span class="material-symbols-outlined text-xs">search</span> 限定领域 (可选)
                </label>
                <input
                  v-model="nicheInput"
                  type="text"
                  placeholder="输入特定领域(如: 副业, 养生)..."
                  class="w-full bg-[#1e1f20] border border-[#444746] rounded-lg px-4 py-2 text-sm text-[#e3e3e3] focus:border-[#a8c7fa] outline-none placeholder-[#5f6368]"
                >
              </div>
            </div>

            <!-- Action Button -->
            <button
              :disabled="isAnalyzing"
              class="w-full bg-[#a8c7fa] text-[#1e1f20] py-3 rounded-xl font-bold text-sm hover:bg-[#d3e3fd] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              @click="startAnalysis"
            >
              <span v-if="isAnalyzing" class="material-symbols-outlined text-lg animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-lg">radar</span>
              {{ isAnalyzing ? '正在全网扫描与分析...' : '开始全网扫描与分析' }}
            </button>
          </div>

          <!-- Results -->
          <div v-if="analysisResult" class="space-y-6 animate-fade-in relative">
            <!-- Bulk Actions -->
            <div v-if="selectedItems.length > 0" class="fixed bottom-6 right-6 z-40 animate-bounce-in">
              <button
                class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold"
                @click="openSaveModal()"
              >
                <span class="material-symbols-outlined">save</span>
                保存 {{ selectedItems.length }} 项到知识库
              </button>
            </div>

            <!-- Ranking Table -->
            <div v-if="!analysisResult.type || analysisResult.type !== 'search_result'" class="bg-[#28292a] rounded-xl border border-[#444746] overflow-hidden">
              <div class="px-6 py-4 border-b border-[#444746] flex justify-between items-center">
                <h3 class="text-sm font-bold text-[#e3e3e3]">
                  搜索热度排行
                </h3>
                <span class="bg-green-900/30 text-green-400 text-[10px] px-2 py-1 rounded border border-green-800">Live Data</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead class="bg-[#1e1f20] text-[#c4c7c5] text-xs uppercase">
                    <tr>
                      <th class="px-4 py-3 w-10">
                        <!-- Header Checkbox (Optional) -->
                      </th>
                      <th class="px-6 py-3 w-16">
                        排名
                      </th>
                      <th class="px-6 py-3">
                        核心搜索词 / 话题
                      </th>
                      <th class="px-6 py-3 hidden md:table-cell">
                        热度指数
                      </th>
                      <th class="px-6 py-3 hidden md:table-cell">
                        趋势
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#444746]">
                    <tr
                      v-for="item in analysisResult.rankings"
                      :key="item.rank"
                      class="hover:bg-[#353637] transition cursor-pointer"
                      @click="toggleSelection(item)"
                    >
                      <td class="px-4 py-4">
                        <div class="w-4 h-4 border border-[#5f6368] rounded flex items-center justify-center" :class="{ 'bg-indigo-500 border-indigo-500': isSelected(item) }">
                          <span v-if="isSelected(item)" class="material-symbols-outlined text-[10px] text-white">check</span>
                        </div>
                      </td>
                      <td class="px-6 py-4 font-bold text-[#a8c7fa]">
                        {{ item.rank }}
                      </td>
                      <td class="px-6 py-4 font-medium text-[#e3e3e3]">
                        <span class="cursor-pointer hover:text-[#a8c7fa] hover:underline" @click.stop="showTrend(item.keyword, item.heat)">{{ item.keyword }}</span>
                      </td>
                      <td class="px-6 py-4 hidden md:table-cell">
                        <div class="flex items-center gap-2">
                          <div class="w-24 h-1.5 bg-[#1e1f20] rounded-full overflow-hidden">
                            <div class="h-full bg-[#a8c7fa]" :style="{ width: item.heat + '%' }" />
                          </div>
                          <span class="text-xs text-[#c4c7c5]">{{ item.heat }}</span>
                        </div>
                      </td>
                      <td class="px-6 py-4 hidden md:table-cell">
                        <span class="px-2 py-1 bg-[#1e1f20] border border-[#444746] rounded text-xs text-[#c4c7c5]">{{ item.trend }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Search Results Grid -->
            <div v-else class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                v-for="(item, idx) in analysisResult.searchResults"
                :key="idx"
                class="bg-[#28292a] rounded-xl border border-[#444746] overflow-hidden group cursor-pointer relative hover:border-[#a8c7fa] transition"
                @click="toggleSelection(item)"
              >
                <!-- Selection Overlay -->
                <div class="absolute top-2 left-2 z-10">
                  <div class="w-6 h-6 border-2 border-white/50 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center transition" :class="{ 'bg-indigo-600 border-indigo-500': isSelected(item) }">
                    <span v-if="isSelected(item)" class="material-symbols-outlined text-sm text-white">check</span>
                  </div>
                </div>

                <!-- Cover -->
                <div class="aspect-[3/4] bg-[#1e1f20] relative">
                  <img v-if="item.cover" :src="item.cover" class="w-full h-full object-cover">
                  <div v-else class="w-full h-full flex items-center justify-center text-[#5f6368]">
                    <span class="material-symbols-outlined text-4xl">image_not_supported</span>
                  </div>
                  <!-- Platform Badge -->
                  <div class="absolute top-2 right-2 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-bold uppercase">
                    {{ item.platform || 'XHS' }}
                  </div>
                </div>

                <!-- Info -->
                <div class="p-4 space-y-2">
                  <h3 class="text-xs font-bold text-[#e3e3e3] line-clamp-2 h-8 leading-4">
                    {{ item.title }}
                  </h3>
                  <div class="flex justify-between items-center text-[10px] text-[#9aa0a6]">
                    <span class="flex items-center gap-1 truncate max-w-[60%]">
                      <span class="material-symbols-outlined text-[12px]">person</span>
                      <span class="truncate">{{ item.author }}</span>
                    </span>
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-[12px] text-red-400">favorite</span>
                      {{ item.likes }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Insight Cards -->
            <div v-if="!analysisResult.type || analysisResult.type !== 'search_result'" class="grid md:grid-cols-2 gap-6">
              <div class="bg-[#28292a] p-6 rounded-xl border-l-4 border-yellow-500 shadow-lg">
                <h3 class="font-bold text-[#e3e3e3] mb-3 flex items-center gap-2">
                  <span class="material-symbols-outlined text-yellow-500">lightbulb</span> 内容切入点建议
                </h3>
                <p class="text-sm text-[#c4c7c5] leading-relaxed">
                  {{ analysisResult.content_advice }}
                </p>
              </div>
              <div class="bg-[#28292a] p-6 rounded-xl border-l-4 border-green-500 shadow-lg">
                <h3 class="font-bold text-[#e3e3e3] mb-3 flex items-center gap-2">
                  <span class="material-symbols-outlined text-green-500">monetization_on</span> 潜在变现/商品方向
                </h3>
                <p class="text-sm text-[#c4c7c5] leading-relaxed">
                  {{ analysisResult.monetize_advice }}
                </p>
              </div>
            </div>

            <!-- Strategy -->
            <div v-if="!analysisResult.type || analysisResult.type !== 'search_result'" class="bg-[#28292a] p-6 rounded-xl border-l-4 border-purple-500 shadow-lg">
              <h3 class="font-bold text-[#e3e3e3] mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-purple-500">local_fire_department</span> 爆款内容策略推荐
              </h3>
              <div class="space-y-3">
                <div v-for="(strategy, idx) in analysisResult.hot_strategy" :key="idx" class="bg-[#1e1f20] p-4 rounded-lg border border-[#444746]">
                  <h4 class="font-bold text-[#a8c7fa] mb-1 text-sm">
                    {{ strategy.title }}
                  </h4>
                  <p class="text-xs text-[#c4c7c5]">
                    {{ strategy.desc }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Content Analysis -->
        <div v-show="currentTab === 'analysis'" class="space-y-6">
          <div class="bg-[#28292a] rounded-xl p-6 border border-[#444746]">
            <h3 class="font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-blue-400">link</span> 链接/视频深度分析
            </h3>
            <div class="flex gap-2">
              <input
                v-model="analysisUrl"
                type="text"
                placeholder="在此粘贴 小红书/微信公众号/抖音/Youtube 链接..."
                class="flex-1 bg-[#1e1f20] border border-[#444746] rounded-lg px-4 py-3 text-sm text-[#e3e3e3] focus:border-[#a8c7fa] outline-none"
              >
              <button
                :disabled="isContentAnalyzing || !analysisUrl"
                class="bg-[#a8c7fa] text-[#1e1f20] px-6 py-2 rounded-lg font-bold text-sm hover:bg-[#d3e3fd] transition disabled:opacity-50 flex items-center gap-2"
                @click="analyzeContent"
              >
                <span v-if="isContentAnalyzing" class="material-symbols-outlined animate-spin">sync</span>
                <span v-else class="material-symbols-outlined">analytics</span>
                深度诊断
              </button>
            </div>
            <p class="text-xs text-[#5f6368] mt-2 ml-1">
              支持：小红书图文/视频、微信公众号文章、抖音/快手视频、Youtube
            </p>
          </div>

          <!-- Bulk Actions for Content -->
          <div v-if="selectedContentItems.length > 0" class="fixed bottom-6 right-6 z-40 animate-bounce-in">
            <button
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold"
              @click="openSaveModal()"
            >
              <span class="material-symbols-outlined">save</span>
              保存 {{ selectedContentItems.length }} 项到知识库
            </button>
          </div>

          <!-- Analysis Results List -->
          <div v-if="collectedContents.length > 0" class="space-y-6">
            <div v-for="(item, idx) in collectedContents" :key="idx" class="bg-[#28292a] rounded-xl border border-[#444746] overflow-hidden animate-fade-in relative group">
              <!-- Checkbox Overlay -->
              <div class="absolute top-4 left-4 z-20">
                <div class="w-6 h-6 border-2 border-white/50 bg-black/30 backdrop-blur rounded-lg flex items-center justify-center cursor-pointer hover:border-white transition" :class="{ 'bg-indigo-600 border-indigo-500': isContentSelected(item) }" @click.stop="toggleContentSelection(item)">
                  <span v-if="isContentSelected(item)" class="material-symbols-outlined text-sm text-white">check</span>
                </div>
              </div>

              <!-- Cover & Header -->
              <div class="relative h-48 w-full bg-[#1e1f20]">
                <img v-if="item.cover" :src="item.cover" class="w-full h-full object-cover opacity-60">
                <div v-else class="w-full h-full flex items-center justify-center text-[#444746]">
                  <span class="material-symbols-outlined text-6xl">image_not_supported</span>
                </div>
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#28292a] to-transparent p-6 pt-20">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-1 bg-indigo-500/80 text-white text-xs rounded font-bold">{{ item.type }}</span>
                    <span class="px-2 py-1 bg-[#444746]/80 text-[#e3e3e3] text-xs rounded">{{ item.classification || 'Analysis Ready' }}</span>
                  </div>
                  <h2 class="text-xl font-bold text-white leading-tight shadow-sm cursor-pointer hover:underline" @click="item.mediaUrl || item.url ? window.open(item.mediaUrl || item.url, '_blank') : null">
                    {{ item.title }}
                  </h2>
                </div>
              </div>

              <div class="p-6 space-y-6">
                <!-- Metrics -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="bg-[#1e1f20] p-3 rounded-lg border border-[#444746]">
                    <span class="text-xs text-[#9aa0a6] block mb-1">软广指数 (0-100)</span>
                    <div class="flex items-end gap-2">
                      <span class="text-xl font-bold" :class="item.score > 50 ? 'text-red-400' : 'text-green-400'">{{ item.score }}</span>
                      <span class="text-xs mb-1" :class="item.isSoft ? 'text-red-400' : 'text-green-400'">{{ item.isSoft ? '疑似软广' : '纯享内容' }}</span>
                    </div>
                  </div>
                  <div class="bg-[#1e1f20] p-3 rounded-lg border border-[#444746]">
                    <span class="text-xs text-[#9aa0a6] block mb-1">内容分类</span>
                    <span class="text-sm font-bold text-[#e3e3e3]">{{ item.classification || '未分类' }}</span>
                  </div>
                </div>

                <!-- Summary -->
                <div class="bg-[#1e1f20] p-4 rounded-lg border border-[#444746]">
                  <h4 class="text-xs font-bold text-[#9aa0a6] uppercase mb-2">
                    内容摘要
                  </h4>
                  <p class="text-sm text-[#e3e3e3] leading-relaxed">
                    {{ item.summary }}
                  </p>
                </div>

                <!-- Tags -->
                <div>
                  <h4 class="text-xs font-bold text-[#9aa0a6] uppercase mb-2">
                    智能标签
                  </h4>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="tag in item.tags" :key="tag" class="px-2 py-1 bg-[#3c4043] text-[#a8c7fa] rounded text-xs"># {{ tag }}</span>
                  </div>
                </div>

                <!-- Reason -->
                <div>
                  <h4 class="text-xs font-bold text-[#9aa0a6] uppercase mb-2">
                    AI 诊断依据
                  </h4>
                  <p class="text-xs text-[#c4c7c5] italic">
                    {{ item.reason }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 text-[#5f6368]">
            <span class="material-symbols-outlined text-4xl mb-2">inbox</span>
            <p class="text-sm">
              暂无分析记录，请在上方输入链接开始深度诊断
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Modal -->
    <div v-if="showChartModal" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="closeModal">
      <div class="bg-[#28292a] w-[600px] max-w-[90%] rounded-xl border border-[#444746] p-6 shadow-2xl relative">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-[#e3e3e3]">
            "{{ chartKeyword }}" 历史热度趋势 (模拟)
          </h3>
          <button class="text-[#c4c7c5] hover:text-white transition" @click="closeModal">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="h-[300px] w-full">
          <canvas ref="chartCanvas" />
        </div>
      </div>
    </div>

    <!-- Save Modal -->
    <div v-if="showSaveModal" class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="showSaveModal = false">
      <div class="bg-[#28292a] w-[400px] rounded-xl border border-[#444746] p-6 shadow-2xl animate-fade-in">
        <h3 class="text-lg font-bold text-[#e3e3e3] mb-4">
          保存到知识库
        </h3>

        <div class="space-y-4 mb-6">
          <div>
            <label class="block text-xs text-[#9aa0a6] mb-2">选择目标知识库</label>
            <select v-model="selectedKbId" class="w-full bg-[#1e1f20] border border-[#444746] rounded-lg p-2 text-sm text-[#e3e3e3] outline-none">
              <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
                {{ kb.name }}
              </option>
            </select>
          </div>
          <div class="bg-[#1e1f20] border border-[#444746] rounded-lg p-3">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-[#9aa0a6]">待保存项目</span>
              <span class="text-[#e3e3e3] font-bold">{{ currentTab === 'search' ? selectedItems.length : selectedContentItems.length }} 项</span>
            </div>
            <div class="text-xs text-[#5f6368] truncate">
              {{ currentTab === 'search' ? (selectedItems[0]?.keyword + (selectedItems.length > 1 ? ` 等...` : '')) : (selectedContentItems[0]?.title + (selectedContentItems.length > 1 ? ` 等...` : '')) }}
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button class="px-4 py-2 text-sm text-[#c4c7c5] hover:text-white" @click="showSaveModal = false">
            取消
          </button>
          <button
            :disabled="isSaving || !selectedKbId"
            class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2"
            @click="saveToKb"
          >
            <span v-if="isSaving" class="material-symbols-outlined text-sm animate-spin">sync</span>
            确认保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #444746;
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #5f6368;
}
.animate-fade-in {
  animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
