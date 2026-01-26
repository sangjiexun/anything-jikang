import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Play,
  Pause,
  VideoCamera,
  FilmStrip,
  ChartLine,
  Robot,
  Microphone,
  Lightbulb,
  Clock,
  SpinnerGap,
  Check,
  X,
  CaretRight,
  Download,
  ArrowCounterClockwise,
  UserCircle,
  Waveform,
  MagicWand,
  Gear,
  DotsThree,
  Trash,
  TreeView,
  Eye,
  Plus,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import showToast from "@/utils/toast";

// Tab 配置
const TABS = [
  { id: "upload", name: "上传视频", icon: Upload },
  { id: "analysis", name: "视频分析", icon: ChartLine },
  { id: "script", name: "脚本生成", icon: FilmStrip },
  { id: "influence", name: "人物画像", icon: TreeView },
  { id: "ai-extend", name: "AI续写", icon: MagicWand },
  { id: "digital-human", name: "数字人", icon: UserCircle },
  { id: "video-gen", name: "视频生成", icon: VideoCamera },
  { id: "history", name: "历史记录", icon: Clock },
];

// 模型选项
const MODEL_OPTIONS = [
  { value: "qwen3-omni-flash-2025-12-01", label: "qwen3-omni-flash (快速)" },
  { value: "qwen3-vl-flash", label: "qwen3-vl-flash" },
  { value: "qwen-vl-max-2025-08-13", label: "qwen-vl-max" },
];

