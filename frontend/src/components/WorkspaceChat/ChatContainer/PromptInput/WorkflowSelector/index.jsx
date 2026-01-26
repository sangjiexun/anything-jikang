import React, { useState, useEffect, useRef } from "react";
import { GitBranch, CaretDown, Play, X, Check } from "@phosphor-icons/react";
import Workflow from "@/models/workflow";
import showToast from "@/utils/toast";
import { useTranslation } from "react-i18next";

export default function WorkflowSelector({ onSelect, onRun }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const dropdownRef = useRef(null);

  // 加载工作流列表
  useEffect(() => {
    const loadWorkflows = async () => {
      setLoading(true);
      try {
        const result = await Workflow.list();
        if (result.success) {
          setWorkflows(result.flows || []);
        }
      } catch (error) {
        console.error("Failed to load workflows:", error);
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

    try {
      showToast(`正在运行工作流: ${selectedWorkflow.name}`, "info");
      const result = await Workflow.run(selectedWorkflow.uuid);
      
      if (result.success) {
        showToast("工作流执行成功", "success");
        if (onRun) {
          onRun(result);
        }
      } else {
        showToast("工作流执行失败: " + (result.error || "未知错误"), "error");
      }
    } catch (error) {
      showToast("执行错误: " + error.message, "error");
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
            className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-md text-sm hover:bg-green-500/30 transition-colors"
            data-tooltip-id="run-workflow"
            data-tooltip-content="运行工作流"
          >
            <Play className="w-4 h-4" weight="fill" />
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
                      {workflow.config?.blocks?.length || 0} 个节点
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
