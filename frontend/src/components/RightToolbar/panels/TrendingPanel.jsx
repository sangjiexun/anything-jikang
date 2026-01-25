import React, { useState, useEffect } from "react";
import {
  TrendUp,
  Fire,
  NewspaperClipping,
  ArrowRight,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";

const SAMPLE_TRENDS = [
  { id: 1, title: "人工智能最新进展", heat: 9823, category: "科技" },
  { id: 2, title: "新能源汽车市场分析", heat: 8456, category: "财经" },
  { id: 3, title: "教育改革新政策解读", heat: 7234, category: "教育" },
  { id: 4, title: "健康生活方式趋势", heat: 6521, category: "健康" },
  { id: 5, title: "互联网安全态势报告", heat: 5890, category: "安全" },
];

export default function TrendingPanel() {
  const [trends, setTrends] = useState(SAMPLE_TRENDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const filteredTrends = trends.filter((trend) =>
    trend.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAnalyzeTrend = async (trend) => {
    setSelectedTrend(trend);
    setIsAnalyzing(true);
    // TODO: 实现热点分析
    setTimeout(() => {
      setIsAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 搜索框 */}
      <div className="p-4 border-b border-theme-sidebar-border">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索热点话题..."
            className="w-full pl-10 pr-4 py-3 bg-theme-settings-input-bg text-theme-text-primary placeholder:text-theme-placeholder rounded-lg border border-theme-sidebar-border focus:border-theme-button-primary outline-none"
          />
        </div>
      </div>

      {/* 热点列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Fire className="w-5 h-5 text-orange-400" weight="fill" />
          <span className="text-theme-text-primary font-medium">热门话题</span>
        </div>

        {filteredTrends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <NewspaperClipping className="w-10 h-10 text-theme-text-secondary/50 mb-3" />
            <p className="text-theme-text-secondary text-sm">暂无相关热点</p>
          </div>
        ) : (
          filteredTrends.map((trend, index) => (
            <div
              key={trend.id}
              className="p-4 bg-theme-bg-primary/50 rounded-xl border border-theme-sidebar-border hover:border-theme-button-primary/50 transition-colors cursor-pointer"
              onClick={() => handleAnalyzeTrend(trend)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-lg font-bold ${
                      index < 3 ? "text-orange-400" : "text-theme-text-secondary"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="text-theme-text-primary font-medium">
                      {trend.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-theme-button-primary/20 text-theme-button-primary">
                        {trend.category}
                      </span>
                      <span className="text-theme-text-secondary text-xs flex items-center gap-1">
                        <TrendUp className="w-3 h-3" />
                        {trend.heat.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button className="p-2 rounded-lg hover:bg-theme-action-menu-item-hover transition-colors">
                  <ArrowRight className="w-4 h-4 text-theme-text-secondary" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分析面板 */}
      {selectedTrend && (
        <div className="p-4 border-t border-theme-sidebar-border bg-theme-bg-primary/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-theme-text-primary font-medium">
              {selectedTrend.title}
            </h4>
            <button
              onClick={() => setSelectedTrend(null)}
              className="text-theme-text-secondary text-sm hover:text-theme-text-primary"
            >
              关闭
            </button>
          </div>
          {isAnalyzing ? (
            <div className="flex items-center justify-center py-6">
              <Sparkle className="w-6 h-6 text-theme-button-primary animate-spin mr-2" />
              <span className="text-theme-text-secondary">AI 正在分析...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-theme-button-primary hover:bg-theme-button-primary/80 text-white rounded-lg transition-colors">
                <Sparkle className="w-4 h-4" />
                <span className="text-sm">生成分析报告</span>
              </button>
              <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg hover:bg-theme-action-menu-item-hover transition-colors">
                <NewspaperClipping className="w-4 h-4 text-theme-text-secondary" />
                <span className="text-theme-text-secondary text-sm">发送到聊天</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
