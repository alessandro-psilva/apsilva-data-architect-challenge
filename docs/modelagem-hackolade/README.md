# Passo 2 de 4 — Desenhando o modelo no Hackolade

> Você está no **passo 2** do percurso deste repositório. Veja o [README da raiz](../../README.md#como-usar-este-repositório-percurso-recomendado) para o mapa completo. Se ainda não leu [`guia-de-estudos/`](../guia-de-estudos/), vale a pena ler primeiro — este passo assume que você já entende os conceitos de embedding, referência e snapshot explicados lá.

Este é o **Requisito 1** do enunciado: desenhar as coleções no Hackolade (template MongoDB) e colar o resultado no Documento Arquitetural. Este guia não pressupõe que você já usou Hackolade — vamos do zero.

## 1. O que é o Hackolade e por que o enunciado pede especificamente ele

[Hackolade Studio](https://studio.hackolade.com/) é uma ferramenta de modelagem de dados especializada em bancos **NoSQL** — ao contrário de ferramentas de diagrama genéricas (Draw.io, Miro), ela entende o vocabulário do MongoDB: coleções, documentos aninhados, arrays, índices, chave de shard. É por isso que o enunciado pede ela especificamente (com Miro/Draw.io/Excalidraw citados só como alternativa aceitável para quem preferir um diagrama mais livre).

> Interface e menus mudam entre versões — trate os nomes de botões abaixo como "o caminho geral", não como coordenadas exatas de clique. Se algum menu estiver em outro lugar na sua versão, o conceito (criar entidade → adicionar campos → adicionar relação) continua o mesmo.

## 2. Criar conta e um novo projeto

1. Acesse [studio.hackolade.com](https://studio.hackolade.com/) e crie uma conta (o Hackolade oferece um período de avaliação gratuito, suficiente para um modelo pequeno como este de 6 coleções).
2. Baixe e instale o Hackolade Studio (desktop) ou use a versão web, conforme a oferta disponível no momento em que você acessar.
3. Crie um **novo projeto** e, ao escolher o "target" (banco de destino), selecione **MongoDB**. É esse target que ativa o vocabulário certo (coleção, documento, embedding, array, shard key).

## 3. Popular o modelo — duas rotas possíveis (escolha uma)

### Rota A — Importar os schemas prontos (mais rápida, não exige nada rodando)

A pasta [`schemas/`](schemas/) deste diretório tem um arquivo **JSON Schema** por coleção, já com a estrutura completa (campos, tipos, e uma `description` explicando cada decisão de modelagem — embedding, referência ou snapshot):

| Arquivo | Coleção |
|---|---|
| [`schemas/clientes.schema.json`](schemas/clientes.schema.json) | `clientes` |
| [`schemas/produtos.schema.json`](schemas/produtos.schema.json) | `produtos` |
| [`schemas/formas_pagamento.schema.json`](schemas/formas_pagamento.schema.json) | `formas_pagamento` |
| [`schemas/pedidos.schema.json`](schemas/pedidos.schema.json) | `pedidos` |
| [`schemas/carrinho.schema.json`](schemas/carrinho.schema.json) | `carrinho` |
| [`schemas/avaliacoes.schema.json`](schemas/avaliacoes.schema.json) | `avaliacoes` |

No Hackolade, procure por **File → Import → JSON Schema** (ou similar — pode aparecer como "Reverse-Engineer JSON Schema"). Importe cada um dos 6 arquivos; cada import cria uma entidade (coleção) no diagrama, já com os campos e os comentários preenchidos.

### Rota B — Reverse-engineer a partir do banco rodando de verdade (mais "real", mas exige o passo 4)

Se você já subiu o ambiente Docker descrito em [`implementacao-docker-mongodb.md`](../implementacao-docker-mongodb.md) (`make up`, rodado na raiz do repositório), o Hackolade consegue se conectar direto no MongoDB local, amostrar os documentos reais e gerar o modelo automaticamente:

1. No Hackolade, escolha **conectar a um banco existente / Reverse-Engineer**.
2. Connection string: `mongodb://localhost:27017/amazonas_ecommerce`.
3. Selecione as 6 coleções (`clientes`, `produtos`, `formas_pagamento`, `pedidos`, `carrinho`, `avaliacoes`) e deixe o Hackolade amostrar os documentos e inferir os campos.

Essa rota tem a vantagem de provar que o modelo desenhado é o mesmo que está rodando de verdade — mas não é obrigatória; a Rota A já entrega tudo que o Requisito 1 pede.

## 4. Adicionar as relações entre coleções

Import de schema (Rota A) não desenha sozinho as setas de relação — isso é uma decisão de modelagem que você adiciona manualmente, com a ferramenta de relação do próprio Hackolade (geralmente um ícone de linha/seta na barra de ferramentas do diagrama). Use esta tabela como roteiro — ela é o mesmo mapa do [Módulo 2.5 do guia de estudos](../guia-de-estudos/README.md#25-nosso-modelo-final-recapitulando):

| De | Para | Campo | Tipo de relação |
|---|---|---|---|
| `formas_pagamento` | `clientes` | `cliente_id` | Referência |
| `pedidos` | `clientes` | `cliente_id` (+ `cliente_snapshot` embutido) | Referência + snapshot |
| `pedidos` | `produtos` | `itens[].produto_id` (+ dados do produto embutidos em `itens[]`) | Referência + embedding |
| `carrinho` | `clientes` | `cliente_id` | Referência |
| `carrinho` | `produtos` | `itens[].produto_id` | Referência + embedding |
| `avaliacoes` | `produtos` | `produto_id` | Referência |
| `avaliacoes` | `clientes` | `cliente_id` (+ `cliente_nome` como snapshot) | Referência + snapshot |

Ao desenhar cada seta, se o Hackolade perguntar o tipo de relação, use **reference** (não "foreign key" no sentido relacional — o MongoDB não impõe integridade referencial automaticamente; a seta aqui é documentação da intenção de modelagem, não uma constraint do banco).

## 5. Anotar as decisões de shard key e índices

Para cada coleção, use o campo de descrição/notas do próprio Hackolade (geralmente disponível ao clicar na entidade ou em cada atributo) para registrar o que o **Requisito 2** do enunciado (escalabilidade) vai exigir depois:

| Coleção | Anotar como nota |
|---|---|
| `pedidos` | Chave de shard: `cliente_id` (hashed). Índices: `{cliente_id: 1, numero_pedido: 1}` único, `{cliente_id: 1, data_pedido: -1}`, `{status: 1}` |
| `avaliacoes` | Chave de shard: `produto_id` (hashed). Índices: `{produto_id: 1, data: -1}`, `{cliente_id: 1}` |
| `carrinho` | Índice único `{cliente_id: 1}` + índice TTL `{atualizado_em: 1}` (expira em 30 dias) |
| `clientes` | Índices únicos `{email: 1}` e `{cpf: 1}` |
| `produtos` | Índice único `{sku: 1}`, índice composto `{categoria: 1, ativo: 1}`, índice de texto `{nome, descricao}` |
| `formas_pagamento` | Índice `{cliente_id: 1}` |

Essas anotações já são, na prática, um rascunho do que vai virar texto no Documento Arquitetural — o [passo 3](../documento-arquitetural/) reaproveita exatamente essa tabela.

## 6. Exportar o diagrama

Quando o diagrama estiver pronto (6 entidades + relações + notas), exporte ou tire um print — procure por **File → Export → Diagram as image/PDF** (ou tire um print de tela normal, se preferir):

1. Salve a imagem em [`docs/screenshots/`](../screenshots/) com um nome descritivo, por exemplo `01-hackolade-diagrama-amazonas.png`.
2. Você vai inserir essa imagem na seção 2 do Documento Arquitetural (próximo passo).

## Checklist antes de seguir

- [ ] As 6 coleções (`clientes`, `produtos`, `formas_pagamento`, `pedidos`, `carrinho`, `avaliacoes`) estão no diagrama.
- [ ] As relações entre elas estão desenhadas (tabela da seção 4).
- [ ] Shard keys e índices anotados (seção 5).
- [ ] Diagrama exportado como imagem em `docs/screenshots/`.

## Próximo passo

Siga para **[`documento-arquitetural/`](../documento-arquitetural/)** — o passo 3, onde este diagrama entra na seção 2 do documento final.
