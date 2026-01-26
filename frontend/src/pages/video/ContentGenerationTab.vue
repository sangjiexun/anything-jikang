<template>
  <div class="space-y-8">
    <!-- 功能选择标签 -->
    <div class="bg-[#28292a] p-6 rounded-2xl border border-[#444746]">
      <div class="flex flex-wrap gap-3 mb-6">
        <button
          v-for="tab in contentTabs"
          :key="tab.id"
          :class="[
            'px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
            activeContentTab === tab.id
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
              : 'bg-[#353637] text-[#c4c7c5] hover:bg-[#444746]'
          ]"
          @click="activeContentTab = tab.id"
        >
          <span class="material-symbols-outlined text-lg">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- 口播二创 -->
      <div v-if="activeContentTab === 'narration'" class="space-y-6">
        <div class="flex items-center gap-4 mb-4">
          <span class="material-symbols-outlined text-2xl text-orange-400">record_voice_over</span>
          <h3 class="text-xl font-bold text-[#e3e3e3]">口播二创</h3>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- 原始内容 -->
          <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#5f6368]">
            <h4 class="font-bold text-[#a8c7fa] mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined">article</span>
              原始文案
            </h4>
            <textarea
              v-model="narrationState.originalText"
              placeholder="请输入或粘贴原始口播文案..."
              class="w-full h-40 bg-[#28292a] text-[#e3e3e3] p-3 rounded-lg border border-[#444746] resize-none focus:border-[#a8c7fa] focus:outline-none"
            />
          </div>
          
          <!-- 二创设置 -->
          <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#5f6368]">
            <h4 class="font-bold text-[#a8c7fa] mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined">tune</span>
              二创设置
            </h4>
            <div class="space-y-4">
              <div>
                <label class="text-[#c4c7c5] text-sm mb-2 block">风格选择</label>
                <select v-model="narrationState.style" class="w-full bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746]">
                  <option value="professional">专业正式</option>
                  <option value="casual">轻松随意</option>
                  <option value="humorous">幽默风趣</option>
                  <option value="emotional">情感共鸣</option>
                  <option value="storytelling">故事叙述</option>
                </select>
              </div>
              <div>
                <label class="text-[#c4c7c5] text-sm mb-2 block">目标平台</label>
                <select v-model="narrationState.platform" class="w-full bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746]">
                  <option value="douyin">抖音</option>
                  <option value="xiaohongshu">小红书</option>
                  <option value="bilibili">B站</option>
                  <option value="kuaishou">快手</option>
                  <option value="wechat">视频号</option>
                </select>
              </div>
              <div>
                <label class="text-[#c4c7c5] text-sm mb-2 block">字数要求</label>
                <input
                  v-model.number="narrationState.wordCount"
                  type="number"
                  placeholder="目标字数"
                  class="w-full bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746]"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 生成按钮 -->
        <div class="flex justify-center">
          <button
            :disabled="narrationState.isGenerating || !narrationState.originalText"
            @click="generateNarration"
            class="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-3"
          >
            <span v-if="narrationState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
            <span v-else class="material-symbols-outlined">auto_fix_high</span>
            {{ narrationState.isGenerating ? '生成中...' : '生成口播二创' }}
          </button>
        </div>

        <!-- 生成结果 -->
        <div v-if="narrationState.result" class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368]">
          <h4 class="font-bold text-lg text-orange-400 mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined">check_circle</span>
            二创结果
          </h4>
          <div class="bg-[#28292a] p-4 rounded-lg">
            <pre class="text-sm text-[#e3e3e3] whitespace-pre-wrap">{{ narrationState.result }}</pre>
          </div>
          <div class="flex gap-3 mt-4">
            <button @click="copyToClipboard(narrationState.result)" class="px-4 py-2 bg-[#444746] hover:bg-[#5f6368] text-white rounded-lg text-sm">
              复制文案
            </button>
            <button @click="exportNarration" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">
              导出文件
            </button>
          </div>
        </div>
      </div>

      <!-- 脚本生成 -->
      <div v-if="activeContentTab === 'script'" class="space-y-6">
        <div class="flex items-center gap-4 mb-4">
          <span class="material-symbols-outlined text-2xl text-blue-400">description</span>
          <h3 class="text-xl font-bold text-[#e3e3e3]">脚本生成</h3>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- 主题输入 -->
          <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#5f6368]">
            <h4 class="font-bold text-[#a8c7fa] mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined">topic</span>
              视频主题
            </h4>
            <textarea
              v-model="scriptState.topic"
              placeholder="请输入视频主题或关键词..."
              class="w-full h-24 bg-[#28292a] text-[#e3e3e3] p-3 rounded-lg border border-[#444746] resize-none focus:border-[#a8c7fa] focus:outline-none"
            />
            <div class="mt-3">
              <label class="text-[#c4c7c5] text-sm mb-2 block">参考素材（可选）</label>
              <textarea
                v-model="scriptState.reference"
                placeholder="粘贴参考文章或素材..."
                class="w-full h-24 bg-[#28292a] text-[#e3e3e3] p-3 rounded-lg border border-[#444746] resize-none focus:border-[#a8c7fa] focus:outline-none"
              />
            </div>
          </div>

          <!-- 脚本设置 -->
          <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#5f6368]">
            <h4 class="font-bold text-[#a8c7fa] mb-3 flex items-center gap-2">
              <span class="material-symbols-outlined">settings</span>
              脚本设置
            </h4>
            <div class="space-y-4">
              <div>
                <label class="text-[#c4c7c5] text-sm mb-2 block">视频类型</label>
                <select v-model="scriptState.videoType" class="w-full bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746]">
                  <option value="knowledge">知识分享</option>
                  <option value="vlog">Vlog日常</option>
                  <option value="tutorial">教程讲解</option>
                  <option value="review">产品测评</option>
                  <option value="story">故事叙述</option>
                  <option value="news">新闻资讯</option>
                </select>
              </div>
              <div>
                <label class="text-[#c4c7c5] text-sm mb-2 block">视频时长</label>
                <select v-model="scriptState.duration" class="w-full bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746]">
                  <option value="15">15秒短视频</option>
                  <option value="30">30秒短视频</option>
                  <option value="60">1分钟视频</option>
                  <option value="180">3分钟视频</option>
                  <option value="300">5分钟视频</option>
                </select>
              </div>
              <div class="flex items-center gap-3">
                <input type="checkbox" v-model="scriptState.includeHook" id="includeHook" class="w-4 h-4">
                <label for="includeHook" class="text-[#c4c7c5] text-sm">包含开场钩子</label>
              </div>
              <div class="flex items-center gap-3">
                <input type="checkbox" v-model="scriptState.includeCTA" id="includeCTA" class="w-4 h-4">
                <label for="includeCTA" class="text-[#c4c7c5] text-sm">包含行动号召</label>
              </div>
            </div>
          </div>
        </div>

        <!-- 生成按钮 -->
        <div class="flex justify-center">
          <button
            :disabled="scriptState.isGenerating || !scriptState.topic"
            @click="generateScript"
            class="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-3"
          >
            <span v-if="scriptState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
            <span v-else class="material-symbols-outlined">movie_creation</span>
            {{ scriptState.isGenerating ? '生成中...' : '生成视频脚本' }}
          </button>
        </div>

        <!-- 脚本结果 -->
        <div v-if="scriptState.result" class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368]">
          <h4 class="font-bold text-lg text-blue-400 mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined">movie</span>
            生成的脚本
          </h4>
          <div class="space-y-4">
            <div v-if="scriptState.result.hook" class="bg-[#28292a] p-4 rounded-lg border-l-4 border-yellow-500">
              <p class="text-yellow-400 font-bold mb-2">🎣 开场钩子</p>
              <p class="text-[#e3e3e3]">{{ scriptState.result.hook }}</p>
            </div>
            <div class="bg-[#28292a] p-4 rounded-lg">
              <p class="text-[#a8c7fa] font-bold mb-2">📝 主体内容</p>
              <pre class="text-sm text-[#e3e3e3] whitespace-pre-wrap">{{ scriptState.result.content }}</pre>
            </div>
            <div v-if="scriptState.result.cta" class="bg-[#28292a] p-4 rounded-lg border-l-4 border-green-500">
              <p class="text-green-400 font-bold mb-2">📢 行动号召</p>
              <p class="text-[#e3e3e3]">{{ scriptState.result.cta }}</p>
            </div>
          </div>
          <div class="flex gap-3 mt-4">
            <button @click="copyToClipboard(formatScript(scriptState.result))" class="px-4 py-2 bg-[#444746] hover:bg-[#5f6368] text-white rounded-lg text-sm">
              复制脚本
            </button>
            <button @click="exportScript" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              导出脚本
            </button>
            <button @click="$emit('export-to-jianying')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">
              导出剪映
            </button>
          </div>
        </div>
      </div>

      <!-- 续写功能 -->
      <div v-if="activeContentTab === 'continue'" class="space-y-6">
        <div class="flex items-center gap-4 mb-4">
          <span class="material-symbols-outlined text-2xl text-purple-400">edit_note</span>
          <h3 class="text-xl font-bold text-[#e3e3e3]">智能续写</h3>
        </div>

        <div class="bg-[#1e1f20] p-4 rounded-xl border border-[#5f6368]">
          <h4 class="font-bold text-[#a8c7fa] mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined">text_fields</span>
            输入已有内容
          </h4>
          <textarea
            v-model="continueState.existingText"
            placeholder="请输入已有的文案内容，AI将为您续写..."
            class="w-full h-48 bg-[#28292a] text-[#e3e3e3] p-3 rounded-lg border border-[#444746] resize-none focus:border-[#a8c7fa] focus:outline-none"
          />
          <div class="flex items-center justify-between mt-3">
            <span class="text-[#5f6368] text-sm">{{ continueState.existingText.length }} 字</span>
            <div class="flex gap-3">
              <select v-model="continueState.continueLength" class="bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746] text-sm">
                <option value="short">续写100字</option>
                <option value="medium">续写300字</option>
                <option value="long">续写500字</option>
              </select>
              <select v-model="continueState.tone" class="bg-[#28292a] text-[#e3e3e3] p-2 rounded-lg border border-[#444746] text-sm">
                <option value="same">保持原风格</option>
                <option value="formal">正式风格</option>
                <option value="casual">轻松风格</option>
                <option value="creative">创意风格</option>
              </select>
            </div>
          </div>
        </div>

        <!-- 续写按钮 -->
        <div class="flex justify-center">
          <button
            :disabled="continueState.isGenerating || !continueState.existingText"
            @click="generateContinuation"
            class="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-3"
          >
            <span v-if="continueState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
            <span v-else class="material-symbols-outlined">auto_awesome</span>
            {{ continueState.isGenerating ? '续写中...' : '智能续写' }}
          </button>
        </div>

        <!-- 续写结果 -->
        <div v-if="continueState.result" class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368]">
          <h4 class="font-bold text-lg text-purple-400 mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined">auto_fix</span>
            续写结果
          </h4>
          <div class="bg-[#28292a] p-4 rounded-lg">
            <p class="text-[#5f6368] text-sm mb-2">原文：</p>
            <p class="text-[#c4c7c5] mb-4">{{ continueState.existingText }}</p>
            <p class="text-purple-400 text-sm mb-2">续写内容：</p>
            <pre class="text-sm text-[#e3e3e3] whitespace-pre-wrap">{{ continueState.result }}</pre>
          </div>
          <div class="flex gap-3 mt-4">
            <button @click="copyToClipboard(continueState.existingText + continueState.result)" class="px-4 py-2 bg-[#444746] hover:bg-[#5f6368] text-white rounded-lg text-sm">
              复制完整内容
            </button>
            <button @click="appendToContinue" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm">
              继续续写
            </button>
          </div>
        </div>
      </div>

      <!-- 原有的内容生成功能 -->
      <div v-if="activeContentTab === 'auto'" class="space-y-6">
        <div class="flex items-center gap-4 mb-4">
          <span class="material-symbols-outlined text-2xl text-green-400">create</span>
          <h3 class="text-xl font-bold text-[#e3e3e3]">智能内容生成</h3>
        </div>

        <!-- 生成按钮 -->
        <div class="flex justify-center mb-8">
          <button
            :disabled="contentGenerationState.isGenerating"
            @click="$emit('generate-content')"
            class="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-3 disabled:cursor-not-allowed"
          >
            <span v-if="contentGenerationState.isGenerating" class="material-symbols-outlined animate-spin">sync</span>
            <span v-else class="material-symbols-outlined">auto_awesome</span>
            {{ contentGenerationState.isGenerating ? '生成中...' : '开始内容生成' }}
          </button>
        </div>

        <!-- 进度显示 -->
        <div v-if="contentGenerationState.isGenerating" class="bg-[#353637] p-4 rounded-xl mb-6">
          <div class="flex items-center gap-3">
            <div class="w-5 h-5 bg-green-500 rounded-full animate-ping"></div>
            <div>
              <p class="font-medium text-[#e3e3e3]">{{ contentGenerationState.message }}</p>
              <div class="w-full bg-[#444746] rounded-full h-2 mt-2">
                <div
                  class="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${contentGenerationState.progress}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 生成结果 -->
        <div v-if="contentGenerationState.generatedContent" class="space-y-8">
          <!-- 视频脚本 -->
          <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368] shadow-md">
            <h4 class="font-bold text-lg text-blue-400 mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined">video_file</span>
              视频脚本
            </h4>
            <div class="prose prose-sm max-w-none text-[#e3e3e3] bg-[#28292a] p-4 rounded-lg">
              <p><strong>标题：</strong>{{ contentGenerationState.generatedContent.videoScript.title }}</p>
              <p><strong>时长：</strong>{{ contentGenerationState.generatedContent.videoScript.duration }}秒</p>
              <p><strong>脚本内容：</strong></p>
              <pre class="text-sm bg-black/20 p-3 rounded overflow-x-auto">{{ contentGenerationState.generatedContent.videoScript.content }}</pre>
            </div>
          </div>

          <!-- 社交媒体文案 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368] shadow-md">
              <h4 class="font-bold text-lg text-purple-400 mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined">smart_toy</span>
                抖音文案
              </h4>
              <div class="bg-[#28292a] p-4 rounded-lg">
                <pre class="text-sm text-[#e3e3e3] whitespace-pre-wrap">{{ contentGenerationState.generatedContent.socialMedia.douyin }}</pre>
              </div>
            </div>
            <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368] shadow-md">
              <h4 class="font-bold text-lg text-pink-400 mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined">book</span>
                小红书文案
              </h4>
              <div class="bg-[#28292a] p-4 rounded-lg">
                <pre class="text-sm text-[#e3e3e3] whitespace-pre-wrap">{{ contentGenerationState.generatedContent.socialMedia.xiaohongshu }}</pre>
              </div>
            </div>
          </div>

          <!-- 剪映导出 -->
          <div class="bg-[#1e1f20] p-6 rounded-xl border border-[#5f6368] shadow-md">
            <h4 class="font-bold text-lg text-blue-400 mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined">video_settings</span>
              剪映脚本导出
            </h4>
            <div class="space-y-4">
              <div class="bg-[#28292a] p-4 rounded-lg">
                <p class="text-sm text-[#c4c7c5] mb-3">脚本预览:</p>
                <pre class="text-xs bg-black/20 p-3 rounded text-[#e3e3e3] max-h-40 overflow-y-auto">{{ contentGenerationState.generatedContent.jianyingExport.script }}</pre>
              </div>
              <div class="flex gap-3">
                <button @click="$emit('export-to-jianying')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  下载剪映脚本 (.txt)
                </button>
                <button @click="$emit('copy-jianying-script')" class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                  复制脚本
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

