# Documento Arquitetural de Dados — Loja "Amazonas"

**Bootcamp:** Arquiteto(a) de Dados
**Módulo:** Desafio Final
**Professor:** João Paulo Faria
**Aluno(a):** *[seu nome aqui]*
**Data:** *[data de entrega]*

> **Como usar este arquivo**: preencha os campos entre colchetes, insira a imagem do diagrama Hackolade (passo 2 deste repositório) na seção 2.4, e siga as instruções de exportação para Word/PDF em [`README.md`](README.md) desta mesma pasta.

---

## 1. Descrição do sistema

### 1.1 Contexto

A loja "Amazonas" é um e-commerce fictício que vende produtos heterogêneos — eletrônicos, vestuário, utensílios domésticos e livros — e está expandindo do modelo físico para o digital com a ambição de se tornar a maior loja de comércio eletrônico do Brasil. Esse crescimento traz um requisito não-funcional dominante: o sistema precisa suportar aumento **rápido e exponencial** de clientes e transações, sem perder performance nem disponibilidade.

### 1.2 Objetivos principais da arquitetura

1. **Escalabilidade horizontal, com elasticidade quando possível** — crescer somando servidores, não trocando por um servidor maior, e idealmente ajustando essa capacidade automaticamente conforme a demanda.
2. **Alta disponibilidade** — o sistema deve continuar respondendo mesmo se um servidor individual falhar.
3. **Modelo de dados flexível** — o catálogo é heterogêneo (um eletrônico e um livro têm atributos completamente diferentes); um esquema rígido de tabelas geraria dezenas de colunas nulas.
4. **Leituras rápidas e previsíveis** — as telas mais acessadas do site (produto, pedido, carrinho) precisam responder sem depender de junções (joins) custosas entre múltiplas tabelas.

### 1.3 Por que um banco não-relacional (NoSQL)

Bancos relacionais tradicionais foram desenhados em torno de uma máquina central coordenando tudo, com dados normalizados em tabelas conectadas por chaves estrangeiras. Esse modelo é excelente para consistência, mas escala mal horizontalmente — à medida que o volume de dados e a concorrência de acesso crescem, o custo de manter joins consistentes entre múltiplos servidores explode. Como o requisito central da Amazonas é justamente crescimento rápido com escalabilidade horizontal, a escolha recai sobre um **banco de documentos** (MongoDB), que:

- Guarda cada entidade como um documento autocontido (JSON/BSON), reduzindo ou eliminando a necessidade de joins na leitura.
- Aceita esquema flexível por documento — cada categoria de produto pode ter atributos diferentes sem alterar um schema global.
- Foi desenhado desde a origem para ser distribuído entre múltiplos servidores (sharding nativo).

### 1.4 Escopo deste documento

Este documento cobre a camada de dados **transacional (OLTP)** do e-commerce: os dados que sustentam o dia a dia da aplicação (cadastro, catálogo, carrinho, pedidos, pagamento, avaliações). Não cobre integração com gateways de pagamento externos, autenticação/autorização, nem a camada analítica (Data Warehouse/BI) — mencionada apenas como visão de evolução na seção 4.

---

## 2. Estrutura de dados proposta

### 2.1 Modelo de documentos: a regra de ouro é modelar pela leitura

Em um banco relacional, a regra de ouro é normalizar — cada fato mora em um único lugar. Em MongoDB, a regra se inverte: **modela-se pensando em como a informação será lida na tela**, aceitando duplicar dado de propósito quando isso evita uma consulta cara. Essa desnormalização deliberada é obtida através de três padrões, aplicados de forma consistente nas seis coleções abaixo:

- **Embedding**: o dado "filho" é gravado dentro do documento "pai", usado quando o filho tem tamanho limitado e é sempre lido junto do pai (ex.: itens de um pedido).
- **Referência**: o documento guarda apenas o `_id` do documento relacionado, usado quando a entidade referenciada cresce sem limite e é reaproveitada em múltiplos contextos (ex.: `cliente_id` em `pedidos`).
- **Snapshot**: uma cópia do dado é gravada no momento da transação, preservando como ele era naquele instante mesmo que o original mude depois (ex.: nome do cliente dentro do pedido, para não "mentir" sobre como a compra realmente aconteceu caso o cadastro mude depois).

