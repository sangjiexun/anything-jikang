import React, { useState } from "react";
import {
  Image,
  TextT,
  MagicWand,
  Upload,
  Sparkle,
} from "@phosphor-icons/react";

export default function AIImageTextPanel() {
  const [inputText, setInputText] = useState("");
  const [generatedContent, setGeneratedContent] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsGenerating(true);
    // TODO: 实现 AI 图文生成
    setTimeout(() => {
      setGeneratedContent({
        text: `基于"${inputText}"生成的智能图文内容...`,
        image: null,
      });
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区域 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <label className="block text-theme-text-primary font-medium mb-2">
          输入主题或描述
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="描述您想要生成的图文内容..."
          className="w-full h-24 p-3 bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-placeholder rounded-lg border border-theme-sidebar-border focus:border-theme-button-primary outline-none resize-none"
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !inputText.trim()}
          className="w-full mt-3 flex items-center justify-center gap-2 py-3 px-4 bg-theme-button-primary hover:bg-theme-button-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isGenerating ? (
            <>
              <Sparkle className="w-5 h-5 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <MagicWand className="w-5 h-5" />
              <span>生成图文</span>
            </>
          )}
        </button>
      </div>

      {/* 功能选项 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <h4 className="text-theme-text-primary font-medium mb-3">快捷功能</h4>
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center gap-2 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors">
            <Image className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">图片配文</span>
          </button>
          <button className="flex items-center gap-2 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors">
            <TextT className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">文字排版</span>
          </button>
          <button className="flex items-center gap-2 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors">
            <Upload className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">上传素材</span>
          </button>
          <button className="flex items-center gap-2 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors">
            <Sparkle className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">智能美化</span>
          </button>
        </div>
      </div>

      {/* 生成结果 */}
      <div className="flex-1 overflow-y-auto p-4">
        {generatedContent ? (
          <div className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border">
            <p className="text-theme-text-primary">{generatedContent.text}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MagicWand className="w-12 h-12 text-theme-text-secondary/50 mb-4" />
            <h3 className="text-theme-text-primary font-medium mb-2">
              AI 智能图文
            </h3>
            <p className="text-theme-text-secondary text-sm">
              输入主题，让 AI 为您生成精美的图文内容
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
