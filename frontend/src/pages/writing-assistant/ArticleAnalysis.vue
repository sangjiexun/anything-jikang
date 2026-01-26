<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{
  (e: 'analysis-complete', result: any): void
}>()

const fetchArticleContent = async (url: string) => {
  try {
    // Use backend proxy instead of unstable public proxy
    const api = useApi()
    const response: any = await api.post('/writing-assistant/scrape-article', { url })

    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch content')
    }

    const { title, content } = response.data

    if (!content) {
      throw new Error('文章内容为空')
    }

    return { title, text: content }
  } catch (e: any) {
    console.error('Scraping error:', e)
    throw new Error(e.message || '无法抓取该文章内容，请检查链接或网络。')
  }
}

const analyzeWithQwen = async (content: { title: string, text: string }, platformName: string) => {
  const systemPrompt = `你是一个专业的爆款内容分析师。请分析以下${platformName}文章，并严格按照 JSON 格式返回分析结果。
  
  分析维度要求：
  1. 爆款原因分析：分析情绪价值、开头钩子、数据支撑等。
  2. 平台规则合规性：检查是否符合${platformName}规范，有无违规词。
  3. SMART评估：Specific(具体), Measurable(可衡量), Achievable(可实现), Relevant(相关), Time-bound(时限)。
  4. 修改建议：给出3条具体的优化建议。
  5. 7日流量预测：预测未来7天的阅读/播放数据趋势（纯数字数组）。

  返回格式必须是合法的 JSON，不要包含 Markdown 代码块标记：
  {
    "viralReasons": ["原因1", "原因2", "原因3"],
    "platformRules": { "compliant": true, "notes": "合规说明" },
    "smartAnalysis": {
      "specific": "...",
      "measurable": "...",
      "achievable": "...",
      "relevant": "...",
      "timeBound": "..."
    },
    "suggestions": ["建议1", "建议2", "建议3"],
    "trafficData": [100, 200, 350, 500, 800, 1200, 2000]
  }`

  const userPrompt = `文章标题：${content.title}\n\n文章内容：\n${content.text}`

  const response = await fetch('/api/writing-assistant/chat/completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
    },
    body: JSON.stringify({
      model: 'qwen3-omni-flash', // Use a cheaper model or match what was there
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`)
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

  const contentStr = resJson.data.choices[0].message.content

  // Clean up markdown code blocks if present
  const jsonStr = contentStr.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr)
}

const articleUrl = ref('')
const selectedPlatform = ref('toutiao')
const isAnalyzing = ref(false)
const result = ref<any>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let trafficChart: any = null

const platforms = [
  { id: 'toutiao', name: '今日头条', icon: 'article', color: 'text-red-500' },
  { id: 'xiaohongshu', name: '小红书', icon: 'book_2', color: 'text-red-400' },
  { id: 'news', name: '新闻网站', icon: 'newspaper', color: 'text-blue-500' }
]

const startAnalysis = async () => {
  if (!articleUrl.value) return

  isAnalyzing.value = true
  result.value = null

  try {
    // 1. Fetch Content
    const content = await fetchArticleContent(articleUrl.value)

    // 2. Analyze with LLM
    const platformObj = platforms.find(p => p.id === selectedPlatform.value)
    const data = await analyzeWithQwen(content, platformObj?.name || '自媒体')

    result.value = data

    await nextTick()
    renderChart(data.trafficData)

    emit('analysis-complete', { ...data, url: articleUrl.value })
  } catch (e: any) {
    console.error(e)
    alert(e.message || '分析过程中发生错误')
  } finally {
    isAnalyzing.value = false
  }
}

const renderChart = (data: number[]) => {
  if (!chartCanvas.value) return

  if (trafficChart) {
    trafficChart.destroy()
  }

  const ctx = chartCanvas.value.getContext('2d')
  if (!ctx) return

  // @ts-ignore
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded')
    return
  }

  // @ts-ignore
  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
      datasets: [{
        label: '7日流量预估',
        data: data,
        borderColor: '#fb923c', // Orange-400
        backgroundColor: 'rgba(251, 146, 60, 0.2)',
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
}

onUnmounted(() => {
  if (trafficChart) {
    trafficChart.destroy()
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-[#1e1f20] text-[#e3e3e3] overflow-hidden relative">
    <!-- Header -->
    <div class="p-4 border-b border-[#444746] flex justify-between items-center bg-[#28292a]">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-orange-400">article</span>
        <h2 class="text-sm font-medium">
          爆款文章分析
        </h2>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-6 custom-scroll">
      <!-- Input Section -->
      <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746] mb-6">
        <div class="mb-4">
          <label class="text-xs text-[#c4c7c5] font-medium mb-2 block uppercase tracking-wider">文章链接</label>
          <div class="flex gap-2">
            <input
              v-model="articleUrl"
              type="text"
              placeholder="粘贴今日头条、小红书或新闻链接..."
              class="flex-1 bg-[#1e1f20] border border-[#444746] rounded-lg px-4 py-2.5 text-sm text-[#e3e3e3] focus:border-orange-400 focus:outline-none transition-colors"
            >
            <button
              :disabled="isAnalyzing || !articleUrl"
              class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              @click="startAnalysis"
            >
              <span v-if="isAnalyzing" class="material-symbols-outlined text-[18px] animate-spin">sync</span>
              <span v-else class="material-symbols-outlined text-[18px]">analytics</span>
              {{ isAnalyzing ? '分析中...' : '开始分析' }}
            </button>
          </div>
        </div>

        <div>
          <label class="text-xs text-[#c4c7c5] font-medium mb-2 block uppercase tracking-wider">目标平台</label>
          <div class="flex gap-3">
            <button
              v-for="p in platforms"
              :key="p.id"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all',
                selectedPlatform === p.id
                  ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                  : 'bg-[#1e1f20] border-[#444746] text-[#c4c7c5] hover:border-[#c4c7c5]'
              ]"
              @click="selectedPlatform = p.id"
            >
              <span class="material-symbols-outlined text-[18px]" :class="selectedPlatform === p.id ? 'text-orange-400' : p.color">{{ p.icon }}</span>
              {{ p.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="result" class="space-y-6 animate-fadeIn">
        <!-- 7-Day Traffic Chart -->
        <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746]">
          <h3 class="text-sm font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-orange-400 text-[20px]">ssid_chart</span>
            7日流量趋势预测
          </h3>
          <div class="h-64 w-full">
            <canvas ref="chartCanvas" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <!-- Viral Reasons -->
          <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746]">
            <h3 class="text-sm font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-yellow-400 text-[20px]">local_fire_department</span>
              爆款原因分析
            </h3>
            <ul class="space-y-3">
              <li v-for="(reason, idx) in result.viralReasons" :key="idx" class="flex items-start gap-2 text-sm text-[#c4c7c5]">
                <span class="bg-yellow-400/10 text-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5">{{ idx + 1 }}</span>
                <span>{{ reason }}</span>
              </li>
            </ul>
          </div>

          <!-- Platform Rules -->
          <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746]">
            <h3 class="text-sm font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-blue-400 text-[20px]">gavel</span>
              平台规则合规性
            </h3>
            <div class="flex items-center gap-2 mb-3">
              <span :class="result.platformRules.compliant ? 'text-green-400' : 'text-red-400'" class="material-symbols-outlined">
                {{ result.platformRules.compliant ? 'check_circle' : 'cancel' }}
              </span>
              <span :class="result.platformRules.compliant ? 'text-green-400' : 'text-red-400'" class="font-medium text-sm">
                {{ result.platformRules.compliant ? '合规' : '存在风险' }}
              </span>
            </div>
            <p class="text-sm text-[#c4c7c5] leading-relaxed">
              {{ result.platformRules.notes }}
            </p>
          </div>
        </div>

        <!-- SMART Analysis -->
        <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746]">
          <h3 class="text-sm font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-purple-400 text-[20px]">psychology</span>
            SMART 评估模型
          </h3>
          <div class="grid grid-cols-5 gap-2">
            <div v-for="(val, key) in result.smartAnalysis" :key="key" class="bg-[#1e1f20] p-3 rounded-lg border border-[#444746]">
              <div class="text-[10px] font-black text-[#5f6368] uppercase mb-1">
                {{ key }}
              </div>
              <div class="text-xs text-[#e3e3e3] leading-snug">
                {{ val }}
              </div>
            </div>
          </div>
        </div>

        <!-- Suggestions -->
        <div class="bg-[#28292a] p-5 rounded-xl border border-[#444746]">
          <h3 class="text-sm font-bold text-[#e3e3e3] mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-green-400 text-[20px]">edit_note</span>
            修改建议
          </h3>
          <div class="space-y-3">
            <div v-for="(sugg, idx) in result.suggestions" :key="idx" class="flex gap-3 bg-[#1e1f20] p-3 rounded-lg border border-[#444746]">
              <span class="material-symbols-outlined text-green-400 text-[18px] shrink-0">arrow_right_alt</span>
              <span class="text-sm text-[#c4c7c5]">{{ sugg }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 6px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background-color: #444746;
  border-radius: 20px;
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
