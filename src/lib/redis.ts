import { createClient } from 'redis'

let client: ReturnType<typeof createClient> | null = null

export async function getRedis() {
  if (!client) {
    const url = process.env.REDIS_URL
    if (!url) throw new Error('REDIS_URL não configurada')
    client = createClient({ url })
    client.on('error', (err) => console.error('[Redis]', err))
    await client.connect()
  }
  return client
}
