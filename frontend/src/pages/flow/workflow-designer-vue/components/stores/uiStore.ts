import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UIState {
  activeTab: 'chat' | 'config' | 'kb' | 'results'
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  canvasZoom: number
  canvasPan: { x: number, y: number }
  selectedNodeId: string | null
  connectingFrom: string | null
  toast: {
    show: boolean
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }
}

export const useUIStore = defineStore('ui', () => {
  // UI状态
  const state = ref<UIState>({
    activeTab: 'chat',
    sidebarCollapsed: false,
    rightPanelCollapsed: false,
    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    selectedNodeId: null,
    connectingFrom: null,
    toast: {
      show: false,
      message: '',
      type: 'info'
    }
  })

  // 设置活动标签页
  const setActiveTab = (tab: UIState['activeTab']) => {
    state.value.activeTab = tab
  }

  // 切换侧边栏
  const toggleSidebar = () => {
    state.value.sidebarCollapsed = !state.value.sidebarCollapsed
  }

  // 切换右侧面板
  const toggleRightPanel = () => {
    state.value.rightPanelCollapsed = !state.value.rightPanelCollapsed
  }

  // 设置画布缩放
  const setCanvasZoom = (zoom: number) => {
    state.value.canvasZoom = Math.max(0.1, Math.min(3, zoom))
  }

  // 设置画布平移
  const setCanvasPan = (pan: { x: number, y: number }) => {
    state.value.canvasPan = pan
  }

  // 选择节点
  const selectNode = (nodeId: string | null) => {
    state.value.selectedNodeId = nodeId
  }

  // 开始连接
  const startConnection = (nodeId: string) => {
    state.value.connectingFrom = nodeId
  }

  // 结束连接
  const endConnection = () => {
    state.value.connectingFrom = null
  }

  // 显示提示
  const showToast = (message: string, type: UIState['toast']['type'] = 'info') => {
    state.value.toast = {
      show: true,
      message,
      type
    }

    setTimeout(() => {
      state.value.toast.show = false
    }, 3000)
  }

  return {
    // 状态
    state,
    
    // 方法
    setActiveTab,
    toggleSidebar,
    toggleRightPanel,
    setCanvasZoom,
    setCanvasPan,
    selectNode,
    startConnection,
    endConnection,
    showToast
  }
})