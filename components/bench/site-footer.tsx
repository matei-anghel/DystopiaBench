import { TrefoilMark } from "./trefoil-mark"

export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-6 pt-6">
      <p className="ds-label flex items-center gap-2 text-[11px] text-muted-foreground">
        <TrefoilMark size={14} className="text-foreground" />
        <a href="https://mawklabs.com" className="text-foreground underline-offset-2 hover:underline">
          Mawk Labs
        </a>
      </p>
    </footer>
  )
}
