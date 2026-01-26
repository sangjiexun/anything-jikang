import React, { useState, useEffect, useRef } from "react";
import {
  Gear,
  ChartLine,
  DotsThree,
  FilePdf,
  Star,
  BookOpen,
  ArrowCounterClockwise,
  Plus,
  Copy,
  X,
  Lightbulb,
  SpinnerGap,
  Check,
  PencilSimple,
  Trash,
  MagicWand,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import showToast from "@/utils/toast";

// 写作配置的默认值
const DEFAULT_CONFIG = {
  articleTitle: "",
  articleTheme: "",
  articleScenario: "通用场景",
  useEmbedding: true,
  useReranker: true,
  chunkSize: 500,
};

// 写作场景选项
const SCENARIO_OPTIONS = [
  { id: "general", name: "通用场景", icon: "📝" },
  { id: "marketing", name: "营销推广", icon: "📢" },
  { id: "tech", name: "技术文档", icon: "💻" },
  { id: "news", name: "新闻资讯", icon: "📰" },
  { id: "story", name: "故事创作", icon: "📖" },
  { id: "academic", name: "学术论文", icon: "🎓" },
];

export default function WritingWorkspace({ initialContent = "", onClose }) {
  const { t } = useTranslation();
  const editorRef = useRef(null);
  
  // 状态管理
  const [config, setConfig] = useState(() => {
    // 从 localStorage 读取保存的配置
    const saved = localStorage.getItem("writing_workspace_config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });
  
  const [content, setContent] = useState(() => {
    // 优先使用传入的内容，其次从 localStorage 读取
    const savedContent = localStorage.getItem("writing_workspace_content");
    return initialContent || savedContent || "";
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [wordCount, setWordCount] = useState(0);

  // 保存配置到 localStorage
  useEffect(() => {
    localStorage.setItem("writing_workspace_config", JSON.stringify(config));
  }, [config]);

  // 保存内容到 localStorage（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("writing_workspace_content", content);
      // 计算字数
      setWordCount(content.replace(/<[^>]*>/g, "").length);
    }, 1000);
    return () => clearTimeout(timer);
  }, [content]);

  // 生成文章
  const handleGenerate = async () => {
    if (!config.articleTitle && !config.articleTheme) {
      showToast("请先输入文章标题或主题", "warning");
      setShowConfigPanel(true);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // 模拟生成过程
      const steps = [
        { progress: 20, delay: 800 },
        { progress: 40, delay: 1000 },
        { progress: 60, delay: 1200 },
        { progress: 80, delay: 1000 },
        { progress: 100, delay: 800 },
      ];

      for (const step of steps) {
        await new Promise((resolve) => setTimeout(resolve, step.delay));
        setGenerationProgress(step.progress);
      }

      // 模拟生成的内容
      const generatedContent = `
<h1>${config.articleTitle || "智能生成的文章"}</h1>

<h2>引言</h2>
<p>在当今数字化时代，${config.articleTheme || "人工智能"}正在深刻改变着我们的生活和工作方式。本文将深入探讨这一主题，为您带来全面的分析和见解。</p>

<h2>核心观点</h2>
<p>随着技术的不断发展，我们看到了前所未有的变革机遇。以下是几个关键点：</p>
<ul>
  <li>技术创新正在加速推进</li>
  <li>应用场景不断拓展</li>
  <li>用户体验持续优化</li>
</ul>

<h2>深入分析</h2>
<p>从多个维度来看，这一领域的发展态势令人振奋。数据显示，相关技术的应用已经覆盖了众多行业，包括但不限于金融、医疗、教育和制造业。</p>

<h2>总结与展望</h2>
<p>综上所述，${config.articleTheme || "这一领域"}的未来充满希望。我们期待看到更多创新成果的涌现，为社会发展贡献力量。</p>
      `.trim();

      setContent(generatedContent);
      showToast("文章生成完成", "success");
    } catch (error) {
      showToast("生成失败，请重试", "error");
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  // 复制全文
  const handleCopyAll = async () => {
    if (!content) {
      showToast("暂无内容可复制", "warning");
      return;
    }

    try {
      // 尝试复制 HTML 和纯文本
      const plainText = content.replace(/<[^>]*>/g, "");
      await navigator.clipboard.writeText(plainText);
      showToast("已复制到剪贴板", "success");
    } catch (error) {
      showToast("复制失败", "error");
    }
  };

  // 全文优化
  const handleOptimize = async () => {
    if (!content) {
      showToast("请先生成或输入内容", "warning");
      return;
    }

    setIsGenerating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      showToast("优化完成", "success");
    } finally {
      setIsGenerating(false);
    }
  };

  // 导出 PDF
  const handleExportPDF = () => {
    showToast("PDF 导出功能开发中", "info");
  };

  // 清空内容
  const handleClear = () => {
    if (window.confirm("确定要清空所有内容吗？")) {
      setContent("");
      localStorage.removeItem("writing_workspace_content");
      showToast("内容已清空", "success");
    }
  };

  return (
    <div className="flex flex-col h-full bg-theme-bg-primary">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border bg-theme-bg-secondary/50">
        <div className="flex items-center gap-2">
          <MagicWand className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-theme-text-primary">
            智能图文工作台
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* 配置按钮 */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
              showConfigPanel
                ? "bg-purple-500 text-white"
                : "bg-theme-bg-primary text-theme-text-secondary hover:bg-theme-action-menu-item-hover"
            }`}
          >
            <Gear className="w-4 h-4" />
            配置
          </button>

          {/* 更多操作 */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-1.5 rounded-lg text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
            >
              <DotsThree className="w-5 h-5" weight="bold" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    handleExportPDF();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-colors"
                >
                  <FilePdf className="w-4 h-4" />
                  导出 PDF
                </button>
                <button
                  onClick={() => {
                    handleOptimize();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-colors"
                >
                  <Star className="w-4 h-4" />
                  全文优化
                </button>
                <button
                  onClick={() => {
                    showToast("知识库插入功能开发中", "info");
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  插入知识库
                </button>
                <button
                  onClick={() => {
                    handleClear();
                    setShowMoreMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash className="w-4 h-4" />
                  清空内容
                </button>
              </div>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 配置面板 */}
      {showConfigPanel && (
        <div className="p-4 border-b border-theme-sidebar-border bg-theme-bg-secondary/30 space-y-4">
          {/* 文章标题 */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-1.5">
              文章标题
            </label>
            <input
              type="text"
              value={config.articleTitle}
              onChange={(e) =>
                setConfig({ ...config, articleTitle: e.target.value })
              }
              placeholder="请输入文章标题"
              className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* 文章主题 */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-1.5">
              文章主题/关键词
            </label>
            <input
              type="text"
              value={config.articleTheme}
              onChange={(e) =>
                setConfig({ ...config, articleTheme: e.target.value })
              }
              placeholder="请输入文章主题或关键词"
              className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* 写作场景 */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-1.5">
              写作场景
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SCENARIO_OPTIONS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() =>
                    setConfig({ ...config, articleScenario: scenario.name })
                  }
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all ${
                    config.articleScenario === scenario.name
                      ? "bg-purple-500/20 border-purple-500 text-purple-400 border"
                      : "bg-theme-bg-primary border border-theme-sidebar-border text-theme-text-secondary hover:border-purple-500/50"
                  }`}
                >
                  <span>{scenario.icon}</span>
                  <span>{scenario.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 高级选项 */}
          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm text-theme-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={config.useEmbedding}
                onChange={(e) =>
                  setConfig({ ...config, useEmbedding: e.target.checked })
                }
                className="w-4 h-4 rounded border-theme-sidebar-border"
              />
              使用向量检索
            </label>
            <label className="flex items-center gap-2 text-sm text-theme-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={config.useReranker}
                onChange={(e) =>
                  setConfig({ ...config, useReranker: e.target.checked })
                }
                className="w-4 h-4 rounded border-theme-sidebar-border"
              />
              使用重排序
            </label>
          </div>
        </div>
      )}

      {/* 主编辑区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 编辑器工具栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-sidebar-border bg-theme-bg-secondary/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => document.execCommand("bold")}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="加粗"
            >
              <span className="font-bold text-sm">B</span>
            </button>
            <button
              onClick={() => document.execCommand("italic")}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="斜体"
            >
              <span className="italic text-sm">I</span>
            </button>
            <button
              onClick={() => document.execCommand("underline")}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="下划线"
            >
              <span className="underline text-sm">U</span>
            </button>
            <div className="w-px h-4 bg-theme-sidebar-border mx-1" />
            <button
              onClick={() => document.execCommand("insertUnorderedList")}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="无序列表"
            >
              <span className="text-sm">• —</span>
            </button>
            <button
              onClick={() => document.execCommand("insertOrderedList")}
              className="p-1.5 rounded text-theme-text-secondary hover:bg-theme-action-menu-item-hover transition-colors"
              title="有序列表"
            >
              <span className="text-sm">1. —</span>
            </button>
          </div>
          <div className="text-xs text-theme-text-secondary">
            {wordCount} 字
          </div>
        </div>

        {/* 编辑器内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {content ? (
            <div
              ref={editorRef}
              contentEditable
              dangerouslySetInnerHTML={{ __html: content }}
              onInput={(e) => setContent(e.currentTarget.innerHTML)}
              className="min-h-full prose prose-invert max-w-none focus:outline-none text-theme-text-primary"
              style={{ lineHeight: "1.8" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Lightbulb className="w-16 h-16 text-theme-text-secondary/30 mb-4" />
              <p className="text-theme-text-secondary mb-2">
                还没有内容，开始创作吧！
              </p>
              <p className="text-sm text-theme-text-secondary/60 mb-6">
                点击下方按钮配置写作参数并生成文章
              </p>
              <button
                onClick={() => setShowConfigPanel(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                开始写作
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex items-center justify-between p-4 border-t border-theme-sidebar-border bg-theme-bg-secondary/50">
        <div className="flex items-center gap-2">
          {content && (
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
            >
              <Copy className="w-4 h-4" />
              复制全文
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {content && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-bg-primary border border-theme-sidebar-border text-theme-text-secondary rounded-lg text-sm hover:bg-theme-action-menu-item-hover transition-colors disabled:opacity-50"
            >
              <ArrowCounterClockwise className="w-4 h-4" />
              重新生成
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <SpinnerGap className="w-4 h-4 animate-spin" />
                生成中 {generationProgress}%
              </>
            ) : (
              <>
                <MagicWand className="w-4 h-4" />
                {content ? "重新生成" : "生成文章"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 点击外部关闭菜单 */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMoreMenu(false)}
        />
      )}
    </div>
  );
}
