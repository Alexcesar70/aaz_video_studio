import { describe, it, expect, beforeEach } from 'vitest'
import {
  createReferenceAsset,
  getReferenceAsset,
  listReferenceAssets,
  removeReferenceAsset,
  ReferenceAssetNotFoundError,
  ReferenceAssetAccessDeniedError,
  InMemoryReferenceAssetRepository,
  InvalidReferenceAssetError,
  type BlobDeleter,
} from '@/modules/references'

describe('references — use cases', () => {
  let repo: InMemoryReferenceAssetRepository

  beforeEach(() => {
    repo = new InMemoryReferenceAssetRepository()
  })

  describe('createReferenceAsset', () => {
    it('cria com uuid auto-gerado e mediaType inferido por mime', async () => {
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.bin',
          contentType: 'image/png',
          source: 'upload',
          userId: 'u',
          workspaceId: 'ws',
        },
      )
      expect(r.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
      expect(r.mediaType).toBe('image')
    })

    it('cria com mediaType inferido pela extensão do URL', async () => {
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/foo.mp4',
          source: 'generated',
          userId: 'u',
          workspaceId: 'ws',
        },
      )
      expect(r.mediaType).toBe('video')
    })

    it('respeita mediaType explícito sobre inferência', async () => {
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/foo.png', // sugere image
          mediaType: 'video', // explícito ganha
          source: 'upload',
          userId: 'u',
          workspaceId: 'ws',
        },
      )
      expect(r.mediaType).toBe('video')
    })

    it('lança InvalidReferenceAssetError quando não é possível inferir mediaType', async () => {
      await expect(
        createReferenceAsset(
          { repo },
          {
            url: 'https://blob/unknown.xyz',
            source: 'upload',
            userId: 'u',
            workspaceId: null,
          },
        ),
      ).rejects.toThrow(InvalidReferenceAssetError)
    })

    it('respeita id fornecido (idempotência externa)', async () => {
      const id = '12345678-1234-4234-8234-123456789abc'
      const r = await createReferenceAsset(
        { repo },
        {
          id,
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'u',
          workspaceId: null,
        },
      )
      expect(r.id).toBe(id)
    })
  })

  describe('getReferenceAsset — autorização', () => {
    async function seed() {
      return createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
    }

    it('retorna quando requesterUserId bate', async () => {
      const r = await seed()
      const got = await getReferenceAsset(
        { repo },
        { id: r.id, requesterUserId: 'alice' },
      )
      expect(got.id).toBe(r.id)
    })

    it('lança AccessDenied quando user diferente e ws diferente', async () => {
      const r = await seed()
      await expect(
        getReferenceAsset(
          { repo },
          {
            id: r.id,
            requesterUserId: 'bob',
            requesterWorkspaceId: 'ws-other',
          },
        ),
      ).rejects.toThrow(ReferenceAssetAccessDeniedError)
    })

    it('permite acesso se user diferente mas mesmo workspace', async () => {
      const r = await seed()
      const got = await getReferenceAsset(
        { repo },
        { id: r.id, requesterUserId: 'bob', requesterWorkspaceId: 'ws-1' },
      )
      expect(got.id).toBe(r.id)
    })

    it('lança NotFound para id inexistente', async () => {
      await expect(
        getReferenceAsset({ repo }, { id: 'missing' }),
      ).rejects.toThrow(ReferenceAssetNotFoundError)
    })
  })

  describe('listReferenceAssets', () => {
    it('passa filtros ao repositório', async () => {
      await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/1.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/2.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'bob',
          workspaceId: 'ws-1',
        },
      )
      const list = await listReferenceAssets({ repo }, { userId: 'alice' })
      expect(list).toHaveLength(1)
      expect(list[0].userId).toBe('alice')
    })
  })

  describe('removeReferenceAsset', () => {
    it('remove com auth do owner', async () => {
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await removeReferenceAsset(
        { repo },
        { id: r.id, requesterUserId: 'alice' },
      )
      expect(await repo.findById(r.id)).toBeNull()
    })

    it('bloqueia não-owner sem workspace match', async () => {
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await expect(
        removeReferenceAsset(
          { repo },
          {
            id: r.id,
            requesterUserId: 'bob',
            requesterWorkspaceId: 'ws-other',
          },
        ),
      ).rejects.toThrow(ReferenceAssetAccessDeniedError)
    })

    it('chama blobDeleter quando deleteBlob=true e pathname presente', async () => {
      const calls: string[] = []
      const blobDeleter: BlobDeleter = {
        async delete(p) {
          calls.push(p)
        },
      }
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          pathname: 'ref-123.png',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await removeReferenceAsset(
        { repo, blobDeleter },
        {
          id: r.id,
          requesterUserId: 'alice',
          deleteBlob: true,
        },
      )
      expect(calls).toEqual(['ref-123.png'])
    })

    it('não chama blobDeleter quando deleteBlob=false', async () => {
      const calls: string[] = []
      const blobDeleter: BlobDeleter = {
        async delete(p) {
          calls.push(p)
        },
      }
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          pathname: 'ref-123.png',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await removeReferenceAsset(
        { repo, blobDeleter },
        { id: r.id, requesterUserId: 'alice', deleteBlob: false },
      )
      expect(calls).toEqual([])
    })

    it('tolera falha silenciosa do blobDeleter (registro é removido)', async () => {
      const blobDeleter: BlobDeleter = {
        async delete() {
          throw new Error('blob offline')
        },
      }
      const r = await createReferenceAsset(
        { repo },
        {
          url: 'https://blob/x.png',
          mediaType: 'image',
          source: 'upload',
          pathname: 'ref.png',
          userId: 'alice',
          workspaceId: 'ws-1',
        },
      )
      await removeReferenceAsset(
        { repo, blobDeleter },
        { id: r.id, requesterUserId: 'alice', deleteBlob: true },
      )
      expect(await repo.findById(r.id)).toBeNull()
    })
  })
})
