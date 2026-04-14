import type { Character } from '../domain/Character'

/**
 * Contrato de persistência de Character.
 *
 * Regra de resolução (`findBySlug`): tenta primeiro o override do
 * workspace; se ausente, faz fallback para o global. Mesmo padrão de
 * StyleProfile / PromptTemplate.
 *
 * Versionamento: cada `upsert` com mudança de conteúdo deve arquivar
 * a versão anterior no histórico. `listVersions` retorna o histórico
 * em ordem desc. A implementação concreta é responsável por detectar
 * se é uma criação (não arquiva) ou edição (arquiva a versão atual
 * antes de sobrescrever).
 */
export interface CharacterListFilter {
  /** undefined = não filtra; null = apenas globais; string = workspace. */
  workspaceId?: string | null
  /** Só oficiais / só custom. */
  isOfficial?: boolean
  /** Limite de resultados. */
  limit?: number
}

export interface CharacterRepository {
  /**
   * Retorna com precedência workspace-override → global.
   */
  findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<Character | null>

  /**
   * Retorna apenas do escopo exato (sem fallback).
   */
  findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<Character | null>

  /**
   * Lista characters. Ordenação: oficiais primeiro, depois createdAt desc.
   */
  list(filter?: CharacterListFilter): Promise<Character[]>

  /**
   * Insere ou atualiza. Se já existir no escopo exato com outra
   * `version`, a implementação arquiva a versão antiga em histórico.
   */
  upsert(character: Character): Promise<Character>

  /**
   * Remove character do escopo exato. Character com `isOfficial=true`
   * deve ser rejeitado na camada de use case — o repo apenas obedece.
   * Histórico de versões NÃO é apagado junto (registro imutável).
   */
  remove(slug: string, workspaceId: string | null): Promise<void>

  /**
   * Retorna versões anteriores, ordem desc (mais recente primeiro).
   * Não inclui a versão corrente (que sai de `findBySlug`).
   */
  listVersions(
    slug: string,
    workspaceId: string | null,
  ): Promise<Character[]>
}
