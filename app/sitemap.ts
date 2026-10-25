import type { MetadataRoute } from 'next'
import { ALL_MODULES } from '@/lib/dystopiabench/scenarios'

export const dynamic = "force-static"

export default function sitemap(): MetadataRoute.Sitemap {
    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://dystopiabench.com'
    return [
        {
            url: `${url}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${url}/methodology`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        ...ALL_MODULES.map((module) => ({
            url: `${url}/module/${String(module.id)}`,
            lastModified: new Date(),
            changeFrequency: 'monthly' as const,
            priority: 0.6,
        })),
    ]
}
