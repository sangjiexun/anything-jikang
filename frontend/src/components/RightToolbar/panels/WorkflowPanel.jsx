import React, { useState } from "react";
import {
  Plus,
  Play,
  Pause,
  Trash,
  PencilSimple,
  GitBranch,
  Lightning,
} from "@phosphor-icons/react";

const SAMPLE_WORKFLOWS = [
  { id: 1, name: "文档处理流程", status: "running", steps: 5 },
  { id: 2, name: "数据分析管道", status: "paused", steps: 8 },
  { id: 3, name: "内容生成工作流", status: "stopped", steps: 3 },
];

export default function WorkflowPanel() {
  const [workflows, setWorkflows] = useState(SAMPLE_WORKFLOWS);

  const getStatusColor = (status) => {
    switch (status) {
      case "running":
        return "text-green-400 bg-green-400/20";
      case "paused":
        return "text-yellow-400 bg-yellow-400/20";
      default:
        return "text-theme-text-secondary bg-theme-bg-primary";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "running":
        return "运行中";
      case "paused":
        return "已暂停";
      default:
        return "已停止";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部操作 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-theme-button-primary hover:bg-theme-button-primary/80 text-white rounded-lg transition-colors">
          <Plus className="w-5 h-5" />
          <span className="font-medium">新建工作流</span>
        </button>
      </div>

      {/* 工作流列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitBranch className="w-12 h-12 text-theme-text-secondary/50 mb-4" />
            <h3 className="text-theme-text-primary font-medium mb-2">
              暂无工作流
            </h3>
            <p className="text-theme-text-secondary text-sm">
              创建您的第一个自动化工作流
            </p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-theme-text-primary font-medium">
                    {workflow.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(
                        workflow.status
                      )}`}
                    >
                      {getStatusText(workflow.status)}
                    </span>
                    <span className="text-theme-text-secondary text-xs">
                      {workflow.steps} 步骤
                    </span>
                  </div>
                </div>
                <Lightning className="w-5 h-5 text-theme-button-primary" weight="fill" />
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg bg-theme-action-menu-bg hover:bg-theme-action-menu-item-hover transition-colors">
                  {workflow.status === "running" ? (
                    <Pause className="w-4 h-4 text-theme-text-secondary" />
                  ) : (
                    <Play className="w-4 h-4 text-theme-text-secondary" />
                  )}
                </button>
                <button className="p-2 rounded-lg bg-theme-action-menu-bg hover:bg-theme-action-menu-item-hover transition-colors">
                  <PencilSimple className="w-4 h-4 text-theme-text-secondary" />
                </button>
                <button className="p-2 rounded-lg bg-theme-action-menu-bg hover:bg-theme-action-menu-item-hover transition-colors">
                  <Trash className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