const props = defineProps({
  analysisResult: {
    type: Object,
    required: true
  },
  contentGenerationState: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['generate-content', 'export-to-jianying', 'copy-jianying-script'])

// 功能标签
const contentTabs = [
  { id: 'narration', label: '口播二创', icon: 'record_voice_over' },
  { id: 'script', label: '脚本生成', icon: 'description' },
  { id: 'continue', label: '智能续写', icon: 'edit_note' },
  { id: 'auto', label: '自动生成', icon: 'auto_awesome' }
]

const activeContentTab = ref('narration')

// 口播二创状态
const narrationState = reactive({
  originalText: '',
  style: 'professional',
  platform: 'douyin',
  wordCount: 300,
  isGenerating: false,
  result: ''
})

// 脚本生成状态
const scriptState = reactive({
  topic: '',
  reference: '',
  videoType: 'knowledge',
  duration: '60',
  includeHook: true,
  includeCTA: true,
  isGenerating: false,
  result: null as { hook?: string; content: string; cta?: string } | null
})

// 续写状态
const continueState = reactive({
  existingText: '',
  continueLength: 'medium',
  tone: 'same',
  isGenerating: false,
  result: ''
})

// 获取token
const getToken = () => {
  return localStorage.getItem('auth_token') || ''
}

// 生成口播二创
const generateNarration = async () => {
  if (!narrationState.originalText) return
  
  narrationState.isGenerating = true
  try {
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的短视频口播文案创作专家。请根据用户提供的原始文案，进行二次创作。
要求：
1. 风格：${narrationState.style === 'professional' ? '专业正式' : narrationState.style === 'casual' ? '轻松随意' : narrationState.style === 'humorous' ? '幽默风趣' : narrationState.style === 'emotional' ? '情感共鸣' : '故事叙述'}
2. 目标平台：${narrationState.platform}
3. 目标字数：约${narrationState.wordCount}字
4. 保持原文核心观点，但用更吸引人的方式表达
5. 适合口播朗读，语句流畅自然`
          },
          {
            role: 'user',
            content: `请对以下口播文案进行二次创作：\n\n${narrationState.originalText}`
          }
        ],
        stream: false
      })
    })

    const data = await response.json()
    narrationState.result = data.choices?.[0]?.message?.content || '生成失败'
  } catch (error) {
    console.error('生成口播二创失败:', error)
    narrationState.result = '生成失败，请重试'
  } finally {
    narrationState.isGenerating = false
  }
}

// 生成脚本
const generateScript = async () => {
  if (!scriptState.topic) return
  
  scriptState.isGenerating = true
  try {
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的短视频脚本创作专家。请根据用户提供的主题创作视频脚本。
要求：
1. 视频类型：${scriptState.videoType}
2. 视频时长：${scriptState.duration}秒
3. ${scriptState.includeHook ? '需要包含吸引人的开场钩子' : ''}
4. ${scriptState.includeCTA ? '需要包含行动号召' : ''}
5. 脚本要适合口播，语言自然流畅

请以JSON格式返回，包含以下字段：
{
  "hook": "开场钩子（如果需要）",
  "content": "主体内容",
  "cta": "行动号召（如果需要）"
}`
          },
          {
            role: 'user',
            content: `主题：${scriptState.topic}\n${scriptState.reference ? `参考素材：${scriptState.reference}` : ''}`
          }
        ],
        stream: false
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''
    
    try {
      // 尝试解析JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        scriptState.result = JSON.parse(jsonMatch[0])
      } else {
        scriptState.result = { content }
      }
    } catch {
      scriptState.result = { content }
    }
  } catch (error) {
    console.error('生成脚本失败:', error)
    scriptState.result = { content: '生成失败，请重试' }
  } finally {
    scriptState.isGenerating = false
  }
}

