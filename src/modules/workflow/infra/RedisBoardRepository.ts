import { getRedis } from '@/lib/redis'
import type { Board } from '../domain/Board'
import type { BoardRepository } from '../ports/BoardRepository'

const PREFIX = 'aaz:board:'

export class RedisBoardRepository implements BoardRepository {
  async findById(id: string): Promise<Board | null> {
    const redis = await getRedis()
    const raw = await redis.get(`${PREFIX}${id}`)
    if (!raw) return null
    return JSON.parse(raw) as Board
  }

  async list(workspaceId: string): Promise<Board[]> {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    const boards: Board[] = []
    for (const key of keys) {
      const raw = await redis.get(key)
      if (raw) {
        const board = JSON.parse(raw) as Board
        if (board.workspaceId === workspaceId) boards.push(board)
      }
    }
    boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return boards
  }

  async save(board: Board): Promise<Board> {
    const redis = await getRedis()
    board.updatedAt = new Date().toISOString()
    await redis.set(`${PREFIX}${board.id}`, JSON.stringify(board))
    return board
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    await redis.del(`${PREFIX}${id}`)
  }
}
