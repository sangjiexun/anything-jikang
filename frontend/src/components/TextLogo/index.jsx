import { Link } from "react-router-dom";
import paths from "@/utils/paths";

export default function TextLogo({ className = "", showSubtitle = true }) {
  return (
    <Link
      to={paths.home()}
      aria-label="Home"
      className={`flex flex-col items-start justify-center ${className}`}
    >
      <span
        className="text-xl font-bold tracking-wide"
        style={{
          background: "linear-gradient(135deg, var(--theme-button-primary) 0%, var(--theme-button-cta) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        极康AI
      </span>
      {showSubtitle && (
        <span className="text-[10px] text-theme-text-secondary mt-[-2px] whitespace-nowrap">
          一款可信、可用、可交换的智能体
        </span>
      )}
    </Link>
  );
}

export function TextLogoCompact() {
  return (
    <Link
      to={paths.home()}
      aria-label="Home"
      className="flex items-center justify-center"
    >
      <span
        className="text-lg font-bold tracking-wide"
        style={{
          background: "linear-gradient(135deg, var(--theme-button-primary) 0%, var(--theme-button-cta) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        极康AI
      </span>
    </Link>
  );
}

export function TextLogoLarge({ className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <span
        className="text-5xl font-bold tracking-wide mb-2"
        style={{
          background: "linear-gradient(135deg, var(--theme-button-primary) 0%, var(--theme-button-cta) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        极康AI
      </span>
      <span className="text-sm text-theme-text-secondary">
        一款可信、可用、可交换的智能体
      </span>
    </div>
  );
}
