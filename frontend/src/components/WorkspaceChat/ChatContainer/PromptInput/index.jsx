import React, { useState, useRef, useEffect, useCallback } from "react";
import SlashCommandsButton, {
  SlashCommands,
  useSlashCommands,
} from "./SlashCommands";
import debounce from "lodash.debounce";
import { PaperPlaneRight } from "@phosphor-icons/react";
import StopGenerationButton from "./StopGenerationButton";
import AvailableAgentsButton, {
  AvailableAgents,
  useAvailableAgents,
} from "./AgentMenu";
import TextSizeButton from "./TextSizeMenu";
import SpeechToText from "./SpeechToText";
import { Tooltip } from "react-tooltip";
import AttachmentManager from "./Attachments";
import AttachItem from "./AttachItem";
import WorkflowSelector from "./WorkflowSelector";
import {
  ATTACHMENTS_PROCESSED_EVENT,
  ATTACHMENTS_PROCESSING_EVENT,
  PASTE_ATTACHMENT_EVENT,
} from "../DnDWrapper";
import useTextSize from "@/hooks/useTextSize";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import usePromptInputStorage from "@/hooks/usePromptInputStorage";

export const PROMPT_INPUT_ID = "primary-prompt-input";
export const PROMPT_INPUT_EVENT = "set_prompt_input";
const MAX_EDIT_STACK_SIZE = 100;

// 输入框高度持久化的 localStorage key
const PROMPT_INPUT_HEIGHT_KEY = "anythingllm_prompt_input_height";
const DEFAULT_INPUT_HEIGHT = 40; // 默认高度
const MIN_INPUT_HEIGHT = 40; // 最小高度
const MAX_INPUT_HEIGHT = 400; // 最大高度

/**
 * 可拖动的调节条组件 - 光柱效果
 */
function ResizeHandle({ onResize, isDragging }) {
  return (
    <div
      className={`
        w-full h-[6px] cursor-ns-resize flex items-center justify-center
        transition-all duration-200 group
        ${isDragging ? "bg-gradient-to-r from-transparent via-[#d4a85a] to-transparent" : ""}
      `}
      style={{
        background: isDragging
          ? "linear-gradient(90deg, transparent 0%, rgba(212, 168, 90, 0.8) 50%, transparent 100%)"
          : "transparent",
      }}
    >
      {/* 光柱效果 */}
      <div
        className={`
          w-[60px] h-[3px] rounded-full
          transition-all duration-300
          ${isDragging
            ? "bg-gradient-to-r from-[#d4a85a] via-[#f0c674] to-[#d4a85a] shadow-[0_0_12px_rgba(212,168,90,0.8)]"
            : "bg-gradient-to-r from-transparent via-[#d4a85a]/40 to-transparent group-hover:via-[#d4a85a]/80"
          }
        `}
        style={{
          boxShadow: isDragging
            ? "0 0 15px rgba(212, 168, 90, 0.6), 0 0 30px rgba(212, 168, 90, 0.3)"
            : "none",
        }}
      />
    </div>
  );
}

