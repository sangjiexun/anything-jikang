import React, { useState, useEffect } from "react";
import System from "../../../models/system";
import SingleUserAuth from "./SingleUserAuth";
import MultiUserAuth from "./MultiUserAuth";
import LoginLeftPanel from "./LoginLeftPanel";
import {
  AUTH_TOKEN,
  AUTH_USER,
  AUTH_TIMESTAMP,
} from "../../../utils/constants";
import { TextLogoLarge } from "@/components/TextLogo";

export default function PasswordModal({ mode = "single" }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden overflow-y-auto md:inset-0 h-full bg-[#050505] flex flex-col md:flex-row">
      {/* 左侧面板 - 文字轮播和网格波浪动画 */}
      <LoginLeftPanel />

      {/* 右侧面板 - 登录表单 */}
      <div className="flex flex-col items-center justify-center h-full w-full md:w-1/2 z-50 relative bg-[#0a0a0a]">
        {/* 移动端 Logo */}
        <div className="md:hidden flex items-center justify-center py-8">
          <TextLogoLarge />
        </div>

        {/* 登录表单容器 */}
        <div className="w-full max-w-md px-8">
          {mode === "single" ? <SingleUserAuth /> : <MultiUserAuth />}
        </div>
      </div>
    </div>
  );
}

export function usePasswordModal(notry = false) {
  const [auth, setAuth] = useState({
    loading: true,
    requiresAuth: false,
    mode: "single",
  });

  useEffect(() => {
    async function checkAuthReq() {
      if (!window) return;

      // 获取当前 token
      const currentToken = window.localStorage.getItem(AUTH_TOKEN);

      // 如果没有 token，直接要求登录（强制登录模式）
      if (!currentToken) {
        setAuth({
          loading: false,
          requiresAuth: true,
          mode: "multi", // 默认使用多用户登录模式
        });
        return;
      }

      // 如果有 token，验证其有效性
      const valid = notry ? false : await System.checkAuth(currentToken);
      if (!valid) {
        setAuth({
          loading: false,
          requiresAuth: true,
          mode: "multi",
        });
        window.localStorage.removeItem(AUTH_USER);
        window.localStorage.removeItem(AUTH_TOKEN);
        window.localStorage.removeItem(AUTH_TIMESTAMP);
        return;
      }

      // Token 有效，不需要登录
      setAuth({
        loading: false,
        requiresAuth: false,
        mode: "multi",
      });
    }
    checkAuthReq();
  }, []);

  return auth;
}
