import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AAZ com Jesus · Production Studio',
  description: 'Studio interno de produção de cenas — Seedance 2.0',
  robots: 'noindex, nofollow', // uso interno — não indexar
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#080A0F' }}>
        {children}
      </body>
    </html>
  )
}
