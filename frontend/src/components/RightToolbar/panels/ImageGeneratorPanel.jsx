import React, { useState } from "react";
import {
  Image,
  Sparkle,
  Palette,
  Resize,
  Download,
  Copy,
  ArrowsClockwise,
} from "@phosphor-icons/react";

const STYLE_OPTIONS = [
  { id: "realistic", name: "写实" },
  { id: "cartoon", name: "卡通" },
  { id: "oil-painting", name: "油画" },
  { id: "watercolor", name: "水彩" },
  { id: "sketch", name: "素描" },
  { id: "3d", name: "3D渲染" },
];

const SIZE_OPTIONS = [
  { id: "1:1", name: "1:1", desc: "正方形" },
  { id: "16:9", name: "16:9", desc: "横屏" },
  { id: "9:16", name: "9:16", desc: "竖屏" },
  { id: "4:3", name: "4:3", desc: "标准" },
];

export default function ImageGeneratorPanel() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [selectedSize, setSelectedSize] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    // TODO: 实现图片生成（可以接入通义万相 MCP）
    setTimeout(() => {
      setGeneratedImages([
        { id: 1, url: null, prompt },
        { id: 2, url: null, prompt },
        { id: 3, url: null, prompt },
        { id: 4, url: null, prompt },
      ]);
      setIsGenerating(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 输入区域 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <label className="block text-theme-text-primary font-medium mb-2">
          图片描述
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述您想要生成的图片..."
          className="w-full h-20 p-3 bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-placeholder rounded-lg border border-theme-sidebar-border focus:border-theme-button-primary outline-none resize-none"
        />
      </div>

      {/* 风格选择 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-theme-button-primary" />
          <h4 className="text-theme-text-primary font-medium">风格</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((style) => (
            <button
              key={style.id}
              onClick={() => setSelectedStyle(style.id)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                selectedStyle === style.id
                  ? "bg-theme-button-primary text-white"
                  : "bg-theme-bg-primary border border-theme-sidebar-border text-theme-text-secondary hover:border-theme-button-primary/50"
              }`}
            >
              {style.name}
            </button>
          ))}
        </div>
      </div>

      {/* 尺寸选择 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <div className="flex items-center gap-2 mb-3">
          <Resize className="w-4 h-4 text-theme-button-primary" />
          <h4 className="text-theme-text-primary font-medium">尺寸</h4>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size.id}
              onClick={() => setSelectedSize(size.id)}
              className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                selectedSize === size.id
                  ? "bg-theme-button-primary/10 border border-theme-button-primary"
                  : "bg-theme-bg-primary/50 border border-theme-sidebar-border hover:border-theme-button-primary/50"
              }`}
            >
              <span
                className={`text-sm font-medium ${
                  selectedSize === size.id
                    ? "text-theme-button-primary"
                    : "text-theme-text-primary"
                }`}
              >
                {size.name}
              </span>
              <span className="text-xs text-theme-text-secondary">{size.desc}</span>
            </button>
          ))}
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
              <Image className="w-5 h-5" />
              <span>生成图片</span>
            </>
          )}
        </button>
      </div>

      {/* 生成结果 */}
      {generatedImages.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 border-t border-theme-sidebar-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-theme-text-primary font-medium">生成结果</h4>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 text-theme-button-primary text-sm hover:underline"
            >
              <ArrowsClockwise className="w-4 h-4" />
              重新生成
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {generatedImages.map((img) => (
              <div
                key={img.id}
                className="relative group aspect-square bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border overflow-hidden"
              >
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-10 h-10 text-theme-text-secondary/30" />
                </div>
                {/* 操作按钮 */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    <Download className="w-5 h-5 text-white" />
                  </button>
                  <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    <Copy className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {generatedImages.length === 0 && !isGenerating && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Image className="w-12 h-12 text-theme-text-secondary/50 mb-4" />
          <h3 className="text-theme-text-primary font-medium mb-2">
            智能图片生成
          </h3>
          <p className="text-theme-text-secondary text-sm">
            输入描述，AI 将为您生成独特的图片
          </p>
        </div>
      )}
    </div>
  );
}