### 2.2 Visão geral das seis coleções

| Coleção | Chave primária | Relacionamentos | Padrão de design aplicado |
|---|---|---|---|
| `clientes` | `_id` (ObjectId) | — | Endereços embutidos |
| `produtos` | `_id` (ObjectId), `sku` único | — | Atributos com schema flexível por categoria; contadores de avaliação desnormalizados |
| `formas_pagamento` | `_id` (ObjectId) | `cliente_id` → `clientes` | Coleção própria (ciclo de vida independente); nunca guarda cartão completo |
| `pedidos` | `_id` (ObjectId), `numero_pedido` único | `cliente_id` → `clientes`; `itens[].produto_id` → `produtos` | Itens embutidos; cliente/endereço/pagamento como snapshot |
| `carrinho` | `_id` (ObjectId) | `cliente_id` → `clientes` | Coleção própria (escrita muito mais frequente que pedidos) + índice TTL de 30 dias |
| `avaliacoes` | `_id` (ObjectId) | `produto_id` → `produtos`; `cliente_id` → `clientes` | `cliente_nome` como snapshot, evita join na tela de produto |

### 2.3 Detalhamento de cada coleção

#### 2.3.1 `clientes`

Guarda o cadastro de cada cliente: dados pessoais, contato e endereços. Os **endereços são embutidos** como um array — cada cliente tem no máximo alguns endereços cadastrados (um array pequeno e limitado), e são sempre exibidos junto do cliente (nunca consultados isoladamente), o que torna o embedding a escolha natural. O **histórico de pedidos não é embutido aqui** — cresce sem limite ao longo dos anos e é consultado de formas diferentes (por status, por período), por isso vira a coleção própria `pedidos`, referenciando `cliente_id`.

Índices: `{email: 1}` único e `{cpf: 1}` único, para garantir não-duplicidade de cadastro e permitir login/busca rápida por esses campos.

#### 2.3.2 `produtos`

Catálogo de produtos. O subdocumento `atributos` tem **esquema flexível por categoria**: um eletrônico tem `voltagem` e `garantia_meses`; uma peça de vestuário tem `tamanhos_disponiveis` e `cor`; um livro tem `autor` e `isbn`. Nenhuma dessas categorias precisa de colunas vazias para acomodar os atributos das outras — o problema clássico de um catálogo heterogêneo em um schema relacional rígido.

Os campos `avaliacao_media` e `total_avaliacoes` são **contadores desnormalizados**: em vez de agregar a coleção `avaliacoes` toda vez que a página do produto é carregada (a tela mais acessada do site), o valor já vem pronto no próprio documento do produto, recalculado de forma assíncrona.

Índices: `{sku: 1}` único (chave de negócio usada em integrações externas), `{categoria: 1, ativo: 1}` composto (listagens de catálogo por categoria) e um índice de texto em `{nome, descricao}` (busca).

#### 2.3.3 `formas_pagamento`

Meios de pagamento salvos pelo cliente (cartão tokenizado, chave PIX). É uma **coleção própria**, não embutida em `clientes`, porque tem ciclo de vida independente — adicionar ou remover um cartão não deveria reescrever o documento inteiro do cliente. Referencia `cliente_id`. Por exigência de conformidade (PCI-DSS), **nunca armazena o número completo do cartão** — apenas um token do gateway de pagamento e os últimos 4 dígitos, para exibição.

Índice: `{cliente_id: 1}`, para listar as formas de pagamento de um cliente.

#### 2.3.4 `pedidos`

A coleção central da transação. `itens[]` fica **embutido**: sempre lido junto do pedido, tamanho limitado (poucas dezenas de itens no máximo) e nunca consultado isoladamente fora do contexto do pedido. `cliente_snapshot`, `endereco_entrega` e `forma_pagamento` são **snapshots** — cópias do dado no exato momento da compra. Isso é essencial (inclusive por motivos fiscais e de auditoria): se o cliente mudar de endereço ou trocar de cartão amanhã, o pedido antigo precisa continuar registrando fielmente como a compra realmente aconteceu. `cliente_id` é mantido como **referência**, permitindo consultas indexadas do tipo "todos os pedidos do cliente X" sem duplicar o cliente inteiro em cada pedido.

