<template>
  <div v-if="visible" class="progress-overlay">
    <div class="progress-container">
      <div class="progress-header">
        <h3 class="progress-title">
          🤖 AI正在生成文章
        </h3>
        <button class="cancel-button" @click="$emit('cancel')">
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

      <div class="progress-content">
        <!-- 进度条 -->
        <div class="progress-bar-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <span class="progress-text">{{ progress }}%</span>
        </div>

        <!-- 当前步骤 -->
        <div class="current-step">
          <div class="step-icon">
            <div class="loading-spinner" />
          </div>
          <div class="step-content">
            <div class="step-title">
              {{ currentStep.title }}
            </div>
            <div class="step-description">
              {{ currentStep.description }}
            </div>
          </div>
        </div>

        <!-- 步骤列表 -->
        <div class="steps-list">
          <div
            v-for="(step, index) in steps"
            :key="index"
            :class="[
              'step-item',
              {
                completed: index < currentStepIndex,
                active: index === currentStepIndex,
                pending: index > currentStepIndex
              }
            ]"
          >
            <div class="step-indicator">
              <svg
                v-if="index < currentStepIndex"
                class="check-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              <div v-else-if="index === currentStepIndex" class="active-indicator">
                <div class="pulse-dot" />
              </div>
              <div v-else class="pending-indicator">
                {{ index + 1 }}
              </div>
            </div>
            <div class="step-info">
              <div class="step-name">
                {{ step.title }}
              </div>
              <div class="step-desc">
                {{ step.description }}
              </div>
            </div>
          </div>
        </div>

        <!-- 实时内容预览 -->
        <div v-if="previewContent" class="content-preview">
          <h4 class="preview-title">
            生成预览
          </h4>
          <div class="preview-text" v-html="previewContent" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface GenerationStep {
  title: string
  description: string
}

const props = defineProps<{
  visible: boolean
  progress: number
  currentStepIndex: number
  previewContent?: string
}>()

const emit = defineEmits<{
  cancel: []
}>()

const steps: GenerationStep[] = [
  {
    title: '分析主题',
    description: '理解文章主题和写作要求'
  },
  {
    title: '检索知识',
    description: '从知识库中搜索相关内容'
  },
  {
    title: '构建大纲',
    description: '生成文章结构和章节安排'
  },
  {
    title: '生成内容',
    description: '逐段生成高质量文章内容'
  },
  {
    title: '优化润色',
    description: '检查语法并优化表达'
  },
  {
    title: '完成生成',
    description: '文章生成完成，准备展示'
  }
]

const currentStep = computed(() => {
  return steps[props.currentStepIndex] || steps[0]
})
</script>

<style scoped>
.progress-overlay {
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

.progress-container {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 32rem;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.3s ease-out;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.progress-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.cancel-button {
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

.cancel-button:hover {
  background: #f3f4f6;
  color: #374151;
}

.cancel-button svg {
  width: 1rem;
  height: 1rem;
}

.progress-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* 进度条 */
.progress-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 0.25rem;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  min-width: 3rem;
  text-align: right;
}

/* 当前步骤 */
.current-step {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #f0f9ff;
  border-radius: 0.75rem;
  border: 1px solid #e0f2fe;
}

.step-icon {
  flex-shrink: 0;
}

.loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #e0f2fe;
  border-top: 2px solid #0ea5e9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 1rem;
  font-weight: 600;
  color: #0c4a6e;
  margin-bottom: 0.25rem;
}

.step-description {
  font-size: 0.875rem;
  color: #0369a1;
}

/* 步骤列表 */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.step-item.completed {
  background: rgba(16, 185, 129, 0.05);
}

.step-item.active {
  background: rgba(59, 130, 246, 0.05);
}

.step-item.pending {
  background: #f9fafb;
}

.step-indicator {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: #10b981;
}

.active-indicator {
  position: relative;
  width: 1rem;
  height: 1rem;
  background: #3b82f6;
  border-radius: 50%;
}

.pulse-dot {
  position: absolute;
  top: -0.25rem;
  left: -0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  background: rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.pending-indicator {
  width: 1rem;
  height: 1rem;
  background: #e5e7eb;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
}

.step-info {
  flex: 1;
}

.step-name {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.125rem;
}

.step-item.completed .step-name {
  color: #059669;
}

.step-item.active .step-name {
  color: #2563eb;
}

.step-item.pending .step-name {
  color: #6b7280;
}

.step-desc {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* 内容预览 */
.content-preview {
  background: #f9fafb;
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
}

.preview-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.preview-text {
  font-size: 0.8rem;
  line-height: 1.6;
  color: #6b7280;
  max-height: 8rem;
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .progress-container {
    margin: 1rem;
    max-width: calc(100vw - 2rem);
  }

  .progress-header {
    padding: 1rem;
  }

  .progress-content {
    padding: 1rem;
    gap: 1rem;
  }

  .current-step {
    padding: 0.75rem;
  }

  .step-item {
    padding: 0.5rem;
  }
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .progress-container {
    background: #1f2937;
  }

  .progress-header {
    background: #111827;
    border-bottom-color: #374151;
  }

  .progress-title {
    color: #f9fafb;
  }

  .cancel-button {
    color: #9ca3af;
  }

  .cancel-button:hover {
    background: #374151;
    color: #f3f4f6;
  }

  .progress-bar {
    background: #374151;
  }

  .progress-text {
    color: #d1d5db;
  }

  .current-step {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .step-title {
    color: #60a5fa;
  }

  .step-description {
    color: #93c5fd;
  }

  .step-item.completed {
    background: rgba(16, 185, 129, 0.1);
  }

  .step-item.active {
    background: rgba(59, 130, 246, 0.1);
  }

  .step-item.pending {
    background: #111827;
  }

  .step-item.completed .step-name {
    color: #34d399;
  }

  .step-item.active .step-name {
    color: #60a5fa;
  }

  .step-item.pending .step-name {
    color: #9ca3af;
  }

  .pending-indicator {
    background: #4b5563;
    color: #9ca3af;
  }

  .content-preview {
    background: #111827;
    border-color: #374151;
  }

  .preview-title {
    color: #d1d5db;
  }

  .preview-text {
    color: #9ca3af;
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

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
