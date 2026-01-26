import React from "react";
import PasswordModal, { usePasswordModal } from "@/components/Modals/Password";
import { FullScreenLoader } from "@/components/Preloader";
import Home from "./Home";
import DefaultChatContainer from "@/components/DefaultChat";
import { isMobile } from "react-device-detect";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import RightToolbar from "@/components/RightToolbar";
import { userFromStorage } from "@/utils/request";
import LLMSelectorTop from "@/components/LLMSelector";

export default function Main() {
  const { loading, requiresAuth, mode } = usePasswordModal();

  if (loading) return <FullScreenLoader />;
  if (requiresAuth !== false)
    return <>{requiresAuth !== null && <PasswordModal mode={mode} />}</>;

  const user = userFromStorage();
  return (
    <div className="w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {/* 左上角 LLM 模型选择器 */}
      <div className="fixed top-4 left-4 z-50">
        <LLMSelectorTop />
      </div>

      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div className="flex-1 min-w-0">
        {!!user && user?.role !== "admin" ? <DefaultChatContainer /> : <Home />}
      </div>
      {!isMobile && <RightToolbar />}
    </div>
  );
}
