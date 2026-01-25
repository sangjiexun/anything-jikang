import React, { useState } from "react";
import {
  Waveform,
  VideoCamera,
  TreeStructure,
  FileText,
  Cards,
  ClipboardText,
  ChartBar,
  Presentation,
  Table,
  MagicWand,
  Plus,
} from "@phosphor-icons/react";

const KNOWLEDGE_TOOLS = [
  { id: "audio-overview", name: "音频概览", icon: Waveform },
  { id: "video-overview", name: "视频概览", icon: VideoCamera },
  { id: "mind-map", name: "思维导图", icon: TreeStructure },
  { id: "report", name: "报告", icon: FileText },
  { id: "flashcard", name: "闪卡", icon: Cards },
  { id: "quiz", name: "测验", icon: ClipboardText },
  { id: "infographic", name: "信息图", icon: ChartBar },
  { id: "presentation", name: "演示文稿", icon: Presentation },
  { id: "data-table", name: "数据表格", icon: Table },
];

export default function KnowledgePanel() {
  const [notes, setNotes] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);

  const handleToolClick = (toolId) => {
    setSelectedTool(toolId);
    // TODO: 实现工具功能
  };

  return (
    <div className="flex flex-col h-full">
      {/* 工具网格 */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {KNOWLEDGE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                className={`flex flex-col items-start p-3 rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? "bg-theme-button-primary/10 border-theme-button-primary"
                    : "bg-theme-bg-primary/50 border-theme-sidebar-border hover:border-theme-button-primary/50 hover:bg-theme-action-menu-item-hover"
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-2 ${
                    isSelected ? "text-theme-button-primary" : "text-theme-text-secondary"
                  }`}
                  weight={isSelected ? "fill" : "regular"}
                />
                <span
                  className={`text-xs ${
                    isSelected ? "text-theme-button-primary" : "text-theme-text-secondary"
                  }`}
                >
                  {tool.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-theme-sidebar-border" />

      {/* Studio 内容区域 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <MagicWand className="w-10 h-10 text-theme-text-secondary/50 mb-4" />
        <h3 className="text-theme-text-primary font-medium mb-2">
          Studio 输出将保存在此处。
        </h3>
        <p className="text-theme-text-secondary text-sm">
          添加来源后，点击即可添加音频概览、学习指南、思维导图等！
        </p>
      </div>

      {/* 笔记列表 */}
      {notes.length > 0 && (
        <div className="border-t border-theme-sidebar-border p-4">
          <h4 className="text-theme-text-primary font-medium mb-3">我的笔记</h4>
          <div className="space-y-2">
            {notes.map((note, index) => (
              <div
                key={index}
                className="p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border"
              >
                <p className="text-theme-text-primary text-sm">{note.content}</p>
                <span className="text-theme-text-secondary text-xs">{note.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 底部添加笔记按钮 */}
      <div className="p-4 border-t border-theme-sidebar-border">
        <button
          onClick={() => {
            const content = prompt("请输入笔记内容：");
            if (content) {
              setNotes([
                ...notes,
                {
                  content,
                  date: new Date().toLocaleString("zh-CN"),
                },
              ]);
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-theme-bg-primary rounded-full border border-theme-sidebar-border hover:bg-theme-action-menu-item-hover transition-colors"
        >
          <Plus className="w-4 h-4 text-theme-text-primary" />
          <span className="text-theme-text-primary text-sm">添加笔记</span>
        </button>
      </div>
    </div>
  );
}
