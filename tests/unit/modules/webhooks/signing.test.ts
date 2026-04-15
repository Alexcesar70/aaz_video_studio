import { describe, it, expect } from 'vitest'
import {
  generateWebhookSecret,
  signPayload,
  verifySignature,
} from '@/modules/webhooks'

describe('webhook signing', () => {
  describe('generateWebhookSecret', () => {
    it('retorna hex de 64 chars (32 bytes)', () => {
      const s = generateWebhookSecret()
      expect(s).toMatch(/^[0-9a-f]{64}$/)
    })

    it('chamadas distintas retornam secrets distintos', () => {
      const a = generateWebhookSecret()
      const b = generateWebhookSecret()
      expect(a).not.toBe(b)
    })
  })

  describe('signPayload + verifySignature', () => {
    const secret = generateWebhookSecret()

    it('verifica assinatura válida', () => {
      const payload = '{"hello":"world"}'
      const sig = signPayload(payload, secret)
      expect(verifySignature(payload, secret, sig)).toBe(true)
    })

    it('rejeita assinatura adulterada', () => {
      const payload = '{"hello":"world"}'
      const sig = signPayload(payload, secret)
      const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
      expect(verifySignature(payload, secret, tampered)).toBe(false)
    })

    it('rejeita assinatura com secret errado', () => {
      const payload = '{"x":1}'
      const sig = signPayload(payload, secret)
      const otherSecret = generateWebhookSecret()
      expect(verifySignature(payload, otherSecret, sig)).toBe(false)
    })

    it('aceita signature sem prefixo "sha256="', () => {
      const payload = 'hello'
      const sig = signPayload(payload, secret)
      const hexOnly = sig.replace('sha256=', '')
      expect(verifySignature(payload, secret, hexOnly)).toBe(true)
    })

    it('rejeita payload modificado', () => {
      const sig = signPayload('original', secret)
      expect(verifySignature('modified', secret, sig)).toBe(false)
    })

    it('formato sha256=<hex>', () => {
      const sig = signPayload('x', secret)
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
    })

    it('comparação é timing-safe (smoke: não joga em strings de tamanho diferente)', () => {
      const payload = 'x'
      const sig = signPayload(payload, secret)
      // Strings de tamanho diferente devem retornar false sem lançar
      expect(() =>
        verifySignature(payload, secret, sig + 'a'),
      ).not.toThrow()
      expect(verifySignature(payload, secret, sig + 'a')).toBe(false)
    })
  })
})
