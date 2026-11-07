import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/dystopiabench/site'
import { ALL_MODULES } from '@/lib/dystopiabench/scenarios'

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
    const url = getSiteUrl()
    return [
        {
            url: `${url}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        ...ALL_MODULES.map((module) => ({
            url: `${url}/module/${String(module.id)}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        })),
    ]
}
