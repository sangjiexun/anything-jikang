import React, { useState, useEffect, useRef } from "react";
import { Brain, CaretDown, Check } from "@phosphor-icons/react";
import System from "@/models/system";
import { useTranslation } from "react-i18next";

// localStorage key for persisting selected model
const LLM_MODEL_STORAGE_KEY = "anythingllm_selected_model";
const LLM_PROVIDER_STORAGE_KEY = "anythingllm_selected_provider";

// Common LLM providers and their display names
const LLM_PROVIDER_NAMES = {
  openai: "OpenAI",
  azure: "Azure OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  lmstudio: "LMStudio",
  localai: "LocalAI",
  ollama: "Ollama",
  togetherai: "Together AI",
  mistral: "Mistral",
  huggingface: "HuggingFace",
  perplexity: "Perplexity AI",
  openrouter: "OpenRouter",
  groq: "Groq",
  koboldcpp: "KoboldCPP",
  textgenwebui: "Text Generation WebUI",
  cohere: "Cohere",
  litellm: "LiteLLM",
  "generic-openai": "Generic OpenAI",
  deepseek: "DeepSeek",
  qwen: "通义千问",
  apipie: "APIpie",
  xai: "xAI",
  novita: "Novita AI",
  ppio: "PPIO",
  native: "AnythingLLM",
  bedrock: "AWS Bedrock",
};

export default function LLMSelectorTop() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [currentModel, setCurrentModel] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const dropdownRef = useRef(null);

  // Load current settings from system and localStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await System.keys();
        const savedProvider = localStorage.getItem(LLM_PROVIDER_STORAGE_KEY);
        const savedModel = localStorage.getItem(LLM_MODEL_STORAGE_KEY);

        // Use saved values or system defaults
        const provider = savedProvider || settings.LLMProvider || "unknown";
        const model = savedModel || settings.LLMModel || "";

        setCurrentProvider(provider);
        setCurrentModel(model);

        // Fetch available models for current provider
        if (provider && provider !== "unknown") {
          await fetchModels(provider);
        }
      } catch (error) {
        console.error("Failed to load LLM settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch available models for a provider
  async function fetchModels(provider) {
    try {
      const { models = [] } = await System.customModels(provider);
      setAvailableModels(
        models.map((model) => ({
          id: typeof model === "string" ? model : model.id,
          name: typeof model === "string" ? model : model.name || model.id,
        }))
      );
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setAvailableModels([]);
    }
  }

  // Handle model selection
  function handleModelSelect(model) {
    setCurrentModel(model.id);
    localStorage.setItem(LLM_MODEL_STORAGE_KEY, model.id);
    setIsOpen(false);
  }

  // Get display name for provider
  function getProviderDisplayName(provider) {
    return LLM_PROVIDER_NAMES[provider] || provider || "未配置";
  }

  // Get short model name for display
  function getShortModelName(model) {
    if (!model) return "未选择模型";
    // Truncate long model names
    if (model.length > 20) {
      return model.substring(0, 17) + "...";
    }
    return model;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-bg-secondary/50">
        <Brain className="w-5 h-5 text-[#d4a85a] animate-pulse" />
        <span className="text-sm text-theme-text-secondary">加载中...</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-theme-bg-secondary/50 hover:bg-theme-bg-secondary
          border border-transparent hover:border-[#d4a85a]/30
          transition-all duration-200 group
          ${isOpen ? "border-[#d4a85a]/50 bg-theme-bg-secondary" : ""}
        `}
      >
        <Brain
          className={`w-5 h-5 transition-colors ${
            isOpen ? "text-[#d4a85a]" : "text-[#d4a85a]/70 group-hover:text-[#d4a85a]"
          }`}
        />
        <div className="flex flex-col items-start">
          <span className="text-xs text-theme-text-secondary">
            {getProviderDisplayName(currentProvider)}
          </span>
          <span className="text-sm text-theme-text-primary font-medium">
            {getShortModelName(currentModel)}
          </span>
        </div>
        <CaretDown
          className={`w-4 h-4 text-theme-text-secondary transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute top-full left-0 mt-2 z-50
            min-w-[280px] max-h-[400px] overflow-y-auto
            bg-theme-bg-primary border border-theme-sidebar-border
            rounded-lg shadow-lg
            animate-fadeIn
          `}
          style={{
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-theme-sidebar-border">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#d4a85a]" />
              <span className="text-sm font-medium text-theme-text-primary">
                选择模型
              </span>
            </div>
            <p className="text-xs text-theme-text-secondary mt-1">
              当前提供商: {getProviderDisplayName(currentProvider)}
            </p>
          </div>

          {/* Model List */}
          <div className="py-2">
            {availableModels.length === 0 ? (
              <div className="px-4 py-3 text-sm text-theme-text-secondary text-center">
                暂无可用模型，请先配置 LLM 提供商
              </div>
            ) : (
              availableModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model)}
                  className={`
                    w-full flex items-center justify-between px-4 py-2
                    hover:bg-theme-bg-secondary transition-colors
                    ${currentModel === model.id ? "bg-theme-bg-secondary/50" : ""}
                  `}
                >
                  <span
                    className={`text-sm truncate ${
                      currentModel === model.id
                        ? "text-[#d4a85a] font-medium"
                        : "text-theme-text-primary"
                    }`}
                    title={model.name}
                  >
                    {model.name}
                  </span>
                  {currentModel === model.id && (
                    <Check className="w-4 h-4 text-[#d4a85a] flex-shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer Hint */}
          <div className="px-4 py-2 border-t border-theme-sidebar-border bg-theme-bg-secondary/30">
            <p className="text-xs text-theme-text-secondary">
              💡 前往设置 → LLM 配置更多提供商
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
