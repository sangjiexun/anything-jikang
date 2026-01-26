<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useWorkflowStore } from './stores/workflowStore'
import { useUIStore } from './stores/uiStore'

const workflowStore = useWorkflowStore()
const uiStore = useUIStore()

// 画布引用
const canvasRef = ref<HTMLElement>()
const svgRef = ref<SVGElement>()

// 拖拽状态
const isDragging = ref(false)
const dragNode = ref<string | null>(null)
const dragOffset = ref({ x: 0, y: 0 })

// 连接状态
const isConnecting = ref(false)
const connectionStart = ref<string | null>(null)

// 画布变换
const canvasTransform = computed(() => ({
  scale: uiStore.state.canvasZoom,
  translateX: uiStore.state.canvasPan.x,
  translateY: uiStore.state.canvasPan.y
}))

// 计算样式
const svgStyle = computed(() => ({
  transform: `scale(${canvasTransform.value.scale}) translate(${canvasTransform.value.translateX}px, ${canvasTransform.value.translateY}px)`
}))

const nodeStyle = computed(() => ({
  transform: `scale(${canvasTransform.value.scale}) translate(${canvasTransform.value.translateX}px, ${canvasTransform.value.translateY}px)`
}))

const gridStyle = computed(() => ({
  transform: `scale(${canvasTransform.value.scale})`,
  backgroundSize: `${20 * canvasTransform.value.scale}px ${20 * canvasTransform.value.scale}px`
}))

// 处理拖拽开始
const handleDragStart = (event: DragEvent) => {
  event.preventDefault()
  
  const nodeType = event.dataTransfer?.getData('nodeType')
  if (!nodeType || !canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasTransform.value.translateX) / canvasTransform.value.scale
  const y = (event.clientY - rect.top - canvasTransform.value.translateY) / canvasTransform.value.scale

  // 添加节点
  const newNode = workflowStore.addNode(nodeType, { x, y })
  workflowStore.selectNode(newNode.id)
}

// 处理节点拖拽
const handleNodeMouseDown = (event: MouseEvent, nodeId: string) => {
  if (event.button !== 0) return // 只处理左键
  
  event.preventDefault()
  event.stopPropagation()
  
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  isDragging.value = true
  dragNode.value = nodeId
  
  const node = workflowStore.state.nodes.find(n => n.id === nodeId)
  if (!node) return

  dragOffset.value = {
    x: (event.clientX - rect.left - canvasTransform.value.translateX) / canvasTransform.value.scale - node.x,
    y: (event.clientY - rect.top - canvasTransform.value.translateY) / canvasTransform.value.scale - node.y
  }
}

// 处理鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !dragNode.value || !canvasRef.value) return

  const rect = canvasRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left - canvasTransform.value.translateX) / canvasTransform.value.scale - dragOffset.value.x
  const y = (event.clientY - rect.top - canvasTransform.value.translateY) / canvasTransform.value.scale - dragOffset.value.y

  workflowStore.updateNode(dragNode.value, { x, y })
}

// 处理鼠标释放
const handleMouseUp = () => {
  isDragging.value = false
  dragNode.value = null
}

// 处理节点点击
const handleNodeClick = (event: MouseEvent, nodeId: string) => {
  event.stopPropagation()
  workflowStore.selectNode(nodeId)
}

// 处理画布点击
const handleCanvasClick = () => {
  workflowStore.selectNode(null)
}

// 处理连接端口
const handlePortClick = (event: MouseEvent, nodeId: string, portType: 'input' | 'output') => {
  event.stopPropagation()
  
  if (portType === 'output') {
    // 开始连接
    isConnecting.value = true
    connectionStart.value = nodeId
    uiStore.startConnection(nodeId)
  } else if (portType === 'input' && connectionStart.value) {
    // 完成连接
    if (connectionStart.value !== nodeId) {
      workflowStore.addConnection(connectionStart.value, nodeId)
    }
    
    // 重置连接状态
    isConnecting.value = false
    connectionStart.value = null
    uiStore.endConnection()
  }
}

// 处理滚轮缩放
const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  
  const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
  const currentScale = uiStore.state.canvasZoom
  const newScale = Math.max(0.1, Math.min(3, currentScale * scaleFactor))
  
  uiStore.setCanvasZoom(newScale)
}

// 获取节点颜色
const getNodeColor = (nodeType: string) => {
  const colorMap: Record<string, string> = {
    'llm-deepseek': '#6366f1',
    'llm-gemini': '#10b981',
    'input-text': '#f59e0b',
    'output-text': '#8b5cf6',
    'rag-upload': '#06b6d4',
    'rag-query': '#0891b2',
    'code-js': '#eab308',
    'code-cmd': '#84cc16',
    'algo-latex-ai': '#f97316',
    'algo-formula': '#ea580c',
    'algo-chart': '#dc2626'
  }
  return colorMap[nodeType] || '#64748b'
}

