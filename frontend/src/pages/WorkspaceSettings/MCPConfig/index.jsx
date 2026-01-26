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
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    setLoading(true);
    showToast("正在重试连接...", "info");
    
    try {
      const MCPServers = (await import("@/models/mcpServers")).default;
      
      // 先尝试停止服务器（如果正在运行）
      await MCPServers.toggleServer(server.name);
      
      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // 重新启动服务器
      const toggleResult = await MCPServers.toggleServer(server.name);
      
      if (toggleResult.success) {
        // 重新加载服务器列表
        const { servers: backendServers } = await MCPServers.listServers();
        const backendServer = backendServers.find(s => s.name === server.name);
        
        const newServers = servers.map((s) =>
          s.id === serverId
            ? { 
                ...s, 
                status: backendServer?.running ? "connected" : "error",
                error: backendServer?.error || null,
              }
            : s
        );
        saveServers(newServers);
        
        if (backendServer?.running) {
          showToast("连接成功", "success");
        } else {
          showToast(`连接失败: ${backendServer?.error || "未知错误"}`, "error");
        }
      } else {
        showToast(`重试失败: ${toggleResult.error || "未知错误"}`, "error");
      }
    } catch (error) {
      console.error("重试连接失败:", error);
      showToast("重试连接失败: " + error.message, "error");
    } finally {
      setLoading(false);
    }
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

  const addManualServer = async (serverConfig) => {
    // 构建后端配置
    const backendConfig = {
      command: serverConfig.command || "npx",
      args: serverConfig.args 
        ? (Array.isArray(serverConfig.args) 
            ? serverConfig.args 
            : typeof serverConfig.args === "string" && serverConfig.args.trim()
            ? serverConfig.args.trim().split(/\s+/)
            : [])
        : [],
      env: {
        ...(serverConfig.apiKey ? { 
          AMAP_MAPS_API_KEY: serverConfig.apiKey,
          API_KEY: serverConfig.apiKey 
        } : {}),
        ...(serverConfig.webApiKey ? { 
          AMAP_WEB_API_KEY: serverConfig.webApiKey,
          WEB_API_KEY: serverConfig.webApiKey 
        } : {}),
      },
    };

    // 如果没有命令，使用默认值
    if (!backendConfig.command) {
      backendConfig.command = "npx";
    }

    // 如果没有参数但有命令，确保args是数组
    if (!backendConfig.args || backendConfig.args.length === 0) {
      // 对于高德地图，如果没有参数，添加默认参数
      if (serverConfig.name && (serverConfig.name.includes("高德") || serverConfig.name.includes("amap") || serverConfig.name.includes("高德map"))) {
        backendConfig.args = ["-y", "@amap/amap-maps-mcp-server"];
      }
    }
    
    // 确保args是数组格式
    if (!Array.isArray(backendConfig.args)) {
      if (typeof backendConfig.args === "string" && backendConfig.args.trim()) {
        backendConfig.args = backendConfig.args.trim().split(/\s+/);
      } else {
        backendConfig.args = [];
      }
    }

    try {
      // 先保存到后端
      const MCPServers = (await import("@/models/mcpServers")).default;
      const result = await MCPServers.updateServer(serverConfig.name, backendConfig);
      
      if (!result.success) {
        showToast("后端保存失败: " + (result.error || "未知错误"), "error");
        return;
      }

      // 保存成功后，重新加载服务器列表以获取真实状态
      showToast("MCP 服务器已添加并保存到后端", "success");
      
      // 等待一下让服务器启动
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // 重新加载服务器列表
      const { servers: backendServers } = await MCPServers.listServers();
      const backendServer = backendServers.find(s => s.name === serverConfig.name);
      
      const newServer = {
        id: `manual_${Date.now()}`,
        name: serverConfig.name,
        status: backendServer?.running ? "connected" : "error",
        enabled: true,
        type: "manual",
        config: {
          ...serverConfig,
          command: backendConfig.command,
          args: backendConfig.args,
        },
        error: backendServer?.error || null,
      };

      const newServers = [...servers, newServer];
      saveServers(newServers);
      setShowManualModal(false);
      
      // 如果服务器启动失败，显示错误信息
      if (backendServer && !backendServer.running && backendServer.error) {
        showToast(`服务器启动失败: ${backendServer.error}`, "warning");
      }
    } catch (error) {
      console.error("Failed to save MCP config to backend:", error);
      showToast("后端保存失败: " + error.message, "error");
    }
  };

  const updateServer = async (serverId, updates) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;

    try {
      // 构建后端MCP服务器配置格式
      const backendConfig = {
        command: updates.config?.command || server.config?.command || "npx",
        args: (() => {
          // 优先使用更新后的args
          if (updates.config?.args) {
            if (Array.isArray(updates.config.args)) {
              return updates.config.args;
            } else if (typeof updates.config.args === "string" && updates.config.args.trim()) {
              return updates.config.args.trim().split(/\s+/);
            }
          }
          // 否则使用服务器现有配置
          if (server.config?.args) {
            if (Array.isArray(server.config.args)) {
              return server.config.args;
            } else if (typeof server.config.args === "string" && server.config.args.trim()) {
              return server.config.args.trim().split(/\s+/);
            }
          }
          // 默认值
          return [];
        })(),
        env: {
          ...(server.config?.env || {}),
          // 将API Key添加到环境变量中
          ...(updates.config?.apiKey ? { 
            AMAP_MAPS_API_KEY: updates.config.apiKey,
            API_KEY: updates.config.apiKey 
          } : {}),
          ...(updates.config?.webApiKey ? { 
            AMAP_WEB_API_KEY: updates.config.webApiKey,
            WEB_API_KEY: updates.config.webApiKey 
          } : {}),
        },
      };

      // 调用后端API保存配置
      const MCPServers = (await import("@/models/mcpServers")).default;
      const result = await MCPServers.updateServer(server.name, backendConfig);
      
      if (!result.success) {
        showToast("后端保存失败: " + (result.error || "未知错误"), "error");
        return;
      }

      showToast("配置已保存到后端，正在重新加载...", "success");
      
      // 重新加载服务器列表以获取最新状态
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { servers: backendServers } = await MCPServers.listServers();
      const backendServer = backendServers.find(s => s.name === server.name);

      // 更新本地存储
      const newServers = servers.map((s) =>
        s.id === serverId 
          ? { 
              ...s, 
              ...updates,
              status: backendServer?.running ? "connected" : "error",
              error: backendServer?.error || null,
              config: {
                ...s.config,
                ...updates.config,
                command: backendConfig.command,
                args: backendConfig.args,
              },
            } 
          : s
      );
      saveServers(newServers);
      setEditingServer(null);
      
      if (backendServer && !backendServer.running && backendServer.error) {
        showToast(`配置已保存，但服务器启动失败: ${backendServer.error}`, "warning");
      } else {
        showToast("配置已更新", "success");
      }
    } catch (error) {
      console.error("Failed to save MCP config to backend:", error);
      showToast("后端保存失败: " + error.message, "error");
    }
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
  const [apiKey, setApiKey] = useState("");
  const [webApiKey, setWebApiKey] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("请输入服务器名称", "warning");
      return;
    }
    
    // 确保参数格式正确
    let processedArgs = args.trim();
    if (!processedArgs && (name.includes("高德") || name.includes("amap"))) {
      // 高德地图默认参数
      processedArgs = "-y @amap/amap-maps-mcp-server";
    }
    
    onAdd({
      name: name.trim(),
      command: command.trim() || "npx",
      args: processedArgs,
      apiKey: apiKey.trim(),
      webApiKey: webApiKey.trim(),
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

          <div>
            <label className="block text-sm text-white/60 mb-2">
              API Key (可选)
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
              Web API Key (可选)
            </label>
            <input
              type="text"
              value={webApiKey}
              onChange={(e) => setWebApiKey(e.target.value)}
              placeholder="例如: 671a340b83a6c56c1ac80779984ab086"
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-white/40 mt-1">
              用于前端显示的密钥（某些服务需要单独的 Web 端 Key）
            </p>
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
  const [command, setCommand] = useState(server.config?.command || "npx");
  // 处理args - 如果是数组，转换为字符串；如果是字符串，直接使用
  const [args, setArgs] = useState(
    server.config?.args 
      ? (Array.isArray(server.config.args) 
          ? server.config.args.join(" ") 
          : server.config.args)
      : ""
  );
  const [webApiKey, setWebApiKey] = useState(server.config?.webApiKey || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast("请输入服务器名称", "warning");
      return;
    }
    
    // 确保参数格式正确
    let processedArgs = args.trim();
    if (!processedArgs && (name.includes("高德") || name.includes("amap"))) {
      // 高德地图默认参数
      processedArgs = "-y @amap/amap-maps-mcp-server";
    }
    
    onUpdate({
      name: name.trim(),
      config: {
        ...server.config,
        apiKey: apiKey.trim(),
        webApiKey: webApiKey.trim(),
        command: command.trim() || "npx",
        args: processedArgs,
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
