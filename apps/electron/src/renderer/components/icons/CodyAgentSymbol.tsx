import codyLogo from "@/assets/cody_logo.svg"

interface CodyAgentSymbolProps {
  className?: string
}

/**
 * Cody Agent symbol icon — uses the Cody Agent logo
 */
export function CodyAgentSymbol({ className }: CodyAgentSymbolProps) {
  return (
    <img
      src={codyLogo}
      alt="Cody Agent"
      className={className}
    />
  )
}
