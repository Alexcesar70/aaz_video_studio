import type { Board } from '../domain/Board'

export interface BoardRepository {
  findById(id: string): Promise<Board | null>
  list(workspaceId: string): Promise<Board[]>
  save(board: Board): Promise<Board>
  remove(id: string): Promise<void>
}
