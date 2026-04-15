/**
 * DualWriteWalletRepository — composição que escreve em DOIS adapters
 * simultaneamente (`primary` + `shadow`) e LÊ apenas do primary.
 *
 * **Caso de uso:** fase de transição Redis → Postgres da Wallet.
 * Durante o dual-write:
 *   - primary = Redis (fonte da verdade ainda)
 *   - shadow  = Postgres (recebe sombra das operações; reconciliation
 *     job noturno valida divergências)
 *
 * Após estabilidade (30+ dias com 0 divergências), o operador inverte:
 *   - primary = Postgres (fonte da verdade)
 *   - shadow  = Redis (segurança extra durante 30 dias)
 *
 * Por fim, o adapter dual é removido em PR de consolidação. As rotas
 * passam a usar apenas o Postgres adapter.
 *
 * **Política de erros:**
 *   - Falha no `primary` PROPAGA (cliente recebe erro real).
 *   - Falha no `shadow` é capturada, logada via `reportError` com tag
 *     `feature: 'wallet_dual_write'` — não impede a operação primária.
 *     O reconciliation script noturno é responsável por detectar e
 *     consertar divergências silenciosas.
 */

import { reportError } from '@/lib/errorReporter'
import type {
  Wallet,
  WalletOwnerType,
  WalletTransaction,
} from '../domain/Wallet'
import type {
  WalletRepository,
  CreateWalletInput,
  ApplyTransactionInput,
  ApplyTransactionResult,
  TransferInput,
  TransferResult,
  ListTransactionsFilter,
} from '../ports/WalletRepository'

export class DualWriteWalletRepository implements WalletRepository {
  constructor(
    private readonly primary: WalletRepository,
    private readonly shadow: WalletRepository,
  ) {}

  // ── Reads: somente primary ──
  findById(id: string): Promise<Wallet | null> {
    return this.primary.findById(id)
  }
  findByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null> {
    return this.primary.findByOwner(ownerType, ownerId)
  }
  listTransactions(
    walletId: string,
    filter?: ListTransactionsFilter,
  ): Promise<WalletTransaction[]> {
    return this.primary.listTransactions(walletId, filter)
  }

  // ── Writes: primary primeiro; shadow best-effort ──
  async create(input: CreateWalletInput): Promise<Wallet> {
    const result = await this.primary.create(input)
    void this.shadowSafely('create', () => this.shadow.create({ ...input, id: result.id }))
    return result
  }

  async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<ApplyTransactionResult> {
    const result = await this.primary.applyTransaction(input)
    void this.shadowSafely('applyTransaction', () =>
      this.shadow.applyTransaction(input),
    )
    return result
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    const result = await this.primary.transfer(input)
    void this.shadowSafely('transfer', () => this.shadow.transfer(input))
    return result
  }

  async updateThresholds(
    walletId: string,
    thresholds: { warning: number; critical: number; danger: number },
  ): Promise<Wallet> {
    const result = await this.primary.updateThresholds(walletId, thresholds)
    void this.shadowSafely('updateThresholds', () =>
      this.shadow.updateThresholds(walletId, thresholds),
    )
    return result
  }

  /**
   * Executa o callback no shadow, captura qualquer erro via reportError,
   * e nunca propaga — protege a operação primária.
   */
  private async shadowSafely(
    operation: string,
    cb: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await cb()
    } catch (err) {
      reportError(err, {
        tags: {
          feature: 'wallet_dual_write',
          operation,
        },
        fingerprint: ['wallet-dual-write', operation],
      })
    }
  }
}
