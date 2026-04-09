import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const PREFIX = 'aaz:char:'

interface LibraryEntry {
  charId: string
  name: string
  emoji: string
  sheetUrl: string
  photos: number
  createdAt: string
}

/**
 * GET /api/library
 * Retorna todos os character sheets salvos no Vercel KV
 */
export async function GET() {
  try {
    const keys = await kv.keys(`${PREFIX}*`)

    if (keys.length === 0) {
      return NextResponse.json({})
    }

    const values = await kv.mget<LibraryEntry[]>(...keys)
    const library: Record<string, LibraryEntry> = {}

    keys.forEach((key, i) => {
      const entry = values[i]
      if (entry) {
        const charId = key.replace(PREFIX, '')
        library[charId] = entry
      }
    })

    return NextResponse.json(library)
  } catch (err) {
    console.error('[/api/library GET]', err)
    return NextResponse.json(
      { error: 'Erro ao carregar biblioteca.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/library
 * Salva um character sheet no Vercel KV
 * Body: LibraryEntry
 */
export async function POST(request: NextRequest) {
  try {
    const entry: LibraryEntry = await request.json()

    if (!entry.charId?.trim()) {
      return NextResponse.json({ error: 'charId é obrigatório.' }, { status: 400 })
    }
    if (!entry.sheetUrl) {
      return NextResponse.json({ error: 'sheetUrl é obrigatório.' }, { status: 400 })
    }

    await kv.set(`${PREFIX}${entry.charId}`, entry)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/library POST]', err)
    return NextResponse.json(
      { error: 'Erro ao salvar na biblioteca.' },
      { status: 500 }
    )
  }
}
