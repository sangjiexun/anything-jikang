import React, { useState, useEffect } from "react";
import {
  Plus,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  Trash,
  Warning,
  Check,
  X,
  Globe,
  GithubLogo,
  HardDrive,
  CloudArrowUp,
  Folder,
  Terminal,
  Pencil,
  MapPin,
} from "@phosphor-icons/react";
import showToast from "@/utils/toast";
import { useTranslation } from "react-i18next";

// MCP 服务器图标映射
const SERVER_ICONS = {
  "google-drive": { icon: CloudArrowUp, color: "bg-yellow-500" },
  docker: { icon: Terminal, color: "bg-blue-500" },
  filesystem: { icon: Folder, color: "bg-orange-500" },
  github: { icon: GithubLogo, color: "bg-gray-700" },
  map: { icon: MapPin, color: "bg-green-500" },
  default: { icon: Globe, color: "bg-purple-500" },
};

// 获取服务器图标
const getServerIcon = (name) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("google") || lowerName.includes("drive")) {
    return SERVER_ICONS["google-drive"];
  }
  if (lowerName.includes("docker")) {
    return SERVER_ICONS["docker"];
  }
  if (lowerName.includes("file") || lowerName.includes("filesystem")) {
    return SERVER_ICONS["filesystem"];
  }
  if (lowerName.includes("github")) {
    return SERVER_ICONS["github"];
  }
  if (lowerName.includes("地图") || lowerName.includes("map") || lowerName.includes("高德") || lowerName.includes("amap")) {
    return SERVER_ICONS["map"];
  }
  return SERVER_ICONS["default"];
};

// MCP 服务器存储键
const MCP_SERVERS_KEY = "anythingllm_mcp_servers";

