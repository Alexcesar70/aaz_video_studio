import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Creative Studio · Admin',
  description: 'Painel administrativo da plataforma',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
