import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Key, Monitor, Sparkles, Brain, Zap } from "lucide-react"
import { StepFormLayout } from "./primitives"
import { CraftAgentsSymbol } from "@/components/icons/CraftAgentsSymbol"

import claudeIcon from "@/assets/provider-icons/claude.svg"
import openaiIcon from "@/assets/provider-icons/openai.svg"
import copilotIcon from "@/assets/provider-icons/copilot.svg"

/**
 * The high-level provider choice the user makes on first launch.
 * This maps to one or more ApiSetupMethods downstream.
 */
export type ProviderChoice = 'claude' | 'chatgpt' | 'copilot' | 'api_key' | 'local'

interface ProviderOption {
  id: ProviderChoice
  name: string
  description: string
  icon: React.ReactNode
}

const PROVIDER_ICONS: Record<ProviderChoice, React.ReactNode> = {
  claude: <img src={claudeIcon} alt="" className="size-5 rounded-[3px]" />,
  chatgpt: <img src={openaiIcon} alt="" className="size-5 rounded-[3px]" />,
  copilot: <img src={copilotIcon} alt="" className="size-5 rounded-[3px]" />,
  api_key: <Key className="size-5" />,
  local: <Monitor className="size-5" />,
}

interface ProviderSelectStepProps {
  /** Called when the user selects a provider */
  onSelect: (choice: ProviderChoice) => void
  /** Called when the user chooses to skip setup */
  onSkip?: () => void
}

/**
 * ProviderSelectStep — First screen after install.
 *
 * Cody Agent branded onboarding with cognitive features highlight.
 */
export function ProviderSelectStep({ onSelect, onSkip }: ProviderSelectStepProps) {
  const { t } = useTranslation()

  const PROVIDER_OPTIONS: ProviderOption[] = [
    {
      id: 'claude',
      name: t("onboarding.providerSelect.claudeProMax"),
      description: t("onboarding.providerSelect.claudeProMaxDesc"),
      icon: PROVIDER_ICONS.claude,
    },
    {
      id: 'chatgpt',
      name: t("onboarding.providerSelect.codexChatGPT"),
      description: t("onboarding.providerSelect.codexChatGPTDesc"),
      icon: PROVIDER_ICONS.chatgpt,
    },
    {
      id: 'copilot',
      name: t("onboarding.providerSelect.githubCopilot"),
      description: t("onboarding.providerSelect.githubCopilotDesc"),
      icon: PROVIDER_ICONS.copilot,
    },
    {
      id: 'api_key',
      name: t("onboarding.providerSelect.otherProvider"),
      description: 'Anthropic, AWS Bedrock, OpenRouter, Google or any compatible provider — powered by Cody Agent.',
      icon: PROVIDER_ICONS.api_key,
    },
    {
      id: 'local',
      name: t("onboarding.providerSelect.localModel"),
      description: 'Run local models with Ollama — full offline cognitive capabilities.',
      icon: PROVIDER_ICONS.local,
    },
  ]

  return (
    <div className="flex w-full max-w-[36rem] flex-col items-center">
      {/* Hero section */}
      <div className="mb-8 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="relative mb-5">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 p-1 shadow-lg ring-1 ring-foreground/5">
            <CraftAgentsSymbol className="size-14" />
          </div>
          {/* Animated glow ring */}
          <div className="absolute inset-0 -z-10 animate-pulse rounded-2xl bg-gradient-to-br from-violet-500/20 via-blue-500/20 to-cyan-500/20 blur-xl" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight">
          {t("onboarding.providerSelect.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {t("onboarding.providerSelect.description")}
        </p>

        {/* Feature pills */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
            <Brain className="size-3" />
            Cognitive Memory
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
            <Sparkles className="size-3" />
            Self-Evolution
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
            <Zap className="size-3" />
            Proactive Thinking
          </span>
        </div>
      </div>

      {/* Provider cards */}
      <div className="w-full space-y-2">
        {PROVIDER_OPTIONS.map((option, index) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all",
              "sm:items-start sm:gap-4 sm:p-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "hover:bg-foreground/[0.03]",
              // Subtle gradient border effect
              "border border-transparent hover:border-foreground/[0.06]",
              "hover:shadow-sm",
            )}
          >
            {/* Icon */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
              {option.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">{option.name}</span>
              <p className="mt-0.5 hidden sm:block text-xs text-muted-foreground leading-relaxed">
                {option.description}
              </p>
            </div>

            {/* Chevron */}
            <svg
              className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        ))}
      </div>

      {/* Skip */}
      {onSkip && (
        <div className="mt-6 text-center">
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("onboarding.providerSelect.setupLater")}
          </button>
        </div>
      )}
    </div>
  )
}
