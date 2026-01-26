import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Lightning,
  Brain,
  ChatCircle,
  Database,
  Code,
  GitBranch,
  ArrowsClockwise,
  Timer,
  Globe,
  Funnel,
  MagicWand,
  X,
  Check,
  DotsThreeVertical,
  DotsSixVertical,
} from "@phosphor-icons/react";
import Sidebar from "@/components/Sidebar";
import showToast from "@/utils/toast";

// 节点类型配置
const NODE_TYPES = [
  {
    category: "触发器",
    nodes: [
      { type: "trigger-manual", name: "手动触发", icon: Play, color: "bg-green-500" },
      { type: "trigger-schedule", name: "定时触发", icon: Timer, color: "bg-blue-500" },
      { type: "trigger-webhook", name: "Webhook", icon: Globe, color: "bg-purple-500" },
    ],
  },
  {
    category: "AI 节点",
    nodes: [
      { type: "llm", name: "大语言模型", icon: Brain, color: "bg-indigo-500" },
      { type: "chat", name: "对话节点", icon: ChatCircle, color: "bg-cyan-500" },
      { type: "embedding", name: "向量嵌入", icon: Database, color: "bg-teal-500" },
    ],
  },
  {
    category: "逻辑节点",
    nodes: [
      { type: "condition", name: "条件判断", icon: GitBranch, color: "bg-yellow-500" },
      { type: "loop", name: "循环", icon: ArrowsClockwise, color: "bg-orange-500" },
      { type: "filter", name: "过滤器", icon: Funnel, color: "bg-pink-500" },
    ],
  },
  {
    category: "工具节点",
    nodes: [
      { type: "code", name: "代码执行", icon: Code, color: "bg-gray-500" },
      { type: "http", name: "HTTP 请求", icon: Lightning, color: "bg-red-500" },
      { type: "transform", name: "数据转换", icon: MagicWand, color: "bg-violet-500" },
    ],
  },
];

// 初始工作流
const INITIAL_WORKFLOW = {
  id: "workflow-1",
  name: "新建工作流",
  nodes: [
    {
      id: "node-1",
      type: "trigger-manual",
      name: "手动触发",
      x: 100,
      y: 100,
      config: {},
    },
  ],
  edges: [],
};

