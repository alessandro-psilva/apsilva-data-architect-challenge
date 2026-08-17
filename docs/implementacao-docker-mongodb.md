# Passo 4 de 4 (opcional) — Ambiente Docker: Loja "Amazonas" (MongoDB Replica Set)

> Você está no **passo 4, opcional**, do percurso deste repositório. Veja o [README da raiz](../README.md#como-usar-este-repositório-percurso-recomendado) para o mapa completo. Os passos 1-3 ([`guia-de-estudos/`](guia-de-estudos/), [`modelagem-hackolade/`](modelagem-hackolade/), [`documento-arquitetural/`](documento-arquitetural/)) já entregam tudo que o enunciado exige — este guia é o "se você quiser ir além" que o professor menciona.

Este guia descreve a implementação **opcional/bônus** citada no enunciado do
Desafio Final ("banco de dados funcionando" e "particionamento e réplicas
funcionando"). Os arquivos executáveis (`docker-compose.yml`, `Makefile`,
`mongo-init/`) ficam na **raiz do repositório**, não nesta pasta — todos os
comandos abaixo devem rodar a partir da raiz. Ela materializa em MongoDB de
verdade o modelo NoSQL que deve ser desenhado no Hackolade e descrito no
Documento Arquitetural (Word).

> Se os arquivos `.sh`/`.js` em [`mongo-init/`](../mongo-init/) não fizerem muito
> sentido à primeira vista, leia o **Módulo 5 (bônus)**, perto do fim do
> [guia de estudos](guia-de-estudos/README.md), primeiro — ele explica
> cada um linha por linha, conectando de volta com os conceitos dos Módulos 1-4.

> O essencial do desafio (documento Word + diagrama no Hackolade) **não**
> depende desta implementação. Isso aqui é o "ir além" que o professor menciona.
>
> Use o [`Makefile`](../Makefile) na raiz do repositório para os comandos do
> dia a dia (`make up`, `make status`, `make failover-test`, `make down`...) —
> a seção "Como rodar" abaixo também mostra o `docker compose`/`docker exec`
> puro por trás de cada atalho, caso prefira digitar os comandos você mesmo.

## O que este ambiente sobe

```
mongo1 (primary candidato, priority 2)  ─┐
mongo2 (secondary, priority 1)          ─┼─ replica set "rsAmazonas"
mongo3 (secondary, priority 1)          ─┘
mongo-setup (container one-shot: inicializa o replica set + popula os dados)
```

- **Réplica** (o que este ambiente demonstra na prática): os 3 nós mantêm
  cópias idênticas dos dados. Se `mongo1` cair, `mongo2` ou `mongo3` assume
  como primary automaticamente (failover) — é assim que a solução da
  Amazonas garante **alta disponibilidade**.
- **Sharding** (particionamento): **não** está implementado neste
  docker-compose (exigiria config servers + múltiplos shards + `mongos`,
  ambiente bem mais pesado para rodar localmente). A estratégia de
  particionamento está descrita no Documento Arquitetural e comentada em
  `mongo-init/02-seed-data.js`, indicando a chave de shard sugerida para
  cada coleção candidata (`pedidos` por `cliente_id`, `avaliacoes` por
  `produto_id`). Se quiser ir além, veja a seção "Evoluindo para sharding"
  no fim deste arquivo.

## Coleções e decisões de modelagem

| Coleção | Chave primária | Relacionamento | Por que desnormalizado/referenciado |
|---|---|---|---|
| `clientes` | `_id` | - | Endereços embutidos (array pequeno, sempre lido junto do cliente) |
| `produtos` | `_id` (SKU único) | - | `atributos` com schema flexível por categoria; contadores de avaliação desnormalizados para evitar agregação em toda visualização de produto |
| `formas_pagamento` | `_id` | `cliente_id` → `clientes._id` | Coleção própria (ciclo de vida independente do cliente); nunca guarda número completo de cartão |
| `pedidos` | `_id` (`numero_pedido` único) | `cliente_id` → `clientes._id`; `itens[].produto_id` → `produtos._id` | Itens do pedido **embutidos** (evita join); cliente, endereço e forma de pagamento gravados como **snapshot** (o pedido não pode mudar se o cliente editar o cadastro depois) |
| `carrinho` | `_id` | `cliente_id` → `clientes._id` | Coleção separada de `pedidos` por ter escrita muito mais frequente e ser efêmera; TTL index expira carrinhos abandonados após 30 dias |
| `avaliacoes` | `_id` | `produto_id` → `produtos._id`; `cliente_id` → `clientes._id` | `cliente_nome` como snapshot para renderizar a lista sem join na tela de produto (a mais acessada do site) |

Os comentários completos de cada decisão estão no início de cada bloco em
`mongo-init/02-seed-data.js`.

## Como rodar

Pré-requisito: Docker Desktop (ou Docker Engine) instalado e rodando na sua
máquina. Todos os comandos abaixo rodam a partir da **raiz do repositório**
(onde ficam `docker-compose.yml` e `Makefile`):

```bash
docker compose up -d --wait
# ou, com o Makefile: make up
```

Isso vai:
1. Subir `mongo1`, `mongo2`, `mongo3` (aguarda o healthcheck de cada um).
2. Rodar `mongo-setup`, que inicializa o replica set e popula as 6 coleções
   com dados de exemplo (2 clientes, 3 produtos, 2 formas de pagamento, 2
   pedidos, 1 carrinho, 3 avaliações).

Acompanhe o log do setup:

```bash
docker logs -f amazonas-mongo-setup
```

Você deve ver ao final:

```
>> Seed concluído. Contagem de documentos por coleção:
   - clientes: 2
   - produtos: 3
   - pedidos: 2
   - carrinho: 1
   - avaliacoes: 3
   - formas_pagamento: 2
```

## Como verificar a réplica

```bash
docker exec -it amazonas-mongo1 mongosh --eval "rs.status()"
# ou: make status (versão resumida, só nome + estado de cada membro)
```

Confira o campo `stateStr` de cada membro: um deve estar `PRIMARY` e os
outros dois `SECONDARY`. Para testar failover, derrube o primary e veja um
secondary assumir:

```bash
docker stop amazonas-mongo1
docker exec -it amazonas-mongo2 mongosh --eval "rs.status().members.map(m => m.stateStr)"
docker start amazonas-mongo1   # volta como secondary
# ou tudo isso de uma vez: make failover-test
```

Para consultar os dados:

```bash
docker exec -it amazonas-mongo1 mongosh amazonas_ecommerce --eval "db.pedidos.find().pretty()"
# ou um shell interativo: make shell
```

Print o `rs.status()` (com um `PRIMARY` e dois `SECONDARY` visíveis) e a
contagem de documentos por coleção (`make seed-status`) — são exatamente as
evidências pedidas em [`docs/EVIDENCIAS.md`](EVIDENCIAS.md) para o
entregável opcional "banco de dados funcionando". Salve os prints em
`docs/screenshots/`.

## Parar e limpar

```bash
docker compose down       # para os containers, mantém os dados (volumes)
docker compose down -v    # para os containers e apaga os dados
```

## Status da validação neste ambiente de desenvolvimento

O `docker-compose.yml` foi validado com `docker compose config` (sintaxe
correta) e os scripts `.js` foram validados manualmente (sem `node`/`mongosh`
disponíveis no ambiente onde este repositório foi escrito). A execução
completa (`docker compose up`) **não pôde ser testada de ponta a ponta**
nesta sessão porque não havia um daemon Docker rodando — não é um problema
do compose em si. Rode os comandos acima na sua máquina (com Docker Desktop
ou Docker Engine ativo) para ver o cluster subir; se algo não bater com o
esperado, me avise com o log de `docker logs amazonas-mongo-setup` que eu
ajusto.

## Evoluindo para sharding (fora do escopo obrigatório)

Se quiser demonstrar particionamento de verdade, o próximo passo seria:
1. Subir 3 `config servers` (também como replica set).
2. Subir 2+ replica sets adicionais, um por shard.
3. Subir um roteador `mongos` na frente de tudo.
4. Rodar `sh.enableSharding("amazonas_ecommerce")` e
   `sh.shardCollection("amazonas_ecommerce.pedidos", { cliente_id: "hashed" })`
   — **não** `{ cliente_id: 1 }` (chave em range): como o
   [Documento Arquitetural (seção 3.3)](documento-arquitetural/documento-arquitetural.md#33-o-que-particiona-sharding-e-por-quê)
   explica, particionar por um valor que cresce com o tempo sem hashear cria
   exatamente o hotspot de escrita que o sharding deveria evitar.

Isso é significativamente mais pesado para rodar localmente (7+ containers)
e não é exigido pelo enunciado — a explicação textual da estratégia de
sharding no Documento Arquitetural já atende ao requisito.
