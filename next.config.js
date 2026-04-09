/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite body size maior para upload de imagens base64 nas rotas de API
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
  // Headers de segurança
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
    ]
  },
}

module.exports = nextConfig
