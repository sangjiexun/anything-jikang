<template>
  <div v-if="visible" class="style-rewriter-overlay" @click="$emit('close')">
    <div class="style-rewriter-container" @click.stop>
      <div class="rewriter-header">
        <h3 class="rewriter-title">
          🎨 文章风格重写
        </h3>
        <button class="close-button" @click="$emit('close')">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            />
          </svg>
        </button>
      </div>

      <div class="rewriter-content">
        <!-- 风格选择标签页 -->
        <div class="style-tabs">
          <button
            :class="['tab-button', { active: activeTab === 'preset' }]"
            @click="activeTab = 'preset'"
          >
            <svg
              class="tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            预设风格
          </button>
          <button
            :class="['tab-button', { active: activeTab === 'upload' }]"
            @click="activeTab = 'upload'"
          >
            <svg
              class="tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h8" />
              <path d="M17 6l5 5-5 5" />
            </svg>
            上传文档
          </button>
          <button
            :class="['tab-button', { active: activeTab === 'paste' }]"
            @click="activeTab = 'paste'"
          >
            <svg
              class="tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="8"
                y="2"
                width="8"
                height="4"
                rx="1"
                ry="1"
              />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
            粘贴文本
          </button>
        </div>

        <!-- 预设风格 -->
        <div v-if="activeTab === 'preset'" class="preset-styles">
          <h4 class="section-title">
            选择写作风格
          </h4>
          <div class="styles-grid">
            <div
              v-for="style in presetStyles"
              :key="style.id"
              :class="['style-card', { selected: selectedStyle?.id === style.id }]"
              @click="selectPresetStyle(style)"
            >
              <div class="style-header">
                <span class="style-emoji">{{ style.emoji }}</span>
                <h5 class="style-name">
                  {{ style.name }}
                </h5>
              </div>
              <p class="style-description">
                {{ style.description }}
              </p>
              <div class="style-features">
                <span
                  v-for="feature in style.features"
                  :key="feature"
                  class="feature-tag"
                >
                  {{ feature }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 上传文档 -->
        <div v-if="activeTab === 'upload'" class="upload-section">
          <h4 class="section-title">
            上传参考文档
          </h4>
          <div class="upload-area">
            <input
              ref="fileInput"
              type="file"
              accept=".txt,.doc,.docx,.pdf"
              class="file-input"
              @change="handleFileUpload"
            >
            <div
              class="upload-zone"
              @click="$refs.fileInput?.click()"
              @dragover.prevent
              @drop.prevent="handleFileDrop"
            >
              <svg
                class="upload-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line
                  x1="12"
                  y1="3"
                  x2="12"
                  y2="15"
                />
              </svg>
              <div class="upload-text">
                <p class="upload-title">
                  点击上传或拖拽文件到此处
                </p>
                <p class="upload-subtitle">
                  支持 TXT、DOC、DOCX、PDF 格式
                </p>
              </div>
            </div>

            <!-- 上传的文件列表 -->
            <div v-if="uploadedFiles.length > 0" class="uploaded-files">
              <h5 class="files-title">
                已上传文件
              </h5>
              <div
                v-for="(file, index) in uploadedFiles"
                :key="index"
                class="file-item"
              >
                <div class="file-info">
                  <svg
                    class="file-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                  </svg>
                  <div class="file-details">
                    <span class="file-name">{{ file.name }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                  </div>
                </div>
                <button class="remove-file" @click="removeFile(index)">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line
                      x1="18"
                      y1="6"
                      x2="6"
                      y2="18"
                    />
                    <line
                      x1="6"
                      y1="6"
                      x2="18"
                      y2="18"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 粘贴文本 -->
        <div v-if="activeTab === 'paste'" class="paste-section">
          <h4 class="section-title">
            粘贴参考文本
          </h4>
          <div class="paste-area">
            <textarea
              v-model="pastedText"
              placeholder="请粘贴您想要模仿的文章风格文本..."
              class="paste-textarea"
              rows="12"
            />
            <div class="paste-info">
              <span class="text-count">{{ pastedText.length }} 字符</span>
              <button
                v-if="pastedText"
                :disabled="analyzingStyle"
                class="analyze-button"
                @click="analyzeTextStyle"
              >
                <svg
                  v-if="!analyzingStyle"
                  class="button-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <div v-else class="loading-spinner" />
                {{ analyzingStyle ? '分析中...' : '分析风格' }}
              </button>
            </div>
          </div>

          <!-- 风格分析结果 -->
          <div v-if="analyzedStyle" class="style-analysis">
            <h5 class="analysis-title">
              风格分析结果
            </h5>
            <div class="analysis-content">
              <div class="analysis-item">
                <span class="analysis-label">写作风格</span>
                <span class="analysis-value">{{ analyzedStyle.style }}</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">语言特点</span>
                <span class="analysis-value">{{ analyzedStyle.language }}</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">结构特征</span>
                <span class="analysis-value">{{ analyzedStyle.structure }}</span>
              </div>
              <div class="analysis-item">
                <span class="analysis-label">适用场景</span>
                <span class="analysis-value">{{ analyzedStyle.scenario }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 重写选项 -->
        <div class="rewrite-options">
          <h4 class="section-title">
            重写选项
          </h4>
          <div class="options-grid">
            <label class="option-item">
              <input
                v-model="rewriteOptions.preserveStructure"
                type="checkbox"
                class="option-checkbox"
              >
              <span class="option-label">保持原文结构</span>
            </label>
            <label class="option-item">
              <input
                v-model="rewriteOptions.preserveKeywords"
                type="checkbox"
                class="option-checkbox"
              >
              <span class="option-label">保留关键词</span>
            </label>
            <label class="option-item">
              <input
                v-model="rewriteOptions.enhanceReadability"
                type="checkbox"
                class="option-checkbox"
              >
              <span class="option-label">增强可读性</span>
            </label>
            <label class="option-item">
              <input
                v-model="rewriteOptions.adjustTone"
                type="checkbox"
                class="option-checkbox"
              >
              <span class="option-label">调整语调</span>
            </label>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="rewriter-actions">
          <button class="cancel-button" @click="$emit('close')">
            取消
          </button>
          <button
            :disabled="!canRewrite || rewriting"
            class="rewrite-button"
            @click="startRewrite"
          >
            <svg
              v-if="!rewriting"
              class="button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <div v-else class="loading-spinner" />
            {{ rewriting ? '重写中...' : '开始重写' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface PresetStyle {
  id: string
  name: string
  emoji: string
  description: string
  features: string[]
}

interface AnalyzedStyle {
  style: string
  language: string
  structure: string
  scenario: string
}

interface RewriteOptions {
  preserveStructure: boolean
  preserveKeywords: boolean
  enhanceReadability: boolean
  adjustTone: boolean
}

const props = defineProps<{
  visible: boolean
  originalContent: string
}>()

const emit = defineEmits<{
  close: []
  rewrite: [content: string, style: string]
}>()

// 状态管理
const activeTab = ref<'preset' | 'upload' | 'paste'>('preset')
const selectedStyle = ref<PresetStyle | null>(null)
const uploadedFiles = ref<File[]>([])
const pastedText = ref('')
const analyzedStyle = ref<AnalyzedStyle | null>(null)
const analyzingStyle = ref(false)
const rewriting = ref(false)

const rewriteOptions = ref<RewriteOptions>({
  preserveStructure: true,
  preserveKeywords: true,
  enhanceReadability: true,
  adjustTone: false
})

// 预设风格
const presetStyles: PresetStyle[] = [
  {
    id: 'academic',
    name: '学术论文',
    emoji: '🎓',
    description: '严谨、客观、逻辑清晰的学术写作风格',
    features: ['严谨用词', '逻辑性强', '引用规范', '客观中立']
  },
  {
    id: 'business',
    name: '商务正式',
    emoji: '💼',
    description: '专业、简洁、目标导向的商务写作风格',
    features: ['专业术语', '简洁明了', '结果导向', '正式语调']
  },
  {
    id: 'casual',
    name: '轻松随意',
    emoji: '😊',
    description: '亲切、自然、易懂的日常写作风格',
    features: ['通俗易懂', '亲切自然', '生动有趣', '贴近生活']
  },
  {
    id: 'creative',
    name: '创意文学',
    emoji: '🎨',
    description: '富有想象力、表达丰富的创意写作风格',
    features: ['想象丰富', '修辞多样', '情感充沛', '表达生动']
  },
  {
    id: 'technical',
    name: '技术文档',
    emoji: '⚙️',
    description: '准确、详细、步骤清晰的技术写作风格',
    features: ['准确无误', '步骤清晰', '术语专业', '实用性强']
  },
  {
    id: 'marketing',
    name: '营销推广',
    emoji: '📢',
    description: '吸引人、有说服力的营销写作风格',
    features: ['吸引眼球', '说服力强', '行动导向', '情感共鸣']
  }
]

// 计算属性
const canRewrite = computed(() => {
  return selectedStyle.value || uploadedFiles.value.length > 0 || (pastedText.value && analyzedStyle.value)
})

// 方法
const selectPresetStyle = (style: PresetStyle) => {
  selectedStyle.value = selectedStyle.value?.id === style.id ? null : style
}

const handleFileUpload = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files) {
    addFiles(Array.from(files))
  }
}

const handleFileDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files) {
    addFiles(Array.from(files))
  }
}

const addFiles = (files: File[]) => {
  const validFiles = files.filter((file) => {
    const validTypes = ['.txt', '.doc', '.docx', '.pdf']
    const extension = '.' + file.name.split('.').pop()?.toLowerCase()
    return validTypes.includes(extension) && file.size <= 1024 * 1024 * 1024 // 1GB limit
  })

  if (validFiles.length !== files.length) {
    useNotification().add({
      title: '部分文件不支持',
      description: '只支持 TXT、DOC、DOCX、PDF 格式，且文件大小不超过 1GB',
      type: 'warning'
    })
  }

  uploadedFiles.value.push(...validFiles)
}

const removeFile = (index: number) => {
  uploadedFiles.value.splice(index, 1)
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const analyzeTextStyle = async () => {
  if (!pastedText.value.trim()) return

  analyzingStyle.value = true

  try {
    // 模拟风格分析
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 简单的风格分析逻辑
    const text = pastedText.value
    const sentences = text.split(/[.!?。！？]/).filter(s => s.trim())
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length

    let style = '中性'
    let language = '标准'
    let structure = '常规'
    let scenario = '通用'

    if (avgSentenceLength > 50) {
      style = '正式学术'
      language = '严谨规范'
      structure = '逻辑严密'
      scenario = '学术论文'
    } else if (avgSentenceLength < 20) {
      style = '轻松活泼'
      language = '简洁明快'
      structure = '灵活多变'
      scenario = '日常交流'
    }

    if (text.includes('您') || text.includes('请')) {
      language = '礼貌正式'
      scenario = '商务沟通'
    }

    if (text.includes('哈哈') || text.includes('呢') || text.includes('吧')) {
      style = '亲切随意'
      language = '口语化'
      scenario = '社交媒体'
    }

    analyzedStyle.value = {
      style,
      language,
      structure,
      scenario
    }

    useNotification().add({
      title: '风格分析完成',
      type: 'success'
    })
  } catch (error) {
    useNotification().add({
      title: '风格分析失败',
      type: 'error'
    })
  } finally {
    analyzingStyle.value = false
  }
}

const startRewrite = async () => {
  if (!canRewrite.value) return

  rewriting.value = true

  try {
    let styleDescription = ''

    if (selectedStyle.value) {
      styleDescription = `${selectedStyle.value.name}风格：${selectedStyle.value.description}`
    } else if (analyzedStyle.value) {
      styleDescription = `分析得出的风格：${analyzedStyle.value.style}，${analyzedStyle.value.language}`
    } else if (uploadedFiles.value.length > 0) {
      styleDescription = `基于上传文档的风格`
    }

    // 调用实际的重写API
    const systemPrompt = `你是一个专业的文章风格重写助手。请按照以下风格要求重写文章：
    ${styleDescription}
    
    重写选项：
    ${rewriteOptions.value.preserveStructure ? '- 保持原文结构' : ''}
    ${rewriteOptions.value.preserveKeywords ? '- 保留关键词' : ''}
    ${rewriteOptions.value.enhanceReadability ? '- 增强可读性' : ''}
    ${rewriteOptions.value.adjustTone ? '- 调整语调' : ''}
    
    请直接返回重写后的内容，不要包含其他解释性文字。`

    const response = await fetch('/api/writing-assistant/chat/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: props.originalContent }
        ],
        stream: false
      })
    })

    if (!response.ok) {
      throw new Error('重写请求失败')
    }

    const data = await response.json()
    // 获取token使用情况（如果有）
    if (data.usage) {
      // 触发更新用户余额事件
      window.dispatchEvent(new CustomEvent('token_usage', {
        detail: {
          tokens: data.usage.total_tokens
        }
      }))
    }

    const rewrittenContent = data.choices[0].message.content

    emit('rewrite', rewrittenContent, styleDescription)

    useNotification().add({
      title: '文章重写完成',
      description: `已按照${styleDescription}重写文章`,
      type: 'success'
    })

    emit('close')
  } catch (error) {
    useNotification().add({
      title: '重写失败',
      type: 'error'
    })
  } finally {
    rewriting.value = false
  }
}

