import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Referent AI',
  description: 'Референт AI‑помощник для английских статей',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="h-full bg-slate-950">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  )
}

