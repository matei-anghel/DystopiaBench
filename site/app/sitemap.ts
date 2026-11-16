import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site'

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
    ]
}
