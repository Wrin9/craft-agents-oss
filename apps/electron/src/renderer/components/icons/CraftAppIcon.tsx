import codyLogo from "@/assets/cody_logo.svg"

interface CraftAppIconProps {
  className?: string
  size?: number
}

/**
 * CraftAppIcon - Displays the Cody Agent logo
 */
export function CraftAppIcon({ className, size = 64 }: CraftAppIconProps) {
  return (
    <img
      src={codyLogo}
      alt="Cody Agent"
      width={size}
      height={size}
      className={className}
    />
  )
}
