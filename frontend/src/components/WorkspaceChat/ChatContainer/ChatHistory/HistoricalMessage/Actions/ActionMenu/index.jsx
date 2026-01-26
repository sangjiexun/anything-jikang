import React, { useState, useEffect } from "react";
import { Trash, TreeView, ArrowClockwise, PencilLine, Lightning, X } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import showToast from "@/utils/toast";

function ActionMenu({ chatId, forkThread, isEditing, role, message, onReask, workspace }) {
  const { t } = useTranslation();
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);

  const handleFork = () => {
    forkThread(chatId);
  };

  const handleDelete = () => {
    window.dispatchEvent(
      new CustomEvent("delete-message", { detail: { chatId } })
    );
  };

  // 重新提问 - 将当前消息内容发送到输入框并自动提交
  const handleReask = () => {
    if (onReask && message) {
      // 确保自动提交
      onReask(message, true);
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
      onReask(`@agent ${message}`, true);
    }
  };

  // 创建问答闪卡
  const handleCreateFlashcard = () => {
    setShowFlashcardModal(true);
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

      {/* 创建问答闪卡按钮 */}
      <div className="mt-3 relative">
        <button
          onClick={handleCreateFlashcard}
          className="border-none text-zinc-300"
          data-tooltip-id="flashcard-message"
          data-tooltip-content={t("chat_window.create_flashcard")}
          aria-label={t("chat_window.create_flashcard")}
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

      {/* 闪卡创建弹窗 */}
      {showFlashcardModal && (
        <FlashcardCreateModal
          workspace={workspace}
          message={message}
          onClose={() => setShowFlashcardModal(false)}
        />
      )}
    </div>
  );
}

