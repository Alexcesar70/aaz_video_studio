import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Creative Studio',
  description: 'Plataforma multi-tenant de produção audiovisual com IA',
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