export default function MCPConfig({ workspace }) {
  const { t } = useTranslation();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedServer, setExpandedServer] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);

  // 加载 MCP 服务器列表
  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = () => {
    try {
      const saved = localStorage.getItem(MCP_SERVERS_KEY);
      if (saved) {
        setServers(JSON.parse(saved));
      } else {
        // 默认示例服务器
        const defaultServers = [
          {
            id: "amap",
            name: "高德地图",
            status: "connected",
            enabled: true,
            type: "manual",
            config: {
              apiKey: "671a340b83a6c56c1ac80779984ab086",
              webApiKey: "671a340b83a6c56c1ac80779984ab086",
              command: "npx",
              args: "-y @amap/amap-maps-mcp-server",
            },
          },
          {
            id: "google-drive",
            name: "Google Drive",
            status: "error",
            enabled: true,
            type: "marketplace",
          },
          {
            id: "docker-1",
            name: "Docker",
            status: "error",
            enabled: true,
            type: "marketplace",
          },
          {
            id: "docker-2",
            name: "docker",
            status: "error",
            enabled: true,
            type: "manual",
            icon: "docker",
          },
          {
            id: "edgeone",
            name: "edgeone-pages-mcp-server",
            status: "connected",
            enabled: true,
            type: "manual",
          },
          {
            id: "filesystem",
            name: "Filesystem",
            status: "connected",
            enabled: true,
            type: "manual",
          },
          {
            id: "github",
            name: "GitHub",
            status: "connected",
            enabled: true,
            type: "marketplace",
          },
        ];
        setServers(defaultServers);
        localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(defaultServers));
      }
    } catch (e) {
      console.error("Failed to load MCP servers:", e);
    }
  };

  const saveServers = (newServers) => {
    setServers(newServers);
    localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(newServers));
  };

  const toggleServerEnabled = (serverId) => {
    const newServers = servers.map((s) =>
      s.id === serverId ? { ...s, enabled: !s.enabled } : s
    );
    saveServers(newServers);
  };

  const retryConnection = async (serverId) => {
    setLoading(true);
    showToast("正在重试连接...", "info");
    
    // 模拟重试连接
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const newServers = servers.map((s) =>
      s.id === serverId
        ? { ...s, status: Math.random() > 0.5 ? "connected" : "error" }
        : s
    );
    saveServers(newServers);
    setLoading(false);
    showToast("连接尝试完成", "success");
  };

  const deleteServer = (serverId) => {
    if (!confirm("确定要删除此 MCP 服务器吗？")) return;
    const newServers = servers.filter((s) => s.id !== serverId);
    saveServers(newServers);
    showToast("MCP 服务器已删除", "success");
  };

  const refreshAll = async () => {
    setLoading(true);
    showToast("正在刷新所有连接...", "info");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    loadServers();
    setLoading(false);
    showToast("刷新完成", "success");
  };

  const openMarketplace = () => {
    window.open("https://mcp.so", "_blank");
    setShowAddMenu(false);
  };

  const addManualServer = (serverConfig) => {
    const newServer = {
      id: `manual_${Date.now()}`,
      name: serverConfig.name,
      status: "connected",
      enabled: true,
      type: "manual",
      config: serverConfig,
    };
    const newServers = [...servers, newServer];
    saveServers(newServers);
    setShowManualModal(false);
    showToast("MCP 服务器已添加", "success");
  };

  const updateServer = (serverId, updates) => {
    const newServers = servers.map((s) =>
      s.id === serverId ? { ...s, ...updates } : s
    );
    saveServers(newServers);
    setEditingServer(null);
    showToast("配置已更新", "success");
  };

  return (
    <div className="relative">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">MCP</h1>
          <button
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            title="什么是 MCP?"
            onClick={() => window.open("https://mcp.so/docs", "_blank")}
          >
            <span className="w-5 h-5 rounded-full border border-white/50 flex items-center justify-center text-xs text-white/50">
              ?
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 刷新按钮 */}
          <button
            onClick={refreshAll}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="刷新所有连接"
          >
            <ArrowsClockwise
              className={`w-5 h-5 text-white ${loading ? "animate-spin" : ""}`}
            />
          </button>

          {/* 添加按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <Plus className="w-4 h-4" />
              添加
              <CaretDown className="w-3 h-3" />
            </button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-40 bg-theme-bg-secondary border border-theme-sidebar-border rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={openMarketplace}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors"
                >
                  从市场添加
                </button>
                <button
                  onClick={() => {
                    setShowManualModal(true);
                    setShowAddMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors border-t border-theme-sidebar-border"
                >
                  手动添加
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 服务器列表 */}
      <div className="space-y-2">
        {servers.map((server) => {
          const iconConfig = getServerIcon(server.name);
          const IconComponent = iconConfig.icon;
          const isExpanded = expandedServer === server.id;

          return (
            <div
              key={server.id}
              className="bg-theme-bg-primary border border-theme-sidebar-border rounded-lg overflow-hidden"
            >
              {/* 服务器行 */}
              <div className="flex items-center gap-3 p-4">
                {/* 展开按钮 */}
                <button
                  onClick={() =>
                    setExpandedServer(isExpanded ? null : server.id)
                  }
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {isExpanded ? (
                    <CaretDown className="w-4 h-4" />
                  ) : (
                    <CaretRight className="w-4 h-4" />
                  )}
                </button>

                {/* 图标 */}
                <div
                  className={`w-10 h-10 ${iconConfig.color} rounded-lg flex items-center justify-center`}
                >
                  {server.icon === "docker" ? (
                    <span className="text-white font-bold text-lg">🐳</span>
                  ) : server.name.startsWith("E") ||
                    server.name.startsWith("e") ? (
                    <span className="text-white font-bold text-lg">E</span>
                  ) : (
                    <IconComponent className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* 名称和状态 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{server.name}</span>
                    {server.status === "error" ? (
                      <span className="flex items-center gap-1 text-red-400 text-sm">
                        <Warning className="w-4 h-4" />
                        客户端已关闭
                        <button
                          onClick={() => retryConnection(server.id)}
                          className="text-blue-400 hover:underline ml-1"
                        >
                          重试
                        </button>
                      </span>
                    ) : (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                </div>

                {/* 开关 */}
                <button
                  onClick={() => toggleServerEnabled(server.id)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    server.enabled ? "bg-green-500" : "bg-gray-600"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      server.enabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* 展开内容 */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 border-t border-theme-sidebar-border">
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">类型</span>
                      <span className="text-white">
                        {server.type === "marketplace" ? "市场安装" : "手动配置"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">状态</span>
                      <span
                        className={
                          server.status === "connected"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {server.status === "connected" ? "已连接" : "连接失败"}
                      </span>
                    </div>
                    {server.config && (
                      <>
                        {server.config.apiKey && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">API Key</span>
                            <span className="text-white font-mono text-xs">
                              {server.config.apiKey.substring(0, 8)}...
                            </span>
                          </div>
                        )}
                        {server.config.command && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">命令</span>
                            <span className="text-white font-mono text-xs">
                              {server.config.command}
                            </span>
                          </div>
                        )}
                        {server.config.args && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">参数</span>
                            <span className="text-white font-mono text-xs truncate max-w-[200px]">
                              {server.config.args}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={() => setEditingServer(server)}
                        className="px-3 py-1.5 text-sm bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        编辑配置
                      </button>
                      <button
                        onClick={() => retryConnection(server.id)}
                        className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        重新连接
                      </button>
                      <button
                        onClick={() => deleteServer(server.id)}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {servers.length === 0 && (
        <div className="text-center py-12 text-white/50">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>暂无 MCP 服务器</p>
          <p className="text-sm mt-2">点击"添加"按钮开始配置</p>
        </div>
      )}

      {/* 手动添加弹窗 */}
      {showManualModal && (
        <ManualAddModal
          onClose={() => setShowManualModal(false)}
          onAdd={addManualServer}
        />
      )}

      {/* 编辑配置弹窗 */}
      {editingServer && (
        <EditServerModal
          server={editingServer}
          onClose={() => setEditingServer(null)}
          onUpdate={(updates) => updateServer(editingServer.id, updates)}
        />
      )}
    </div>
  );
}

// 手动添加弹窗组件
function ManualAddModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("请输入服务器名称", "warning");
      return;
    }
    onAdd({
      name: name.trim(),
      command: command.trim(),
      args: args.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl w-[500px] max-w-[90vw] shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border">
          <h2 className="text-lg font-semibold text-white">手动添加 MCP 服务器</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">服务器名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: my-mcp-server"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">命令 (可选)</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例如: npx"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">参数 (可选)</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="例如: -y @anthropic/mcp-server-name"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-sm text-white/40">
            <p>提示: 从 mcp.so 市场获取更多 MCP 工具</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-theme-sidebar-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white/60 hover:bg-white/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              添加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 编辑服务器配置弹窗组件
function EditServerModal({ server, onClose, onUpdate }) {
  const [name, setName] = useState(server.name || "");
  const [apiKey, setApiKey] = useState(server.config?.apiKey || "");
  const [command, setCommand] = useState(server.config?.command || "");
  const [args, setArgs] = useState(server.config?.args || "");
  const [webApiKey, setWebApiKey] = useState(server.config?.webApiKey || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("请输入服务器名称", "warning");
      return;
    }
    onUpdate({
      name: name.trim(),
      config: {
        ...server.config,
        apiKey: apiKey.trim(),
        webApiKey: webApiKey.trim(),
        command: command.trim(),
        args: args.trim(),
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl w-[600px] max-w-[90vw] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border sticky top-0 bg-theme-bg-secondary z-10">
          <h2 className="text-lg font-semibold text-white">编辑 MCP 服务器配置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-white/60 mb-2">服务器名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 高德地图"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">
              API Key (Web 服务)
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="例如: 671a340b83a6c56c1ac80779984ab086"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-white/40 mt-1">
              用于后端 API 调用的密钥
            </p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">
              Web API Key (前端地图)
            </label>
            <input
              type="text"
              value={webApiKey}
              onChange={(e) => setWebApiKey(e.target.value)}
              placeholder="例如: 671a340b83a6c56c1ac80779984ab086"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-white/40 mt-1">
              用于前端地图显示的密钥（高德地图需要单独的 Web 端 Key）
            </p>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">命令 (可选)</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例如: npx"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">参数 (可选)</label>
            <input
              type="text"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder="例如: -y @anthropic/mcp-server-name"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="text-sm text-white/40 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="font-medium text-blue-400 mb-1">高德地图配置示例：</p>
            <p className="text-xs">
              • API Key: 671a340b83a6c56c1ac80779984ab086 (Web 服务 Key)
            </p>
            <p className="text-xs">
              • Web API Key: 671a340b83a6c56c1ac80779984ab086 (Web 端 Key，用于地图显示)
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-theme-sidebar-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-white/60 hover:bg-white/10 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