Índices: `{cliente_id: 1, numero_pedido: 1}` único (a unicidade em coleção *sharded* precisa ter a chave de shard como prefixo — ver seção 3), `{cliente_id: 1, data_pedido: -1}` (histórico do cliente, mais recente primeiro) e `{status: 1}` (filas operacionais, ex.: "todos os pedidos aguardando envio").

#### 2.3.5 `carrinho`

Separada de `pedidos` porque tem um perfil de acesso completamente diferente: é escrita a cada clique de "adicionar ao carrinho" — ordens de magnitude mais frequente que a escrita de um pedido — e é efêmera (ou vira pedido, ou é abandonada). `itens[]` é embutido pelo mesmo raciocínio de `pedidos.itens[]`. Um **índice TTL** (*time to live*) em `atualizado_em` remove automaticamente carrinhos abandonados após 30 dias, sem exigir um processo de limpeza externo — um controle direto do crescimento de dados dessa coleção "quente".

Índices: `{cliente_id: 1}` único (um carrinho ativo por cliente) e `{atualizado_em: 1}` com `expireAfterSeconds` de 30 dias.

#### 2.3.6 `avaliacoes`

Referencia `produto_id` (para listar todas as avaliações de um produto) e `cliente_id` (para auditoria/anti-fraude), mas guarda `cliente_nome` como **snapshot**, permitindo renderizar a lista de avaliações na tela de produto — a mais acessada do site — sem precisar buscar cada cliente individualmente.

Índices: `{produto_id: 1, data: -1}` (lista de avaliações de um produto, mais recente primeiro) e `{cliente_id: 1}` (avaliações feitas por um cliente).

### 2.4 Diagrama do modelo (Hackolade)

*[Insira aqui a imagem exportada do Hackolade — ver [`modelagem-hackolade/`](../modelagem-hackolade/). Sugestão de arquivo: `docs/screenshots/01-hackolade-diagrama-amazonas.png`]*

---

## 3. Plano de escalabilidade

### 3.1 Estratégia geral: replicação e particionamento resolvem problemas diferentes

Escalar horizontalmente significa somar mais servidores em vez de trocar por um servidor maior. Mas "somar servidores" cobre duas técnicas distintas, que resolvem problemas diferentes e, na prática, se combinam:

- **Replicação**: cópias idênticas do banco inteiro em vários servidores (no MongoDB, um *replica set*). Resolve **disponibilidade** — se o servidor primário cair, um secundário assume automaticamente. Não ajuda o banco a crescer em volume: cada réplica guarda o total dos dados.
- **Particionamento (sharding)**: divide os documentos de uma coleção em fatias, cada uma vivendo em um servidor (*shard*) diferente. Resolve **volume e throughput de escrita** — nenhum shard sozinho guarda o total, então o sistema cresce somando shards.

Em produção, as duas técnicas se combinam: cada shard é, ele mesmo, um replica set. É essa combinação que este plano propõe para a Amazonas.

### 3.2 O que replica, e por quê

**Todas as seis coleções são replicadas** — não há exceção, porque disponibilidade é um requisito do sistema inteiro, não só das coleções de maior volume. Um replica set de 3 nós (1 primary + 2 secondaries) garante que, se o primary falhar, uma eleição automática promove um secondary em segundos, sem intervenção manual. Secondaries também podem atender leituras, distribuindo parte da carga de consulta (útil, por exemplo, para a listagem de produtos e avaliações, que tolera alguns milissegundos de atraso em troca de menos carga no primary).

### 3.3 O que particiona (sharding), e por quê

Nem toda coleção precisa de sharding — só as que efetivamente crescem sem limite e concentram volume de escrita:

| Coleção | Particiona? | Chave de shard | Justificativa |
|---|---|---|---|
| `clientes` | Não | — | Cresce de forma proporcional ao número de clientes, não à atividade deles; volume muito menor que pedidos/avaliações |
| `produtos` | Não, por ora | — | Catálogo de tamanho gerenciável; pode ser reavaliado se o número de SKUs crescer por ordens de grandeza |
| `formas_pagamento` | Não | — | Cresce proporcionalmente a clientes, poucas entradas por cliente |
| **`pedidos`** | **Sim** | `cliente_id` (hashed) | Cresce continuamente e sem limite; concentra o maior volume de escrita do sistema |
| **`avaliacoes`** | **Sim** | `produto_id` (hashed) | Cresce continuamente com o uso do site; consultas mais comuns já são "avaliações do produto X" |
| `carrinho` | Opcional | `cliente_id` (hashed) | Efêmera e já contida pelo índice TTL; sharding pode ser adicionado depois se o volume de escrita justificar |

