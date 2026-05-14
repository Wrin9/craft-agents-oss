import { useTranslation } from "react-i18next"
import { CraftAgentsSymbol } from "@/components/icons/CraftAgentsSymbol"
import { Brain, Sparkles, Zap, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface WelcomeStepProps {
  onContinue: () => void
  /** Whether this is an existing user updating settings */
  isExistingUser?: boolean
  /** Whether the app is loading (e.g., checking Git Bash on Windows) */
  isLoading?: boolean
}

/**
 * WelcomeStep - Initial welcome screen for onboarding
 *
 * Cody Agent branded welcome with animated logo and feature highlights.
 */
export function WelcomeStep({
  onContinue,
  isExistingUser = false,
  isLoading = false
}: WelcomeStepProps) {
  const { t } = useTranslation()

  const features = [
    {
      icon: Brain,
      title: "Four-Layer Memory",
      description: "Working, episodic, semantic & procedural memory that persists across sessions",
      gradient: "from-violet-500 to-purple-500",
      bgGlow: "bg-violet-500/10",
    },
    {
      icon: Sparkles,
      title: "Continuous Evolution",
      description: "Learns from every interaction, refining skills and knowledge autonomously",
      gradient: "from-blue-500 to-indigo-500",
      bgGlow: "bg-blue-500/10",
    },
    {
      icon: Zap,
      title: "Proactive Thinking",
      description: "Background reasoning that anticipates needs and surfaces insights",
      gradient: "from-cyan-500 to-teal-500",
      bgGlow: "bg-cyan-500/10",
    },
  ]

  return (
    <div className="flex w-full max-w-[32rem] flex-col items-center">
      {/* Hero */}
      <div className="flex flex-col items-center text-center">
        {/* Animated logo */}
        <div className="relative mb-6">
          <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 p-1 shadow-xl ring-1 ring-foreground/5">
            <CraftAgentsSymbol className="size-16" />
          </div>
          {/* Glow */}
          <div className="absolute inset-0 -z-10 animate-pulse rounded-3xl bg-gradient-to-br from-violet-500/25 via-blue-500/25 to-cyan-500/25 blur-2xl" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight">
          {isExistingUser ? t("onboarding.welcome.updateTitle") : t("onboarding.welcome.title")}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-sm leading-relaxed">
          {isExistingUser
            ? t("onboarding.welcome.updateDescription")
            : t("onboarding.welcome.description")}
        </p>
      </div>

      {/* Feature cards */}
      {!isExistingUser && (
        <div className="mt-8 w-full space-y-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={cn(
                "group flex items-start gap-3 rounded-xl p-3 transition-colors",
                "hover:bg-foreground/[0.02]",
              )}
            >
              <div className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                feature.bgGlow,
              )}>
                <feature.icon className="size-4 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{feature.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={onContinue}
        disabled={isLoading}
        className={cn(
          "mt-8 flex w-full max-w-[320px] items-center justify-center gap-2 rounded-xl py-3 px-5",
          "bg-foreground text-background font-medium text-sm",
          "shadow-minimal hover:bg-foreground/90",
          "transition-all active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {isLoading ? (
          <>
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t("common.checking")}
          </>
        ) : (
          <>
            {isExistingUser ? t("onboarding.welcome.continue") : t("onboarding.welcome.getStarted")}
            <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </div>
  )
}
