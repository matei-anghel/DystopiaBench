import type { MetadataRoute } from 'next'

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
    const url = process.env.NEXT_PUBLIC_APP_URL || 'https://dystopiabench.com'
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/run',
        },
        sitemap: `${url}/sitemap.xml`,
    }
}
