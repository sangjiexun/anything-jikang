import React from "react";
import { Trash, TreeView } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

function ActionMenu({ chatId, forkThread, isEditing, role }) {
  const { t } = useTranslation();

  const handleFork = () => {
    forkThread(chatId);
  };

  const handleDelete = () => {
    window.dispatchEvent(
      new CustomEvent("delete-message", { detail: { chatId } })
    );
  };

  if (!chatId || isEditing || role === "user") return null;

  return (
    <div className="flex items-center gap-x-2">
      {/* 分叉按钮 - 直接显示 */}
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

      {/* 删除按钮 - 直接显示 */}
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
