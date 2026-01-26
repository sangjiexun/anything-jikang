import React, { useState, useEffect } from "react";
import {
  BookOpen,
  GitBranch,
  Images,
  VideoCamera,
  TrendUp,
  FilmStrip,
  Image,
  X,
  CaretLeft,
  CaretRight,
  MagicWand,
  Robot,
  Microphone,
  FilmSlate,
  UserCircle,
  Calendar,
  Brain,
  Plus,
  SidebarSimple,
} from "@phosphor-icons/react";
import ManageWorkspace, {
  useManageWorkspaceModal,
} from "@/components/Modals/ManageWorkspace";
import WritingWorkspace from "./panels/WritingWorkspace";

// AI工具链配置
const AI_TOOLS = [
  {
    id: "image-text-studio",
    name: "智能图文工作台",
    icon: MagicWand,
    color: "text-purple-400",
    status: "active",
  },
  {
    id: "video-studio",
    name: "智能视频工作台",
    icon: FilmStrip,
    color: "text-blue-400",
    status: "active",
  },
  {
    id: "knowledge-base",
    name: "知识库管理",
    icon: BookOpen,
    color: "text-theme-text-secondary",
    status: "active",
  },
  {
    id: "marketing-calendar",
    name: "营销日历",
    icon: Calendar,
    color: "text-theme-text-secondary",
    status: "developing",
  },
  {
    id: "train-agent",
    name: "训练智能体",
    icon: Brain,
    color: "text-theme-text-secondary",
    status: "developing",
  },
  {
    id: "workflow",
    name: "工作流",
    icon: GitBranch,
    color: "text-theme-text-secondary",
    status: "active",
  },
];

// 智能体生态配置
const AGENT_ECOSYSTEM = [
  {
    id: "short-video-agent",
    name: "短视频智能体",
    icon: VideoCamera,
    color: "text-orange-400",
  },
  {
    id: "digital-human-agent",
    name: "数字人智能体",
    icon: UserCircle,
    color: "text-cyan-400",
  },
  {
    id: "podcast-agent",
    name: "播客智能体",
    icon: Microphone,
    color: "text-blue-400",
  },
  {
    id: "short-drama-agent",
    name: "短剧智能体",
    icon: FilmSlate,
    color: "text-orange-400",
  },
];

// 侧边图标列表
const SIDEBAR_ICONS = [
  { id: "knowledge-base", icon: BookOpen },
  { id: "workflow", icon: GitBranch },
  { id: "image-text-studio", icon: Images },
  { id: "video-studio", icon: VideoCamera },
  { id: "trending", icon: TrendUp },
  { id: "video-generator", icon: FilmStrip },
  { id: "image-generator", icon: Image },
];