**Por que a versão *hashed* da chave, e não o valor bruto?** Se o particionamento usasse o valor bruto de uma chave que cresce com o tempo (como um `ObjectId` sequencial), todo documento novo do sistema inteiro tenderia a cair sempre no mesmo shard — o que guarda os valores "mais recentes" — criando um **hotspot** que anula o propósito do sharding. Hashear o valor espalha a distribuição de forma praticamente aleatória entre os shards, sem perder a capacidade de direcionar consultas por cliente ou por produto (o roteador `mongos` calcula o hash e vai direto ao shard correto).

**Limitação conhecida, registrada como risco aceito**: hashear `produto_id` distribui bem entre produtos *diferentes*, mas não resolve um único produto "viral" que concentre volume desproporcional de avaliações — isso é um *hot key* (um único valor de chave recebendo tráfego desproporcional), não um *hot chunk* (uma faixa inteira de chaves mal distribuída), e o sharding por si só não resolve esse caso. Mitigação possível, fora do escopo deste modelo inicial: cache de leitura na frente da coleção para produtos com pico de tráfego.

### 3.4 Lidando com crescimento de dados

1. **Sharding nas coleções de maior volume** (`pedidos`, `avaliacoes`) — o mecanismo primário de crescimento: ao invés de um servidor cada vez maior, o cluster redistribui os dados automaticamente conforme novos shards são adicionados.
2. **TTL em `carrinho`** — remove dado que não tem valor de negócio depois de 30 dias, controlando o crescimento de uma coleção com escrita muito frequente.
3. **Arquivamento futuro** — como evolução (fora do escopo mínimo deste desafio), pedidos muito antigos (ex.: +2 anos) poderiam ser movidos para um armazenamento de menor custo (ex.: um bucket de objetos), mantendo a coleção operacional enxuta.

### 3.5 Lidando com alta concorrência de acesso

Escalar servidores não resolve, sozinho, um problema que aparece mesmo com um único documento: **múltiplos clientes tentando alterar o mesmo dado ao mesmo tempo** — típico em picos de tráfego (ex.: Black Friday), quando centenas de pessoas tentam comprar a última unidade de um produto popular no mesmo segundo.

Se a aplicação executa "ler o estoque → decidir se há saldo → escrever o novo estoque" como passos separados, dois clientes podem ler o mesmo valor antes de qualquer um escrever, ambos concluírem "há saldo" e ambos confirmarem a compra — vendendo a mesma unidade duas vezes. Esse erro é chamado de **race condition** (ou *lost update*).

A correção não é "ler mais rápido": é nunca separar a leitura da escrita quando a decisão depende do valor atual. A solução proposta é uma **operação atômica condicional** — em MongoDB, algo equivalente a:

```javascript
db.produtos.findOneAndUpdate(
  { _id: produtoId, "estoque.quantidade": { $gt: 0 } },
  { $inc: { "estoque.quantidade": -1 } }
)
```

O próprio banco executa a leitura-verificação-escrita como um passo indivisível — apenas um dos clientes concorrentes consegue decrementar o estoque; os demais recebem "esgotado" imediatamente, sem nenhuma janela de tempo em que os dois poderiam ter lido o mesmo valor.

### 3.6 Consistência sob falha (CAP theorem, em uma frase)

Quando a rede entre servidores falha — o que eventualmente acontece em qualquer sistema distribuído — um banco precisa escolher entre continuar respondendo com um dado possivelmente desatualizado (**disponibilidade**) ou recusar responder até ter certeza do dado mais atual (**consistência**); não é possível garantir as duas coisas simultaneamente durante a falha. Por padrão, o MongoDB prioriza consistência (leituras vão ao primary). Este plano propõe uma exceção deliberada: **leituras que toleram alguns milissegundos de atraso** (listagem de avaliações, catálogo de produtos) podem ser direcionadas a secondaries, aliviando a carga do primary — enquanto **leituras que exigem o dado mais atual** (confirmação de pagamento, verificação de estoque no checkout) permanecem no primary.