// 获取节点图标
const getNodeIcon = (nodeType: string) => {
  const iconMap: Record<string, string> = {
    'llm-deepseek': '🧠',
    'llm-gemini': '💎',
    'input-text': '📝',
    'output-text': '📄',
    'rag-upload': '📚',
    'rag-query': '🔍',
    'code-js': '⚡',
    'code-cmd': '🖥️',
    'algo-latex-ai': '🧮',
    'algo-formula': '🧮',
    'algo-chart': '📊'
  }
  return iconMap[nodeType] || '⚙️'
}

// 计算连接线路径
const getConnectionPath = (connection: any) => {
  const fromNode = workflowStore.state.nodes.find(n => n.id === connection.from)
  const toNode = workflowStore.state.nodes.find(n => n.id === connection.to)
  
  if (!fromNode || !toNode) return ''
  
  const x1 = fromNode.x + 120
  const y1 = fromNode.y + 40
  const x2 = toNode.x
  const y2 = toNode.y + 40
  
  const dx = x2 - x1
  const dy = y2 - y1
  const dr = Math.sqrt(dx * dx + dy * dy)
  
  return `M ${x1} ${y1} C ${x1 + dr/3} ${y1}, ${x2 - dr/3} ${y2}, ${x2} ${y2}`
}

// 全局事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div
    ref="canvasRef"
    class="workflow-canvas"
    @dragover.prevent
    @drop="handleDragStart"
    @click="handleCanvasClick"
    @wheel="handleWheel"
  >
    <!-- 网格背景 -->
    <div class="canvas-grid" :style="gridStyle"></div>
    
    <!-- SVG连接线 -->
    <svg
      ref="svgRef"
      class="connection-layer"
      :style="svgStyle"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="#6366f1" />
        </marker>
      </defs>
      
      <g
        v-for="connection in workflowStore.state.connections"
        :key="connection.id"
      >
        <path
          :d="getConnectionPath(connection)"
          stroke="#6366f1"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
          class="connection-line"
        />
      </g>
    </svg>
    
    <!-- 节点层 -->
    <div class="node-layer" :style="nodeStyle">
      <div
        v-for="node in workflowStore.state.nodes"
        :key="node.id"
        class="workflow-node"
        :class="{ selected: uiStore.state.selectedNodeId === node.id }"
        :style="{
          left: node.x + 'px',
          top: node.y + 'px',
          backgroundColor: getNodeColor(node.type) + '20',
          borderColor: getNodeColor(node.type)
        }"
        @mousedown="handleNodeMouseDown($event, node.id)"
        @click="handleNodeClick($event, node.id)"
      >
        <!-- 节点头部 -->
        <div class="node-header">
          <span class="node-icon">{{ getNodeIcon(node.type) }}</span>
          <span class="node-title">{{ node.type.replace('-', ' ').toUpperCase() }}</span>
        </div>
        
        <!-- 输出端口 -->
        <div class="node-port output-port" @click="handlePortClick($event, node.id, 'output')"></div>
        
        <!-- 输入端口 -->
        <div class="node-port input-port" @click="handlePortClick($event, node.id, 'input')"></div>
      </div>
    </div>
    
    <!-- 连接线临时预览 -->
    <svg
      v-if="isConnecting"
      class="connection-preview"
      :style="svgStyle"
    >
      <line
        x1="0"
        y1="0"
        x2="100"
        y2="100"
        stroke="#6366f1"
        stroke-width="2"
        stroke-dasharray="5,5"
        class="preview-line"
      />
    </svg>
  </div>
</template>

<style scoped>
.workflow-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--dark, #1e1e2e);
  cursor: grab;
}

.workflow-canvas:active {
  cursor: grabbing;
}

.canvas-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    radial-gradient(circle, var(--surface, #45475a) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.connection-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1;
}

.connection-line {
  pointer-events: stroke;
  cursor: pointer;
  transition: stroke-width 0.2s;
}

.connection-line:hover {
  stroke-width: 3;
  stroke: #818cf8;
}

.node-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
}

.workflow-node {
  position: absolute;
  width: 120px;
  min-height: 80px;
  background: var(--surface, #45475a);
  border: 2px solid;
  border-radius: 8px;
  cursor: move;
  user-select: none;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.workflow-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.workflow-node.selected {
  box-shadow: 0 0 0 3px currentColor;
}

.node-header {
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  color: var(--light, #cdd6f4);
}

.node-icon {
  font-size: 18px;
  line-height: 1;
}

.node-title {
  font-size: 9px;
  opacity: 0.8;
  line-height: 1.2;
  word-break: break-word;
}

.node-port {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--success, #10b981);
  border: 2px solid var(--dark, #1e1e2e);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  pointer-events: auto;
  z-index: 3;
}

.node-port:hover {
  transform: scale(1.2);
  background: var(--success, #059669);
}

.output-port {
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
}

.input-port {
  left: -6px;
  top: 50%;
  transform: translateY(-50%);
}

.connection-preview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.preview-line {
  stroke: #6366f1;
  opacity: 0.7;
}
</style>