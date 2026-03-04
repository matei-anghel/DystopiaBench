import type { MetadataRoute } from 'next'

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
    ]
}
