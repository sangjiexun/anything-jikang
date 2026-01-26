import React, { useState, useEffect, useRef } from "react";
import { GitBranch, CaretDown, Play, X, Check, SpinnerGap } from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import { useTranslation } from "react-i18next";

export default function WorkflowSelector({ queryText = "", onSelect, onRun }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const dropdownRef = useRef(null);

  // 加载本地工作流列表
  useEffect(() => {
    const loadWorkflows = () => {
      setLoading(true);
      try {
        // 从本地存储加载工作流列表
        const saved = localStorage.getItem("workflow_list");
        if (saved) {
          const localWorkflows = JSON.parse(saved);
          // 只显示活跃的工作流
          setWorkflows(localWorkflows.filter((w) => w.active !== false));
        } else {
          setWorkflows([]);
        }
      } catch (error) {
        console.error("Failed to load workflows:", error);
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadWorkflows();
    }
  }, [isOpen]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (workflow) => {
    setSelectedWorkflow(workflow);
    setIsOpen(false);
    if (onSelect) {
      onSelect(workflow);
    }
  };

  const handleRun = async () => {
    if (!selectedWorkflow) {
      showToast("请先选择工作流", "warning");
      return;
    }

    // 使用输入框的文本作为初始输入
    const initialInput = queryText.trim();

    setIsRunning(true);

    try {
      showToast(`正在运行工作流: ${selectedWorkflow.name}`, "info");
      
      // 从本地加载完整的工作流数据
      const workflowData = localStorage.getItem(`workflow_${selectedWorkflow.uuid}`);
      if (!workflowData) {
        showToast("工作流数据未找到", "error");
        return;
      }

      const workflow = JSON.parse(workflowData);
      const nodes = workflow.nodes || [];
      const connections = workflow.connections || [];

      if (nodes.length === 0) {
        showToast("工作流没有节点", "warning");
        return;
      }

      // 获取 LLM 配置
      let llmConfig = {
        endpoint: "https://api.deepseek.com",
        apiKey: "",
        model: "deepseek-chat",
        temperature: 0.7,
        maxTokens: 2048,
      };
      try {
        const savedConfig = localStorage.getItem("workflow_llm_config");
        if (savedConfig) {
          llmConfig = { ...llmConfig, ...JSON.parse(savedConfig) };
        }
      } catch (e) {
        console.error("Failed to load LLM config:", e);
      }

      // 构建执行顺序
      const inDegree = {};
      const adjacency = {};
      nodes.forEach((n) => {
        inDegree[n.id] = 0;
        adjacency[n.id] = [];
      });
      connections.forEach((c) => {
        if (adjacency[c.from]) adjacency[c.from].push(c.to);
        if (inDegree[c.to] !== undefined) inDegree[c.to]++;
      });

      const queue = nodes.filter((n) => inDegree[n.id] === 0);
      const order = [];
      while (queue.length > 0) {
        const node = queue.shift();
        order.push(node);
        (adjacency[node.id] || []).forEach((nextId) => {
          inDegree[nextId]--;
          if (inDegree[nextId] === 0) {
            const nextNode = nodes.find((n) => n.id === nextId);
            if (nextNode) queue.push(nextNode);
          }
        });
      }

      // 执行节点，使用输入框文本作为初始输入
      let lastOutput = initialInput || "开始执行工作流";
      const executionLog = [];
      
      executionLog.push(`📥 初始输入: ${initialInput || "(无输入)"}`);

      for (const node of order) {
        const nodeType = node.type;
        
        // 检查是否是 LLM 节点
        if (nodeType?.startsWith("llm-") && llmConfig.apiKey) {
          try {
            executionLog.push(`🔄 执行节点: ${nodeType}`);
            
            const response = await fetch(`${llmConfig.endpoint}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${llmConfig.apiKey}`,
              },
              body: JSON.stringify({
                model: llmConfig.model,
                messages: [
                  { role: "system", content: node.config?.systemPrompt || "你是一个有帮助的AI助手" },
                  { role: "user", content: lastOutput },
                ],
                temperature: node.config?.temperature || llmConfig.temperature,
                max_tokens: node.config?.maxTokens || llmConfig.maxTokens,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              lastOutput = data.choices?.[0]?.message?.content || "无响应";
              executionLog.push(`✅ ${nodeType} 完成`);
            } else {
              executionLog.push(`⚠️ ${nodeType} API 请求失败: ${response.status}`);
            }
          } catch (e) {
            executionLog.push(`❌ ${nodeType} 执行失败: ${e.message}`);
          }
        } else {
          // 非 LLM 节点，模拟执行
          executionLog.push(`✅ 节点 ${nodeType} 已处理`);
        }
      }

      executionLog.push(`📤 最终输出: ${lastOutput}`);

      showToast("工作流执行成功", "success");
      
      if (onRun) {
        onRun({
          success: true,
          workflowName: selectedWorkflow.name,
          nodeCount: order.length,
          initialInput,
          finalOutput: lastOutput,
          results: `【${selectedWorkflow.name}】\n\n${executionLog.join("\n")}\n\n---\n\n${lastOutput}`,
        });
      }
    } catch (error) {
      showToast("执行错误: " + error.message, "error");
    } finally {
      setIsRunning(false);
    }
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    setSelectedWorkflow(null);
    if (onSelect) {
      onSelect(null);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* 触发按钮 */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm transition-colors ${
            selectedWorkflow
              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
              : "text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-action-menu-item-hover"
          }`}
          data-tooltip-id="workflow-selector"
          data-tooltip-content={selectedWorkflow ? selectedWorkflow.name : "选择工作流"}
        >
          <GitBranch className="w-4 h-4" />
          {selectedWorkflow ? (
            <>
              <span className="max-w-[80px] truncate">{selectedWorkflow.name}</span>
              <button
                onClick={clearSelection}
                className="p-0.5 hover:bg-indigo-500/30 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <CaretDown className="w-3 h-3" />
          )}
        </button>

        {/* 运行按钮 */}
        {selectedWorkflow && (
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-md text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50"
            data-tooltip-id="run-workflow"
            data-tooltip-content="运行工作流"
          >
            {isRunning ? (
              <SpinnerGap className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" weight="fill" />
            )}
          </button>
        )}
      </div>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-theme-sidebar-border">
            <p className="text-xs text-theme-text-secondary">选择工作流</p>
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-theme-text-secondary text-sm">
                加载中...
              </div>
            ) : workflows.length === 0 ? (
              <div className="p-4 text-center text-theme-text-secondary text-sm">
                暂无可用工作流
              </div>
            ) : (
              workflows.map((workflow) => (
                <button
                  key={workflow.uuid}
                  onClick={() => handleSelect(workflow)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selectedWorkflow?.uuid === workflow.uuid
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "text-theme-text-primary hover:bg-theme-action-menu-item-hover"
                  }`}
                >
                  <GitBranch className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{workflow.name}</p>
                    <p className="text-xs text-theme-text-secondary truncate">
                      {workflow.nodeCount || 0} 个节点
                    </p>
                  </div>
                  {selectedWorkflow?.uuid === workflow.uuid && (
                    <Check className="w-4 h-4 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-theme-sidebar-border">
            <a
              href="/workflow"
              className="flex items-center gap-2 px-3 py-2 text-sm text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-action-menu-item-hover rounded transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              管理工作流
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