// 闪卡创建弹窗组件
function FlashcardCreateModal({ workspace, message, onClose }) {
  const { t } = useTranslation();
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("medium");
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKBs, setLoadingKBs] = useState(true);

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    setLoadingKBs(true);
    try {
      const { API_BASE } = await import("@/utils/constants");
      const { baseHeaders } = await import("@/utils/request");
      const response = await fetch(`${API_BASE}/knowledge-bases?myAccess=true`, {
        headers: baseHeaders(),
      });
      
      if (!response.ok) {
        // 如果API不存在，静默失败，允许不选择知识库的模式
        console.warn("知识库API不可用，将使用基于消息内容的模式");
        setKnowledgeBases([]);
        return;
      }
      
      const result = await response.json();
      if (result.success && result.data) {
        setKnowledgeBases(result.data);
        // 加载每个知识库的文档
        for (const kb of result.data) {
          await loadDocuments(kb.id);
        }
      }
    } catch (error) {
      console.error("加载知识库失败:", error);
      // 静默失败，允许不选择知识库的模式
      setKnowledgeBases([]);
    } finally {
      setLoadingKBs(false);
    }
  };

  const loadDocuments = async (kbId) => {
    try {
      const { API_BASE } = await import("@/utils/constants");
      const { baseHeaders } = await import("@/utils/request");
      const response = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents`, {
        headers: baseHeaders(),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setKnowledgeBases((prev) =>
          prev.map((kb) =>
            kb.id === kbId
              ? { ...kb, documents: result.data.documents || [] }
              : kb
          )
        );
      }
    } catch (error) {
      console.error(`加载知识库 ${kbId} 文档失败:`, error);
    }
  };

  const toggleDocument = (kbId, docId) => {
    setSelectedDocs((prev) => {
      const key = `${kbId}-${docId}`;
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { API_BASE } = await import("@/utils/constants");
      const { baseHeaders } = await import("@/utils/request");
      
      const difficultyMap = {
        easy: "简单（基础概念和定义）",
        medium: "中等（需要理解和应用）",
        hard: "困难（需要分析和综合）",
      };
      
      let allContent = "";
      let references = [];
      let prompt = "";
      
      // 判断模式：有选择知识库文档 vs 无知识库（基于当前消息）
      if (selectedDocs.length > 0) {
        // 模式2：结合知识库的强化学习闪卡
        showToast("正在从知识库检索内容...", "info");
        
        // 获取选中的文档信息
        const selectedDocuments = [];
        knowledgeBases.forEach((kb) => {
          kb.documents?.forEach((doc) => {
            if (selectedDocs.includes(`${kb.id}-${doc.id}`)) {
              selectedDocuments.push({
                ...doc,
                knowledgeBaseId: kb.id,
                knowledgeBaseName: kb.name,
              });
            }
          });
        });

        // 检索所有选中文档的内容
        for (const doc of selectedDocuments) {
          try {
            // 使用向量搜索获取相关内容
            const searchResponse = await fetch(
              `${API_BASE}/vector-search/knowledge-bases/${doc.knowledgeBaseId}/search`,
              {
                method: "POST",
                headers: baseHeaders(),
                body: JSON.stringify({
                  query: doc.file_name || doc.title || "",
                  topK: 5,
                  threshold: 0.3,
                  includeMetadata: true,
                }),
              }
            );

            if (searchResponse.ok) {
              const searchResult = await searchResponse.json();
              const results = searchResult.data?.results || searchResult.results || [];
              
              if (results.length > 0) {
                const content = results.map((r) => r.content || r.preview || "").join("\n\n");
                allContent += `\n\n--- 文档: ${doc.file_name || doc.title} ---\n${content}`;
                
                references.push({
                  document: doc.file_name || doc.title,
                  knowledgeBase: doc.knowledgeBaseName,
                  chunks: results.map((r) => ({
                    content: r.content || r.preview || "",
                    score: r.score || r.similarity || 0,
                  })),
                });
              }
            }
          } catch (error) {
            console.error(`检索文档 ${doc.id} 失败:`, error);
          }
        }

        if (!allContent.trim()) {
          showToast("未能从知识库检索到内容", "warning");
          setLoading(false);
          return;
        }
        
        // 结合当前消息和知识库内容
        prompt = `基于以下AI回答内容和知识库内容，生成 ${questionCount} 道${difficultyMap[difficulty]}难度的强化学习问答题目。

要求：
1. 题目应该结合AI回答的核心观点和知识库的详细内容
2. 每道题目包含：问题、答案、解释、引用位置
3. 难度级别：${difficultyMap[difficulty]}
4. 返回JSON格式

AI回答内容：
${message || "无"}

知识库内容：
${allContent.substring(0, 8000)}`;
      } else {
        // 模式1：基于当前消息内容的闪卡
        if (!message || !message.trim()) {
          showToast("当前消息内容为空，无法生成闪卡", "warning");
          setLoading(false);
          return;
        }
        
        prompt = `基于以下AI回答内容，生成 ${questionCount} 道${difficultyMap[difficulty]}难度的问答题目。

要求：
1. 题目应该覆盖回答的核心内容
2. 每道题目包含：问题、答案、解释
3. 难度级别：${difficultyMap[difficulty]}
4. 返回JSON格式

AI回答内容：
${message.substring(0, 8000)}`;
      }

      // 调用LLM生成题目
      showToast("正在生成题目...", "info");
      
      // 获取LLM配置
      let llmConfig = {
        endpoint: "https://api.deepseek.com",
        apiKey: "",
        model: "deepseek-chat",
      };
      
      try {
        const savedConfig = localStorage.getItem("workflow_llm_config");
        if (savedConfig) {
          llmConfig = { ...llmConfig, ...JSON.parse(savedConfig) };
        }
      } catch (e) {
        console.error("加载LLM配置失败:", e);
      }

      if (!llmConfig.apiKey) {
        showToast("请先配置LLM API Key", "warning");
        setLoading(false);
        return;
      }

      // 构建完整的prompt（已在上面定义）
      const fullPrompt = prompt + `

返回JSON格式，格式如下：
{
  "flashcards": [
    {
      "question": "问题内容",
      "answer": "答案内容",
      "explanation": "详细解释",
      "reference": {
        "document": "文档名称或来源",
        "excerpt": "引用片段（可选）",
        "page": "页码（如果有）",
        "section": "章节（如果有）"
      }
    }
  ]
}`;

      const llmResponse = await fetch(`${llmConfig.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: [
            {
              role: "system",
              content: selectedDocs.length > 0 
                ? "你是一个专业的题目生成助手，能够根据AI回答和知识库内容生成高质量的强化学习问答题目。请严格按照JSON格式返回结果。"
                : "你是一个专业的题目生成助手，能够根据AI回答内容生成高质量的问答题目。请严格按照JSON格式返回结果。",
            },
            { role: "user", content: fullPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!llmResponse.ok) {
        throw new Error(`LLM API请求失败: ${llmResponse.status}`);
      }

      const llmResult = await llmResponse.json();
      const responseText = llmResult.choices?.[0]?.message?.content || "";

      // 解析JSON响应
      let flashcards = [];
      try {
        // 尝试提取JSON部分
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          flashcards = parsed.flashcards || [];
        } else {
          throw new Error("无法解析JSON响应");
        }
      } catch (parseError) {
        console.error("解析题目失败:", parseError);
        // 如果解析失败，尝试手动生成示例题目
        flashcards = [
          {
            question: "请根据知识库内容回答这个问题",
            answer: "答案需要从知识库中提取",
            explanation: "这是基于知识库内容生成的题目",
            reference: {
              document: selectedDocuments[0]?.file_name || "未知文档",
            },
          },
        ];
      }

      if (flashcards.length === 0) {
        showToast("未能生成题目，请重试", "warning");
        return;
      }

      // 保存闪卡数据并添加到聊天历史
      const flashcardData = {
        flashcards,
        config: {
          questionCount,
          difficulty,
          selectedDocs,
        },
        references,
      };

      // 触发闪卡添加到聊天历史事件
      window.dispatchEvent(
        new CustomEvent("add-flashcard-to-chat", { 
          detail: {
            type: "flashcard",
            flashcards: flashcards,
            content: `已生成 ${flashcards.length} 道${difficultyMap[difficulty]}难度的问答题目`,
            role: "assistant",
          }
        })
      );

      onClose();
      showToast(`成功生成 ${flashcards.length} 道题目`, "success");
    } catch (error) {
      console.error("创建闪卡失败:", error);
      showToast("创建闪卡失败: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl w-[600px] max-w-[90vw] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-theme-sidebar-border sticky top-0 bg-theme-bg-secondary z-10">
          <h2 className="text-lg font-semibold text-white">创建问答闪卡</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 题目数量 */}
          <div>
            <label className="block text-sm text-white/60 mb-2">题目数量</label>
            <input
              type="number"
              min="1"
              max="50"
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value) || 10)}
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 难度选择 */}
          <div>
            <label className="block text-sm text-white/60 mb-2">难度</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>

          {/* 知识库文档选择（可选） */}
          <div>
            <label className="block text-sm text-white/60 mb-2">
              关联知识库文档（可选，不选择则基于当前回答生成闪卡）
            </label>
            {loadingKBs ? (
              <div className="text-white/60 text-center py-4">加载中...</div>
            ) : knowledgeBases.length === 0 ? (
              <div className="text-white/60 text-center py-4 text-xs">
                暂无知识库，将基于当前回答内容生成闪卡
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="border border-theme-sidebar-border rounded-lg p-3">
                    <div className="font-medium text-white mb-2">{kb.name}</div>
                    {kb.documents && kb.documents.length > 0 ? (
                      <div className="space-y-1">
                        {kb.documents.map((doc) => {
                          const key = `${kb.id}-${doc.id}`;
                          const isSelected = selectedDocs.includes(key);
                          return (
                            <label
                              key={doc.id}
                              className="flex items-center gap-2 p-2 hover:bg-theme-bg-primary rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDocument(kb.id, doc.id)}
                                className="w-4 h-4"
                              />
                              <span className="text-sm text-white/80">
                                {doc.file_name || doc.title || "未命名文档"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-white/40 text-sm">暂无文档</div>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              type="button"
              onClick={handleCreate}
              disabled={loading || !message?.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "创建中..." : selectedDocs.length > 0 ? "创建强化学习闪卡" : "创建闪卡"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActionMenu;
