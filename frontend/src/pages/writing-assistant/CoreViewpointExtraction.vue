<script setup lang="ts">
import { ref, computed } from 'vue'

const { token } = useAuth()

const emit = defineEmits<{
  (e: 'analysis-complete', result: any): void
}>()

const videoFile = ref<File | null>(null)
const videoUrl = ref<string>('')
const isAnalyzing = ref(false)
const analysisResult = ref<any>(null)
const activeTab = ref('viewpoint')

const tabs = [
  { id: 'viewpoint', label: '核心观点' },
  { id: 'logic', label: '论证逻辑' },
  { id: 'materials', label: '素材/金句' },
  { id: 'emotion', label: '情绪曲线' }
]

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    videoFile.value = file
    videoUrl.value = URL.createObjectURL(file)
  }
}

const startAnalysis = async () => {
  if (!videoFile.value && !videoUrl.value) return

  isAnalyzing.value = true
  analysisResult.value = null

  try {
    const prompt = `请生成一份关于"在不确定的时代，如何建立个人反脆弱能力"的视频深度分析报告。
请返回严格的 JSON 格式，不要包含 markdown 代码块标记，结构如下：
{
  "coreTopic": "核心议题",
  "viewpointSummary": "观点总结（100字左右）",
  "argumentLogic": [
    { "stage": "阶段（如：引入、立论、论证、建议）", "content": "内容描述", "method": "论证方法（如：痛点直击、概念重构、比喻/引用、行动呼吁）" }
  ],
  "caseExamples": [
    { "title": "案例标题", "description": "案例描述" }
  ],
  "goldenSentences": [
    "金句1", "金句2", "金句3"
  ],
  "emotionCurve": [
    { "time": "时间点（如00:00）", "value": 数值(0-100), "label": "情绪标签", "desc": "描述" }
  ]
}
确保生成的数据丰富、有深度，符合反脆弱的主题。`

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '你是一个专业的视频内容分析专家，擅长提炼核心观点和逻辑结构。请只返回 JSON 格式的数据。' },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-4o', // 或者其他可用模型
        temperature: 0.7
      })
    })

    if (!response.ok) {
      throw new Error('Analysis failed')
    }

    const data = await response.json()

    // 分发 token 使用事件
    if (data.usage) {
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: data.usage.total_tokens
        }
      }))
    }

    let content = data.choices[0].message.content
    // 清理可能的 markdown 标记
    content = content.replace(/```json\n?|\n?```/g, '').trim()

    analysisResult.value = JSON.parse(content)
    emit('analysis-complete', analysisResult.value)
  } catch (error) {
    console.error('Analysis error:', error)
    // Fallback or error handling
  } finally {
    isAnalyzing.value = false
  }
}

const clearVideo = () => {
  videoFile.value = null
  videoUrl.value = ''
  analysisResult.value = null
}
</script>