export default function WorkflowDesigner() {
  const canvasRef = useRef(null);
  const [workflow, setWorkflow] = useState(INITIAL_WORKFLOW);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(
    NODE_TYPES.map((c) => c.category)
  );

  // 拖拽状态
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 添加节点
  const addNode = useCallback((nodeType, x = 300, y = 200) => {
    const nodeConfig = NODE_TYPES.flatMap((c) => c.nodes).find(
      (n) => n.type === nodeType
    );
    if (!nodeConfig) return;

    const newNode = {
      id: `node-${Date.now()}`,
      type: nodeType,
      name: nodeConfig.name,
      x,
      y,
      config: {},
    };

    setWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));

    setSelectedNode(newNode.id);
    showToast(`已添加节点: ${nodeConfig.name}`, "success");
  }, []);

  // 删除节点
  const deleteNode = useCallback((nodeId) => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNode(null);
    showToast("节点已删除", "success");
  }, []);

  // 复制节点
  const duplicateNode = useCallback((nodeId) => {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const newNode = {
      ...node,
      id: `node-${Date.now()}`,
      x: node.x + 50,
      y: node.y + 50,
    };

    setWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));

    setSelectedNode(newNode.id);
    showToast("节点已复制", "success");
  }, [workflow.nodes]);

  // 运行工作流
  const runWorkflow = async () => {
    if (workflow.nodes.length === 0) {
      showToast("请先添加节点", "warning");
      return;
    }

    setIsRunning(true);
    showToast("工作流开始执行...", "info");

    // 模拟执行
    await new Promise((r) => setTimeout(r, 2000));

    setIsRunning(false);
    showToast("工作流执行完成", "success");
  };

  // 保存工作流
  const saveWorkflow = () => {
    localStorage.setItem("workflow_draft", JSON.stringify(workflow));
    showToast("工作流已保存", "success");
  };

  // 加载工作流
  useEffect(() => {
    const saved = localStorage.getItem("workflow_draft");
    if (saved) {
      try {
        setWorkflow(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load workflow:", e);
      }
    }
  }, []);

  // 处理节点拖拽
  const handleNodeDragStart = (e, nodeId) => {
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggedNode(nodeId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!draggedNode || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === draggedNode ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n
      ),
    }));
  };

  const handleCanvasMouseUp = () => {
    setDraggedNode(null);
  };

  // 从节点面板拖拽添加
  const handlePanelDragStart = (e, nodeType) => {
    e.dataTransfer.setData("nodeType", nodeType);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData("nodeType");
    if (!nodeType || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 75;
    const y = e.clientY - rect.top - 30;

    addNode(nodeType, x, y);
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
  };

  // 切换分类展开
  const toggleCategory = (category) => {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  // 获取节点配置
  const getNodeConfig = (type) => {
    return NODE_TYPES.flatMap((c) => c.nodes).find((n) => n.type === type);
  };

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
          {showNodePanel && (
            <div className="w-64 bg-theme-bg-secondary border-r border-theme-sidebar-border overflow-y-auto">
              <div className="p-4">
                <h3 className="text-theme-text-primary font-medium mb-4">
                  节点库
                </h3>
                <div className="space-y-2">
                  {NODE_TYPES.map((category) => (
                    <div key={category.category}>
                      <button
                        onClick={() => toggleCategory(category.category)}
                        className="flex items-center justify-between w-full px-2 py-1.5 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors"
                      >
                        <span>{category.category}</span>
                        {expandedCategories.includes(category.category) ? (
                          <CaretDown className="w-4 h-4" />
                        ) : (
                          <CaretRight className="w-4 h-4" />
                        )}
                      </button>
                      {expandedCategories.includes(category.category) && (
                        <div className="space-y-1 mt-1">
                          {category.nodes.map((node) => {
                            const Icon = node.icon;
                            return (
                              <div
                                key={node.type}
                                draggable
                                onDragStart={(e) =>
                                  handlePanelDragStart(e, node.type)
                                }
                                className="flex items-center gap-2 px-3 py-2 bg-theme-bg-primary rounded-lg cursor-grab hover:bg-theme-action-menu-item-hover transition-colors group"
                              >
                                <div
                                  className={`w-6 h-6 rounded flex items-center justify-center ${node.color}`}
                                >
                                  <Icon className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-sm text-theme-text-primary">
                                  {node.name}
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
            </div>
          )}

          {/* 画布 */}
          <div
            ref={canvasRef}
            className="flex-1 bg-theme-bg-primary overflow-auto relative"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--theme-sidebar-border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDrop={handleCanvasDrop}
            onDragOver={handleCanvasDragOver}
          >
            {/* 节点 */}
            {workflow.nodes.map((node) => {
              const config = getNodeConfig(node.type);
              if (!config) return null;
              const Icon = config.icon;
              const isSelected = selectedNode === node.id;

              return (
                <div
                  key={node.id}
                  className={`absolute w-[180px] bg-theme-bg-secondary border-2 rounded-xl shadow-lg cursor-move transition-shadow ${
                    isSelected
                      ? "border-blue-500 shadow-blue-500/20"
                      : "border-theme-sidebar-border hover:border-theme-text-secondary"
                  }`}
                  style={{ left: node.x, top: node.y }}
                  onMouseDown={(e) => {
                    setSelectedNode(node.id);
                    handleNodeDragStart(e, node.id);
                  }}
                >
                  {/* 节点头部 */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-xl ${config.color}`}
                  >
                    <Icon className="w-4 h-4 text-white" />
                    <span className="text-white text-sm font-medium truncate">
                      {node.name}
                    </span>
                  </div>

                  {/* 节点内容 */}
                  <div className="p-3">
                    <p className="text-xs text-theme-text-secondary">
                      点击配置节点参数
                    </p>
                  </div>

                  {/* 连接点 */}
                  <div className="absolute -left-2 top-1/2 w-4 h-4 bg-theme-bg-secondary border-2 border-theme-sidebar-border rounded-full transform -translate-y-1/2" />
                  <div className="absolute -right-2 top-1/2 w-4 h-4 bg-theme-bg-secondary border-2 border-theme-sidebar-border rounded-full transform -translate-y-1/2" />

                  {/* 节点操作 */}
                  {isSelected && (
                    <div className="absolute -top-10 left-0 flex items-center gap-1 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg p-1">
                      <button
                        onClick={() => duplicateNode(node.id)}
                        className="p-1 hover:bg-theme-action-menu-item-hover rounded"
                        title="复制"
                      >
                        <Copy className="w-4 h-4 text-theme-text-secondary" />
                      </button>
                      <button
                        onClick={() => deleteNode(node.id)}
                        className="p-1 hover:bg-red-500/20 rounded"
                        title="删除"
                      >
                        <Trash className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 空状态提示 */}
            {workflow.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <GitBranch className="w-16 h-16 text-theme-text-secondary/30 mx-auto mb-4" />
                  <p className="text-theme-text-secondary">
                    从左侧拖拽节点到画布开始设计工作流
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
                  <h3 className="text-theme-text-primary font-medium">
                    节点配置
                  </h3>
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
                  const Icon = config.icon;

                  return (
                    <div className="space-y-4">
                      {/* 节点信息 */}
                      <div className="flex items-center gap-3 p-3 bg-theme-bg-primary rounded-lg">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={node.name}
                            onChange={(e) =>
                              setWorkflow((prev) => ({
                                ...prev,
                                nodes: prev.nodes.map((n) =>
                                  n.id === node.id
                                    ? { ...n, name: e.target.value }
                                    : n
                                ),
                              }))
                            }
                            className="bg-transparent text-theme-text-primary font-medium focus:outline-none"
                          />
                          <p className="text-xs text-theme-text-secondary">
                            {node.type}
                          </p>
                        </div>
                      </div>

                      {/* 配置项 */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-theme-text-secondary mb-1">
                            描述
                          </label>
                          <textarea
                            placeholder="添加节点描述..."
                            className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500 resize-none"
                            rows={3}
                          />
                        </div>

                        {node.type.startsWith("trigger") && (
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <p className="text-sm text-green-400">
                              这是工作流的起始节点
                            </p>
                          </div>
                        )}

                        {node.type === "llm" && (
                          <>
                            <div>
                              <label className="block text-sm text-theme-text-secondary mb-1">
                                模型
                              </label>
                              <select className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500">
                                <option>GPT-4</option>
                                <option>GPT-3.5-Turbo</option>
                                <option>Claude-3</option>
                                <option>Qwen-Max</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-theme-text-secondary mb-1">
                                提示词
                              </label>
                              <textarea
                                placeholder="输入提示词..."
                                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500 resize-none"
                                rows={4}
                              />
                            </div>
                          </>
                        )}

                        {node.type === "condition" && (
                          <div>
                            <label className="block text-sm text-theme-text-secondary mb-1">
                              条件表达式
                            </label>
                            <input
                              type="text"
                              placeholder="例如: {{input}} > 10"
                              className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        )}

                        {node.type === "http" && (
                          <>
                            <div>
                              <label className="block text-sm text-theme-text-secondary mb-1">
                                请求方法
                              </label>
                              <select className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500">
                                <option>GET</option>
                                <option>POST</option>
                                <option>PUT</option>
                                <option>DELETE</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-theme-text-secondary mb-1">
                                URL
                              </label>
                              <input
                                type="text"
                                placeholder="https://api.example.com/..."
                                className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary text-sm focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </>
                        )}
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
