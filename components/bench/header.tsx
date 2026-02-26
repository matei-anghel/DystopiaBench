import Link from "next/link"
import { AlertTriangle, Shield, Database } from "lucide-react"

export function BenchHeader() {
  return (
    <header className="border-b border-border bg-card sticky top-0 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold tracking-wider text-foreground uppercase">
              DystopiaBench
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              AI Ethics Stress Test
            </p>
          </div>
        </Link>
        <nav className="flex items-center gap-1">
          {[
            { href: "/",              label: "Dashboard" },
            { href: "/module/petrov", label: "Petrov"    },
            { href: "/module/orwell", label: "Orwell"    },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground uppercase rounded-md hover:bg-muted/50"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/results"
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs tracking-wide text-muted-foreground transition-colors hover:text-foreground uppercase rounded-md hover:bg-muted/50"
          >
            <Database className="h-3 w-3" />
            Results
          </Link>
          <Link
            href="/run"
            className="ml-2 flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 font-mono text-xs font-medium tracking-wide text-primary transition-colors hover:bg-primary/20 uppercase"
          >
            <AlertTriangle className="h-3 w-3" />
            Run Bench
          </Link>
        </nav>
      </div>
    </header>
  )
}
