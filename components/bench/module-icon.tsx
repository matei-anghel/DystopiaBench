import type { Module } from "@/lib/dystopiabench/types"
import {
  Boxes,
  Building2,
  Eye,
  FileSearch,
  Fingerprint,
  FlaskConical,
  HeartPulse,
  Radiation,
} from "lucide-react"

export function renderModuleIcon(module: Module, className: string) {
  if (module === "petrov") return <Radiation className={className} />
  if (module === "orwell") return <Eye className={className} />
  if (module === "laguardia") return <Building2 className={className} />
  if (module === "basaglia") return <HeartPulse className={className} />
  if (module === "huxley") return <FlaskConical className={className} />
  if (module === "kafka") return <FileSearch className={className} />
  if (module === "pkd") return <Fingerprint className={className} />
  return <Boxes className={className} />
}
