import React, { useState } from "react";
import {
  FilmStrip,
  Play,
  Sparkle,
  TextT,
  MusicNote,
  ImageSquare,
  Timer,
} from "@phosphor-icons/react";

const VIDEO_TEMPLATES = [
  { id: "promo", name: "宣传片", duration: "30秒" },
  { id: "tutorial", name: "教程", duration: "3-5分钟" },
  { id: "story", name: "故事", duration: "1-2分钟" },
  { id: "short", name: "短视频", duration: "15秒" },
];

export default function VideoGeneratorPanel() {
  const [prompt, setPrompt] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // TODO: 实现视频生成
    setTimeout(() => {
      setGeneratedVideo({
        thumbnail: null,
        url: "#",
        title: prompt,
      });
      setIsGenerating(false);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区域 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <label className="block text-theme-text-primary font-medium mb-2">
          视频描述
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述您想要生成的视频内容..."
          className="w-full h-24 p-3 bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-placeholder rounded-lg border border-theme-sidebar-border focus:border-theme-button-primary outline-none resize-none"
        />
      </div>

      {/* 模板选择 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <h4 className="text-theme-text-primary font-medium mb-3">选择模板</h4>
        <div className="grid grid-cols-2 gap-2">
          {VIDEO_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`flex flex-col items-start p-3 rounded-xl border transition-all ${
                selectedTemplate === template.id
                  ? "bg-theme-button-primary/10 border-theme-button-primary"
                  : "bg-theme-bg-primary/50 border-theme-sidebar-border hover:border-theme-button-primary/50"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  selectedTemplate === template.id
                    ? "text-theme-button-primary"
                    : "text-theme-text-primary"
                }`}
              >
                {template.name}
              </span>
              <span className="text-xs text-theme-text-secondary flex items-center gap-1 mt-1">
                <Timer className="w-3 h-3" />
                {template.duration}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 高级选项 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <h4 className="text-theme-text-primary font-medium mb-3">高级选项</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border">
            <div className="flex items-center gap-2">
              <TextT className="w-5 h-5 text-theme-button-primary" />
              <span className="text-theme-text-secondary text-sm">字幕</span>
            </div>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
          <div className="flex items-center justify-between p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border">
            <div className="flex items-center gap-2">
              <MusicNote className="w-5 h-5 text-theme-button-primary" />
              <span className="text-theme-text-secondary text-sm">背景音乐</span>
            </div>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
          <div className="flex items-center justify-between p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border">
            <div className="flex items-center gap-2">
              <ImageSquare className="w-5 h-5 text-theme-button-primary" />
              <span className="text-theme-text-secondary text-sm">AI 配图</span>
            </div>
            <input type="checkbox" defaultChecked className="rounded" />
          </div>
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="p-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-theme-button-primary hover:bg-theme-button-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {isGenerating ? (
            <>
              <Sparkle className="w-5 h-5 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <FilmStrip className="w-5 h-5" />
              <span>生成视频</span>
            </>
          )}
        </button>
      </div>

      {/* 生成结果 */}
      {generatedVideo && (
        <div className="p-4 border-t border-theme-sidebar-border">
          <div className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border">
            <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center mb-3">
              <Play className="w-12 h-12 text-white/50" />
            </div>
            <h5 className="text-theme-text-primary font-medium">
              {generatedVideo.title}
            </h5>
            <p className="text-theme-text-secondary text-sm mt-1">
              视频已生成完成
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
