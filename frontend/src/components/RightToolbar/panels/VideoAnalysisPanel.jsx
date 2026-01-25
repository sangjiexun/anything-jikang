import React, { useState } from "react";
import {
  VideoCamera,
  Upload,
  Play,
  TextAlignLeft,
  Translate,
  Sparkle,
} from "@phosphor-icons/react";

export default function VideoAnalysisPanel() {
  const [videoUrl, setVideoUrl] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!videoUrl.trim()) return;
    setIsAnalyzing(true);
    // TODO: 实现视频分析
    setTimeout(() => {
      setAnalysisResult({
        summary: "这是一段关于技术讲解的视频，主要内容包括...",
        transcript: "视频字幕内容将显示在此处...",
        keyPoints: ["要点1", "要点2", "要点3"],
      });
      setIsAnalyzing(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 上传/输入区域 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <label className="block text-theme-text-primary font-medium mb-2">
          视频链接
        </label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="粘贴视频链接..."
          className="w-full p-3 bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-placeholder rounded-lg border border-theme-sidebar-border focus:border-theme-button-primary outline-none"
        />
        <div className="flex gap-2 mt-3">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg hover:bg-theme-action-menu-item-hover transition-colors">
            <Upload className="w-4 h-4 text-theme-text-secondary" />
            <span className="text-theme-text-secondary text-sm">上传视频</span>
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !videoUrl.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-theme-button-primary hover:bg-theme-button-primary/80 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {isAnalyzing ? (
              <Sparkle className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="text-sm">分析</span>
          </button>
        </div>
      </div>

      {/* 功能选项 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <h4 className="text-theme-text-primary font-medium mb-3">分析选项</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border cursor-pointer hover:bg-theme-action-menu-item-hover">
            <input type="checkbox" defaultChecked className="rounded" />
            <TextAlignLeft className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">生成字幕</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border cursor-pointer hover:bg-theme-action-menu-item-hover">
            <input type="checkbox" defaultChecked className="rounded" />
            <Sparkle className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">内容摘要</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-theme-bg-primary/50 rounded-lg border border-theme-sidebar-border cursor-pointer hover:bg-theme-action-menu-item-hover">
            <input type="checkbox" className="rounded" />
            <Translate className="w-5 h-5 text-theme-button-primary" />
            <span className="text-theme-text-secondary text-sm">翻译字幕</span>
          </label>
        </div>
      </div>

      {/* 分析结果 */}
      <div className="flex-1 overflow-y-auto p-4">
        {analysisResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border">
              <h5 className="text-theme-text-primary font-medium mb-2">内容摘要</h5>
              <p className="text-theme-text-secondary text-sm">{analysisResult.summary}</p>
            </div>
            <div className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border">
              <h5 className="text-theme-text-primary font-medium mb-2">关键要点</h5>
              <ul className="space-y-1">
                {analysisResult.keyPoints.map((point, index) => (
                  <li key={index} className="text-theme-text-secondary text-sm flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-theme-button-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <VideoCamera className="w-12 h-12 text-theme-text-secondary/50 mb-4" />
            <h3 className="text-theme-text-primary font-medium mb-2">
              AI 视频分析
            </h3>
            <p className="text-theme-text-secondary text-sm">
              上传视频或粘贴链接，AI 将自动分析内容
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
