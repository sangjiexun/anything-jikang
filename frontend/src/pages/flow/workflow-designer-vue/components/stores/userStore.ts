import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserSettings {
  username: string
  email: string
  autoSave: boolean
  showGrid: boolean
  theme: 'dark' | 'light'
}

export interface UserProfile {
  workflows: any[]
  executionHistory: any[]
}

export const useUserStore = defineStore('user', () => {
  // 用户设置
  const settings = ref<UserSettings>({
    username: '用户',
    email: 'user@example.com',
    autoSave: true,
    showGrid: true,
    theme: 'dark'
  })

  // 用户数据
  const profile = ref<UserProfile>({
    workflows: [],
    executionHistory: []
  })

  // 计算属性
  const stats = computed(() => ({
    totalWorkflows: profile.value.workflows.length,
    totalExecutions: profile.value.executionHistory.length,
    totalNodes: profile.value.workflows.reduce((sum, workflow) => {
      return sum + (workflow.nodes ? workflow.nodes.length : 0)
    }, 0)
  }))

  // 加载设置
  const loadSettings = () => {
    const saved = localStorage.getItem('profile_settings')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        settings.value = { ...settings.value, ...data }
      } catch (error) {
        console.error('加载用户设置失败:', error)
      }
    }
  }

  // 保存设置
  const saveSettings = () => {
    localStorage.setItem('profile_settings', JSON.stringify(settings.value))
  }

  // 更新设置
  const updateSettings = (newSettings: Partial<UserSettings>) => {
    settings.value = { ...settings.value, ...newSettings }
    saveSettings()
  }

  // 加载工作流
  const loadWorkflows = () => {
    const saved = localStorage.getItem('workflows')
    if (saved) {
      try {
        profile.value.workflows = JSON.parse(saved)
      } catch (error) {
        console.error('加载工作流失败:', error)
      }
    }
  }

  // 保存工作流
  const saveWorkflow = (workflow: any) => {
    const existingIndex = profile.value.workflows.findIndex(w => w.id === workflow.id)
    
    if (existingIndex !== -1) {
      profile.value.workflows[existingIndex] = workflow
    } else {
      profile.value.workflows.push(workflow)
    }
    
    localStorage.setItem('workflows', JSON.stringify(profile.value.workflows))
  }

  // 删除工作流
  const deleteWorkflow = (workflowId: string) => {
    profile.value.workflows = profile.value.workflows.filter(w => w.id !== workflowId)
    localStorage.setItem('workflows', JSON.stringify(profile.value.workflows))
  }

  // 加载执行历史
  const loadExecutionHistory = () => {
    const saved = localStorage.getItem('workflow_execution_history')
    if (saved) {
      try {
        profile.value.executionHistory = JSON.parse(saved)
      } catch (error) {
        console.error('加载执行历史失败:', error)
      }
    }
  }

  // 保存执行历史
  const saveExecutionHistory = (result: any) => {
    profile.value.executionHistory.unshift({
      timestamp: new Date().toISOString(),
      workflowNodes: result.nodes || 0,
      result: result
    })

    // 只保留最近20条
    if (profile.value.executionHistory.length > 20) {
      profile.value.executionHistory = profile.value.executionHistory.slice(0, 20)
    }

    localStorage.setItem('workflow_execution_history', JSON.stringify(profile.value.executionHistory))
  }

  // 清空所有数据
  const clearAllData = () => {
    localStorage.removeItem('workflows')
    localStorage.removeItem('workflow_execution_history')
    localStorage.removeItem('profile_settings')
    localStorage.removeItem('workflow_designer_state')
    
    profile.value.workflows = []
    profile.value.executionHistory = []
    settings.value = {
      username: '用户',
      email: 'user@example.com',
      autoSave: true,
      showGrid: true,
      theme: 'dark'
    }
  }

  // 初始化
  const initialize = () => {
    loadSettings()
    loadWorkflows()
    loadExecutionHistory()
  }

  return {
    // 状态
    settings,
    profile,
    stats,
    
    // 方法
    initialize,
    updateSettings,
    saveWorkflow,
    deleteWorkflow,
    saveExecutionHistory,
    clearAllData
  }
})