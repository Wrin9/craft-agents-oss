import codyLogo from "@/assets/cody_logo.svg"

interface CraftAgentsSymbolProps {
  className?: string
}

/**
 * Cody Agent symbol icon — uses the Cody Agent logo
 * (kept as CraftAgentsSymbol for backward compatibility with existing imports)
 */
export function CraftAgentsSymbol({ className }: CraftAgentsSymbolProps) {
  return (
    <img
      src={codyLogo}
      alt="Cody Agent"
      className={className}
    />
  )
}
