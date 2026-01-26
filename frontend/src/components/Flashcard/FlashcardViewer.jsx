import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, ArrowClockwise } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

export default function FlashcardViewer({ flashcards, onClose }) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [answeredCards, setAnsweredCards] = useState(new Set());

  const currentCard = flashcards[currentIndex];
  const [selectedOptions, setSelectedOptions] = useState([]);

  // 重置选择状态
  useEffect(() => {
    if (currentCard) {
      setUserAnswer("");
      setSelectedOptions([]);
      setShowResult(false);
    }
  }, [currentIndex, currentCard]);

  const handleOptionSelect = (optionIndex) => {
    if (currentCard.type === "multiple_choice") {
      // 单选题：直接选择
      setSelectedOptions([optionIndex]);
      setUserAnswer(currentCard.options[optionIndex]);
    } else if (currentCard.type === "multiple_select") {
      // 多选题：切换选择
      setSelectedOptions((prev) => {
        if (prev.includes(optionIndex)) {
          return prev.filter((i) => i !== optionIndex);
        } else {
          return [...prev, optionIndex];
        }
      });
    }
  };

  const handleSubmit = () => {
    if (!currentCard) return;

    let correct = false;

    // 根据题目类型判断答案
    if (currentCard.type === "multiple_choice") {
      // 单选题
      if (selectedOptions.length === 1) {
        const selectedIndex = selectedOptions[0];
        correct = selectedIndex === currentCard.answerIndex;
      }
    } else if (currentCard.type === "multiple_select") {
      // 多选题
      const correctIndices = currentCard.answerIndex || [];
      const selectedSet = new Set(selectedOptions);
      const correctSet = new Set(correctIndices);
      correct =
        selectedSet.size === correctSet.size &&
        [...selectedSet].every((i) => correctSet.has(i));
    } else if (currentCard.type === "true_false") {
      // 判断题
      correct = userAnswer.toLowerCase() === currentCard.answer.toLowerCase();
    } else if (currentCard.type === "fill_blank") {
      // 填空题：模糊匹配
      const answerLower = currentCard.answer.toLowerCase();
      const userAnswerLower = userAnswer.toLowerCase();
      correct =
        answerLower.includes(userAnswerLower) ||
        userAnswerLower.includes(answerLower) ||
        answerLower === userAnswerLower;
    } else {
      // 简答题：模糊匹配（兼容旧格式）
      const answerLower = (currentCard.answer || "").toLowerCase();
      const userAnswerLower = userAnswer.toLowerCase();
      correct =
        answerLower.includes(userAnswerLower) ||
        userAnswerLower.includes(answerLower);
    }

    setIsCorrect(correct);
    setShowResult(true);
    setAnsweredCards((prev) => new Set([...prev, currentIndex]));

    // 延迟翻转
    setTimeout(() => {
      setIsFlipped(true);
    }, 500);
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setUserAnswer("");
      setShowResult(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setUserAnswer("");
      setShowResult(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  if (!currentCard) {
    return (
      <div className="p-4 bg-theme-bg-primary rounded-lg text-white text-center">
        <p>没有闪卡数据</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          关闭
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* 进度指示 */}
      <div className="mb-4 flex items-center justify-between text-white/60 text-sm">
        <span>
          题目 {currentIndex + 1} / {flashcards.length}
        </span>
        <span>
          已答 {answeredCards.size} / {flashcards.length}
        </span>
      </div>

      {/* 闪卡容器 */}
      <div className="relative" style={{ perspective: "1000px" }}>
        <div
          className="relative w-full h-[500px] transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* 正面 - 答题界面 */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
              display: isFlipped ? "none" : "block",
            }}
          >
            <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl p-8 h-full flex flex-col">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-xl font-semibold text-white">题目</h3>
                  {currentCard.type && (
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                      {currentCard.type === "multiple_choice"
                        ? "单选题"
                        : currentCard.type === "multiple_select"
                        ? "多选题"
                        : currentCard.type === "fill_blank"
                        ? "填空题"
                        : currentCard.type === "true_false"
                        ? "判断题"
                        : "题目"}
                    </span>
                  )}
                </div>
                <div className="text-white text-lg mb-6 min-h-[100px]">
                  {currentCard.question}
                </div>

                {/* 选择题选项 */}
                {(currentCard.type === "multiple_choice" ||
                  currentCard.type === "multiple_select") &&
                  currentCard.options && (
                    <div className="mt-6 space-y-2">
                      <label className="block text-sm text-white/60 mb-2">
                        选择答案
                        {currentCard.type === "multiple_select" && "（可多选）"}
                      </label>
                      {currentCard.options.map((option, index) => {
                        const isSelected = selectedOptions.includes(index);
                        return (
                          <button
                            key={index}
                            onClick={() => handleOptionSelect(index)}
                            disabled={showResult}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-blue-500/20 border-blue-500 text-blue-300"
                                : "bg-theme-bg-primary border-theme-sidebar-border text-white hover:border-blue-500/50"
                            } ${showResult ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                          >
                            <span className="font-medium mr-2">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}

                {/* 判断题选项 */}
                {currentCard.type === "true_false" && (
                  <div className="mt-6 space-y-2">
                    <label className="block text-sm text-white/60 mb-2">
                      选择答案
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setUserAnswer("true")}
                        disabled={showResult}
                        className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                          userAnswer === "true"
                            ? "bg-green-500/20 border-green-500 text-green-300"
                            : "bg-theme-bg-primary border-theme-sidebar-border text-white hover:border-green-500/50"
                        } ${showResult ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        正确
                      </button>
                      <button
                        onClick={() => setUserAnswer("false")}
                        disabled={showResult}
                        className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                          userAnswer === "false"
                            ? "bg-red-500/20 border-red-500 text-red-300"
                            : "bg-theme-bg-primary border-theme-sidebar-border text-white hover:border-red-500/50"
                        } ${showResult ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        错误
                      </button>
                    </div>
                  </div>
                )}

                {/* 填空题或简答题输入 */}
                {(currentCard.type === "fill_blank" ||
                  !currentCard.type ||
                  (!currentCard.options && currentCard.type !== "true_false")) && (
                  <div className="mt-6">
                    <label className="block text-sm text-white/60 mb-2">你的答案</label>
                    <textarea
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder={
                        currentCard.type === "fill_blank"
                          ? "在此输入填空内容..."
                          : "在此输入你的答案..."
                      }
                      className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500 min-h-[120px]"
                      disabled={showResult}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-bg-primary text-white rounded-lg hover:bg-theme-action-menu-item-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  上一题
                </button>

                {!showResult ? (
                  <button
                    onClick={handleSubmit}
                    disabled={
                      (currentCard.type === "multiple_choice" ||
                        currentCard.type === "multiple_select") &&
                      selectedOptions.length === 0
                        ? true
                        : currentCard.type === "true_false" && !userAnswer
                        ? true
                        : (currentCard.type === "fill_blank" || !currentCard.type) &&
                          !userAnswer.trim()
                    }
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    提交答案
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" />
                        <span>回答正确！</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-400">
                        <XCircle className="w-5 h-5" />
                        <span>回答错误</span>
                      </div>
                    )}
                    <button
                      onClick={handleFlip}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                    >
                      <ArrowClockwise className="w-4 h-4" />
                      查看答案
                    </button>
                  </div>
                )}

                <button
                  onClick={handleNext}
                  disabled={currentIndex === flashcards.length - 1}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-bg-primary text-white rounded-lg hover:bg-theme-action-menu-item-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一题
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* 背面 - 答案和引用 */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              display: !isFlipped ? "none" : "block",
            }}
          >
            <div className="bg-theme-bg-secondary border border-theme-sidebar-border rounded-xl p-8 h-full flex flex-col">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-4">答案</h3>
                <div className="text-white text-lg mb-6 min-h-[100px]">
                  {currentCard.answer}
                </div>

                {currentCard.explanation && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-white/80 mb-2">解释</h4>
                    <div className="text-white/70 text-sm bg-theme-bg-primary rounded-lg p-4">
                      {currentCard.explanation}
                    </div>
                  </div>
                )}

                {currentCard.reference && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-white/80 mb-2">引用位置</h4>
                    <div className="text-white/70 text-sm bg-theme-bg-primary rounded-lg p-4">
                      <p className="font-medium">{currentCard.reference.document}</p>
                      {currentCard.reference.page && (
                        <p className="text-xs mt-1">页码: {currentCard.reference.page}</p>
                      )}
                      {currentCard.reference.section && (
                        <p className="text-xs mt-1">章节: {currentCard.reference.section}</p>
                      )}
                      {currentCard.reference.excerpt && (
                        <p className="text-xs mt-2 italic border-l-2 border-blue-500 pl-2">
                          {currentCard.reference.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-bg-primary text-white rounded-lg hover:bg-theme-action-menu-item-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  上一题
                </button>

                <button
                  onClick={handleFlip}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
                >
                  <ArrowClockwise className="w-4 h-4" />
                  返回题目
                </button>

                <button
                  onClick={handleNext}
                  disabled={currentIndex === flashcards.length - 1}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-bg-primary text-white rounded-lg hover:bg-theme-action-menu-item-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一题
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