<template>
  <div class="h-full flex flex-col bg-[#1e1f20] text-[#e3e3e3] overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-[#444746] flex justify-between items-center bg-[#28292a]">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-purple-400">psychology</span>
        <h2 class="text-sm font-medium">
          提炼核心观点
        </h2>
      </div>
      <div class="text-xs text-[#c4c7c5]">
        AI 深度逻辑提取
      </div>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- Left: Video Input -->
      <div class="w-1/3 border-r border-[#444746] flex flex-col p-4 gap-4 bg-[#1e1f20]">
        <div
          v-if="!videoUrl"
          class="flex-1 border-2 border-dashed border-[#444746] rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#a8c7fa] hover:bg-[#28292a] transition cursor-pointer relative"
        >
          <input
            type="file"
            accept="video/*"
            class="absolute inset-0 opacity-0 cursor-pointer"
            @change="handleFileUpload"
          >
          <span class="material-symbols-outlined text-4xl text-[#5f6368]">video_file</span>
          <div class="text-center">
            <p class="text-sm font-medium text-[#e3e3e3]">
              上传视频文件
            </p>
            <p class="text-xs text-[#c4c7c5] mt-1">
              支持 MP4, MOV (最大 500MB)
            </p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col gap-3">
          <div class="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[60vh] flex items-center justify-center">
            <video :src="videoUrl" controls class="w-full h-full object-contain" />
            <button
              class="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full hover:bg-red-500/80 transition text-white"
              @click="clearVideo"
            >
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <button
            :disabled="isAnalyzing"
            class="w-full py-3 bg-[#a8c7fa] text-black rounded-full font-medium flex items-center justify-center gap-2 hover:bg-[#d3e3fd] transition disabled:opacity-50 disabled:cursor-not-allowed"
            @click="startAnalysis"
          >
            <span v-if="isAnalyzing" class="material-symbols-outlined text-lg animate-spin">sync</span>
            <span v-else class="material-symbols-outlined text-lg">auto_awesome</span>
            {{ isAnalyzing ? '正在提炼观点...' : '开始深度提炼' }}
          </button>
        </div>
      </div>

      <!-- Right: Analysis Result -->
      <div class="flex-1 flex flex-col bg-[#131314]">
        <div v-if="!analysisResult" class="flex-1 flex flex-col items-center justify-center text-[#5f6368] gap-4">
          <span class="material-symbols-outlined text-6xl opacity-20">lightbulb</span>
          <div class="text-center">
            <p class="text-sm">
              上传视频后点击分析
            </p>
            <p class="text-xs mt-1">
              AI 将自动提炼核心议题、论证逻辑与金句语录
            </p>
          </div>
        </div>

        <div v-else class="flex-1 flex flex-col overflow-hidden">
          <!-- Tabs -->
          <div class="flex border-b border-[#444746] bg-[#1e1f20]">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="[
                'px-6 py-3 text-xs font-medium transition-all relative',
                activeTab === tab.id ? 'text-[#a8c7fa]' : 'text-[#c4c7c5] hover:text-[#e3e3e3]'
              ]"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <div v-if="activeTab === tab.id" class="absolute bottom-0 left-0 right-0 h-0.5 bg-[#a8c7fa]" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 custom-scroll">
            <!-- 1. 核心观点 (Viewpoint) -->
            <div v-if="activeTab === 'viewpoint'" class="space-y-6">
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">topic</span> 核心议题
                </h3>
                <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746]">
                  <p class="text-base font-medium text-white">
                    {{ analysisResult.coreTopic }}
                  </p>
                </div>
              </div>

              <div class="space-y-3">
                <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">summarize</span> 观点总结
                </h3>
                <div class="bg-[#28292a] p-4 rounded-xl border border-[#444746]">
                  <p class="text-sm text-[#e3e3e3] leading-relaxed">
                    {{ analysisResult.viewpointSummary }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 2. 论证逻辑 (Logic) -->
            <div v-if="activeTab === 'logic'" class="space-y-6">
              <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                <span class="material-symbols-outlined text-lg">account_tree</span> 逻辑推演链
              </h3>
              <div class="space-y-4 relative">
                <!-- Vertical Line -->
                <div class="absolute left-4 top-4 bottom-4 w-0.5 bg-[#444746]" />

                <div v-for="(item, idx) in analysisResult.argumentLogic" :key="idx" class="relative pl-10">
                  <div class="absolute left-[11px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#a8c7fa] border-2 border-[#1e1f20]" />
                  <div class="bg-[#28292a] p-3 rounded-lg border border-[#444746]">
                    <div class="flex justify-between items-center mb-1">
                      <span class="text-xs font-bold text-[#a8c7fa]">{{ item.stage }}</span>
                      <span class="text-[10px] bg-[#353637] px-2 py-0.5 rounded text-[#c4c7c5]">{{ item.method }}</span>
                    </div>
                    <p class="text-xs text-[#e3e3e3]">
                      {{ item.content }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. 素材/金句 (Materials) -->
            <div v-if="activeTab === 'materials'" class="space-y-6">
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">format_quote</span> 金句语录
                </h3>
                <div class="grid gap-3">
                  <div v-for="(sentence, idx) in analysisResult.goldenSentences" :key="idx" class="bg-gradient-to-r from-[#28292a] to-[#1e1f20] p-4 rounded-lg border-l-4 border-[#a8c7fa] italic">
                    <p class="text-sm text-[#e3e3e3]">
                      "{{ sentence }}"
                    </p>
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                  <span class="material-symbols-outlined text-lg">dataset</span> 案例素材
                </h3>
                <div class="space-y-2">
                  <div v-for="(example, idx) in analysisResult.caseExamples" :key="idx" class="bg-[#28292a] p-3 rounded-lg border border-[#444746]">
                    <div class="text-xs font-bold text-white mb-1">
                      {{ example.title }}
                    </div>
                    <p class="text-xs text-[#c4c7c5]">
                      {{ example.description }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. 情绪曲线 (Emotion) -->
            <div v-if="activeTab === 'emotion'" class="space-y-6">
              <h3 class="text-sm font-medium text-[#a8c7fa] flex items-center gap-2">
                <span class="material-symbols-outlined text-lg">monitor_heart</span> 情绪变化曲线
              </h3>
              <div class="bg-[#28292a] p-6 rounded-xl border border-[#444746] flex flex-col gap-4">
                <!-- Simple Visualization Representation -->
                <div class="h-40 flex items-end justify-between gap-2 px-2 relative border-b border-[#444746]">
                  <div v-for="(point, idx) in analysisResult.emotionCurve" :key="idx" class="flex flex-col items-center gap-2 group w-full">
                    <div
                      class="w-full bg-[#a8c7fa]/20 rounded-t-sm relative hover:bg-[#a8c7fa]/40 transition-all duration-300 group-hover:h-full"
                      :style="{ height: point.value + '%' }"
                    >
                      <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                        {{ point.label }} ({{ point.value }})
                      </div>
                    </div>
                    <div class="text-[10px] text-[#c4c7c5]">
                      {{ point.time }}
                    </div>
                  </div>
                </div>
                <div class="space-y-2 mt-2">
                  <div v-for="(point, idx) in analysisResult.emotionCurve" :key="idx" class="flex items-center gap-3 text-xs">
                    <span class="text-[#a8c7fa] w-10">{{ point.time }}</span>
                    <span class="font-medium text-white w-16">{{ point.label }}</span>
                    <span class="text-[#c4c7c5]">{{ point.desc }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
</style>