export default function PromptInput({
  submit,
  onChange,
  isStreaming,
  sendCommand,
  attachments = [],
}) {
  const { t } = useTranslation();
  const { isDisabled } = useIsDisabled();
  const [promptInput, setPromptInput] = useState("");
  const { showAgents, setShowAgents } = useAvailableAgents();
  const { showSlashCommand, setShowSlashCommand } = useSlashCommands();
  const formRef = useRef(null);
  const textareaRef = useRef(null);
  const [_, setFocused] = useState(false);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const { textSizeClass } = useTextSize();

  // 输入框高度状态 - 从 localStorage 读取
  const [inputHeight, setInputHeight] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(PROMPT_INPUT_HEIGHT_KEY);
      return saved ? Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, parseInt(saved, 10))) : DEFAULT_INPUT_HEIGHT;
    }
    return DEFAULT_INPUT_HEIGHT;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // 保存高度到 localStorage
  const saveHeight = useCallback((height) => {
    const clampedHeight = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, height));
    localStorage.setItem(PROMPT_INPUT_HEIGHT_KEY, clampedHeight.toString());
  }, []);

  // 拖动开始
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY || e.touches?.[0]?.clientY || 0;
    dragStartHeight.current = inputHeight;
  }, [inputHeight]);

  // 拖动中
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    const currentY = e.clientY || e.touches?.[0]?.clientY || 0;
    const delta = dragStartY.current - currentY; // 向上拖动增加高度
    const newHeight = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, dragStartHeight.current + delta));
    setInputHeight(newHeight);
  }, [isDragging]);

  // 拖动结束
  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      saveHeight(inputHeight);
    }
  }, [isDragging, inputHeight, saveHeight]);

  // 添加全局鼠标/触摸事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Synchronizes prompt input value with localStorage, scoped to the current thread.
  usePromptInputStorage({
    onChange,
    promptInput,
    setPromptInput,
  });

  /**
   * To prevent too many re-renders we remotely listen for updates from the parent
   * via an event cycle. Otherwise, using message as a prop leads to a re-render every
   * change on the input.
   * @param {{detail: {messageContent: string, writeMode: 'replace' | 'append'}}} e
   */
  function handlePromptUpdate(e) {
    const { messageContent, writeMode = "replace" } = e?.detail ?? {};
    if (writeMode === "append") setPromptInput((prev) => prev + messageContent);
    else setPromptInput(messageContent ?? "");
  }

  useEffect(() => {
    if (!!window)
      window.addEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
    return () =>
      window?.removeEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
  }, []);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) textareaRef.current.focus();
    resetTextAreaHeight();
  }, [isStreaming]);

  /**
   * Save the current state before changes
   * @param {number} adjustment
   */
  function saveCurrentState(adjustment = 0) {
    if (undoStack.current.length >= MAX_EDIT_STACK_SIZE)
      undoStack.current.shift();
    undoStack.current.push({
      value: promptInput,
      cursorPositionStart: textareaRef.current.selectionStart + adjustment,
      cursorPositionEnd: textareaRef.current.selectionEnd + adjustment,
    });
  }
  const debouncedSaveState = debounce(saveCurrentState, 250);

  function handleSubmit(e) {
    setFocused(false);
    submit(e);
  }

  function resetTextAreaHeight() {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
  }

  function checkForSlash(e) {
    const input = e.target.value;
    if (input === "/") setShowSlashCommand(true);
    if (showSlashCommand) setShowSlashCommand(false);
    return;
  }
  const watchForSlash = debounce(checkForSlash, 300);

  function checkForAt(e) {
    const input = e.target.value;
    if (input === "@") return setShowAgents(true);
    if (showAgents) return setShowAgents(false);
  }
  const watchForAt = debounce(checkForAt, 300);

  /**
   * Capture enter key press to handle submission, redo, or undo
   * via keyboard shortcuts
   * @param {KeyboardEvent} event
   */
  function captureEnterOrUndo(event) {
    // Is simple enter key press w/o shift key
    if (event.keyCode === 13 && !event.shiftKey) {
      event.preventDefault();
      if (isStreaming || isDisabled) return; // Prevent submission if streaming or disabled
      return submit(event);
    }

    // Is undo with Ctrl+Z or Cmd+Z + Shift key = Redo
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      event.shiftKey
    ) {
      event.preventDefault();
      if (redoStack.current.length === 0) return;

      const nextState = redoStack.current.pop();
      if (!nextState) return;

      undoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(nextState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          nextState.cursorPositionStart,
          nextState.cursorPositionEnd
        );
      }, 0);
    }

    // Undo with Ctrl+Z or Cmd+Z
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "z" &&
      !event.shiftKey
    ) {
      if (undoStack.current.length === 0) return;
      const lastState = undoStack.current.pop();
      if (!lastState) return;

      redoStack.current.push({
        value: promptInput,
        cursorPositionStart: textareaRef.current.selectionStart,
        cursorPositionEnd: textareaRef.current.selectionEnd,
      });
      setPromptInput(lastState.value);
      setTimeout(() => {
        textareaRef.current.setSelectionRange(
          lastState.cursorPositionStart,
          lastState.cursorPositionEnd
        );
      }, 0);
    }
  }

  function adjustTextArea(event) {
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function handlePasteEvent(e) {
    e.preventDefault();
    if (e.clipboardData.items.length === 0) return false;

    // paste any clipboard items that are images.
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }

      // handle files specifically that are not images as uploads
      if (item.kind === "file") {
        const file = item.getAsFile();
        window.dispatchEvent(
          new CustomEvent(PASTE_ATTACHMENT_EVENT, {
            detail: { files: [file] },
          })
        );
        continue;
      }
    }

    const pasteText = e.clipboardData.getData("text/plain");
    if (pasteText) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newPromptInput =
        promptInput.substring(0, start) +
        pasteText +
        promptInput.substring(end);
      setPromptInput(newPromptInput);
      onChange({ target: { value: newPromptInput } });

      // Set the cursor position after the pasted text
      // we need to use setTimeout to prevent the cursor from being set to the end of the text
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + pasteText.length;
        adjustTextArea({ target: textarea });
      }, 0);
    }
    return;
  }

  function handleChange(e) {
    debouncedSaveState(-1);
    onChange(e);
    watchForSlash(e);
    watchForAt(e);
    adjustTextArea(e);
    setPromptInput(e.target.value);
  }

  return (
    <div className="w-full fixed md:absolute bottom-0 left-0 z-10 md:z-0 flex justify-center items-center pwa:pb-5">
      <SlashCommands
        showing={showSlashCommand}
        setShowing={setShowSlashCommand}
        sendCommand={sendCommand}
        promptRef={textareaRef}
      />
      <AvailableAgents
        showing={showAgents}
        setShowing={setShowAgents}
        sendCommand={sendCommand}
        promptRef={textareaRef}
      />
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-y-1 rounded-t-lg md:w-3/4 w-full mx-auto max-w-xl items-center"
      >
        <div className="flex items-center rounded-lg md:mb-4 md:w-full">
          <div 
            className="w-[95vw] md:w-[635px] flex flex-col px-4 py-3 overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, rgba(10, 10, 20, 0.95), rgba(20, 10, 30, 0.95))",
              backdropFilter: "blur(10px)",
              border: "2px solid",
              borderImage: "linear-gradient(45deg, #00ffff, #ffff00) 1",
              borderRadius: "16px",
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 10px rgba(0, 255, 255, 0.1)",
            }}
          >
            {/* 可拖动的调节条 - 黑客风格光柱效果 */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="select-none"
            >
              <ResizeHandle onResize={handleDragMove} isDragging={isDragging} />
            </div>

            <AttachmentManager attachments={attachments} />
            <div className="flex items-center border-b mx-3" style={{ borderColor: "rgba(0, 255, 255, 0.2)" }}>
              <textarea
                id={PROMPT_INPUT_ID}
                ref={textareaRef}
                onChange={handleChange}
                onKeyDown={captureEnterOrUndo}
                onPaste={(e) => {
                  saveCurrentState();
                  handlePasteEvent(e);
                }}
                required={true}
                onFocus={() => setFocused(true)}
                onBlur={(e) => {
                  setFocused(false);
                  adjustTextArea(e);
                }}
                value={promptInput}
                spellCheck={Appearance.get("enableSpellCheck")}
                style={{
                  minHeight: `${inputHeight}px`,
                  maxHeight: `${Math.max(inputHeight, 350)}px`,
                  fontFamily: "'Courier New', monospace",
                }}
                className={`border-none cursor-text mx-2 md:mx-0 pt-[12px] w-full leading-6 text-white bg-transparent placeholder:text-white/50 resize-none active:outline-none focus:outline-none flex-grow mb-1 pwa:!text-[16px] ${textSizeClass}`}
                placeholder={t("chat_window.send_message") || "给AI一个任务，让它在云端自主规划、调用工具，并多步骤为你执行完成..."}
              />
              {isStreaming ? (
                <StopGenerationButton />
              ) : (
                <>
                  <button
                    ref={formRef}
                    type="submit"
                    disabled={isDisabled}
                    className="border-none inline-flex justify-center rounded-2xl cursor-pointer opacity-60 hover:opacity-100 light:opacity-100 light:hover:opacity-60 ml-4 disabled:cursor-not-allowed group"
                    data-tooltip-id="send-prompt"
                    data-tooltip-content={
                      isDisabled
                        ? t("chat_window.attachments_processing")
                        : t("chat_window.send")
                    }
                    aria-label={t("chat_window.send")}
                  >
                    <PaperPlaneRight
                      color="var(--theme-sidebar-footer-icon-fill)"
                      className="w-[22px] h-[22px] pointer-events-none text-theme-text-primary group-disabled:opacity-[25%]"
                      weight="fill"
                    />
                    <span className="sr-only">Send message</span>
                  </button>
                  <Tooltip
                    id="send-prompt"
                    place="bottom"
                    delayShow={300}
                    className="tooltip !text-xs z-99"
                  />
                </>
              )}
            </div>
            <div className="flex justify-between py-3.5 mx-3 mb-1">
              <div className="flex gap-x-2">
                <AttachItem />
                <SlashCommandsButton
                  showing={showSlashCommand}
                  setShowSlashCommand={setShowSlashCommand}
                />
                <AvailableAgentsButton
                  showing={showAgents}
                  setShowAgents={setShowAgents}
                />
                <WorkflowSelector
                  queryText={promptInput}
                  onSelect={(workflow) => {
                    if (workflow) {
                      console.log("Selected workflow:", workflow);
                    }
                  }}
                  onRun={(result) => {
                    if (result?.results) {
                      sendCommand(`工作流执行结果: ${result.results}`);
                      // 清空输入框
                      setPromptInput("");
                    }
                  }}
                />
                <TextSizeButton />
              </div>
              <div className="flex gap-x-2">
                <SpeechToText sendCommand={sendCommand} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Handle event listeners to prevent the send button from being used
 * for whatever reason that may we may want to prevent the user from sending a message.
 */
function useIsDisabled() {
  const [isDisabled, setIsDisabled] = useState(false);

  /**
   * Handle attachments processing and processed events
   * to prevent the send button from being clicked when attachments are processing
   * or else the query may not have relevant context since RAG is not yet ready.
   */
  useEffect(() => {
    if (!window) return;
    window.addEventListener(ATTACHMENTS_PROCESSING_EVENT, () =>
      setIsDisabled(true)
    );
    window.addEventListener(ATTACHMENTS_PROCESSED_EVENT, () =>
      setIsDisabled(false)
    );

    return () => {
      window?.removeEventListener(ATTACHMENTS_PROCESSING_EVENT, () =>
        setIsDisabled(true)
      );
      window?.removeEventListener(ATTACHMENTS_PROCESSED_EVENT, () =>
        setIsDisabled(false)
      );
    };
  }, []);

  return { isDisabled };
}
