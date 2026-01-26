import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { WorkflowNode, WorkflowConnection, WorkflowState } from '../../../../../../lib/types/flow/workflow'

export const useWorkflowStore = defineStore('workflow', () => {
  // 工作流状态
  const state = ref<WorkflowState>({
    nodes: [],
    connections: [],
    knowledgeBase: [],
    nodeIdCounter: 0,
    executionResults: [],
    chatHistory: []
  })

  // 选中节点
  const selectedNodeId = ref<string | null>(null)

  // 计算属性
  const selectedNode = computed(() => 
    state.value.nodes.find(node => node.id === selectedNodeId.value)
  )

  // 初始化工作流
  const initializeWorkflow = () => {
    // 从localStorage恢复数据
    const saved = localStorage.getItem('workflow_designer_state')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        state.value = {
          nodes: data.nodes || [],
          connections: data.connections || [],
          knowledgeBase: data.knowledgeBase || [],
          nodeIdCounter: data.nodeIdCounter || 0,
          executionResults: [],
          chatHistory: []
        }
      } catch (error) {
        console.error('加载工作流失败:', error)
      }
    }
  }

  // 保存到localStorage
  const saveToLocalStorage = () => {
    const data = {
      nodes: state.value.nodes,
      connections: state.value.connections,
      knowledgeBase: state.value.knowledgeBase,
      nodeIdCounter: state.value.nodeIdCounter
    }
    localStorage.setItem('workflow_designer_state', JSON.stringify(data))
  }

  // 添加节点
  const addNode = (nodeType: string, position: { x: number, y: number }) => {
    const newNode: WorkflowNode = {
      id: `node_${++state.value.nodeIdCounter}`,
      type: nodeType,
      x: position.x,
      y: position.y,
      config: getDefaultNodeConfig(nodeType)
    }
    
    state.value.nodes.push(newNode)
    saveToLocalStorage()
    return newNode
  }

  // 获取节点默认配置
  const getDefaultNodeConfig = (nodeType: string) => {
    const configs: Record<string, any> = {
      'llm-deepseek': {
        model: 'deepseek-v3',
        systemPrompt: '你是一个有帮助的AI助手。',
        temperature: 0.7,
        maxTokens: 2048
      },
      'input-text': {
        placeholder: '请输入文本...',
        defaultValue: ''
      },
      'output-text': {
        format: 'text'
      }
    }
    return configs[nodeType] || {}
  }

  // 更新节点
  const updateNode = (nodeId: string, updates: Partial<WorkflowNode>) => {
    const nodeIndex = state.value.nodes.findIndex(n => n.id === nodeId)
    if (nodeIndex !== -1) {
      state.value.nodes[nodeIndex] = {
        ...state.value.nodes[nodeIndex],
        ...updates
      }
      saveToLocalStorage()
    }
  }

  // 删除节点
  const deleteNode = (nodeId: string) => {
    state.value.nodes = state.value.nodes.filter(n => n.id !== nodeId)
    state.value.connections = state.value.connections.filter(
      c => c.from !== nodeId && c.to !== nodeId
    )
    
    if (selectedNodeId.value === nodeId) {
      selectedNodeId.value = null
    }
    
    saveToLocalStorage()
  }

  // 添加连接
  const addConnection = (from: string, to: string) => {
    // 检查是否已存在连接
    const exists = state.value.connections.some(
      c => c.from === from && c.to === to
    )
    
    if (!exists) {
      const newConnection: WorkflowConnection = {
        id: `conn_${Date.now()}`,
        from,
        to
      }
      
      state.value.connections.push(newConnection)
      saveToLocalStorage()
      return newConnection
    }
    
    return null
  }

  // 删除连接
  const deleteConnection = (connectionId: string) => {
    state.value.connections = state.value.connections.filter(
      c => c.id !== connectionId
    )
    saveToLocalStorage()
  }

  // 选择节点
  const selectNode = (nodeId: string | null) => {
    selectedNodeId.value = nodeId
  }

  // 清空画布
  const clearCanvas = () => {
    state.value.nodes = []
    state.value.connections = []
    state.value.selectedNode = null
    selectedNodeId.value = null
    saveToLocalStorage()
  }

  // 保存工作流
  const saveWorkflow = () => {
    const workflow = {
      version: '1.0',
      name: prompt('请输入工作流名称:', 'My Workflow') || 'My Workflow',
      created: new Date().toISOString(),
      nodes: state.value.nodes,
      connections: state.value.connections,
      knowledgeBase: state.value.knowledgeBase
    }

    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflow.name.replace(/\s+/g, '_')}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 执行工作流
  const executeWorkflow = async () => {
    if (state.value.nodes.length === 0) {
      alert('请先创建工作流')
      return
    }

    try {
      // 构建执行顺序
      const executionOrder = buildExecutionOrder()
      const context = {
        variables: {},
        results: {},
        knowledgeBase: state.value.knowledgeBase
      }

      for (const nodeId of executionOrder) {
        const node = state.value.nodes.find(n => n.id === nodeId)
        if (!node) continue

        console.log(`执行节点: ${nodeId}`)
        
        // 这里将调用具体的节点执行逻辑
        // const result = await executeNode(node, context)
        // context.results[nodeId] = result
        
        state.value.executionResults.push({
          timestamp: new Date().toISOString(),
          nodeId,
          status: 'completed'
        })
      }

      console.log('工作流执行完成')
    } catch (error) {
      console.error('工作流执行失败:', error)
    }
  }

  // 构建执行顺序（拓扑排序）
  const buildExecutionOrder = () => {
    const order = []
    const visited = new Set()
    const inDegree: Record<string, number> = {}

    // 计算入度
    state.value.nodes.forEach(node => {
      inDegree[node.id] = 0
    })
    state.value.connections.forEach(conn => {
      inDegree[conn.to] = (inDegree[conn.to] || 0) + 1
    })

    // 拓扑排序
    const queue = state.value.nodes.filter(n => inDegree[n.id] === 0).map(n => n.id)

    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      
      visited.add(nodeId)
      order.push(nodeId)

      state.value.connections
        .filter(c => c.from === nodeId)
        .forEach(conn => {
          inDegree[conn.to]--
          if (inDegree[conn.to] === 0) {
            queue.push(conn.to)
          }
        })
    }

    // 添加未访问的节点
    state.value.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        order.push(node.id)
      }
    })

    return order
  }

  return {
    // 状态
    state,
    selectedNodeId,
    selectedNode,
    
    // 方法
    initializeWorkflow,
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    deleteConnection,
    selectNode,
    clearCanvas,
    saveWorkflow,
    executeWorkflow,
    saveToLocalStorage
  }
})