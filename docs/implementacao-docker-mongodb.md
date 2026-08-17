# Implementação em Docker: MongoDB Replica Set

Implementação opcional/bônus citada no enunciado do Desafio Final ("banco de dados funcionando" e
"particionamento e réplicas funcionando"). Materializa em MongoDB de verdade o modelo descrito no
Documento Arquitetural. Os arquivos executáveis (`docker-compose.yml`, `Makefile`, `mongo-init/`)
ficam na raiz do repositório — todos os comandos abaixo rodam a partir de lá.

## O que este ambiente sobe

```
mongo1 (primary candidato, priority 2)  ─┐
mongo2 (secondary, priority 1)          ─┼─ replica set "rsAmazonas"
mongo3 (secondary, priority 1)          ─┘
mongo-setup (container one-shot: inicializa o replica set + popula os dados)
```

- **Réplica**: os 3 nós mantêm cópias idênticas dos dados. Se `mongo1` cair, `mongo2` ou `mongo3`
  assume como primary automaticamente (failover) — é assim que a solução garante alta disponibilidade.
- **Sharding**: não está implementado neste docker-compose (exigiria config servers + múltiplos
  shards + `mongos`, um ambiente bem mais pesado para rodar localmente). A estratégia de
  particionamento está descrita no Documento Arquitetural e comentada em `mongo-init/02-seed-data.js`.
  Ver "Evoluindo para sharding" no fim deste arquivo.

## Coleções e decisões de modelagem

| Coleção | Chave primária | Relacionamento | Por que desnormalizado/referenciado |
|---|---|---|---|
| `clientes` | `_id` | - | Endereços embutidos (array pequeno, sempre lido junto do cliente) |
| `produtos` | `_id` (SKU único) | - | `atributos` com schema flexível por categoria; contadores de avaliação desnormalizados |
| `formas_pagamento` | `_id` | `cliente_id` → `clientes._id` | Coleção própria (ciclo de vida independente do cliente); nunca guarda número completo de cartão |
| `pedidos` | `_id` (`numero_pedido` único) | `cliente_id` → `clientes._id`; `itens[].produto_id` → `produtos._id` | Itens do pedido embutidos; cliente, endereço e forma de pagamento gravados como snapshot |
| `carrinho` | `_id` | `cliente_id` → `clientes._id` | Coleção separada de `pedidos` por ter escrita muito mais frequente e ser efêmera; TTL expira carrinhos abandonados após 30 dias |
| `avaliacoes` | `_id` | `produto_id` → `produtos._id`; `cliente_id` → `clientes._id` | `cliente_nome` como snapshot para renderizar a lista sem join na tela de produto |

Os comentários de cada decisão estão no início de cada bloco em `mongo-init/02-seed-data.js`.

## Como rodar

Pré-requisito: Docker Desktop (ou Docker Engine) instalado e rodando. Comandos a partir da raiz do
repositório:

```bash
docker compose up -d --wait
# ou, com o Makefile: make up
```

Isso sobe `mongo1`, `mongo2`, `mongo3` e roda `mongo-setup`, que inicializa o replica set e popula as
6 coleções com dados de exemplo. Acompanhar o log:

```bash
docker logs -f amazonas-mongo-setup
```

Ao final:

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
# ou: make status
```

Um membro deve estar `PRIMARY` e os outros dois `SECONDARY`. Para testar failover:

```bash
docker stop amazonas-mongo1
docker exec -it amazonas-mongo2 mongosh --eval "rs.status().members.map(m => m.stateStr)"
docker start amazonas-mongo1   # volta como secondary
# ou: make failover-test
```

Consultar os dados:

```bash
docker exec -it amazonas-mongo1 mongosh amazonas_ecommerce --eval "db.pedidos.find().pretty()"
# ou: make shell
```

## Parar e limpar

```bash
docker compose down       # mantém os dados (volumes)
docker compose down -v    # apaga os dados
```

## Evoluindo para sharding (fora do escopo obrigatório)

Para demonstrar particionamento de verdade:
1. Subir 3 config servers (também como replica set).
2. Subir 2+ replica sets adicionais, um por shard.
3. Subir um roteador `mongos` na frente de tudo.
4. Rodar `sh.enableSharding("amazonas_ecommerce")` e
   `sh.shardCollection("amazonas_ecommerce.pedidos", { cliente_id: "hashed" })` — não
   `{ cliente_id: 1 }` (chave em range), que reintroduziria o hotspot de escrita que o sharding deveria
   evitar (ver seção 3.3 do [Documento Arquitetural](EVIDENCIAS.md#33-o-que-particiona-sharding-e-por-quê)).

Isso é significativamente mais pesado para rodar localmente (7+ containers) e não é exigido pelo
enunciado — a explicação textual da estratégia de sharding no Documento Arquitetural já atende ao
requisito.