// 生成续写
const generateContinuation = async () => {
  if (!continueState.existingText) return
  
  continueState.isGenerating = true
  try {
    const lengthMap = { short: 100, medium: 300, long: 500 }
    const targetLength = lengthMap[continueState.continueLength as keyof typeof lengthMap]
    
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的文案续写专家。请根据用户提供的已有内容，自然地续写下去。
要求：
1. 续写约${targetLength}字
2. 风格：${continueState.tone === 'same' ? '保持与原文一致的风格' : continueState.tone === 'formal' ? '正式风格' : continueState.tone === 'casual' ? '轻松风格' : '创意风格'}
3. 内容要与原文自然衔接，逻辑连贯
4. 直接输出续写内容，不要重复原文`
          },
          {
            role: 'user',
            content: `请续写以下内容：\n\n${continueState.existingText}`
          }
        ],
        stream: false
      })
    })

    const data = await response.json()
    continueState.result = data.choices?.[0]?.message?.content || '生成失败'
  } catch (error) {
    console.error('续写失败:', error)
    continueState.result = '生成失败，请重试'
  } finally {
    continueState.isGenerating = false
  }
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('已复制到剪贴板')
  } catch {
    console.error('复制失败')
  }
}

// 格式化脚本
const formatScript = (script: { hook?: string; content: string; cta?: string }) => {
  let result = ''
  if (script.hook) result += `【开场钩子】\n${script.hook}\n\n`
  result += `【主体内容】\n${script.content}`
  if (script.cta) result += `\n\n【行动号召】\n${script.cta}`
  return result
}

// 导出口播文案
const exportNarration = () => {
  const blob = new Blob([narrationState.result], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `口播二创_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// 导出脚本
const exportScript = () => {
  if (!scriptState.result) return
  const content = formatScript(scriptState.result)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `视频脚本_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// 继续续写
const appendToContinue = () => {
  continueState.existingText += continueState.result
  continueState.result = ''
}
</script>

<style scoped>
/* Component-specific styles if needed */
</style>
