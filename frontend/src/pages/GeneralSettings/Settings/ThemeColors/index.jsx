import { useTheme } from "@/hooks/useTheme";
import showToast from "@/utils/toast";
import SettingsSidebar from "@/components/SettingsSidebar";

// 主题预览颜色配置
const themePreviewColors = {
  "jikang-gold": {
    name: "极康金",
    description: "沙漠金 + 高级灰，大气沉稳",
    primary: "#d4a85a",
    secondary: "#1a1915",
    accent: "#e8c078",
    text: "#f5e6c8",
  },
  default: {
    name: "默认深色",
    description: "经典深色主题，护眼舒适",
    primary: "#46c8ff",
    secondary: "#0e0f0f",
    accent: "#7cd4fd",
    text: "#ffffff",
  },
  light: {
    name: "默认浅色",
    description: "明亮清新，适合白天使用",
    primary: "#0ba5ec",
    secondary: "#ffffff",
    accent: "#7cd4fd",
    text: "#0e0f0f",
  },
  qingshan: {
    name: "见青山",
    description: "墨绿色调，宁静自然",
    primary: "#4a9f7e",
    secondary: "#0f1a16",
    accent: "#6bc4a0",
    text: "#d8f0e3",
  },
  shuihanyan: {
    name: "水含烟",
    description: "白色基调，清雅素净",
    primary: "#6b8fa8",
    secondary: "#f8fafc",
    accent: "#7ba3bd",
    text: "#1e3a5f",
  },
};

function ThemeCard({ themeKey, themeInfo, isActive, onSelect }) {
  return (
    <div
      onClick={() => onSelect(themeKey)}
      className={`
        relative cursor-pointer rounded-xl p-4 transition-all duration-300
        border-2 hover:scale-[1.02]
        ${
          isActive
            ? "border-theme-button-primary shadow-lg"
            : "border-theme-sidebar-border hover:border-theme-button-primary/50"
        }
      `}
      style={{ backgroundColor: themeInfo.secondary }}
    >
      {/* 选中标记 */}
      {isActive && (
        <div
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: themeInfo.primary }}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke={themeInfo.secondary}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      {/* 颜色预览条 */}
      <div className="flex gap-2 mb-4">
        <div
          className="w-12 h-12 rounded-lg"
          style={{ backgroundColor: themeInfo.primary }}
        />
        <div
          className="w-12 h-12 rounded-lg"
          style={{ backgroundColor: themeInfo.accent }}
        />
        <div
          className="w-12 h-12 rounded-lg border border-gray-500/30"
          style={{ backgroundColor: themeInfo.secondary }}
        />
      </div>

      {/* 主题信息 */}
      <h3
        className="text-lg font-bold mb-1"
        style={{ color: themeInfo.text }}
      >
        {themeInfo.name}
      </h3>
      <p
        className="text-sm opacity-70"
        style={{ color: themeInfo.text }}
      >
        {themeInfo.description}
      </p>
    </div>
  );
}

export default function ThemeColors() {
  const { theme, setTheme, availableThemes } = useTheme();

  const handleThemeSelect = (themeKey) => {
    setTheme(themeKey);
    showToast(`已切换到「${themePreviewColors[themeKey].name}」主题`, "success", {
      clear: true,
    });
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <SettingsSidebar />
      <div className="w-full h-full overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-theme-text-primary mb-2">
              主题配色
            </h1>
            <p className="text-theme-text-secondary">
              选择您喜欢的主题配色方案，让界面更符合您的风格。
            </p>
          </div>

          {/* 当前主题提示 */}
          <div className="mb-6 p-4 rounded-lg bg-theme-bg-secondary border border-theme-sidebar-border">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: themePreviewColors[theme]?.primary }}
              />
              <span className="text-theme-text-primary">
                当前主题：
                <span className="font-bold ml-1">
                  {themePreviewColors[theme]?.name || availableThemes[theme]}
                </span>
              </span>
            </div>
          </div>

          {/* 主题卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(themePreviewColors).map(([key, info]) => (
              <ThemeCard
                key={key}
                themeKey={key}
                themeInfo={info}
                isActive={theme === key}
                onSelect={handleThemeSelect}
              />
            ))}
          </div>

          {/* 说明文字 */}
          <div className="mt-8 p-4 rounded-lg bg-theme-bg-secondary/50 border border-theme-sidebar-border">
            <h4 className="text-sm font-bold text-theme-text-primary mb-2">
              提示
            </h4>
            <ul className="text-sm text-theme-text-secondary space-y-1">
              <li>• 主题设置会自动保存，下次访问时将自动应用</li>
              <li>• 开发模式下可使用 Ctrl/Cmd + . 快捷键循环切换主题</li>
              <li>• 「极康金」为推荐默认主题，融合东方美学元素</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
