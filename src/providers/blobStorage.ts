/**
 * Blob Storage Provider — implementação Vercel Blob.
 *
 * Abstração de storage — pode ser substituída por S3, R2, etc.
 */

import { put } from '@vercel/blob'
import type { VideoStorage } from '@/domain/videoGeneration'

export class VercelBlobStorage implements VideoStorage {
  async save(buffer: ArrayBuffer, filename: string): Promise<{ url: string; pathname: string }> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN não configurado')
    }
    const blob = await put(filename, Buffer.from(buffer), {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: false,
    })
    return { url: blob.url, pathname: blob.pathname }
  }
}

/** Factory */
export function createVideoStorage(): VideoStorage {
  return new VercelBlobStorage()
}