export default function RightToolbar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [writingContent, setWritingContent] = useState("");
  const {
    showing: showingManageWorkspace,
    showModal: showManageWorkspace,
    hideModal: hideManageWorkspace,
  } = useManageWorkspaceModal();

  // 监听打开智能图文工作台事件
  useEffect(() => {
    const handleOpenWritingWorkspace = (e) => {
      const { content } = e.detail || {};
      if (content) {
        setWritingContent(content);
      }
      setSelectedTool("image-text-studio");
      setIsExpanded(true);
    };

    window.addEventListener("open-writing-workspace", handleOpenWritingWorkspace);
    return () => {
      window.removeEventListener("open-writing-workspace", handleOpenWritingWorkspace);
    };
  }, []);

  const handleToolClick = (toolId) => {
    setSelectedTool(toolId);
    // 知识库管理 - 打开文档管理窗口
    if (toolId === "knowledge-base") {
      showManageWorkspace();
    }
    // 智能图文工作台 - 需要更宽的面板
    if (toolId === "image-text-studio") {
      setIsExpanded(true);
    }
  };

  // 判断是否显示全屏工作台面板
  const showFullPanel = selectedTool === "image-text-studio";

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex h-full">
      {/* 展开的面板 - 使用 width 过渡动画 */}
      <div
        style={{
          width: isExpanded ? (showFullPanel ? "480px" : "320px") : "0px",
        }}
        className="transition-all duration-500 overflow-hidden"
      >
        <div
          style={{ width: showFullPanel ? "480px" : "320px" }}
          className="h-[calc(100%-32px)] my-[16px] bg-theme-bg-sidebar border-[2px] border-theme-sidebar-border light:border-none rounded-[16px] overflow-hidden flex flex-col"
        >
          {/* 智能图文工作台 - 全功能面板 */}
          {showFullPanel ? (
            <WritingWorkspace
              initialContent={writingContent}
              onClose={() => {
                setSelectedTool(null);
                setWritingContent("");
              }}
            />
          ) : (
            <>
              {/* 头部 */}
              <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border">
                <h2
                  className={`text-theme-text-primary font-bold text-lg transition-opacity duration-500 ${
                    isExpanded ? "opacity-100" : "opacity-0"
                  }`}
                >
                  AI工具链
                </h2>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-lg hover:bg-theme-action-menu-item-hover transition-colors"
                  title="收起面板"
                >
                  <SidebarSimple className="w-5 h-5 text-theme-text-secondary" />
                </button>
              </div>

              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto no-scroll p-4">
                {/* AI工具链分类 */}
                <div className="mb-6">
                  <h3 className="text-theme-text-secondary text-xs font-medium mb-3">
                    AI工具链
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {AI_TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.id}
                          onClick={() => handleToolClick(tool.id)}
                          className={`flex flex-col items-start p-4 rounded-xl border transition-all duration-300 ${
                            selectedTool === tool.id
                              ? "bg-theme-button-primary/10 border-theme-button-primary"
                              : "bg-theme-bg-primary/50 border-theme-sidebar-border hover:border-theme-button-primary/50 hover:bg-theme-action-menu-item-hover"
                          }`}
                        >
                          <Icon className={`w-6 h-6 mb-2 ${tool.color}`} />
                          <span className="text-theme-text-primary text-sm font-medium">
                            {tool.name}
                          </span>
                          {tool.status === "developing" && (
                            <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              开发中
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 智能体生态分类 */}
                <div>
                  <h3 className="text-theme-text-secondary text-xs font-medium mb-3">
                    智能体生态
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {AGENT_ECOSYSTEM.map((agent) => {
                      const Icon = agent.icon;
                      return (
                        <button
                          key={agent.id}
                          onClick={() => handleToolClick(agent.id)}
                          className={`flex flex-col items-start p-4 rounded-xl border transition-all duration-300 ${
                            selectedTool === agent.id
                              ? "bg-theme-button-primary/10 border-theme-button-primary"
                              : "bg-theme-bg-primary/50 border-theme-sidebar-border hover:border-theme-button-primary/50 hover:bg-theme-action-menu-item-hover"
                          }`}
                        >
                          <Icon className={`w-6 h-6 mb-2 ${agent.color}`} />
                          <span className="text-theme-text-primary text-sm font-medium">
                            {agent.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 底部按钮 */}
              <div className="p-4 border-t border-theme-sidebar-border">
                <button className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-theme-bg-primary rounded-full border border-theme-sidebar-border hover:bg-theme-action-menu-item-hover transition-all duration-300">
                  <Plus className="w-4 h-4 text-theme-text-primary" />
                  <span className="text-theme-text-primary text-sm">
                    申请智能体
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 收起状态的工具栏图标 */}
      <div className="h-[calc(100%-32px)] my-[16px] w-[60px] transition-all duration-500">
        <div className="h-full bg-theme-bg-sidebar border-[2px] border-theme-sidebar-border light:border-none rounded-[16px] p-2 flex flex-col items-center gap-2">
          {/* 展开按钮 */}
          <button
            onClick={toggleExpand}
            className="p-2 rounded-lg hover:bg-theme-action-menu-item-hover transition-all duration-300 mb-2"
            title={isExpanded ? "收起工具栏" : "展开工具栏"}
          >
            <CaretLeft
              className={`w-4 h-4 text-theme-text-secondary transition-transform duration-500 ${
                isExpanded ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>

          {/* 工具图标 */}
          {SIDEBAR_ICONS.map((item, index) => {
            const Icon = item.icon;
            const isActive = selectedTool === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  handleToolClick(item.id);
                  if (!isExpanded) setIsExpanded(true);
                }}
                className={`p-3 rounded-xl transition-all duration-300 group relative ${
                  isActive
                    ? "bg-theme-button-primary text-white"
                    : "hover:bg-theme-action-menu-item-hover text-theme-text-secondary hover:text-theme-text-primary"
                }`}
                style={{
                  transitionDelay: `${index * 30}ms`,
                }}
              >
                <Icon className="w-5 h-5" weight={isActive ? "fill" : "regular"} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 知识库管理模态框 */}
      {showingManageWorkspace && (
        <ManageWorkspace hideModal={hideManageWorkspace} />
      )}
    </div>
  );
}