export default function VideoWorkspace({ onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // 状态管理
  const [activeTab, setActiveTab] = useState("upload");
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODEL_OPTIONS[0].value);

  // 分析状态
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);

  // 脚本状态
  const [script, setScript] = useState(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // 人物画像状态
  const [influenceGraph, setInfluenceGraph] = useState(null);

  // AI续写状态
  const [extensionDuration, setExtensionDuration] = useState(10);
  const [isExtending, setIsExtending] = useState(false);
  const [extendedContent, setExtendedContent] = useState("");

  // 数字人状态
  const [digitalHumanState, setDigitalHumanState] = useState({
    photoUrl: "",
    audioUrl: "",
    ttsText: "",
    isGenerating: false,
    progress: 0,
    videoUrl: "",
    error: null,
  });

  // 视频生成状态
  const [videoGenState, setVideoGenState] = useState({
    prompt: "",
    aspectRatio: "16:9",
    duration: 5,
    isGenerating: false,
    progress: 0,
    resultUrl: "",
  });

  // 历史记录
  const [historyList, setHistoryList] = useState([]);

  // 处理文件上传
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("video/")) {
        showToast("请上传视频文件", "warning");
        return;
      }
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      showToast("视频上传成功", "success");
    }
  };

  // 处理 URL 输入
  const handleUrlInput = (url) => {
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      setVideoUrl(url);
      setVideoFile(null);
    }
  };

  // 分析视频
  const handleAnalyze = async () => {
    if (!videoUrl) {
      showToast("请先上传或输入视频", "warning");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // 模拟分析过程
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((r) => setTimeout(r, 500));
        setAnalysisProgress(i);
      }

      // 模拟分析结果
      setAnalysisResult({
        duration: "02:35",
        resolution: "1920x1080",
        fps: 30,
        viralReasons: ["情绪共鸣", "热点话题", "视觉冲击", "节奏紧凑"],
        emotionAnalysis: {
          positive: 65,
          neutral: 25,
          negative: 10,
        },
        keyMoments: [
          { time: "00:15", description: "开场亮点" },
          { time: "00:45", description: "情绪高潮" },
          { time: "01:30", description: "转折点" },
          { time: "02:10", description: "结尾升华" },
        ],
        suggestions: [
          "建议在开头3秒内抓住观众注意力",
          "可增加字幕提高信息传达效率",
          "背景音乐节奏可更紧凑",
        ],
      });

      showToast("分析完成", "success");
      setActiveTab("analysis");
    } catch (error) {
      showToast("分析失败，请重试", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 生成脚本
  const handleGenerateScript = async () => {
    if (!analysisResult) {
      showToast("请先完成视频分析", "warning");
      return;
    }

    setIsGeneratingScript(true);

    try {
      await new Promise((r) => setTimeout(r, 2000));

      setScript({
        title: "爆款视频脚本",
        hook: "你知道吗？90%的人都不知道这个秘密...",
        structure: [
          { type: "开场", duration: "0-5s", content: "悬念开场，抓住注意力" },
          { type: "铺垫", duration: "5-15s", content: "背景介绍，建立共鸣" },
          { type: "高潮", duration: "15-45s", content: "核心内容展示" },
          { type: "转折", duration: "45-60s", content: "意外反转或深度分析" },
          { type: "结尾", duration: "60-90s", content: "总结升华，引导互动" },
        ],
        callToAction: "点赞关注，下期更精彩！",
      });

      showToast("脚本生成完成", "success");
      setActiveTab("script");
    } catch (error) {
      showToast("脚本生成失败", "error");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // AI续写
  const handleAIExtend = async () => {
    if (!script) {
      showToast("请先生成脚本", "warning");
      return;
    }

    setIsExtending(true);

    try {
      await new Promise((r) => setTimeout(r, 3000));

      setExtendedContent(`
## AI续写内容（${extensionDuration}秒扩展）

### 深度解析部分
这里我们来深入探讨一下刚才提到的关键点...

### 案例展示
让我用一个真实案例来说明这个问题...

### 互动引导
如果你也有类似的经历，欢迎在评论区分享...
      `);

      showToast("AI续写完成", "success");
    } catch (error) {
      showToast("续写失败", "error");
    } finally {
      setIsExtending(false);
    }
  };

  // 生成数字人视频
  const handleGenerateDigitalHuman = async () => {
    if (!digitalHumanState.photoUrl || !digitalHumanState.ttsText) {
      showToast("请上传人物照片并输入台词", "warning");
      return;
    }

    setDigitalHumanState((prev) => ({
      ...prev,
      isGenerating: true,
      progress: 0,
      error: null,
    }));

    try {
      for (let i = 0; i <= 100; i += 5) {
        await new Promise((r) => setTimeout(r, 300));
        setDigitalHumanState((prev) => ({ ...prev, progress: i }));
      }

      setDigitalHumanState((prev) => ({
        ...prev,
        isGenerating: false,
        videoUrl: "https://example.com/digital-human-video.mp4",
      }));

      showToast("数字人视频生成完成", "success");
    } catch (error) {
      setDigitalHumanState((prev) => ({
        ...prev,
        isGenerating: false,
        error: error.message,
      }));
      showToast("生成失败", "error");
    }
  };

  // 生成视频
  const handleGenerateVideo = async () => {
    if (!videoGenState.prompt) {
      showToast("请输入视频描述", "warning");
      return;
    }

    setVideoGenState((prev) => ({
      ...prev,
      isGenerating: true,
      progress: 0,
    }));

    try {
      for (let i = 0; i <= 100; i += 2) {
        await new Promise((r) => setTimeout(r, 200));
        setVideoGenState((prev) => ({ ...prev, progress: i }));
      }

      setVideoGenState((prev) => ({
        ...prev,
        isGenerating: false,
        resultUrl: "https://example.com/generated-video.mp4",
      }));

      showToast("视频生成完成", "success");
    } catch (error) {
      showToast("视频生成失败", "error");
      setVideoGenState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-theme-bg-primary">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border bg-theme-bg-secondary/50">
        <div className="flex items-center gap-2">
          <VideoCamera className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-theme-text-primary">
            智能视频工作台
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* 模型选择 */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-3 py-1.5 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:border-blue-500"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

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

      {/* Tab 导航 */}
      <div className="flex overflow-x-auto border-b border-theme-sidebar-border bg-theme-bg-secondary/30 no-scroll">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-transparent text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-action-menu-item-hover"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 上传视频 Tab */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            {/* 文件上传区 */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-theme-sidebar-border rounded-xl p-8 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-theme-text-secondary" />
              <p className="text-theme-text-primary mb-2">
                点击或拖拽上传视频
              </p>
              <p className="text-sm text-theme-text-secondary">
                支持 MP4, MOV, AVI 等格式
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* URL 输入 */}
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="或粘贴视频 URL..."
                onChange={(e) => handleUrlInput(e.target.value)}
                className="flex-1 px-4 py-3 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* 视频预览 */}
            {videoUrl && (
              <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                </div>

                {videoFile && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-theme-text-secondary">
                      {videoFile.name}
                    </span>
                    <span className="text-theme-text-secondary">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <SpinnerGap className="w-5 h-5 animate-spin" />
                      分析中 {analysisProgress}%
                    </>
                  ) : (
                    <>
                      <ChartLine className="w-5 h-5" />
                      开始分析
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 分析结果 Tab */}
        {activeTab === "analysis" && (
          <div className="space-y-4">
            {analysisResult ? (
              <>
                {/* 基础信息 */}
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-medium mb-3">
                    基础信息
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-theme-text-secondary">时长</p>
                      <p className="text-theme-text-primary font-medium">
                        {analysisResult.duration}
                      </p>
                    </div>
                    <div>
                      <p className="text-theme-text-secondary">分辨率</p>
                      <p className="text-theme-text-primary font-medium">
                        {analysisResult.resolution}
                      </p>
                    </div>
                    <div>
                      <p className="text-theme-text-secondary">帧率</p>
                      <p className="text-theme-text-primary font-medium">
                        {analysisResult.fps} FPS
                      </p>
                    </div>
                  </div>
                </div>

                {/* 爆款因素 */}
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-medium mb-3">
                    爆款因素分析
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.viralReasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 情绪分析 */}
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-medium mb-3">
                    情绪分析
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-theme-text-secondary w-16">
                        积极
                      </span>
                      <div className="flex-1 h-2 bg-theme-bg-primary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{
                            width: `${analysisResult.emotionAnalysis.positive}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-green-400 w-10">
                        {analysisResult.emotionAnalysis.positive}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-theme-text-secondary w-16">
                        中性
                      </span>
                      <div className="flex-1 h-2 bg-theme-bg-primary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-500 rounded-full"
                          style={{
                            width: `${analysisResult.emotionAnalysis.neutral}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-400 w-10">
                        {analysisResult.emotionAnalysis.neutral}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-theme-text-secondary w-16">
                        消极
                      </span>
                      <div className="flex-1 h-2 bg-theme-bg-primary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{
                            width: `${analysisResult.emotionAnalysis.negative}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-red-400 w-10">
                        {analysisResult.emotionAnalysis.negative}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 关键时刻 */}
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-medium mb-3">
                    关键时刻
                  </h3>
                  <div className="space-y-2">
                    {analysisResult.keyMoments.map((moment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-theme-bg-primary rounded-lg"
                      >
                        <span className="text-blue-400 font-mono text-sm">
                          {moment.time}
                        </span>
                        <span className="text-theme-text-primary text-sm">
                          {moment.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 优化建议 */}
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-medium mb-3">
                    优化建议
                  </h3>
                  <ul className="space-y-2">
                    {analysisResult.suggestions.map((suggestion, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-theme-text-secondary"
                      >
                        <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 操作按钮 */}
                <button
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
                >
                  {isGeneratingScript ? (
                    <>
                      <SpinnerGap className="w-5 h-5 animate-spin" />
                      生成脚本中...
                    </>
                  ) : (
                    <>
                      <FilmStrip className="w-5 h-5" />
                      生成爆款脚本
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ChartLine className="w-16 h-16 text-theme-text-secondary/30 mb-4" />
                <p className="text-theme-text-secondary">暂无分析结果</p>
                <p className="text-sm text-theme-text-secondary/60 mt-1">
                  请先上传视频并开始分析
                </p>
              </div>
            )}
          </div>
        )}

        {/* 脚本生成 Tab */}
        {activeTab === "script" && (
          <div className="space-y-4">
            {script ? (
              <>
                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h3 className="text-theme-text-primary font-bold text-lg mb-2">
                    {script.title}
                  </h3>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className="text-yellow-400 text-sm font-medium">
                      🎣 开场钩子
                    </p>
                    <p className="text-theme-text-primary mt-1">{script.hook}</p>
                  </div>
                </div>

                <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                  <h4 className="text-theme-text-primary font-medium mb-3">
                    脚本结构
                  </h4>
                  <div className="space-y-3">
                    {script.structure.map((section, idx) => (
                      <div
                        key={idx}
                        className="flex gap-3 p-3 bg-theme-bg-primary rounded-lg"
                      >
                        <div className="flex-shrink-0 w-16">
                          <span className="text-blue-400 text-sm font-medium">
                            {section.type}
                          </span>
                          <p className="text-xs text-theme-text-secondary">
                            {section.duration}
                          </p>
                        </div>
                        <p className="text-theme-text-primary text-sm">
                          {section.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 text-sm font-medium">
                    📣 行动号召
                  </p>
                  <p className="text-theme-text-primary mt-1">
                    {script.callToAction}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FilmStrip className="w-16 h-16 text-theme-text-secondary/30 mb-4" />
                <p className="text-theme-text-secondary">暂无脚本</p>
                <p className="text-sm text-theme-text-secondary/60 mt-1">
                  请先完成视频分析后生成脚本
                </p>
              </div>
            )}
          </div>
        )}

        {/* 人物画像 Tab */}
        {activeTab === "influence" && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <TreeView className="w-16 h-16 text-theme-text-secondary/30 mb-4" />
            <p className="text-theme-text-secondary">人物画像功能开发中</p>
            <p className="text-sm text-theme-text-secondary/60 mt-1">
              敬请期待...
            </p>
          </div>
        )}

        {/* AI续写 Tab */}
        {activeTab === "ai-extend" && (
          <div className="space-y-4">
            <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
              <h3 className="text-theme-text-primary font-medium mb-3">
                AI续写设置
              </h3>
              <div>
                <label className="block text-sm text-theme-text-secondary mb-2">
                  续写时长（秒）
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={extensionDuration}
                  onChange={(e) => setExtensionDuration(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-theme-text-secondary mt-1">
                  <span>5秒</span>
                  <span className="text-blue-400 font-medium">
                    {extensionDuration}秒
                  </span>
                  <span>60秒</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleAIExtend}
              disabled={isExtending || !script}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50"
            >
              {isExtending ? (
                <>
                  <SpinnerGap className="w-5 h-5 animate-spin" />
                  AI续写中...
                </>
              ) : (
                <>
                  <MagicWand className="w-5 h-5" />
                  开始AI续写
                </>
              )}
            </button>

            {extendedContent && (
              <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                <h4 className="text-theme-text-primary font-medium mb-3">
                  续写结果
                </h4>
                <div className="prose prose-invert max-w-none text-sm text-theme-text-primary whitespace-pre-wrap">
                  {extendedContent}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 数字人 Tab */}
        {activeTab === "digital-human" && (
          <div className="space-y-4">
            <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
              <h3 className="text-theme-text-primary font-medium mb-3">
                数字人照片
              </h3>
              <input
                type="url"
                placeholder="输入人物照片 URL..."
                value={digitalHumanState.photoUrl}
                onChange={(e) =>
                  setDigitalHumanState((prev) => ({
                    ...prev,
                    photoUrl: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
              <h3 className="text-theme-text-primary font-medium mb-3">
                台词文本
              </h3>
              <textarea
                placeholder="输入数字人要说的台词..."
                value={digitalHumanState.ttsText}
                onChange={(e) =>
                  setDigitalHumanState((prev) => ({
                    ...prev,
                    ttsText: e.target.value,
                  }))
                }
                rows={4}
                className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleGenerateDigitalHuman}
              disabled={digitalHumanState.isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50"
            >
              {digitalHumanState.isGenerating ? (
                <>
                  <SpinnerGap className="w-5 h-5 animate-spin" />
                  生成中 {digitalHumanState.progress}%
                </>
              ) : (
                <>
                  <UserCircle className="w-5 h-5" />
                  生成数字人视频
                </>
              )}
            </button>

            {digitalHumanState.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <p className="text-red-400">{digitalHumanState.error}</p>
              </div>
            )}
          </div>
        )}

        {/* 视频生成 Tab */}
        {activeTab === "video-gen" && (
          <div className="space-y-4">
            <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
              <h3 className="text-theme-text-primary font-medium mb-3">
                视频描述
              </h3>
              <textarea
                placeholder="描述你想要生成的视频内容..."
                value={videoGenState.prompt}
                onChange={(e) =>
                  setVideoGenState((prev) => ({ ...prev, prompt: e.target.value }))
                }
                rows={4}
                className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary placeholder-theme-text-secondary/50 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                <label className="block text-sm text-theme-text-secondary mb-2">
                  画面比例
                </label>
                <select
                  value={videoGenState.aspectRatio}
                  onChange={(e) =>
                    setVideoGenState((prev) => ({
                      ...prev,
                      aspectRatio: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary focus:outline-none focus:border-blue-500"
                >
                  <option value="16:9">16:9 横屏</option>
                  <option value="9:16">9:16 竖屏</option>
                  <option value="1:1">1:1 方形</option>
                </select>
              </div>

              <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                <label className="block text-sm text-theme-text-secondary mb-2">
                  视频时长
                </label>
                <select
                  value={videoGenState.duration}
                  onChange={(e) =>
                    setVideoGenState((prev) => ({
                      ...prev,
                      duration: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-theme-text-primary focus:outline-none focus:border-blue-500"
                >
                  <option value={5}>5秒</option>
                  <option value={10}>10秒</option>
                  <option value={15}>15秒</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={videoGenState.isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-medium hover:from-indigo-600 hover:to-purple-600 transition-all disabled:opacity-50"
            >
              {videoGenState.isGenerating ? (
                <>
                  <SpinnerGap className="w-5 h-5 animate-spin" />
                  生成中 {videoGenState.progress}%
                </>
              ) : (
                <>
                  <VideoCamera className="w-5 h-5" />
                  生成视频
                </>
              )}
            </button>

            {videoGenState.resultUrl && (
              <div className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border">
                <h4 className="text-theme-text-primary font-medium mb-3">
                  生成结果
                </h4>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={videoGenState.resultUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 历史记录 Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            {historyList.length > 0 ? (
              historyList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-theme-bg-secondary rounded-xl p-4 border border-theme-sidebar-border hover:border-blue-500/50 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-theme-text-primary font-medium">
                      {item.title || "未命名分析"}
                    </h4>
                    <span className="text-xs text-theme-text-secondary">
                      {item.savedAt}
                    </span>
                  </div>
                  <button className="w-full py-2 bg-theme-bg-primary rounded-lg text-sm text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-colors flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    查看详情
                  </button>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="w-16 h-16 text-theme-text-secondary/30 mb-4" />
                <p className="text-theme-text-secondary">暂无历史记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