---

## 4. Visão de implementação em nuvem — MongoDB Atlas ou Amazon DynamoDB (bônus)

O enunciado sugere, como "plus", pensar a implementação via banco de dados gerenciado. Em ambos os casos, a decisão de modelagem deste documento (embedding, referência, snapshot, chaves) **não muda** — o que muda é quem opera a infraestrutura por baixo.

### 4.1 MongoDB Atlas

É o próprio MongoDB, hospedado e gerenciado pela MongoDB Inc., disponível nas três grandes nuvens (AWS, Azure, GCP). A migração deste modelo para o Atlas seria direta, porque o vocabulário (coleções, sharding, replica set) é idêntico ao usado neste documento:

- Réplica e sharding são configurados via interface gráfica ou infraestrutura como código, sem precisar operar manualmente os `config servers` e o roteador `mongos`.
- *Auto-scaling* de capacidade de computação/armazenamento, aproximando o sistema da elasticidade que o enunciado cita como desejável.
- Backup automático, monitoramento e alertas prontos, reduzindo trabalho operacional.

### 4.2 Amazon DynamoDB

Um banco NoSQL nativo da AWS, com um modelo um pouco diferente (mistura chave-valor e documento). Diferenças relevantes para este modelo:

- **Sem servidor para gerenciar** — o DynamoDB já é inerentemente particionado e replicado por baixo dos panos; não há shards ou replica sets para configurar manualmente.
- **Capacidade sob demanda ou provisionada** — paga-se por unidades de leitura/escrita (ou por uso, no modo *on-demand*), em vez de dimensionar servidores.
- **Modelagem por chave de partição + chave de ordenação** — as coleções deste documento se traduziriam em tabelas, com `cliente_id` como chave de partição natural para `pedidos` e `carrinho` (mesmo raciocínio da chave de shard hashed proposta na seção 3.3), e `produto_id` para `avaliacoes`.
- Índices secundários globais (GSI) substituiriam os índices compostos do MongoDB (ex.: consultar pedidos por `status`).

### 4.3 Qual escolher

Para a Amazonas, **MongoDB Atlas** é a transição mais natural a partir deste documento: o modelo já foi desenhado no vocabulário do MongoDB (embedding, referência, snapshot, sharding por hash), então a curva de adaptação é menor. **DynamoDB** seria uma opção interessante se a prioridade fosse eliminar por completo a operação de infraestrutura de banco (zero servidores, zero patches), aceitando reformular parte da modelagem em torno de chave de partição/ordenação e do modelo de consulta mais restrito do DynamoDB.

---

## Anexo A — Implementação opcional em MongoDB (bônus)

Este projeto inclui, como "ir além" opcional do enunciado, uma implementação real em Docker de um replica set MongoDB de 3 nós, populado com os dados de exemplo descritos na seção 2. Ver [`implementacao-docker-mongodb.md`](../implementacao-docker-mongodb.md) para os detalhes e [`docs/EVIDENCIAS.md`](../EVIDENCIAS.md) para as evidências (prints de `rs.status()`, teste de failover, contagem de documentos por coleção).

## Glossário

- **Documento**: um registro no MongoDB, semelhante a um objeto JSON.
- **Coleção**: um agrupamento de documentos, equivalente a uma "tabela" no modelo relacional.
- **Embedding**: guardar um dado "filho" dentro do documento "pai".
- **Referência**: guardar apenas o `_id` do documento relacionado, em vez de copiá-lo.
- **Snapshot**: copiar um dado no momento de uma transação, para preservar como ele era naquele instante.
- **Desnormalização**: aceitar dado duplicado de propósito, para evitar consultas caras.
- **Réplica / Replica set**: cópias idênticas do banco em vários servidores, para alta disponibilidade.
- **Sharding / Particionamento**: dividir os dados em fatias distintas entre servidores, para escalar volume e escrita.
- **Chave de shard**: o campo usado para decidir em qual fatia (shard) um documento vive.
- **Hotspot**: quando a distribuição de leitura/escrita se concentra desproporcionalmente em um único shard.
- **Race condition**: erro que ocorre quando duas operações concorrentes leem o mesmo dado antes de qualquer uma escrever.
- **Operação atômica**: uma operação que o banco executa como um passo indivisível, sem intervalo para outra operação interferir.
