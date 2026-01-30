import React from "react";
import { Trash, TreeView, PencilLine } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

function ActionMenu({ chatId, forkThread, isEditing, role, message }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleFork = () => {
    forkThread(chatId);
  };

  const handleDelete = () => {
    window.dispatchEvent(
      new CustomEvent("delete-message", { detail: { chatId } })
    );
  };

  // 跳转到智能图文工作台 - 将当前消息内容传递过去
  const handleGoToWritingWorkspace = () => {
    // 将消息内容存储到 localStorage，供图文工作台使用
    if (message) {
      localStorage.setItem("writing_workspace_content", message);
    }
    // 跳转到智能图文工作台页面
    navigate("/writing-assistant");
  };

  if (!chatId || isEditing || role === "user") return null;

  return (
    <div className="flex items-center gap-x-2">
      {/* 跳转到智能图文工作台按钮 */}
      <div className="mt-3 relative">
        <button
          onClick={handleGoToWritingWorkspace}
          className="border-none text-zinc-300"
          data-tooltip-id="writing-workspace"
          data-tooltip-content={t("chat_window.writing_workspace")}
          aria-label={t("chat_window.writing_workspace")}
        >
          <PencilLine
            color="var(--theme-sidebar-footer-icon-fill)"
            size={20}
            className="mb-1"
          />
        </button>
      </div>

      {/* 分叉按钮 */}
      <div className="mt-3 relative">
        <button
          onClick={handleFork}
          className="border-none text-zinc-300"
          data-tooltip-id="fork-message"
          data-tooltip-content={t("chat_window.fork")}
          aria-label={t("chat_window.fork")}
        >
          <TreeView
            color="var(--theme-sidebar-footer-icon-fill)"
            size={20}
            className="mb-1"
          />
        </button>
      </div>

      {/* 删除按钮 */}
      <div className="mt-3 relative">
        <button
          onClick={handleDelete}
          className="border-none text-zinc-300"
          data-tooltip-id="delete-message"
          data-tooltip-content={t("chat_window.delete")}
          aria-label={t("chat_window.delete")}
        >
          <Trash
            color="var(--theme-sidebar-footer-icon-fill)"
            size={20}
            className="mb-1"
          />
        </button>
      </div>
    </div>
  );
}

export default ActionMenu;
