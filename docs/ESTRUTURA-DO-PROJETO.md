# Estrutura do Projeto

Este documento explica o que cada arquivo e pasta do repositório faz — a ideia é que, abrindo o
projeto do zero (ou voltando depois de um tempo), dê pra entender rápido onde está cada coisa e por
quê. Para a ordem em que percorrer os passos, veja o [README da raiz](../README.md#como-usar-este-repositório-percurso-recomendado).

A organização segue o mesmo princípio do
[`apsilva-data-platform-open-source`](https://github.com/alessandro-psilva/apsilva-data-platform-open-source):
o que é **executável** (Docker, Makefile, scripts) fica solto na raiz; o que é **documentação/conteúdo**
fica agrupado em `docs/`.

```
apsilva-data-architect-challenge/
├── README.md                                  ← porta de entrada: percurso recomendado, status, diagrama
├── Enunciado do Desafio Final - ... .pdf       ← enunciado original do professor
├── Makefile                                    ← atalhos pra rodar a implementação opcional (make up, make status...)
├── docker-compose.yml                          ← sobe o cluster MongoDB local (3 nós + seed)
├── mongo-init/                                 ← scripts que inicializam o replica set e populam os dados
│   ├── 00-entrypoint.sh
│   ├── 01-rs-init.js
│   └── 02-seed-data.js
└── docs/
    ├── ESTRUTURA-DO-PROJETO.md                 ← este arquivo
    ├── EVIDENCIAS.md                           ← checklist dos entregáveis + espaço pros prints
    ├── screenshots/                            ← os prints em si
    ├── implementacao-docker-mongodb.md         ← passo 4: guia da implementação opcional
    ├── guia-de-estudos/                        ← passo 1: os 4 fundamentos teóricos
    │   ├── README.md
    │   └── assets/
    ├── modelagem-hackolade/                    ← passo 2: desenhar o modelo no Hackolade
    │   ├── README.md
    │   └── schemas/
    └── documento-arquitetural/                 ← passo 3: o entregável oficial (Word/PDF)
        ├── README.md
        └── documento-arquitetural.md
```

## Raiz do repositório

**`README.md`** — a página inicial do projeto. Explica do que se trata o desafio, mostra um diagrama
do modelo, lista o percurso recomendado, o status da entrega e os requisitos do enunciado resumidos. É
o primeiro arquivo que qualquer pessoa (incluindo você, meses depois) deveria abrir.

**`Enunciado do Desafio Final - Módulo Desafio - Arquiteto(a) de dados.pdf`** — o enunciado original,
fornecido pelo professor João Paulo Faria. Fonte de verdade de tudo que precisa ser entregue: nunca
deve ser editado, só consultado.

**`Makefile`** — atalhos para os comandos do dia a dia da implementação opcional: `make up`, `make
status` (estado do replica set), `make seed-status` (contagem de documentos), `make failover-test`
(derruba o primary e mostra a eleição), `make demo` (reset limpo + espera + status, pra tirar prints de
evidência). Fica na raiz (não dentro de uma subpasta) para rodar sem precisar de `cd`.

**`docker-compose.yml`** — descreve os containers do ambiente: 3 nós MongoDB formando um *replica set*
(1 primary + 2 secondaries) e um container auxiliar (`mongo-setup`) que roda uma vez só, pra
inicializar tudo.

**`mongo-init/`** — os scripts que o container `mongo-setup` executa:
- `00-entrypoint.sh` — script "maestro": espera os 3 nós MongoDB responderem, chama o script de
  inicialização do replica set, aguarda a eleição de um primary, e só então roda o seed de dados.
- `01-rs-init.js` — comando MongoDB (`rs.initiate`) que transforma os 3 containers soltos num replica
  set de verdade, com `mongo1` como candidato preferencial a primary. Idempotente (não falha se rodar
  de novo contra um replica set já inicializado).
- `02-seed-data.js` — cria as 6 coleções do modelo (`clientes`, `produtos`, `formas_pagamento`,
  `pedidos`, `carrinho`, `avaliacoes`) com dados de exemplo e comentários explicando cada decisão de
  modelagem — a mesma fonte usada para gerar os schemas em `docs/modelagem-hackolade/schemas/`.

## `docs/` — documentação e conteúdo de estudo

**`ESTRUTURA-DO-PROJETO.md`** — este arquivo.

**`EVIDENCIAS.md`** — checklist dos entregáveis do enunciado (obrigatórios e opcionais), cada um
apontando pra onde ele é produzido neste repositório, com espaço reservado pros prints/screenshots que
comprovam cada um.

**`screenshots/`** — os prints em si (`.png`), referenciados por `EVIDENCIAS.md` e inseridos no
Documento Arquitetural: o diagrama exportado do Hackolade, `rs.status()` do MongoDB, teste de
failover, contagem de documentos do seed.

**`implementacao-docker-mongodb.md`** — passo 4 (opcional/bônus) do percurso: como rodar o `docker-compose.yml`/`Makefile`/`mongo-init/` da raiz, como verificar a réplica, como testar failover, e a
tabela de decisões de modelagem por coleção.

### `docs/guia-de-estudos/` — passo 1: material de estudo

Não é um entregável do desafio — é o material de apoio conceitual, cobrindo os 4 objetivos de ensino
do enunciado (Fundamentos de Arquitetura de Dados, Modelagem Não-Relacional, Arquitetura de Dados
Escaláveis, Principais Arquiteturas de Dados da Atualidade), mais um Módulo 5 bônus lendo o código de
`mongo-init/` linha por linha.

**`README.md`** — a aula em si: um guia em Markdown que explica cada conceito em linguagem simples e
amarra com as decisões concretas tomadas no modelo da Amazonas.

**`assets/`** — as imagens (`.png`) referenciadas pelo `README.md`: diagramas comparando relacional
vs. não-relacional, escala vertical vs. horizontal, replicar vs. particionar, o problema de
concorrência no estoque, e o panorama de arquiteturas de dados atuais.

### `docs/modelagem-hackolade/` — passo 2: Requisito 1 do enunciado

**`README.md`** — tutorial passo a passo de como desenhar o modelo no Hackolade: criar conta/projeto,
duas formas de popular as 6 entidades (importar os schemas prontos, ou fazer reverse-engineer a partir
do MongoDB rodando localmente), como desenhar as relações entre coleções, como anotar shard
keys/índices, e como exportar o diagrama final.

**`schemas/`** — um arquivo JSON Schema por coleção (`clientes`, `produtos`, `formas_pagamento`,
`pedidos`, `carrinho`, `avaliacoes`), com a estrutura completa de campos e comentários explicando cada
decisão de modelagem — pronto pra importar direto no Hackolade em vez de desenhar cada entidade do
zero.

### `docs/documento-arquitetural/` — passo 3: Requisito 3 do enunciado

**`README.md`** — explica o que já está pronto no rascunho, o que falta você preencher, e como
transformar o Markdown em Word/PDF (copiar e colar, ou via Pandoc).

**`documento-arquitetural.md`** — o arquivo mais importante desta pasta: o rascunho completo do
Documento Arquitetural, cobrindo os 4 itens exigidos (descrição do sistema, estrutura de dados, plano
de escalabilidade, visão Atlas/DynamoDB), escrito no registro formal de um documento técnico e
organizado na ordem que o enunciado pede.
