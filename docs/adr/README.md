# Architecture Decision Records (ADR)

Cada decisão arquitetural significativa é registrada aqui como um ADR numerado.
O objetivo é ter **memória do "por quê"** — não só do "o quê".

## Quando criar um ADR

- Decisão estruturante que afeta +1 módulo (ex.: escolha de ORM, estratégia de tenancy).
- Decisão que reverte ou substitui outra anterior.
- Escolha entre duas opções viáveis onde o trade-off precisa ficar documentado.
- Qualquer decisão irreversível dentro do refactor universal.

## O que NÃO é ADR

- Bug fix.
- Refatoração local (rename, extract method).
- Escolha de lib pequena (ex.: lodash vs ramda).

## Template

```
# ADR-NNNN — Título curto

- Status: proposed | accepted | superseded | deprecated
- Data: YYYY-MM-DD
- Contexto: por que estamos decidindo isso agora?
- Decisão: o que foi decidido, em uma frase.
- Consequências: o que muda, o que ganhamos, o que perdemos.
- Alternativas consideradas: o que foi descartado e por quê.
```

## Índice

| # | Status | Título |
|---|--------|--------|
| [0001](./0001-module-structure.md) | accepted | Estrutura modular e Clean Architecture aplicada |
| [0002](./0002-feature-flag-strategy.md) | accepted | Estratégia de feature flags sem staging |
