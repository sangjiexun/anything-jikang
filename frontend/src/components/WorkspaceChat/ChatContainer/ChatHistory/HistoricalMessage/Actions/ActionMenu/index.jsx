import React from "react";
import { Trash, TreeView, ArrowClockwise, PencilLine, Lightning } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function ActionMenu({ chatId, forkThread, isEditing, role, message, onReask }) {
  const { t } = useTranslation();

  const handleFork = () => {
    forkThread(chatId);
  };

  const handleDelete = () => {
    window.dispatchEvent(
      new CustomEvent("delete-message", { detail: { chatId } })
    );
  };

  // 重新提问 - 将当前消息内容发送到输入框
  const handleReask = () => {
    if (onReask && message) {
      onReask(message);
    }
  };

  // 跳转到智能图文工作台 - 将当前消息内容传递过去
  const handleGoToWritingWorkspace = () => {
    // 将消息内容存储到 localStorage，供图文工作台使用
    if (message) {
      localStorage.setItem("writing_workspace_content", message);
    }
    // 触发右侧工具栏打开智能图文工作台
    window.dispatchEvent(
      new CustomEvent("open-writing-workspace", { detail: { content: message } })
    );
  };

  // 加强 - 使用 Agent Skills 重新处理消息
  const handleEnhance = () => {
    if (onReask && message) {
      // 使用 @agent 命令触发 agent 模式，并带上原始消息
      onReask(`@agent ${message}`);
    }
  };

  if (!chatId || isEditing || role === "user") return null;

  return (
    <div className="flex items-center gap-x-2">
      {/* 重新提问按钮 */}
      <div className="mt-3 relative">
        <button
          onClick={handleReask}
          className="border-none text-zinc-300"
          data-tooltip-id="reask-message"
          data-tooltip-content={t("chat_window.reask")}
          aria-label={t("chat_window.reask")}
        >
          <ArrowClockwise
            color="var(--theme-sidebar-footer-icon-fill)"
            size={20}
            className="mb-1"
          />
        </button>
      </div>

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

      {/* 加强按钮 - 使用 Agent Skills */}
      <div className="mt-3 relative">
        <button
          onClick={handleEnhance}
          className="border-none text-zinc-300"
          data-tooltip-id="enhance-message"
          data-tooltip-content={t("chat_window.enhance_tooltip")}
          aria-label={t("chat_window.enhance")}
        >
          <Lightning
            color="var(--theme-sidebar-footer-icon-fill)"
            size={20}
            className="mb-1"
            weight="fill"
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
