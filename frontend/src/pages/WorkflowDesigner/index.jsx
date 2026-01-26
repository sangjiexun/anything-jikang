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
} from "@phosphor-icons/react";
import Sidebar from "@/components/Sidebar";
import showToast from "@/utils/toast";
import { NODE_TYPES, NODE_CATEGORIES } from "./nodeTypes";
import Workflow from "@/models/workflow";

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

  // 处理滚轮缩放 - 直接滚轮缩放，以鼠标位置为中心
  const handleWheel = (e) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // 鼠标在画布中的位置
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 计算缩放比例
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(zoom * delta, 0.2), 3);
    
    // 以鼠标位置为中心缩放
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - pan.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - pan.y) * zoomRatio;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
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

  // 保存工作流到服务器
  const saveWorkflow = async () => {
    try {
      // 保存到 localStorage
      localStorage.setItem("workflow_draft", JSON.stringify(workflow));

      // 保存到服务器
      const config = {
        nodes: workflow.nodes,
        connections: workflow.connections || [],
        blocks: (workflow.nodes || []).map((node) => ({
          id: node.id,
          type: node.type,
          position: { x: node.x, y: node.y },
          config: node.config,
        })),
      };

      const result = await Workflow.save(
        workflow.name,
        config,
        workflow.uuid || null
      );

      if (result.success) {
        // 更新 UUID
        if (result.flow?.uuid) {
          setWorkflow((prev) => ({ ...prev, uuid: result.flow.uuid }));
        }
        showToast("工作流已保存到服务器", "success");
      } else {
        showToast("保存到服务器失败: " + (result.error || "未知错误"), "warning");
      }
    } catch (error) {
      showToast("保存失败: " + error.message, "error");
    }
  };

  // 运行工作流
  const runWorkflow = async () => {
    if ((workflow.nodes || []).length === 0) {
      showToast("请先添加节点", "warning");
      return;
    }

    setIsRunning(true);
    showToast("工作流开始执行...", "info");

    try {
      // 模拟执行
      for (const node of (workflow.nodes || [])) {
        await new Promise((r) => setTimeout(r, 500));
      }
      showToast("工作流执行完成", "success");
    } catch (error) {
      showToast("执行失败: " + error.message, "error");
    } finally {
      setIsRunning(false);
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
            onWheel={handleWheel}
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

                return (
                  <div
                    key={node.id}
                    className={`absolute w-[180px] bg-theme-bg-secondary border-2 rounded-xl shadow-lg transition-shadow ${
                      isSelected
                        ? "border-blue-500 shadow-blue-500/30"
                        : "border-theme-sidebar-border hover:border-theme-text-secondary"
                    }`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                  >
                    {/* 节点头部 */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${config.color}`}
                    >
                      <span className="text-white">{config.icon}</span>
                      <span className="text-white text-sm font-medium truncate flex-1">
                        {config.title}
                      </span>
                    </div>

                    {/* 节点内容 */}
                    <div className="p-3 min-h-[40px]">
                      <p className="text-xs text-theme-text-secondary">
                        {node.id.slice(0, 15)}...
                      </p>
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
    </div>
  );
}
