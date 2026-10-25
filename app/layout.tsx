import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { SITE_DESCRIPTION, SITE_NAME, SITE_SHORT_DESCRIPTION, SOCIAL_PREVIEW_IMAGE } from '@/lib/dystopiabench/site'
import './globals.css'

// Self-hosted at build time by next/font, so no third-party font requests (CSP-friendly).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'DystopiaBench - AI Ethics Stress Test',
  description: SITE_DESCRIPTION,
  keywords: [
    'AI', 'Artificial Intelligence', 'Benchmark', 'Safety', 'Alignment', 'Ethics',
    'Dystopia', 'LLM', 'Red Teaming', 'Machine Learning', 'AI Alignment'
  ],
  authors: [{ name: 'DystopiaBench Research Team' }],
  creator: 'DystopiaBench Research Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'DystopiaBench - AI Ethics Stress Test',
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DystopiaBench - AI Ethics Stress Test',
    description: SITE_SHORT_DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE.url],
  },
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
      <body className="font-mono antialiased selection:bg-primary/30 selection:text-primary">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
