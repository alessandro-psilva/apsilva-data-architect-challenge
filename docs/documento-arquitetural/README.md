# Passo 3 de 4 — O Documento Arquitetural (entregável final)

> Você está no **passo 3** do percurso deste repositório. Veja o [README da raiz](../../README.md#como-usar-este-repositório-percurso-recomendado) para o mapa completo. Este passo assume que você já passou por [`guia-de-estudos/`](../guia-de-estudos/) e [`modelagem-hackolade/`](../modelagem-hackolade/).

Este é o **Requisito 3** do enunciado — o entregável oficial do desafio: um documento técnico (originalmente pedido em Word, entregue em PDF) reunindo descrição do sistema, estrutura de dados, plano de escalabilidade e, como bônus, uma visão de implementação em nuvem.

## O que já está pronto

[`documento-arquitetural.md`](documento-arquitetural.md) é um **rascunho completo** desse documento, já escrito, cobrindo os 4 itens exigidos pelo enunciado:

1. Descrição do sistema (contexto e objetivos)
2. Estrutura de dados proposta (as 6 coleções, detalhadas uma a uma)
3. Plano de escalabilidade (o que replica, o que particiona, crescimento de dados, concorrência)
4. Visão de implementação via Atlas/DynamoDB (o "plus" do enunciado)

Ele reaproveita o conteúdo já validado em [`guia-de-estudos/`](../guia-de-estudos/), mas reescrito no registro formal de um documento técnico (não de uma aula) e organizado na ordem exata que o enunciado pede — não na ordem didática dos módulos de ensino.

## O que falta você fazer

1. **Preencher os campos entre colchetes** no topo do arquivo (seu nome, data de entrega).
2. **Inserir a imagem do diagrama Hackolade** na seção 2.4 — o arquivo que você exportou no [passo 2](../modelagem-hackolade/). Salve-a em [`docs/screenshots/`](../screenshots/) e referencie com `![Diagrama](../screenshots/nome-do-arquivo.png)`.
3. Se você fez a implementação opcional em Docker ([passo 4](../implementacao-docker-mongodb.md)), revise o Anexo A e confira se os links para as evidências em [`docs/EVIDENCIAS.md`](../EVIDENCIAS.md) fazem sentido para o que você efetivamente rodou.
4. **Revisar e personalizar** — o rascunho é um ponto de partida sólido, mas é importante que o texto reflita seu próprio entendimento. Ajuste o que fizer sentido, adicione observações que você teve durante o processo (o critério de avaliação do enunciado inclui "criatividade nas soluções apresentadas").

## Como transformar o Markdown em Word/PDF

Você tem três caminhos, do mais simples ao mais flexível:

### Opção 1 — Copiar e colar (mais simples, sem instalar nada)

Abra `documento-arquitetural.md` em um editor de texto ou no GitHub (renderizado), copie o conteúdo e cole direto no Word ou Google Docs. Títulos, negrito e tabelas Markdown geralmente colam formatados corretamente na maioria dos editores modernos. Ajuste a formatação final (capa, fontes, espaçamento) manualmente.

### Opção 2 — Pandoc (linha de comando, resultado mais limpo)

Se você tem o [Pandoc](https://pandoc.org/) instalado:

```bash
cd docs/documento-arquitetural
pandoc documento-arquitetural.md -o documento-arquitetural.docx
```

Abra o `.docx` gerado no Word, ajuste a formatação (capa, estilos) e exporte como PDF (**Arquivo → Salvar como → PDF**).

### Opção 3 — Exportar direto para PDF

```bash
pandoc documento-arquitetural.md -o documento-arquitetural.pdf
```

Mais rápido, mas com menos controle sobre a formatação final do que passar pelo Word primeiro. Bom para uma conferência rápida antes da versão definitiva.

## Checklist antes de entregar

- [ ] Nome e data preenchidos na capa.
- [ ] Diagrama do Hackolade inserido na seção 2.4.
- [ ] As 6 coleções estão detalhadas (seção 2.3).
- [ ] O que particiona e o que replica está explicado, com o porquê (seção 3).
- [ ] Crescimento de dados e alta concorrência estão endereçados (seções 3.4 e 3.5).
- [ ] Visão Atlas/DynamoDB incluída (seção 4 — bônus, mas soma pontos por "criatividade").
- [ ] Exportado como PDF.

## Próximo passo (opcional)

O essencial do desafio termina aqui. Se você quiser "ir além" e ganhar a experiência prática de rodar o modelo em um banco de verdade, siga para **[`implementacao-docker-mongodb.md`](../implementacao-docker-mongodb.md)** — o passo 4, opcional.
