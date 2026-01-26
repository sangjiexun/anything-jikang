import React from "react";
import FlashcardViewer from "@/components/Flashcard/FlashcardViewer";

export default function FlashcardMessage({ props }) {
  const { flashcards } = props;

  if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
    return (
      <div className="p-4 bg-theme-bg-secondary rounded-lg text-white/60 text-center">
        闪卡数据为空
      </div>
    );
  }

  return (
    <div className="w-full my-4">
      <FlashcardViewer flashcards={flashcards} onClose={() => {}} />
    </div>
  );
}
