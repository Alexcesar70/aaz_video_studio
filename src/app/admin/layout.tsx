import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AAZ Platform · Super Admin',
  description: 'Painel administrativo da plataforma AAZ',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
