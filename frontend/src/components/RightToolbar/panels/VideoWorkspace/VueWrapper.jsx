import React, { useRef, useEffect, useState } from "react";
import { createApp, h } from "vue";

/**
 * React 包装组件，用于在 React 中渲染 Vue 组件
 * 使用 veaury 库实现 React-Vue 混合渲染
 */
export default function VueWrapper({ component: VueComponent, props = {}, onEvent = {} }) {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !VueComponent) return;

    try {
      // 创建 Vue 应用实例
      const app = createApp({
        render() {
          return h(VueComponent, {
            ...props,
            // 转换事件处理器
            ...Object.keys(onEvent).reduce((acc, key) => {
              acc[`on${key.charAt(0).toUpperCase()}${key.slice(1)}`] = onEvent[key];
              return acc;
            }, {}),
          });
        },
      });

      // 提供必要的全局配置（模拟 Nuxt 环境）
      app.provide("runtimeConfig", {
        public: {
          apiBase: window.location.origin + "/api",
        },
      });

      // 挂载 Vue 应用
      app.mount(containerRef.current);
      appRef.current = app;
    } catch (err) {
      console.error("Failed to mount Vue component:", err);
      setError(err.message);
    }

    // 清理函数
    return () => {
      if (appRef.current) {
        try {
          appRef.current.unmount();
        } catch (e) {
          console.warn("Error unmounting Vue app:", e);
        }
        appRef.current = null;
      }
    };
  }, [VueComponent]);

  // 更新 props
  useEffect(() => {
    if (appRef.current) {
      // Vue 会自动响应 props 变化
    }
  }, [props]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <p>加载 Vue 组件失败: {error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
