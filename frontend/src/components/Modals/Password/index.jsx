import React, { useState, useEffect } from "react";
import System from "../../../models/system";
import SingleUserAuth from "./SingleUserAuth";
import MultiUserAuth from "./MultiUserAuth";
import {
  AUTH_TOKEN,
  AUTH_USER,
  AUTH_TIMESTAMP,
} from "../../../utils/constants";
import illustration from "@/media/illustrations/login-illustration.svg";
import { TextLogoLarge } from "@/components/TextLogo";

export default function PasswordModal({ mode = "single" }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] h-full bg-theme-bg-primary flex flex-col md:flex-row items-center justify-center">
      <div
        style={{
          background: `
    radial-gradient(circle at center, transparent 40%, black 100%),
    linear-gradient(180deg, #85F8FF 0%, #65A6F2 100%)
  `,
          width: "575px",
          filter: "blur(150px)",
          opacity: "0.4",
        }}
        className="absolute left-0 top-0 z-0 h-full w-full"
      />
      <div className="hidden md:flex md:w-1/2 md:h-full md:items-center md:justify-center">
        <img
          className="w-full h-full object-contain z-50"
          src={illustration}
          alt="login illustration"
        />
      </div>
      <div className="flex flex-col items-center justify-center h-full w-full md:w-1/2 z-50 relative md:-mt-20 mt-0 !border-none bg-theme-bg-secondary md:bg-transparent">
        <div
          className={`hidden relative md:flex rounded-2xl w-fit m-4 z-30 ${
            mode === "single" ? "md:top-2" : "md:top-12"
          }`}
        >
          <TextLogoLarge />
        </div>
        {mode === "single" ? <SingleUserAuth /> : <MultiUserAuth />}
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
