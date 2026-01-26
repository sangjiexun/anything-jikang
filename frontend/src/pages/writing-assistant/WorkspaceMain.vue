<template>
  <div class="flex flex-col h-full">
    <!-- 空状态 -->
    <div v-if="!articleContent" class="flex-1 flex items-center justify-center bg-gray-50">
      <div class="text-center max-w-md px-6">
        <div class="mb-8 text-indigo-500">
          <svg
            class="w-20 h-20 mx-auto"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line
              x1="16"
              y1="13"
              x2="8"
              y2="13"
            />
            <line
              x1="16"
              y1="17"
              x2="8"
              y2="17"
            />
            <polyline points="10,9 9,9 8,9" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-gray-900 mb-3">
          开始您的创作之旅
        </h3>
        <p class="text-gray-600 mb-8">
          点击右上角的"写作配置"按钮，配置您的写作参数并生成精彩文章
        </p>
        <div class="flex justify-center gap-6">
          <div class="text-center">
            <div class="mb-2 text-indigo-500">
              <svg
                class="w-8 h-8 mx-auto"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
            </div>
            <span class="text-sm text-gray-700">AI智能写作</span>
          </div>
          <div class="text-center">
            <div class="mb-2 text-indigo-500">
              <svg
                class="w-8 h-8 mx-auto"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <span class="text-sm text-gray-700">知识库检索</span>
          </div>
          <div class="text-center">
            <div class="mb-2 text-indigo-500">
              <svg
                class="w-8 h-8 mx-auto"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 3v18h18" />
                <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
              </svg>
            </div>
            <span class="text-sm text-gray-700">SMART评估</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑器区域 -->
    <div v-else class="flex flex-col flex-1">
      <div class="flex-1 overflow-hidden">
        <TinyMCEEditor
          :model-value="articleContent"
          :readonly="false"
          class="h-full"
          @update:model-value="handleContentUpdate"
        />
      </div>

      <!-- 编辑器工具栏 -->
      <div class="flex justify-between items-center px-6 py-3 bg-white/95 border-t border-gray-200 backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-600 font-medium">字数统计</span>
          <span class="text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded-md border border-gray-200">{{ wordCount }}</span>
        </div>

        <div class="flex gap-3">
          <button class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" @click="saveArticle">
            <svg
              class="w-4 h-4 text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" />
              <polyline points="7,3 7,8 15,8" />
            </svg>
            保存
          </button>

          <button class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" @click="previewArticle">
            <svg
              class="w-4 h-4 text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            预览
          </button>

          <button class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" @click="$emit('insert-knowledge')">
            <svg
              class="w-4 h-4 text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            插入知识
          </button>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <div v-if="showPreview" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click="showPreview = false">
      <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" @click.stop>
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            文章预览
          </h3>
          <button class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors" @click="showPreview = false">
            <svg
              class="w-5 h-5"
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

        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div class="prose max-w-none" v-html="articleContent" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TinyMCEEditor from './TinyMCEEditor.vue'

const props = defineProps<{
  articleContent?: string
  articleParagraphs?: Array<{ index: number, content: string, imageUrl?: string }>
}>()

const emit = defineEmits<{
  'update:articleContent': [value: string]
  'optimize-paragraph': [index: number]
  'format-paragraph': [index: number]
  'generate-image': [index: number]
  'copy-full': []
  'optimize-full': []
  'export-pdf': []
  'insert-knowledge': [position?: number]
}>()

// UI 状态
const showPreview = ref(false)

// 计算字数
const wordCount = computed(() => {
  if (!props.articleContent) return 0
  // 移除HTML标签并计算字数
  const textContent = props.articleContent.replace(/<[^>]*>/g, '')
  return textContent.length
})

const handleContentUpdate = (value: string) => {
  emit('update:articleContent', value)
}

const saveArticle = () => {
  // 实现保存逻辑
  useNotification().add({
    title: '文章已保存',
    type: 'success'
  })
}

const previewArticle = () => {
  showPreview.value = true
}
</script>

<style scoped>
.workspace-main-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 空状态样式 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
}

.empty-content {
  text-align: center;
  max-width: 32rem;
}

.empty-icon {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: center;
}

