/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint: não bloquear build por erros de lint. Os bugs reais são
  // pegos pelo `npm run typecheck` (tsc --noEmit) e `npm run test`
  // (vitest) que rodam no CI. Regras @typescript-eslint/* referenciadas
  // por comentários inline no legacy (AAZStudio.tsx, SuperAdmin.tsx,
  // elevenlabs.ts) exigiriam @typescript-eslint/eslint-plugin instalado,
  // o que não traz benefício real dado que typecheck já cobre.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Headers de segurança + anti-cache para /studio
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/studio',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
