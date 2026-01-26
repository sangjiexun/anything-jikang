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

  // 工作流状态
  const [workflow, setWorkflow] = useState(() => {
    const saved = localStorage.getItem("workflow_draft");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load workflow:", e);
      }
    }
    return {
      id: generateId(),
      name: "新建工作流",
      nodes: [],
      connections: [],
    };
  });

  // UI 状态
  const [selectedNode, setSelectedNode] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(
    NODE_CATEGORIES.map((c) => c.id)
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
      const node = workflow.nodes.find((n) => n.id === nodeId);
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
        nodes: [...prev.nodes, newNode],
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
      const exists = workflow.connections.some(
        (c) => c.from === fromNodeId && c.to === toNodeId
      );
      if (exists) return;

      // 检查是否连接到自己
      if (fromNodeId === toNodeId) return;

      saveHistory();

      setWorkflow((prev) => ({
        ...prev,
        connections: [
          ...prev.connections,
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

  // 处理画布拖拽
  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      } else {
        setSelectedNode(null);
      }
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

  // 处理滚轮缩放
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(Math.max(prev * delta, 0.1), 3));
    }
  };

  // 节点拖拽开始
  const handleNodeDragStart = (e, nodeId) => {
    e.stopPropagation();
    const node = workflow.nodes.find((n) => n.id === nodeId);
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

  // 连接点点击
  const handleConnectionPointClick = (e, nodeId, isOutput) => {
    e.stopPropagation();

    if (!isConnecting && isOutput) {
      // 开始连接
      const node = workflow.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      setIsConnecting(true);
      setConnectionStart({
        nodeId,
        x: node.x + 180, // 节点宽度
        y: node.y + 40, // 节点中心高度
      });
    } else if (isConnecting && !isOutput) {
      // 完成连接
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
        connections: workflow.connections,
        blocks: workflow.nodes.map((node) => ({
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
    if (workflow.nodes.length === 0) {
      showToast("请先添加节点", "warning");
      return;
    }

    setIsRunning(true);
    showToast("工作流开始执行...", "info");

    try {
      // 模拟执行
      for (const node of workflow.nodes) {
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
    if (!searchQuery) return NODE_CATEGORIES;

    const query = searchQuery.toLowerCase();
    return NODE_CATEGORIES.map((cat) => ({
      ...cat,
      nodes: cat.nodes.filter((nodeType) => {
        const config = NODE_TYPES[nodeType];
        return (
          config.title.toLowerCase().includes(query) ||
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
          >
            {/* SVG 连接层 */}
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <defs>
                <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* 现有连接 */}
              {workflow.connections.map((conn) => {
                const fromNode = workflow.nodes.find((n) => n.id === conn.from);
                const toNode = workflow.nodes.find((n) => n.id === conn.to);
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.x + 180;
                const y1 = fromNode.y + 40;
                const x2 = toNode.x;
                const y2 = toNode.y + 40;

                return (
                  <g key={conn.id}>
                    <path
                      d={getBezierPath(x1, y1, x2, y2)}
                      stroke="url(#connectionGradient)"
                      strokeWidth="3"
                      fill="none"
                      className="pointer-events-auto cursor-pointer hover:stroke-red-500"
                      onClick={() => deleteConnection(conn.id)}
                    />
                    {/* 箭头 */}
                    <circle cx={x2} cy={y2} r="4" fill="#10b981" />
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
              {workflow.nodes.map((node) => {
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

                    {/* 输入连接点 */}
                    {config.inputs.length > 0 && (
                      <div
                        className="absolute -left-3 top-1/2 w-6 h-6 bg-blue-500 border-2 border-white rounded-full transform -translate-y-1/2 cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center"
                        onClick={(e) => handleConnectionPointClick(e, node.id, false)}
                      >
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}

                    {/* 输出连接点 */}
                    {config.outputs.length > 0 && (
                      <div
                        className="absolute -right-3 top-1/2 w-6 h-6 bg-green-500 border-2 border-white rounded-full transform -translate-y-1/2 cursor-crosshair hover:scale-125 transition-transform flex items-center justify-center"
                        onClick={(e) => handleConnectionPointClick(e, node.id, true)}
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
            {workflow.nodes.length === 0 && (
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
                  const node = workflow.nodes.find((n) => n.id === selectedNode);
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
    </div>
  );
}
