<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWorkflowStore } from '../stores/workflowStore'
import { useUIStore } from '../stores/uiStore'
import { createAPIClient } from '../utils/api'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 聊天状态
const message = ref('')
const isLoading = ref(false)

// API配置
const apiEndpoint = ref('https://api.deepseek.com/v1')
const apiKey = ref('')

// 聊天历史
const chatHistory = ref([
  { role: 'system', content: '你是一个有帮助的AI助手。' }
])

// 发送消息
const sendMessage = async () => {
  if (!message.value.trim() || isLoading.value) return

  const userMessage = message.value.trim()
  message.value = ''
  isLoading.value = true

  // 添加用户消息
  chatHistory.value.push({
    role: 'user',
    content: userMessage
  })

  try {
    const client = createAPIClient(apiEndpoint.value, apiKey.value)
    
    // 添加助手消息占位
    const assistantIndex = chatHistory.value.length
    chatHistory.value.push({
      role: 'assistant',
      content: ''
    })

    // 流式响应
    await client.streamChatCompletion(
      {
        model: 'deepseek-chat',
        messages: chatHistory.value,
        temperature: 0.7,
        max_tokens: 2048
      },
      (chunk) => {
        chatHistory.value[assistantIndex].content += chunk
      }
    )

  } catch (error) {
    console.error('发送消息失败:', error)
    chatHistory.value.push({
      role: 'assistant',
      content: '抱歉，发送消息时出现错误。'
    })
  } finally {
    isLoading.value = false
  }
}

// 清空聊天历史
const clearHistory = () => {
  chatHistory.value = [
    { role: 'system', content: '你是一个有帮助的AI助手。' }
  ]
}

// 自动滚动到底部
const chatContainer = ref<HTMLElement>()
const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// 监听聊天历史变化
import { watch, nextTick } from 'vue'
watch(chatHistory, () => {
  nextTick(scrollToBottom)
}, { deep: true })
</script>

<template>
  <div class="chat-panel">
    <!-- API配置 -->
    <div class="api-config">
      <div class="config-row">
        <label class="config-label">API端点</label>
        <input
          v-model="apiEndpoint"
          class="config-input"
          placeholder="https://api.deepseek.com/v1"
        />
      </div>
      <div class="config-row">
        <label class="config-label">API密钥</label>
        <input
          v-model="apiKey"
          class="config-input"
          type="password"
          placeholder="输入API密钥"
        />
      </div>
    </div>

    <!-- 聊天区域 -->
    <div class="chat-container" ref="chatContainer">
      <div
        v-for="(msg, index) in chatHistory"
        :key="index"
        class="message"
        :class="msg.role"
      >
        <div class="message-avatar">
          <span v-if="msg.role === 'system'">⚙️</span>
          <span v-else-if="msg.role === 'user'">👤</span>
          <span v-else>🤖</span>
        </div>
        <div class="message-content">
          {{ msg.content }}
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-container">
        <textarea
          v-model="message"
          class="message-input"
          placeholder="输入消息..."
          rows="3"
          @keydown.enter.ctrl="sendMessage"
          :disabled="isLoading"
        ></textarea>
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="isLoading || !message.trim()"
        >
          <span v-if="isLoading">⏳</span>
          <span v-else>📤</span>
        </button>
      </div>
      <div class="input-actions">
        <button class="action-btn" @click="clearHistory">
          🗑️ 清空
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--darker, #181825);
}

.api-config {
  padding: 16px;
  border-bottom: 1px solid var(--surface, #45475a);
}

.config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-label {
  font-size: 12px;
  color: var(--text-secondary, #a0a0a0);
  min-width: 60px;
}

.config-input {
  flex: 1;
  padding: 6px 10px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--light, #cdd6f4);
  font-size: 12px;
  outline: none;
}

.config-input:focus {
  border-color: var(--primary, #6366f1);
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  gap: 8px;
  max-width: 100%;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: var(--surface, #45475a);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.message-content {
  max-width: 280px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.message.system .message-content {
  background: var(--surface, #45475a);
  color: var(--text-secondary, #a0a0a0);
}

.message.user .message-content {
  background: var(--primary, #6366f1);
  color: white;
}

.message.assistant .message-content {
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  color: var(--light, #cdd6f4);
}

.input-area {
  padding: 16px;
  border-top: 1px solid var(--surface, #45475a);
}

.input-container {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.message-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--dark, #1e1e2e);
  border: 1px solid var(--surface, #45475a);
  border-radius: 8px;
  color: var(--light, #cdd6f4);
  font-size: 13px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.message-input:focus {
  border-color: var(--primary, #6366f1);
}

.send-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--primary, #6366f1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #5558e3;
  transform: translateY(-1px);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--surface, #45475a);
  border-radius: 4px;
  color: var(--text-secondary, #a0a0a0);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: var(--primary, #6366f1);
  color: var(--primary, #6366f1);
}

/* 滚动条样式 */
.chat-container::-webkit-scrollbar {
  width: 4px;
}

.chat-container::-webkit-scrollbar-track {
  background: transparent;
}

.chat-container::-webkit-scrollbar-thumb {
  background: var(--surface, #45475a);
  border-radius: 2px;
}

.chat-container::-webkit-scrollbar-thumb:hover {
  background: var(--surface-light, #585b70);
}
</style>
