'use client'

import React from 'react'
import { BearIntro } from '@/components/intro/BearIntro'
import { useSessionIntro } from '@/components/intro/useSessionIntro'

/**
 * Layout exclusivo da seção Workflow. Aqui mora o intro animado:
 * roda quando o usuário entra em qualquer rota /workflow* (lista de
 * boards ou board específico) pela primeira vez na sessão.
 *
 * Por que aqui e não no layout do workspace:
 *   - Animação tem 6s e cobre a tela inteira — só faz sentido
 *     interromper o usuário quando ele está abrindo a ferramenta
 *     criativa, não pra ver Home/Settings.
 *   - sessionStorage garante uma execução por sessão (per-tab).
 *
 * Stateful: o componente abaixo monta/desmonta o overlay; o layout
 * é Client porque o hook useSessionIntro depende de window.
 */
export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  const { show, markShown } = useSessionIntro()

  return (
    <>
      {children}
      {show && <BearIntro onDone={markShown} />}
    </>
  )
}