.empty-icon svg {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
}

.empty-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.75rem;
}

.empty-description {
  font-size: 1rem;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.empty-features {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  min-width: 6rem;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.feature-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #d1d5db;
}

.feature-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #667eea;
}

.feature-item span {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

/* 编辑器容器样式 */
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  overflow: hidden;
}

.editor-instance {
  flex: 1;
  min-height: 0;
}

/* 编辑器工具栏 */
.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #e5e7eb;
  backdrop-filter: blur(10px);
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.word-count {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  padding: 0.25rem 0.5rem;
  background: #f3f4f6;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
}

.toolbar-actions {
  display: flex;
  gap: 0.5rem;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.button-icon {
  width: 1rem;
  height: 1rem;
}

/* 预览弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

.preview-modal {
  width: 100%;
  max-width: 56rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.modal-content {
  flex: 1;
  overflow-y: auto;
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

/* 预览内容样式 */
.preview-content {
  padding: 1.5rem;
  line-height: 1.8;
  font-size: 1rem;
  color: #111827;
  max-height: 70vh;
  overflow-y: auto;
}

.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3) {
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: #111827;
}

.preview-content :deep(h1) {
  font-size: 1.875rem;
}

.preview-content :deep(h2) {
  font-size: 1.5rem;
}

.preview-content :deep(h3) {
  font-size: 1.25rem;
}

.preview-content :deep(p) {
  margin-bottom: 1rem;
  color: #374151;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.preview-content :deep(li) {
  margin-bottom: 0.5rem;
  color: #374151;
}

.preview-content :deep(strong) {
  font-weight: 600;
  color: #111827;
}

.preview-content :deep(em) {
  font-style: italic;
}

.preview-content :deep(a) {
  color: #667eea;
  text-decoration: underline;
}

.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

/* TinyMCE 编辑器样式优化 */
:deep(.tox-tinymce) {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

:deep(.tox .tox-edit-area__iframe) {
  background-color: white;
}

:deep(.tox-toolbar-overlord) {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

:deep(.tox .tox-toolbar__primary) {
  background: transparent;
}

:deep(.tox .tox-tbtn) {
  border-radius: 0.375rem;
  margin: 0.125rem;
}

:deep(.tox .tox-tbtn:hover) {
  background: white;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .empty-features {
    gap: 1rem;
  }

  .feature-item {
    min-width: 5rem;
    padding: 0.75rem;
  }

  .editor-wrapper {
    padding: 1rem;
  }

  .editor-toolbar {
    padding: 0.5rem 1rem;
    flex-direction: column;
    gap: 0.5rem;
  }

  .toolbar-section {
    order: 2;
  }

  .toolbar-actions {
    order: 1;
  }

  .modal-container {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .workspace-main-container {
    background: #111827;
  }

  .empty-title {
    color: #f9fafb;
  }

  .empty-description {
    color: #9ca3af;
  }

  .feature-item {
    background: #1f2937;
    border-color: #374151;
  }

  .feature-item:hover {
    border-color: #4b5563;
  }

  .feature-item span {
    color: #f3f4f6;
  }

  .editor-toolbar {
    background: rgba(31, 41, 55, 0.95);
    border-top-color: #374151;
  }

  .toolbar-label {
    color: #9ca3af;
  }

  .word-count {
    color: #f9fafb;
    background: #374151;
    border-color: #4b5563;
  }

  .toolbar-button {
    color: #9ca3af;
  }

  .toolbar-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .modal-container {
    background: #1f2937;
  }

  .modal-header {
    border-bottom-color: #374151;
  }

  .modal-title {
    color: #f9fafb;
  }

  .close-button {
    color: #9ca3af;
  }

  .close-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .preview-content {
    color: #f9fafb;
  }

  .preview-content :deep(h1),
  .preview-content :deep(h2),
  .preview-content :deep(h3) {
    color: #f9fafb;
  }

  .preview-content :deep(p),
  .preview-content :deep(li) {
    color: #d1d5db;
  }

  .preview-content :deep(strong) {
    color: #f9fafb;
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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

.empty-content {
  animation: fadeIn 0.6s ease-out;
}

.editor-container {
  animation: fadeIn 0.4s ease-out;
}
</style>
