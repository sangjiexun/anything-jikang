import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Stop,
  Plus,
  Trash,
  Copy,
  FloppyDisk,
  CaretRight,
  CaretDown,
  X,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowsOutCardinal,
  Lightning,
  Robot,
  Gear,
  SpinnerGap,
  ListBullets,
} from "@phosphor-icons/react";
import Sidebar from "@/components/Sidebar";
import showToast from "@/utils/toast";
import { NODE_TYPES, NODE_CATEGORIES } from "./nodeTypes";
// Workflow model no longer needed - using localStorage only

// 生成唯一ID
const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 贝塞尔曲线路径计算
const getBezierPath = (x1, y1, x2, y2) => {
  const midX = (x1 + x2) / 2;
  const controlOffset = Math.min(Math.abs(x2 - x1) * 0.5, 150);
  return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
};

export default function WorkflowDesigner() {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);

  // 默认工作流结构
  const defaultWorkflow = {
    id: generateId(),
    name: "新建工作流",
    nodes: [],
    connections: [],
  };

  // 工作流状态
  const [workflow, setWorkflow] = useState(() => {
    const saved = localStorage.getItem("workflow_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 确保必要的字段存在
        return {
          ...defaultWorkflow,
          ...parsed,
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          connections: Array.isArray(parsed.connections) ? parsed.connections : [],
        };
      } catch (e) {
        console.error("Failed to load workflow:", e);
      }
    }
    return defaultWorkflow;
  });

  // UI 状态
  const [selectedNode, setSelectedNode] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(
    NODE_CATEGORIES?.map((c) => c.id) || []
  );
  const [searchQuery, setSearchQuery] = useState("");

  // 执行状态
  const [executingNodeId, setExecutingNodeId] = useState(null);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [executionResult, setExecutionResult] = useState(null);
  const [showResultPanel, setShowResultPanel] = useState(false);
  const [nodeResults, setNodeResults] = useState({});

  // 画布状态
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 连接状态
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState(null);

  // 拖拽状态
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 历史记录
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // AI创建工作流状态
  const [showAICreator, setShowAICreator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // 大模型配置状态
  const [showLLMConfig, setShowLLMConfig] = useState(false);
  const [llmConfig, setLLMConfig] = useState(() => {
    const saved = localStorage.getItem("workflow_llm_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load LLM config:", e);
      }
    }
    return {
      endpoint: "https://api.deepseek.com",
      apiKey: "",
      model: "deepseek-chat",
      temperature: 0.7,
      maxTokens: 2048,
    };
  });

  // 保存历史状态
  const saveHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-50), JSON.stringify(workflow)]);
    setRedoStack([]);
  }, [workflow]);

  // 撤销
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoStack((prev) => [...prev, JSON.stringify(workflow)]);
    setHistory((prev) => prev.slice(0, -1));
    setWorkflow(JSON.parse(previous));
    showToast("已撤销", "info");
  }, [history, workflow]);

  // 重做
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, JSON.stringify(workflow)]);
    setRedoStack((prev) => prev.slice(0, -1));
    setWorkflow(JSON.parse(next));
    showToast("已重做", "info");
  }, [redoStack, workflow]);

  // 自动保存
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("workflow_draft", JSON.stringify(workflow));
    }, 1000);
    return () => clearTimeout(timer);
  }, [workflow]);

  // 添加节点
  const addNode = useCallback(
    (type, x = 300, y = 200) => {
      const nodeConfig = NODE_TYPES[type];
      if (!nodeConfig) return;

      saveHistory();

      const newNode = {
        id: generateId(),
        type,
        x,
        y,
        config: { ...nodeConfig.config },
      };

      setWorkflow((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));

      setSelectedNode(newNode.id);
      showToast(`已添加: ${nodeConfig.title}`, "success");
    },
    [saveHistory]
  );

  // 删除节点
  const deleteNode = useCallback(
    (nodeId) => {
      saveHistory();
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== nodeId),
        connections: prev.connections.filter(
          (c) => c.from !== nodeId && c.to !== nodeId
        ),
      }));
      setSelectedNode(null);
      showToast("节点已删除", "success");
    },
    [saveHistory]
  );

  // 复制节点
  const duplicateNode = useCallback(
    (nodeId) => {
      const node = (workflow.nodes || []).find((n) => n.id === nodeId);
      if (!node) return;

      saveHistory();

      const newNode = {
        ...node,
        id: generateId(),
        x: node.x + 50,
        y: node.y + 50,
        config: { ...node.config },
      };

      setWorkflow((prev) => ({
        ...prev,
        nodes: [...(prev.nodes || []), newNode],
      }));

      setSelectedNode(newNode.id);
      showToast("节点已复制", "success");
    },
    [workflow.nodes, saveHistory]
  );

  // 创建连接
  const createConnection = useCallback(
    (fromNodeId, toNodeId) => {
      // 检查是否已存在相同连接
      const exists = (workflow.connections || []).some(
        (c) => c.from === fromNodeId && c.to === toNodeId
      );
      if (exists) return;

      // 检查是否连接到自己
      if (fromNodeId === toNodeId) return;

      saveHistory();

      setWorkflow((prev) => ({
        ...prev,
        connections: [
          ...(prev.connections || []),
          { id: generateId(), from: fromNodeId, to: toNodeId },
        ],
      }));

      showToast("连接已创建", "success");
    },
    [workflow.connections, saveHistory]
  );

  // 删除连接
  const deleteConnection = useCallback(
    (connId) => {
      saveHistory();
      setWorkflow((prev) => ({
        ...prev,
        connections: prev.connections.filter((c) => c.id !== connId),
      }));
    },
    [saveHistory]
  );

  // 处理画布拖拽 (中键或Alt+左键)
  const handleCanvasMouseDown = (e) => {
    // 中键按下 - 开始拖拽画布
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    
    // Alt + 左键 - 也可以拖拽画布
    if (e.button === 0 && e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    
    // 左键点击空白区域 - 取消选中
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      setSelectedNode(null);
    }
  };

  const handleCanvasMouseMove = (e) => {
    // 画布平移
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    // 节点拖拽
    if (draggedNode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggedNode ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n
        ),
      }));
    }

    // 连接线拖拽
    if (isConnecting && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTempConnectionEnd({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }
  };

  const handleCanvasMouseUp = (e) => {
    setIsPanning(false);

    if (draggedNode) {
      saveHistory();
      setDraggedNode(null);
    }

    if (isConnecting) {
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnectionEnd(null);
    }
  };

  // 节点拖拽开始
  const handleNodeDragStart = (e, nodeId) => {
    e.stopPropagation();
    const node = (workflow.nodes || []).find((n) => n.id === nodeId);
    if (!node) return;

    setDraggedNode(nodeId);
    setSelectedNode(nodeId);

    const rect = e.currentTarget.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setDragOffset({
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    });
  };

  // 连接点 mouseDown - 开始连接
  const handleConnectionPointMouseDown = (e, nodeId, isOutput) => {
    e.stopPropagation();
    e.preventDefault();

    if (isOutput) {
      // 从输出点开始连接
      const node = (workflow.nodes || []).find((n) => n.id === nodeId);
      if (!node) return;

      setIsConnecting(true);
      setConnectionStart({
        nodeId,
        x: node.x + 180, // 节点宽度
        y: node.y + 40, // 节点中心高度
      });
    }
  };

  // 连接点 mouseUp - 完成连接
  const handleConnectionPointMouseUp = (e, nodeId, isOutput) => {
    e.stopPropagation();

    if (isConnecting && !isOutput && connectionStart) {
      // 在输入点释放 - 完成连接
      createConnection(connectionStart.nodeId, nodeId);
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnectionEnd(null);
    }
  };

  // 从面板拖拽添加节点
  const handlePanelDragStart = (e, nodeType) => {
    e.dataTransfer.setData("nodeType", nodeType);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("nodeType");
    if (!nodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom - 90;
    const y = (e.clientY - rect.top - pan.y) / zoom - 30;

    addNode(nodeType, x, y);
  };

  // 保存工作流（本地 + 服务器）
  const saveWorkflow = async () => {
    try {
      // 确保有 UUID
      const workflowToSave = {
        ...workflow,
        uuid: workflow.uuid || `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        updatedAt: new Date().toISOString(),
      };

      // 保存当前编辑的工作流到 localStorage
      localStorage.setItem("workflow_draft", JSON.stringify(workflowToSave));

      // 获取本地工作流列表
      let localWorkflows = [];
      try {
        const saved = localStorage.getItem("workflow_list");
        if (saved) {
          localWorkflows = JSON.parse(saved);
        }
      } catch (e) {
        console.error("Error loading local workflows:", e);
      }

      // 更新或添加工作流到列表
      const existingIndex = localWorkflows.findIndex((w) => w.uuid === workflowToSave.uuid);
      const workflowSummary = {
        uuid: workflowToSave.uuid,
        name: workflowToSave.name,
        nodeCount: (workflowToSave.nodes || []).length,
        active: true,
        updatedAt: workflowToSave.updatedAt,
      };

      if (existingIndex >= 0) {
        localWorkflows[existingIndex] = workflowSummary;
      } else {
        localWorkflows.push(workflowSummary);
      }

      // 保存工作流列表
      localStorage.setItem("workflow_list", JSON.stringify(localWorkflows));

      // 保存完整工作流数据
      localStorage.setItem(`workflow_${workflowToSave.uuid}`, JSON.stringify(workflowToSave));

      // 更新状态
      setWorkflow(workflowToSave);

      showToast("工作流已保存", "success");
    } catch (error) {
      showToast("保存失败: " + error.message, "error");
    }
  };

  // 日志计数器（用于生成唯一 ID）
  const logIdRef = useRef(0);

  // 添加执行日志
  const addLog = (type, message, nodeId = null) => {
    logIdRef.current += 1;
    const log = {
      id: `log_${Date.now()}_${logIdRef.current}`,
      type, // 'info' | 'success' | 'error' | 'warning'
      message,
      nodeId,
      timestamp: new Date().toLocaleTimeString(),
    };
    setExecutionLogs((prev) => [...prev, log]);
  };

  // 执行单个节点
  const executeNode = async (node, inputData) => {
    const config = NODE_TYPES[node.type];
    if (!config) {
      throw new Error(`未知的节点类型: ${node.type}`);
    }

    addLog("info", `开始执行节点: ${config.title}`, node.id);
    setExecutingNodeId(node.id);

    // 模拟不同类型节点的执行
    let result = null;
    const startTime = Date.now();

    try {
      switch (node.type) {
        case "llm-deepseek":
        case "llm-gemini":
        case "llm-qwen":
          // LLM 节点 - 调用 API
          if (!llmConfig.apiKey) {
            throw new Error("请先配置大模型 API Key");
          }
          addLog("info", `调用 ${config.title} API...`, node.id);
          
          // 确保用户消息是字符串
          let userMessage = "你好";
          if (inputData) {
            if (typeof inputData === "string") {
              userMessage = inputData;
            } else if (typeof inputData === "object") {
              userMessage = JSON.stringify(inputData);
            } else {
              userMessage = String(inputData);
            }
          }
          
          const requestBody = {
            model: llmConfig.model,
            messages: [
              { role: "system", content: node.config?.systemPrompt || "你是一个有帮助的AI助手" },
              { role: "user", content: userMessage },
            ],
            temperature: node.config?.temperature || llmConfig.temperature || 0.7,
            max_tokens: node.config?.maxTokens || llmConfig.maxTokens || 2048,
          };
          
          addLog("info", `请求模型: ${requestBody.model}`, node.id);
          
          const llmResponse = await fetch(`${llmConfig.endpoint}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${llmConfig.apiKey}`,
            },
            body: JSON.stringify(requestBody),
          });

          if (!llmResponse.ok) {
            let errorMessage = `API请求失败: ${llmResponse.status}`;
            try {
              const errorData = await llmResponse.json();
              errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
              // 无法解析错误响应
            }
            
            if (llmResponse.status === 400) {
              throw new Error(`请求格式错误: ${errorMessage}`);
            } else if (llmResponse.status === 401) {
              throw new Error("API Key无效或已过期");
            } else if (llmResponse.status === 402) {
              throw new Error("API账户余额不足");
            } else if (llmResponse.status === 429) {
              throw new Error("请求过于频繁，请稍后重试");
            } else {
              throw new Error(errorMessage);
            }
          }

          const llmData = await llmResponse.json();
          result = llmData.choices?.[0]?.message?.content || "无响应内容";
          break;

        case "trigger-manual":
          result = { triggered: true, timestamp: new Date().toISOString() };
          break;

        case "trigger-schedule":
          result = { scheduled: true, cron: node.config?.cron || "0 * * * *" };
          break;

        case "code-js":
          // JavaScript 代码执行
          addLog("info", "执行 JavaScript 代码...", node.id);
          try {
            const code = node.config?.code || "return input;";
            const fn = new Function("input", code);
            result = fn(inputData);
          } catch (e) {
            throw new Error(`代码执行错误: ${e.message}`);
          }
          break;

        case "http-request":
          // HTTP 请求
          addLog("info", `发送 HTTP ${node.config?.method || "GET"} 请求...`, node.id);
          const httpResponse = await fetch(node.config?.url || "https://httpbin.org/get", {
            method: node.config?.method || "GET",
            headers: node.config?.headers ? JSON.parse(node.config.headers) : {},
          });
          result = await httpResponse.json();
          break;

        case "condition":
          // 条件判断
          const condition = node.config?.condition || "true";
          try {
            const condFn = new Function("input", `return ${condition};`);
            result = { passed: condFn(inputData), condition };
          } catch (e) {
            result = { passed: false, error: e.message };
          }
          break;

        case "chat":
          // 聊天输出
          result = { output: inputData, type: "chat" };
          break;

        default:
          // 其他节点模拟执行
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
          result = { 
            nodeType: node.type, 
            input: inputData,
            output: `${config.title} 执行完成`,
          };
      }

      const duration = Date.now() - startTime;
      addLog("success", `节点执行完成 (${duration}ms)`, node.id);
      
      // 保存节点结果
      setNodeResults((prev) => ({
        ...prev,
        [node.id]: { success: true, result, duration },
      }));

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      addLog("error", `节点执行失败: ${error.message}`, node.id);
      setNodeResults((prev) => ({
        ...prev,
        [node.id]: { success: false, error: error.message, duration },
      }));
      throw error;
    }
  };

  // 构建工作流执行图
  const buildExecutionGraph = () => {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || [];
    
    // 构建入度表、邻接表和前驱表
    const inDegree = {};
    const adjacency = {}; // 后继节点
    const predecessors = {}; // 前驱节点
    
    nodes.forEach((node) => {
      inDegree[node.id] = 0;
      adjacency[node.id] = [];
      predecessors[node.id] = [];
    });
    
    connections.forEach((conn) => {
      if (adjacency[conn.from]) {
        adjacency[conn.from].push(conn.to);
      }
      if (inDegree[conn.to] !== undefined) {
        inDegree[conn.to]++;
      }
      if (predecessors[conn.to]) {
        predecessors[conn.to].push(conn.from);
      }
    });
    
    // 找到所有入度为0的节点（起始节点）
    const startNodes = nodes.filter((node) => inDegree[node.id] === 0);
    
    return { nodes, inDegree, adjacency, predecessors, startNodes };
  };

  // 检查是否是条件分支节点
  const isConditionalNode = (nodeType) => {
    return nodeType === "condition" || nodeType === "loop";
  };

  // 检查是否是并行汇聚点（多个输入）
  const isJoinNode = (nodeId, predecessors) => {
    return predecessors[nodeId]?.length > 1;
  };

  // 检查是否是并行分支点（多个输出）
  const isForkNode = (nodeId, adjacency) => {
    return adjacency[nodeId]?.length > 1;
  };

  // 运行工作流（支持并行执行和条件分支）
  const runWorkflow = async () => {
    if ((workflow.nodes || []).length === 0) {
      showToast("请先添加节点", "warning");
      return;
    }

    // 重置状态
    setIsRunning(true);
    setExecutionLogs([]);
    setNodeResults({});
    setExecutionResult(null);
    setShowResultPanel(true);
    logIdRef.current = 0;

    addLog("info", "🚀 工作流开始执行");
    const startTime = Date.now();

    try {
      const { nodes, inDegree, adjacency, predecessors, startNodes } = buildExecutionGraph();
      
      if (startNodes.length === 0) {
        throw new Error("未找到起始节点（请确保有触发器或无输入的节点）");
      }

      addLog("info", `共 ${nodes.length} 个节点，${startNodes.length} 个起始节点`);
      
      // 检测工作流模式
      const hasFork = nodes.some((n) => isForkNode(n.id, adjacency));
      const hasJoin = nodes.some((n) => isJoinNode(n.id, predecessors));
      const hasCondition = nodes.some((n) => isConditionalNode(n.type));
      
      if (hasFork) addLog("info", "📊 检测到并行分支模式");
      if (hasJoin) addLog("info", "🔀 检测到并行汇聚模式");
      if (hasCondition) addLog("info", "🔀 检测到条件分支模式");

      // 节点结果存储
      const allResults = {};
      // 跟踪已完成的节点
      const completed = new Set();
      // 当前入度（动态更新）
      const currentInDegree = { ...inDegree };

      // 执行单个节点并返回结果
      const runNode = async (node) => {
        // 收集所有前驱节点的输出作为输入
        const inputs = predecessors[node.id].map((predId) => allResults[predId]);
        // 如果只有一个输入，直接传递；否则传递数组
        const inputData = inputs.length === 1 ? inputs[0] : inputs.length > 0 ? inputs : null;
        
        const result = await executeNode(node, inputData);
        allResults[node.id] = result;
        completed.add(node.id);
        
        return { node, result };
      };

      // 处理条件节点的路由
      const evaluateCondition = (node, result) => {
        const nextNodes = adjacency[node.id];
        if (nextNodes.length <= 1) return nextNodes;
        
        // 条件节点：根据结果选择分支
        if (node.type === "condition") {
          const passed = result?.passed ?? true;
          // 假设第一个连接是 true 分支，第二个是 false 分支
          if (passed) {
            addLog("info", `条件判断: 通过 → 执行 true 分支`, node.id);
            return [nextNodes[0]];
          } else {
            addLog("info", `条件判断: 不通过 → 执行 false 分支`, node.id);
            return nextNodes.length > 1 ? [nextNodes[1]] : [];
          }
        }
        
        return nextNodes;
      };

      // BFS 执行，支持并行
      let currentLevel = [...startNodes];
      let levelCount = 1;

      while (currentLevel.length > 0) {
        const isParallel = currentLevel.length > 1;
        
        if (isParallel) {
          addLog("info", `⚡ 第 ${levelCount} 层: 并行执行 ${currentLevel.length} 个节点`);
          
          // 并行执行当前层的所有节点
          const results = await Promise.all(currentLevel.map(runNode));
          
          addLog("success", `✓ 第 ${levelCount} 层并行执行完成`);
          
          // 收集下一层节点
          const nextLevel = new Set();
          
          for (const { node, result } of results) {
            // 处理条件分支
            const nextNodeIds = evaluateCondition(node, result);
            
            for (const nextId of nextNodeIds) {
              currentInDegree[nextId]--;
              
              // 只有当所有前驱都完成时才加入下一层（汇聚点）
              if (currentInDegree[nextId] === 0) {
                const nextNode = nodes.find((n) => n.id === nextId);
                if (nextNode && !completed.has(nextId)) {
                  nextLevel.add(nextNode);
                }
              }
            }
          }
          
          currentLevel = Array.from(nextLevel);
        } else {
          // 单节点执行（链式）
          const node = currentLevel[0];
          const { result } = await runNode(node);
          
          // 处理条件分支
          const nextNodeIds = evaluateCondition(node, result);
          
          // 更新下一层
          currentLevel = [];
          for (const nextId of nextNodeIds) {
            currentInDegree[nextId]--;
            
            if (currentInDegree[nextId] === 0) {
              const nextNode = nodes.find((n) => n.id === nextId);
              if (nextNode && !completed.has(nextId)) {
                currentLevel.push(nextNode);
              }
            }
          }
        }
        
        levelCount++;
      }

      const totalDuration = Date.now() - startTime;
      
      // 找到最终输出（没有后继的节点）
      const endNodes = nodes.filter((n) => adjacency[n.id].length === 0);
      const finalOutputs = endNodes.map((n) => allResults[n.id]).filter(Boolean);
      const finalOutput = finalOutputs.length === 1 ? finalOutputs[0] : finalOutputs;

      addLog("success", `✅ 工作流执行完成 (总耗时: ${totalDuration}ms)`);

      setExecutionResult({
        success: true,
        duration: totalDuration,
        nodeCount: completed.size,
        parallelExecution: hasFork,
        conditionalBranch: hasCondition,
        finalOutput,
        allResults,
      });

      showToast("工作流执行完成", "success");
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      addLog("error", `❌ 工作流执行失败: ${error.message}`);

      setExecutionResult({
        success: false,
        duration: totalDuration,
        error: error.message,
      });

      showToast("执行失败: " + error.message, "error");
    } finally {
      setIsRunning(false);
      setExecutingNodeId(null);
    }
  };

  // 缩放控制
  const zoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3));
  const zoomOut = () => setZoom((prev) => Math.max(prev * 0.8, 0.1));
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // 保存LLM配置
  const saveLLMConfig = () => {
    localStorage.setItem("workflow_llm_config", JSON.stringify(llmConfig));
    setShowLLMConfig(false);
    showToast("大模型配置已保存", "success");
  };

  // AI生成工作流
  const generateWorkflowWithAI = async () => {
    if (!aiPrompt.trim()) {
      showToast("请描述您想要的工作流", "warning");
      return;
    }

    if (!llmConfig.apiKey) {
      showToast("请先配置大模型 API Key", "warning");
      setShowAICreator(false);
      setShowLLMConfig(true);
      return;
    }

    setIsGenerating(true);
    showToast("AI正在生成工作流...", "info");

    const systemPrompt = `你是一个工作流设计专家。根据用户的描述，生成一个JSON格式的工作流配置。

可用的节点类型：
- llm-deepseek: DeepSeek V3大语言模型，用于文本生成和对话
- llm-gemini: Gemini Flash大语言模型
- llm-qwen: 通义千问大语言模型
- trigger-manual: 手动触发节点
- trigger-schedule: 定时触发节点
- trigger-webhook: Webhook触发节点
- rag-query: 知识检索节点，用于RAG检索
- code-js: JavaScript代码执行节点
- code-python: Python代码执行节点
- condition: 条件判断节点
- loop: 循环节点
- http-request: HTTP请求节点
- db-query: 数据库查询节点
- chat: 聊天输出节点
- image-gen: 图像生成节点
- image-process: 图像处理节点

请返回一个JSON对象，格式如下：
{
    "nodes": [
        {
            "id": "node_1",
            "type": "节点类型",
            "x": x坐标(建议从100开始，每个节点间隔200-300),
            "y": y坐标(建议从100开始),
            "config": { 节点配置 }
        }
    ],
    "connections": [
        {
            "id": "conn_1",
            "from": "源节点id",
            "to": "目标节点id"
        }
    ]
}

节点配置示例：
- llm节点: { "systemPrompt": "你是一个助手", "temperature": 0.7 }
- code节点: { "code": "return input * 2;" }
- condition节点: { "condition": "input > 0" }
- http节点: { "url": "https://api.example.com", "method": "GET" }

只返回JSON，不要其他解释。`;

    try {
      const response = await fetch(`${llmConfig.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: aiPrompt },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        if (response.status === 402) {
          throw new Error("API账户余额不足，请充值后重试");
        } else if (response.status === 401) {
          throw new Error("API Key无效或已过期，请检查配置");
        } else if (response.status === 429) {
          throw new Error("API请求过于频繁，请稍后重试");
        } else {
          throw new Error(`API请求失败: ${response.status}`);
        }
      }

      const data = await response.json();
      let workflowJson = data.choices[0].message.content;

      // 提取JSON
      const jsonMatch = workflowJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workflowJson = jsonMatch[0];
      }

      const generatedWorkflow = JSON.parse(workflowJson);

      // 保存历史
      saveHistory();

      // 应用生成的工作流
      setWorkflow((prev) => ({
        ...prev,
        nodes: generatedWorkflow.nodes || [],
        connections: generatedWorkflow.connections || [],
      }));

      setShowAICreator(false);
      setAiPrompt("");
      showToast("工作流已生成", "success");
    } catch (error) {
      showToast("生成失败: " + error.message, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // 清空画布
  const clearCanvas = () => {
    if (window.confirm("确定要清空所有节点吗？")) {
      saveHistory();
      setWorkflow((prev) => ({ ...prev, nodes: [], connections: [] }));
      showToast("画布已清空", "success");
    }
  };

  // 过滤节点
  const filteredCategories = useMemo(() => {
    if (!NODE_CATEGORIES) return [];
    if (!searchQuery) return NODE_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return NODE_CATEGORIES.map((cat) => ({
      ...cat,
      nodes: (cat.nodes || []).filter((nodeType) => {
        const config = NODE_TYPES?.[nodeType];
        if (!config) return false;
        return (
          config.title?.toLowerCase().includes(query) ||
          nodeType.toLowerCase().includes(query)
        );
      }),
    })).filter((cat) => cat.nodes.length > 0);
  }, [searchQuery]);

  // 获取节点配置
  const getNodeConfig = (type) => NODE_TYPES[type];

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === "s") {
          e.preventDefault();
          saveWorkflow();
        }
      }

      if (e.key === "Delete" && selectedNode) {
        deleteNode(selectedNode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, selectedNode, deleteNode]);

  // 滚轮缩放事件 - 使用非 passive 监听器以支持 preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wheelHandler = (e) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      
      setZoom((prevZoom) => {
        const newZoom = Math.min(Math.max(prevZoom * delta, 0.2), 3);
        const zoomRatio = newZoom / prevZoom;
        
        setPan((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * zoomRatio,
          y: mouseY - (mouseY - prevPan.y) * zoomRatio,
        }));
        
        return newZoom;
      });
    };

    canvas.addEventListener("wheel", wheelHandler, { passive: false });
    return () => canvas.removeEventListener("wheel", wheelHandler);
  }, []);

  return (
    <div className="flex h-screen bg-theme-bg-container">
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="h-14 bg-theme-bg-secondary border-b border-theme-sidebar-border flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-theme-text-secondary hover:text-theme-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>返回</span>
            </Link>
            <div className="w-px h-6 bg-theme-sidebar-border" />
            <input
              type="text"
              value={workflow.name}
              onChange={(e) =>
                setWorkflow((prev) => ({ ...prev, name: e.target.value }))
              }
              className="bg-transparent text-theme-text-primary font-medium text-lg focus:outline-none border-b border-transparent hover:border-theme-sidebar-border focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* 撤销/重做 */}
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="p-2 rounded-lg text-theme-text-secondary hover:bg-theme-action-menu-item-hover disabled:opacity-30 transition-colors"
              title="撤销 (Ctrl+Z)"
            >
              <ArrowCounterClockwise className="w-5 h-5" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-2 rounded-lg text-theme-text-secondary hover:bg-theme-action-menu-item-hover disabled:opacity-30 transition-colors"
              title="重做 (Ctrl+Shift+Z)"
            >
              <ArrowClockwise className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-theme-sidebar-border mx-2" />

            {/* AI创建按钮 */}
            <button
              onClick={() => setShowAICreator(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Robot className="w-4 h-4" />
              AI创建
            </button>

            {/* 大模型配置按钮 */}
            <button
              onClick={() => setShowLLMConfig(true)}
              className="p-2 rounded-lg text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="大模型配置"
            >
              <Gear className="w-5 h-5" />
            </button>

            <div className="w-px h-6 bg-theme-sidebar-border mx-2" />

            <button
              onClick={saveWorkflow}
              className="flex items-center gap-2 px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-colors"
            >
              <FloppyDisk className="w-4 h-4" />
              保存
            </button>
            <button
              onClick={runWorkflow}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Stop className="w-4 h-4" />
                  停止
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  运行
                </>
              )}
            </button>
            <button
              onClick={() => setShowResultPanel(!showResultPanel)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showResultPanel
                  ? "bg-blue-500 text-white"
                  : "bg-theme-bg-secondary text-theme-text-primary border border-theme-sidebar-border hover:bg-theme-action-menu-item-hover"
              }`}
              data-tooltip-id="result-panel-btn"
              data-tooltip-content={showResultPanel ? "隐藏结果" : "显示结果"}
            >
              <ListBullets className="w-4 h-4" />
              结果
            </button>
          </div>
        </div>

        {/* 工作区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 节点面板 */}
          <div className="w-64 bg-theme-bg-secondary border-r border-theme-sidebar-border overflow-y-auto flex flex-col">
            <div className="p-3 border-b border-theme-sidebar-border">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索节点..."
                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredCategories.map((category) => (
                <div key={category.id} className="mb-2">
                  <button
                    onClick={() =>
                      setExpandedCategories((prev) =>
                        prev.includes(category.id)
                          ? prev.filter((c) => c !== category.id)
                          : [...prev, category.id]
                      )
                    }
                    className="flex items-center justify-between w-full px-2 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors rounded"
                  >
                    <span className="flex items-center gap-2">
                      <span>{category.icon}</span>
                      <span>{category.name}</span>
                    </span>
                    {expandedCategories.includes(category.id) ? (
                      <CaretDown className="w-4 h-4" />
                    ) : (
                      <CaretRight className="w-4 h-4" />
                    )}
                  </button>

                  {expandedCategories.includes(category.id) && (
                    <div className="space-y-1 mt-1 ml-2">
                      {category.nodes.map((nodeType) => {
                        const config = NODE_TYPES[nodeType];
                        if (!config) return null;

                        return (
                          <div
                            key={nodeType}
                            draggable
                            onDragStart={(e) => handlePanelDragStart(e, nodeType)}
                            className="flex items-center gap-2 px-2 py-1.5 bg-theme-bg-primary rounded cursor-grab hover:bg-theme-action-menu-item-hover transition-colors"
                          >
                            <div
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs ${config.color}`}
                            >
                              {config.icon}
                            </div>
                            <span className="text-sm text-theme-text-primary truncate">
                              {config.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 画布 */}
          <div
            ref={canvasRef}
            className="flex-1 relative overflow-hidden"
            style={{
              background: `
                radial-gradient(circle, var(--theme-sidebar-border) 1px, transparent 1px)
              `,
              backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
              backgroundPosition: `${pan.x}px ${pan.y}px`,
              cursor: isPanning ? "grabbing" : "default",
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDrop={handleCanvasDrop}
            onDragOver={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onAuxClick={(e) => e.button === 1 && e.preventDefault()}
          >
            {/* SVG 连接层 */}
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                pointerEvents: "none",
              }}
            >
              <defs>
                <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* 现有连接 */}
              {(workflow.connections || []).map((conn) => {
                const fromNode = (workflow.nodes || []).find((n) => n.id === conn.from);
                const toNode = (workflow.nodes || []).find((n) => n.id === conn.to);
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.x + 180;
                const y1 = fromNode.y + 40;
                const x2 = toNode.x;
                const y2 = toNode.y + 40;

                return (
                  <g key={conn.id} style={{ pointerEvents: "auto" }}>
                    {/* 透明粗线用于增大点击区域 */}
                    <path
                      d={getBezierPath(x1, y1, x2, y2)}
                      stroke="transparent"
                      strokeWidth="15"
                      fill="none"
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("确定要删除此连接吗？")) {
                          deleteConnection(conn.id);
                          showToast("连接已删除", "success");
                        }
                      }}
                    />
                    {/* 可见的连接线 */}
                    <path
                      d={getBezierPath(x1, y1, x2, y2)}
                      stroke="url(#connectionGradient)"
                      strokeWidth="3"
                      fill="none"
                      className="pointer-events-none transition-all"
                    />
                    {/* 箭头 */}
                    <circle cx={x2} cy={y2} r="4" fill="#10b981" className="pointer-events-none" />
                  </g>
                );
              })}

              {/* 临时连接线 */}
              {isConnecting && connectionStart && tempConnectionEnd && (
                <path
                  d={getBezierPath(
                    connectionStart.x,
                    connectionStart.y,
                    tempConnectionEnd.x,
                    tempConnectionEnd.y
                  )}
                  stroke="#6366f1"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                />
              )}
            </svg>

            {/* 节点层 */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {(workflow.nodes || []).map((node) => {
                const config = getNodeConfig(node.type);
                if (!config) return null;
                const isSelected = selectedNode === node.id;
                const isExecuting = executingNodeId === node.id;
                const nodeResult = nodeResults[node.id];

                return (
                  <div
                    key={node.id}
                    className={`absolute w-[180px] bg-theme-bg-secondary border-2 rounded-xl shadow-lg transition-all duration-300 ${
                      isExecuting
                        ? "border-yellow-500 shadow-yellow-500/50 scale-105 animate-pulse"
                        : nodeResult?.success
                        ? "border-green-500 shadow-green-500/30"
                        : nodeResult?.error
                        ? "border-red-500 shadow-red-500/30"
                        : isSelected
                        ? "border-blue-500 shadow-blue-500/30"
                        : "border-theme-sidebar-border hover:border-theme-text-secondary"
                    }`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  >
                    {/* 执行状态指示器 */}
                    {isExecuting && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center z-20 animate-spin">
                        <SpinnerGap className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {nodeResult?.success && !isExecuting && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center z-20">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    {nodeResult?.error && !isExecuting && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center z-20">
                        <span className="text-white text-xs">✕</span>
                      </div>
                    )}

                    {/* 节点头部 */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${config.color} ${
                        isExecuting ? "animate-pulse" : ""
                      }`}
                    >
                      <span className="text-white">{config.icon}</span>
                      <span className="text-white text-sm font-medium truncate flex-1">
                        {config.title}
                      </span>
                    </div>

                    {/* 节点内容 */}
                    <div className="p-3 min-h-[40px]">
                      {nodeResult?.duration ? (
                        <p className="text-xs text-theme-text-secondary">
                          耗时: {nodeResult.duration}ms
                        </p>
                      ) : (
                        <p className="text-xs text-theme-text-secondary">
                          {node.id.slice(0, 15)}...
                        </p>
                      )}
                    </div>

                    {/* 输入连接点 (蓝色) */}
                    {config.inputs.length > 0 && (
                      <div
                        className={`absolute -left-3 top-1/2 w-6 h-6 bg-blue-500 border-2 border-white rounded-full transform -translate-y-1/2 cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center z-10 ${
                          isConnecting ? "animate-pulse ring-2 ring-blue-400" : ""
                        }`}
                        onMouseDown={(e) => handleConnectionPointMouseDown(e, node.id, false)}
                        onMouseUp={(e) => handleConnectionPointMouseUp(e, node.id, false)}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}

                    {/* 输出连接点 (绿色) */}
                    {config.outputs.length > 0 && (
                      <div
                        className="absolute -right-3 top-1/2 w-6 h-6 bg-green-500 border-2 border-white rounded-full transform -translate-y-1/2 cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center z-10"
                        onMouseDown={(e) => handleConnectionPointMouseDown(e, node.id, true)}
                        onMouseUp={(e) => handleConnectionPointMouseUp(e, node.id, true)}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}

                    {/* 选中时的操作按钮 */}
                    {isSelected && (
                      <div className="absolute -top-10 left-0 flex items-center gap-1 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg p-1 shadow-lg">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateNode(node.id);
                          }}
                          className="p-1.5 hover:bg-theme-action-menu-item-hover rounded"
                          title="复制"
                        >
                          <Copy className="w-4 h-4 text-theme-text-secondary" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNode(node.id);
                          }}
                          className="p-1.5 hover:bg-red-500/20 rounded"
                          title="删除"
                        >
                          <Trash className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 缩放控制 */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg p-1">
              <button
                onClick={zoomOut}
                className="p-2 hover:bg-theme-action-menu-item-hover rounded"
                title="缩小"
              >
                <MagnifyingGlassMinus className="w-4 h-4 text-theme-text-secondary" />
              </button>
              <span className="px-2 text-sm text-theme-text-secondary min-w-[50px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-2 hover:bg-theme-action-menu-item-hover rounded"
                title="放大"
              >
                <MagnifyingGlassPlus className="w-4 h-4 text-theme-text-secondary" />
              </button>
              <button
                onClick={resetZoom}
                className="p-2 hover:bg-theme-action-menu-item-hover rounded"
                title="重置"
              >
                <ArrowsOutCardinal className="w-4 h-4 text-theme-text-secondary" />
              </button>
            </div>

            {/* 空状态 */}
            {(workflow.nodes || []).length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Lightning className="w-16 h-16 text-theme-text-secondary/20 mx-auto mb-4" />
                  <p className="text-theme-text-secondary text-lg">
                    从左侧拖拽节点到画布开始设计工作流
                  </p>
                  <p className="text-theme-text-secondary/60 text-sm mt-2">
                    按住 Alt + 左键拖动画布，Ctrl + 滚轮缩放
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 右侧配置面板 */}
          {selectedNode && (
            <div className="w-72 bg-theme-bg-secondary border-l border-theme-sidebar-border overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-theme-text-primary font-medium">节点配置</h3>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 hover:bg-theme-action-menu-item-hover rounded"
                  >
                    <X className="w-4 h-4 text-theme-text-secondary" />
                  </button>
                </div>

                {(() => {
                  const node = (workflow.nodes || []).find((n) => n.id === selectedNode);
                  if (!node) return null;
                  const config = getNodeConfig(node.type);
                  if (!config) return null;

                  return (
                    <div className="space-y-4">
                      {/* 节点信息 */}
                      <div className="flex items-center gap-3 p-3 bg-theme-bg-primary rounded-lg">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${config.color}`}
                        >
                          {config.icon}
                        </div>
                        <div>
                          <p className="text-theme-text-primary font-medium">
                            {config.title}
                          </p>
                          <p className="text-xs text-theme-text-secondary">
                            {node.type}
                          </p>
                        </div>
                      </div>

                      {/* 配置项 */}
                      <div className="space-y-3">
                        {Object.entries(node.config || {}).map(([key, value]) => (
                          <div key={key}>
                            <label className="block text-sm text-theme-text-secondary mb-1 capitalize">
                              {key}
                            </label>
                            {typeof value === "boolean" ? (
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={value}
                                  onChange={(e) =>
                                    setWorkflow((prev) => ({
                                      ...prev,
                                      nodes: prev.nodes.map((n) =>
                                        n.id === node.id
                                          ? {
                                              ...n,
                                              config: {
                                                ...n.config,
                                                [key]: e.target.checked,
                                              },
                                            }
                                          : n
                                      ),
                                    }))
                                  }
                                  className="w-4 h-4"
                                />
                                <span className="text-sm text-theme-text-primary">
                                  启用
                                </span>
                              </label>
                            ) : typeof value === "number" ? (
                              <input
                                type="number"
                                value={value}
                                onChange={(e) =>
                                  setWorkflow((prev) => ({
                                    ...prev,
                                    nodes: prev.nodes.map((n) =>
                                      n.id === node.id
                                        ? {
                                            ...n,
                                            config: {
                                              ...n.config,
                                              [key]: parseFloat(e.target.value) || 0,
                                            },
                                          }
                                        : n
                                    ),
                                  }))
                                }
                                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                              />
                            ) : key.includes("Prompt") ||
                              key.includes("code") ||
                              key.includes("Template") ? (
                              <textarea
                                value={value}
                                onChange={(e) =>
                                  setWorkflow((prev) => ({
                                    ...prev,
                                    nodes: prev.nodes.map((n) =>
                                      n.id === node.id
                                        ? {
                                            ...n,
                                            config: {
                                              ...n.config,
                                              [key]: e.target.value,
                                            },
                                          }
                                        : n
                                    ),
                                  }))
                                }
                                rows={4}
                                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500 resize-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={value}
                                onChange={(e) =>
                                  setWorkflow((prev) => ({
                                    ...prev,
                                    nodes: prev.nodes.map((n) =>
                                      n.id === node.id
                                        ? {
                                            ...n,
                                            config: {
                                              ...n.config,
                                              [key]: e.target.value,
                                            },
                                          }
                                        : n
                                    ),
                                  }))
                                }
                                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 连接信息 */}
                      <div className="pt-4 border-t border-theme-sidebar-border">
                        <h4 className="text-sm text-theme-text-secondary mb-2">
                          连接
                        </h4>
                        <div className="space-y-1 text-xs">
                          <p className="text-theme-text-secondary">
                            输入: {config.inputs.join(", ") || "无"}
                          </p>
                          <p className="text-theme-text-secondary">
                            输出: {config.outputs.join(", ") || "无"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI创建工作流弹窗 */}
      {showAICreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl w-[500px] max-w-[90vw] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border">
              <h2 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
                <Robot className="w-5 h-5 text-purple-400" />
                AI工作流创建器
              </h2>
              <button
                onClick={() => setShowAICreator(false)}
                className="p-1 hover:bg-theme-action-menu-item-hover rounded"
              >
                <X className="w-5 h-5 text-theme-text-secondary" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  描述你想要的工作流
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  placeholder="例如：创建一个能够读取文档并回答问题的RAG工作流，包含文档上传、向量检索和LLM问答功能..."
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  选择模型
                </label>
                <select
                  value={llmConfig.model}
                  onChange={(e) =>
                    setLLMConfig((prev) => ({ ...prev, model: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-coder">DeepSeek Coder</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="qwen-turbo">通义千问 Turbo</option>
                  <option value="qwen-plus">通义千问 Plus</option>
                </select>
              </div>

              <div className="bg-theme-bg-primary/50 rounded-lg p-3">
                <p className="text-xs text-theme-text-secondary">
                  💡 提示：详细描述工作流的用途、需要的输入输出、处理步骤等，AI将为你生成完整的工作流配置。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-theme-sidebar-border">
              <button
                onClick={() => setShowAICreator(false)}
                className="px-4 py-2 text-theme-text-secondary hover:bg-theme-action-menu-item-hover rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={generateWorkflowWithAI}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <SpinnerGap className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Robot className="w-4 h-4" />
                    生成工作流
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 大模型配置弹窗 */}
      {showLLMConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl w-[500px] max-w-[90vw] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border">
              <h2 className="text-lg font-semibold text-theme-text-primary flex items-center gap-2">
                <Gear className="w-5 h-5 text-blue-400" />
                大模型执行配置
              </h2>
              <button
                onClick={() => setShowLLMConfig(false)}
                className="p-1 hover:bg-theme-action-menu-item-hover rounded"
              >
                <X className="w-5 h-5 text-theme-text-secondary" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  API 地址
                </label>
                <input
                  type="text"
                  value={llmConfig.endpoint}
                  onChange={(e) =>
                    setLLMConfig((prev) => ({ ...prev, endpoint: e.target.value }))
                  }
                  placeholder="https://api.deepseek.com"
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={(e) =>
                    setLLMConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  默认模型
                </label>
                <select
                  value={llmConfig.model}
                  onChange={(e) =>
                    setLLMConfig((prev) => ({ ...prev, model: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="deepseek-chat">DeepSeek Chat</option>
                  <option value="deepseek-coder">DeepSeek Coder</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="qwen-turbo">通义千问 Turbo</option>
                  <option value="qwen-plus">通义千问 Plus</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-theme-text-secondary mb-2">
                    温度 (Temperature)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={llmConfig.temperature}
                    onChange={(e) =>
                      setLLMConfig((prev) => ({
                        ...prev,
                        temperature: parseFloat(e.target.value) || 0.7,
                      }))
                    }
                    className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-theme-text-secondary mb-2">
                    最大Tokens
                  </label>
                  <input
                    type="number"
                    step="256"
                    min="256"
                    max="32768"
                    value={llmConfig.maxTokens}
                    onChange={(e) =>
                      setLLMConfig((prev) => ({
                        ...prev,
                        maxTokens: parseInt(e.target.value) || 2048,
                      }))
                    }
                    className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="bg-theme-bg-primary/50 rounded-lg p-3">
                <p className="text-xs text-theme-text-secondary">
                  💡 这些配置将用于工作流中的LLM节点执行和AI创建功能。配置会自动保存到本地。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-theme-sidebar-border">
              <button
                onClick={() => setShowLLMConfig(false)}
                className="px-4 py-2 text-theme-text-secondary hover:bg-theme-action-menu-item-hover rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={saveLLMConfig}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <FloppyDisk className="w-4 h-4" />
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 执行结果面板 */}
      {showResultPanel && (
        <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-theme-bg-secondary border-l border-t border-theme-sidebar-border shadow-2xl z-40 flex flex-col">
          {/* 面板头部 */}
          <div className="flex items-center justify-between p-3 border-b border-theme-sidebar-border bg-theme-bg-primary/50">
            <h3 className="text-sm font-semibold text-theme-text-primary flex items-center gap-2">
              <Lightning className="w-4 h-4 text-yellow-400" />
              执行日志
              {isRunning && (
                <SpinnerGap className="w-4 h-4 animate-spin text-yellow-400" />
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExecutionLogs([])}
                className="text-xs text-theme-text-secondary hover:text-theme-text-primary"
              >
                清空
              </button>
              <button
                onClick={() => setShowResultPanel(false)}
                className="p-1 hover:bg-theme-action-menu-item-hover rounded"
              >
                <X className="w-4 h-4 text-theme-text-secondary" />
              </button>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs font-mono">
            {executionLogs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded ${
                  log.type === "error"
                    ? "bg-red-500/10 text-red-400"
                    : log.type === "success"
                    ? "bg-green-500/10 text-green-400"
                    : log.type === "warning"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-theme-bg-primary/50 text-theme-text-secondary"
                }`}
              >
                <span className="opacity-50">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
            {executionLogs.length === 0 && (
              <div className="text-center text-theme-text-secondary py-4">
                暂无执行日志
              </div>
            )}
          </div>

          {/* 执行结果 */}
          {executionResult && (
            <div className="border-t border-theme-sidebar-border p-3 bg-theme-bg-primary/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-theme-text-primary">
                  {executionResult.success ? "✅ 执行成功" : "❌ 执行失败"}
                </span>
                <span className="text-xs text-theme-text-secondary">
                  耗时: {executionResult.duration}ms
                </span>
              </div>
              
              {executionResult.finalOutput && (
                <div className="mt-2">
                  <p className="text-xs text-theme-text-secondary mb-1">最终输出:</p>
                  <pre className="text-xs bg-theme-bg-primary p-2 rounded overflow-x-auto max-h-[100px] overflow-y-auto text-theme-text-primary">
                    {typeof executionResult.finalOutput === "string"
                      ? executionResult.finalOutput
                      : JSON.stringify(executionResult.finalOutput, null, 2)}
                  </pre>
                </div>
              )}

              {executionResult.error && (
                <div className="mt-2">
                  <p className="text-xs text-red-400">{executionResult.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
