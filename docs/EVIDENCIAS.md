# Evidências — Desafio Final de Arquiteto(a) de Dados (Loja "Amazonas")

Este documento reúne as evidências dos entregáveis pedidos no enunciado (ver "Resumo dos Entregáveis"
na última página do PDF) e serve como checklist para saber o que falta antes de submeter. Para o
percurso completo de como produzir cada um, veja o [README da raiz](../README.md).

## Notas sobre o que é obrigatório e o que é bônus

O enunciado é explícito: **nada precisa ser implementado em banco de dados ou nuvem** — o propósito
do desafio é a ideia e a arquitetura, registradas no Documento Arquitetural com o diagrama do
Hackolade. Rodar um MongoDB de verdade (item 4 abaixo) é opcional, citado pelo próprio professor como
"quem tentar, vai ganhar conhecimento valioso" — não é critério de nota.

| # | Entregável (conforme o PDF) | Obrigatório? | Onde neste repositório |
|---|---|---|---|
| 1 | Arquitetura de Dados (Word com diagrama Hackolade) | **Sim** | [`documento-arquitetural/`](documento-arquitetural/) |
| 2 | Explicação da estrutura e dos elementos da solução | **Sim** | Seção 2 de [`documento-arquitetural.md`](documento-arquitetural/documento-arquitetural.md) |
| 3 | Explicação do particionamento e da replicação | **Sim** | Seção 3 de [`documento-arquitetural.md`](documento-arquitetural/documento-arquitetural.md) |
| 4 | Opcional: banco de dados funcionando | Não | [`implementacao-docker-mongodb.md`](implementacao-docker-mongodb.md) |
| 5 | Opcional: particionamento e réplicas funcionando | Não | Réplica: sim (ver `implementacao-docker-mongodb.md`). Sharding: só descrito no documento — ver nota abaixo |
| 6 | Opcional: implementação em nuvem (Atlas ou DynamoDB) | Não | Seção 4 (visão textual) de [`documento-arquitetural.md`](documento-arquitetural/documento-arquitetural.md) |

**Nota sobre sharding**: o ambiente Docker deste repositório sobe um *replica set* (réplica) real, mas
**não** um cluster com sharding de verdade — isso exigiria *config servers*, múltiplos shards e um
roteador `mongos`, um ambiente significativamente mais pesado para rodar localmente (7+ containers) e
não exigido pelo enunciado. A estratégia de sharding está descrita e justificada na seção 3 do
Documento Arquitetural. Ver a seção "Evoluindo para sharding" em
[`implementacao-docker-mongodb.md`](implementacao-docker-mongodb.md) se você quiser ir além disso
também.

---

## Entregável 1 — Diagrama do modelo no Hackolade

> *Print do diagrama com as 6 coleções, relações e anotações de shard key/índices — ver [passo 2](modelagem-hackolade/).*

![Diagrama Hackolade — modelo Amazonas](screenshots/01-hackolade-diagrama-amazonas.png)

## Entregável 2 — Documento Arquitetural em PDF

> *O PDF final exportado a partir de [`documento-arquitetural.md`](documento-arquitetural/documento-arquitetural.md) — ver instruções de exportação no README daquela pasta.*

Arquivo final: `docs/documento-arquitetural/documento-arquitetural.pdf` *(gere localmente — não faz
parte deste checklist versionado até você exportar o seu)*.

---

## Entregável opcional 4 — Banco de dados funcionando (MongoDB replica set)

> *"Opcional (banco de dados funcionando)."*

Comando para reproduzir (a partir da raiz do repositório): `make demo`.

### `docker ps` — os 3 nós + o container de setup

![docker ps](screenshots/02-docker-ps.png)

### `rs.status()` — um PRIMARY e dois SECONDARY

Gerado com `make status`:

![rs.status()](screenshots/03-rs-status.png)

### Contagem de documentos por coleção (seed aplicado)

Gerado com `make seed-status`:

![Contagem de documentos](screenshots/04-seed-status.png)

## Entregável opcional 5 — Réplica funcionando (teste de failover)

> *"Opcional (particionamento e réplicas funcionando)."* — cobre a parte de réplica; sharding não
> implementado neste ambiente, ver nota acima.

Gerado com `make failover-test` (derruba o `mongo1`/primary, mostra a eleição do novo primary, e
restaura o nó original como secondary):

![Teste de failover](screenshots/05-failover-test.png)

---

## Como reproduzir estas evidências do zero

```bash
git clone <url-deste-repositorio>
cd apsilva-data-architect-challenge
make demo              # reset completo + sobe a stack + espera o seed terminar + mostra status
make failover-test     # opcional: prova a alta disponibilidade
```

Salve cada print em `docs/screenshots/` com os nomes referenciados acima — a pasta já está fora de
qualquer `.gitignore` deste projeto, os prints são versionados junto com o código.
