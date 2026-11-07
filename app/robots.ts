import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/dystopiabench/site'

export const dynamic = "force-static"

export default function robots(): MetadataRoute.Robots {
    const url = getSiteUrl()
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/run',
        },
        sitemap: `${url}/sitemap.xml`,
    }
}
