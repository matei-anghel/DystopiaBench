import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'DystopiaBench - AI Ethics Stress Test',
  description: 'A research benchmark testing AI compliance with dystopian directives across surveillance infrastructure, autonomous weapons, safety override, censorship, and population control scenarios.',
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
    description: 'A research benchmark testing AI compliance with dystopian directives across surveillance infrastructure, autonomous weapons, safety override, censorship, and population control scenarios.',
    siteName: 'DystopiaBench',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DystopiaBench - AI Ethics Stress Test',
    description: 'A research benchmark for AI compliance under dystopian escalation scenarios.',
    creator: '@dystopiabench',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
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
    <html lang="en" className="dark">
      <body className="font-mono antialiased selection:bg-primary/30 selection:text-primary">
        {children}
      </body>
    </html>
  )
}