// 重置状态
watch(() => props.visible, (visible) => {
  if (visible) {
    activeTab.value = 'preset'
    selectedStyle.value = null
    uploadedFiles.value = []
    pastedText.value = ''
    analyzedStyle.value = null
    rewriteOptions.value = {
      preserveStructure: true,
      preserveKeywords: true,
      enhanceReadability: true,
      adjustTone: false
    }
  }
})
</script>

<style scoped>
.style-rewriter-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.style-rewriter-container {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 56rem;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

.rewriter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.rewriter-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.close-button svg {
  width: 1rem;
  height: 1rem;
}

.rewriter-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 标签页 */
.style-tabs {
  display: flex;
  gap: 0.25rem;
  background: #f3f4f6;
  border-radius: 0.75rem;
  padding: 0.25rem;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-button.active {
  background: white;
  color: #667eea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  width: 1rem;
  height: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

/* 预设风格 */
.styles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1rem;
}

.style-card {
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  background: white;
}

.style-card:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
}

.style-card.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.style-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.style-emoji {
  font-size: 1.5rem;
}

.style-name {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.style-description {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.style-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.feature-tag {
  font-size: 0.75rem;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

/* 上传区域 */
.upload-area {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.file-input {
  display: none;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #f9fafb;
}

.upload-zone:hover {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.upload-icon {
  width: 3rem;
  height: 3rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.upload-text {
  text-align: center;
}

.upload-title {
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
  margin: 0 0 0.25rem 0;
}

.upload-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.uploaded-files {
  background: #f9fafb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.files-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
}

.file-item:last-child {
  margin-bottom: 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #667eea;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.file-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #111827;
}

.file-size {
  font-size: 0.75rem;
  color: #6b7280;
}

.remove-file {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.remove-file:hover {
  background: #fecaca;
}

.remove-file svg {
  width: 0.875rem;
  height: 0.875rem;
}

/* 粘贴区域 */
.paste-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.paste-textarea {
  width: 100%;
  padding: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  background: white;
  color: #111827;
  transition: all 0.15s ease;
}

.paste-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.paste-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-count {
  font-size: 0.75rem;
  color: #6b7280;
}

.analyze-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: none;
  background: #667eea;
  color: white;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.analyze-button:hover:not(:disabled) {
  background: #5a67d8;
}

.analyze-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-icon {
  width: 1rem;
  height: 1rem;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 风格分析结果 */
.style-analysis {
  background: #f0f9ff;
  border: 1px solid #e0f2fe;
  border-radius: 0.75rem;
  padding: 1rem;
}

.analysis-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0c4a6e;
  margin: 0 0 0.75rem 0;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.analysis-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.analysis-label {
  font-size: 0.75rem;
  color: #0369a1;
  font-weight: 500;
}

.analysis-value {
  font-size: 0.75rem;
  color: #0c4a6e;
  font-weight: 600;
}

/* 重写选项 */
.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.option-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}

.option-label {
  font-size: 0.875rem;
  color: #374151;
}

/* 操作按钮 */
.rewriter-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.cancel-button {
  padding: 0.75rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #6b7280;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.rewrite-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.rewrite-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.rewrite-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .style-rewriter-container {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }

  .rewriter-header {
    padding: 1rem;
  }

  .rewriter-content {
    padding: 1rem;
    gap: 1rem;
  }

  .styles-grid {
    grid-template-columns: 1fr;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }

  .rewriter-actions {
    flex-direction: column;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .style-rewriter-container {
    background: #1f2937;
  }

  .rewriter-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .rewriter-title {
    color: #f9fafb;
  }

  .close-button {
    color: #9ca3af;
  }

  .close-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .section-title {
    color: #f9fafb;
  }

  .style-tabs {
    background: #374151;
  }

  .tab-button {
    color: #9ca3af;
  }

  .tab-button.active {
    background: #1f2937;
    color: #60a5fa;
  }

  .style-card {
    background: #111827;
    border-color: #374151;
  }

  .style-card:hover {
    border-color: #667eea;
  }

  .style-card.selected {
    background: rgba(102, 126, 234, 0.1);
  }

  .style-name {
    color: #f9fafb;
  }

  .style-description {
    color: #9ca3af;
  }

  .upload-zone {
    background: #111827;
    border-color: #4b5563;
  }

  .upload-zone:hover {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
  }

  .upload-title {
    color: #d1d5db;
  }

  .upload-subtitle {
    color: #9ca3af;
  }

  .uploaded-files {
    background: #111827;
  }

  .files-title {
    color: #d1d5db;
  }

  .file-item {
    background: #1f2937;
  }

  .file-name {
    color: #f9fafb;
  }

  .file-size {
    color: #9ca3af;
  }

  .paste-textarea {
    background: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }

  .paste-textarea:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .text-count {
    color: #9ca3af;
  }

  .style-analysis {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .analysis-title {
    color: #60a5fa;
  }

  .analysis-label {
    color: #93c5fd;
  }

  .analysis-value {
    color: #60a5fa;
  }

  .option-label {
    color: #d1d5db;
  }

  .rewriter-actions {
    border-top-color: #374151;
  }

  .cancel-button {
    background: #374151;
    border-color: #4b5563;
    color: #d1d5db;
  }

  .cancel-button:hover {
    background: #4b5563;
    color: #f3f4f6;
  }
}

/* 动画效果 */
@keyframes modalSlideIn {
  from {
    transform: scale(0.95) translateY(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
