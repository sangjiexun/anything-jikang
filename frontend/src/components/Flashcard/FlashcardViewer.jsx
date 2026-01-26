import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, RotateCw } from "@phosphor-icons/react";
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

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;

    // 简单的答案检查（可以后续改进为更智能的匹配）
    const correct = currentCard.answer
      .toLowerCase()
      .includes(userAnswer.toLowerCase()) ||
      userAnswer.toLowerCase().includes(currentCard.answer.toLowerCase());

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
                <h3 className="text-xl font-semibold text-white mb-4">题目</h3>
                <div className="text-white text-lg mb-6 min-h-[100px]">
                  {currentCard.question}
                </div>

                <div className="mt-6">
                  <label className="block text-sm text-white/60 mb-2">你的答案</label>
                  <textarea
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="在此输入你的答案..."
                    className="w-full px-4 py-3 bg-theme-bg-primary border border-theme-sidebar-border rounded-lg text-white focus:outline-none focus:border-blue-500 min-h-[120px]"
                    disabled={showResult}
                  />
                </div>
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
                    disabled={!userAnswer.trim()}
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
                      <RotateCw className="w-4 h-4" />
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
                  <RotateCw className="w-4 h-4" />
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
