// ============================================================================
// Seed de dados - Loja "Amazonas" (e-commerce)
//
// Este script materializa, em MongoDB de verdade, o modelo desenhado no
// Hackolade (template MongoDB) para o Documento Arquitetural. Cada coleção
// abaixo tem um comentário explicando a decisão de modelagem (o "porquê"
// que o enunciado pede: chaves, relacionamentos e justificativa de
// desnormalização).
//
// Convenções gerais:
//  - Referência (ObjectId) é usada quando a entidade referenciada cresce sem
//    limite e é reaproveitada em muitos contextos (ex.: cliente_id, produto_id).
//  - "Snapshot" embutido é usado quando o pedido precisa preservar o dado
//    como ele era NO MOMENTO da transação, mesmo que o original mude depois
//    (ex.: nome do cliente, preço do produto).
//  - Embedding puro é usado quando os subitens são sempre lidos junto com o
//    pai e têm tamanho limitado (ex.: itens de um pedido, endereços de um
//    cliente).
// ============================================================================

const dbName = "amazonas_ecommerce";
db = db.getSiblingDB(dbName);

// Única fonte de verdade para os nomes das 6 coleções, reaproveitada na
// limpeza (abaixo) e no resumo final — evita duas listas hardcoded que
// podem ficar dessincronizadas se uma coleção for adicionada/removida.
const COLLECTIONS = ["clientes", "produtos", "formas_pagamento", "pedidos", "carrinho", "avaliacoes"];

// Usamos "for...of" (não ".forEach()") de propósito: dentro de um callback
// de forEach, o mongosh NÃO aguarda automaticamente operações assíncronas
// do driver (drop/countDocuments retornam Promise) — só o corpo de um
// for/for-of no nível principal do script é reescrito para aguardar cada
// chamada. Com forEach, os drops abaixo disparariam "e esqueceriam", e um
// insertMany() logo em seguida poderia rodar antes do drop terminar.
print(">> Limpando coleções existentes (idempotência do seed)...");
for (const c of COLLECTIONS) {
  db[c].drop();
}

// ----------------------------------------------------------------------------
// 1) clientes
//    - Chave primária: _id (ObjectId).
//    - Endereços são EMBUTIDOS (array limitado, sempre lidos junto do cliente).
//    - NÃO embutimos o histórico de pedidos aqui: pedidos crescem sem limite
//      e são consultados de formas diferentes (por status, por período), por
//      isso viram uma coleção própria referenciando cliente_id.
// ----------------------------------------------------------------------------
const clienteAna = {
  _id: ObjectId(),
  nome: "Ana Beatriz Souza",
  email: "ana.souza@example.com",
  cpf: "123.456.789-00",
  telefone: "+55 92 99123-4567",
  data_cadastro: new Date("2024-02-10"),
  enderecos: [
    {
      apelido: "Casa",
      logradouro: "Rua das Palmeiras, 120",
      bairro: "Adrianópolis",
      cidade: "Manaus",
      estado: "AM",
      cep: "69057-000",
      principal: true,
    },
    {
      apelido: "Trabalho",
      logradouro: "Av. Djalma Batista, 1661, sala 302",
      bairro: "Chapada",
      cidade: "Manaus",
      estado: "AM",
      cep: "69050-010",
      principal: false,
    },
  ],
  preferencias: { newsletter: true, categorias_favoritas: ["eletronicos", "livros"] },
};

const clienteCarlos = {
  _id: ObjectId(),
  nome: "Carlos Eduardo Lima",
  email: "carlos.lima@example.com",
  cpf: "987.654.321-00",
  telefone: "+55 11 98888-1122",
  data_cadastro: new Date("2024-06-22"),
  enderecos: [
    {
      apelido: "Casa",
      logradouro: "Rua Augusta, 900, apto 45",
      bairro: "Consolação",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01305-100",
      principal: true,
    },
  ],
  preferencias: { newsletter: false, categorias_favoritas: ["vestuario"] },
};

db.clientes.insertMany([clienteAna, clienteCarlos]);
db.clientes.createIndex({ email: 1 }, { unique: true });
db.clientes.createIndex({ cpf: 1 }, { unique: true });

// ----------------------------------------------------------------------------
// 2) produtos
//    - Chave primária: _id (ObjectId); sku também é único (identificador de
//      negócio, usado em integrações externas).
//    - "atributos" é um subdocumento de esquema FLEXÍVEL: eletrônicos têm
//      voltagem/garantia, roupas têm tamanho/cor, livros têm autor/isbn -
//      típico caso de uso de schema-less do NoSQL (evita dezenas de colunas
//      nulas que existiriam num modelo relacional rígido).
//    - avaliacao_media / total_avaliacoes são CONTADORES DESNORMALIZADOS,
//      recalculados de forma assíncrona a partir da coleção `avaliacoes`,
//      para a página do produto não precisar agregar em tempo real (evita
//      "join"/aggregation cara em toda visualização de produto).
// ----------------------------------------------------------------------------
const produtoEcho = {
  _id: ObjectId(),
  sku: "ELET-ECHO-001",
  nome: "Echo Smart Speaker 4ª Geração",
  categoria: "eletronicos",
  subcategoria: "smart-home",
  descricao: "Caixa de som inteligente com assistente de voz integrado.",
  preco: 449.9,
  moeda: "BRL",
  estoque: { quantidade: 850, deposito: "AM-01" },
  atributos: { voltagem: "bivolt", garantia_meses: 12, conectividade: ["wifi", "bluetooth"] },
  imagens: ["https://cdn.amazonas.com/produtos/echo-001-1.jpg"],
  avaliacao_media: 4.5, // média das notas 5 e 4 em `avaliacoes` (avaliacao1/avaliacao2)
  total_avaliacoes: 2,
  ativo: true,
  criado_em: new Date("2023-11-01"),
};

const produtoCamiseta = {
  _id: ObjectId(),
  sku: "VEST-CAM-014",
  nome: "Camiseta Algodão Premium",
  categoria: "vestuario",
  subcategoria: "camisetas",
  descricao: "Camiseta 100% algodão, corte regular.",
  preco: 79.9,
  moeda: "BRL",
  estoque: { quantidade: 1200, deposito: "SP-02" },
  atributos: { tamanhos_disponiveis: ["P", "M", "G", "GG"], cor: "azul-marinho", material: "algodao" },
  imagens: ["https://cdn.amazonas.com/produtos/cam-014-1.jpg"],
  avaliacao_media: 4.0, // média da nota 4 em `avaliacoes` (avaliacao3)
  total_avaliacoes: 1,
  ativo: true,
  criado_em: new Date("2024-01-15"),
};

const produtoLivro = {
  _id: ObjectId(),
  sku: "LIVR-DDD-003",
  nome: "Domain-Driven Design Descomplicado",
  categoria: "livros",
  subcategoria: "tecnologia",
  descricao: "Guia prático de DDD para times de engenharia.",
  preco: 129.5,
  moeda: "BRL",
  estoque: { quantidade: 300, deposito: "SP-01" },
  atributos: { autor: "Vaughn Vernon", isbn: "978-8550811558", paginas: 424, idioma: "pt-BR" },
  imagens: ["https://cdn.amazonas.com/produtos/livr-003-1.jpg"],
  avaliacao_media: 0,
  total_avaliacoes: 0,
  ativo: true,
  criado_em: new Date("2024-03-05"),
};

db.produtos.insertMany([produtoEcho, produtoCamiseta, produtoLivro]);
db.produtos.createIndex({ sku: 1 }, { unique: true });
db.produtos.createIndex({ categoria: 1, ativo: 1 });
db.produtos.createIndex({ nome: "text", descricao: "text" });

// ----------------------------------------------------------------------------
// 3) formas_pagamento
//    - Meios de pagamento SALVOS pelo cliente (cartão tokenizado, chave PIX).
//    - Referencia cliente_id. NUNCA guardamos o número completo do cartão,
//      apenas token do gateway + últimos 4 dígitos (compliance PCI-DSS).
//    - É uma coleção separada (não embutida em `clientes`) porque tem ciclo
//      de vida próprio (adicionar/remover cartão não deve reescrever o
//      documento inteiro do cliente) e pode ser referenciada por auditorias.
// ----------------------------------------------------------------------------
const pagamentoAnaCartao = {
  _id: ObjectId(),
  cliente_id: clienteAna._id,
  tipo: "cartao_credito",
  bandeira: "visa",
  ultimos_digitos: "4242",
  token_gateway: "tok_visa_9f8a7b",
  validade: "12/2028",
  padrao: true,
  criado_em: new Date("2024-02-10"),
};

const pagamentoCarlosPix = {
  _id: ObjectId(),
  cliente_id: clienteCarlos._id,
  tipo: "pix",
  chave_pix_hash: "hash_sha256_chave_pix_carlos",
  padrao: true,
  criado_em: new Date("2024-06-22"),
};

db.formas_pagamento.insertMany([pagamentoAnaCartao, pagamentoCarlosPix]);
db.formas_pagamento.createIndex({ cliente_id: 1 });

// ----------------------------------------------------------------------------
// 4) pedidos
//    - Chave primária: _id; numero_pedido é a chave de negócio (visível ao
//      cliente).
//    - itens[] fica EMBUTIDO: é sempre lido junto do pedido, tem tamanho
//      limitado (poucas dezenas de itens no máximo) e nunca é consultado
//      isoladamente fora do contexto do pedido -> desnormalização clássica
//      para evitar join entre "pedidos" e "itens_pedido".
//    - cliente_snapshot e endereco_entrega são cópias (não referências) do
//      cliente/endereço NO MOMENTO da compra: se a Ana mudar de endereço
//      amanhã, o pedido antigo não pode mudar junto.
//    - forma_pagamento também é um snapshot (não referencia formas_pagamento
//      diretamente), pelo mesmo motivo: o cartão pode ser removido depois,
//      mas o pedido precisa manter o registro de como foi pago.
//    - cliente_id é mantido como REFERÊNCIA para permitir consultas do tipo
//      "todos os pedidos do cliente X" com índice, sem duplicar o cliente
//      inteiro em cada pedido.
//    - Chave de SHARD definida no Documento Arquitetural: cliente_id (hashed).
//      Hashear evita hotspot de escrita (cliente_id, sendo ObjectId, também
//      cresce com o tempo - range direto concentraria clientes novos sempre
//      no mesmo chunk) e ainda permite consulta direcionada por cliente
//      (o mongos calcula o hash e vai direto ao shard certo).
// ----------------------------------------------------------------------------
const pedidoAna = {
  _id: ObjectId(),
  numero_pedido: "PED-2025-000101",
  cliente_id: clienteAna._id,
  cliente_snapshot: { nome: clienteAna.nome, email: clienteAna.email },
  itens: [
    {
      produto_id: produtoEcho._id,
      sku: produtoEcho.sku,
      nome_produto: produtoEcho.nome,
      preco_unitario: produtoEcho.preco,
      quantidade: 1,
      subtotal: produtoEcho.preco,
    },
    {
      produto_id: produtoLivro._id,
      sku: produtoLivro.sku,
      nome_produto: produtoLivro.nome,
      preco_unitario: produtoLivro.preco,
      quantidade: 2,
      subtotal: produtoLivro.preco * 2,
    },
  ],
  endereco_entrega: clienteAna.enderecos[0],
  forma_pagamento: {
    tipo: "cartao_credito",
    bandeira: "visa",
    ultimos_digitos: "4242",
    parcelas: 3,
  },
  status: "entregue",
  historico_status: [
    { status: "criado", data: new Date("2025-01-10T14:32:00Z") },
    { status: "pago", data: new Date("2025-01-10T14:33:10Z") },
    { status: "enviado", data: new Date("2025-01-11T09:00:00Z") },
    { status: "entregue", data: new Date("2025-01-14T16:45:00Z") },
  ],
  valor_frete: 19.9,
  valor_desconto: 0,
  valor_total: produtoEcho.preco + produtoLivro.preco * 2 + 19.9,
  data_pedido: new Date("2025-01-10T14:32:00Z"),
};

const pedidoCarlos = {
  _id: ObjectId(),
  numero_pedido: "PED-2025-000102",
  cliente_id: clienteCarlos._id,
  cliente_snapshot: { nome: clienteCarlos.nome, email: clienteCarlos.email },
  itens: [
    {
      produto_id: produtoCamiseta._id,
      sku: produtoCamiseta.sku,
      nome_produto: produtoCamiseta.nome,
      preco_unitario: produtoCamiseta.preco,
      quantidade: 3,
      subtotal: produtoCamiseta.preco * 3,
    },
  ],
  endereco_entrega: clienteCarlos.enderecos[0],
  forma_pagamento: { tipo: "pix" },
  status: "pago", // deve sempre bater com o último item de historico_status
  historico_status: [
    { status: "criado", data: new Date("2025-08-10T10:00:00Z") },
    { status: "pago", data: new Date("2025-08-10T10:02:00Z") },
  ],
  valor_frete: 12.5,
  valor_desconto: 10.0,
  valor_total: produtoCamiseta.preco * 3 + 12.5 - 10.0,
  data_pedido: new Date("2025-08-10T10:00:00Z"),
};

db.pedidos.insertMany([pedidoAna, pedidoCarlos]);
// Índice único composto: o PREFIXO precisa ser a chave de shard (cliente_id)
// para que o MongoDB consiga garantir unicidade no cluster inteiro, não só
// dentro de cada shard isoladamente (regra de índice único em coleção sharded).
db.pedidos.createIndex({ cliente_id: 1, numero_pedido: 1 }, { unique: true });
db.pedidos.createIndex({ cliente_id: 1, data_pedido: -1 });
db.pedidos.createIndex({ status: 1 });

// ----------------------------------------------------------------------------
// 5) carrinho
//    - Coleção separada de `pedidos` porque tem ciclo de vida bem diferente:
//      é escrita com MUITO mais frequência (cada clique de "adicionar ao
//      carrinho") e efêmera (vira pedido ou expira).
//    - itens[] embutido, igual a pedidos, pelo mesmo motivo (lido/escrito
//      sempre em conjunto).
//    - Índice TTL em `atualizado_em`: carrinhos abandonados há mais de 30
//      dias são removidos automaticamente pelo próprio MongoDB - útil para
//      controlar o crescimento de dados dessa coleção "quente".
// ----------------------------------------------------------------------------
const carrinhoCarlos = {
  _id: ObjectId(),
  cliente_id: clienteCarlos._id,
  itens: [
    {
      produto_id: produtoEcho._id,
      nome_produto: produtoEcho.nome,
      preco_unitario: produtoEcho.preco,
      quantidade: 1,
    },
  ],
  criado_em: new Date(),
  atualizado_em: new Date(),
};

db.carrinho.insertOne(carrinhoCarlos);
db.carrinho.createIndex({ cliente_id: 1 }, { unique: true });
db.carrinho.createIndex({ atualizado_em: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // TTL 30 dias

// ----------------------------------------------------------------------------
// 6) avaliacoes
//    - Referencia produto_id (para "todas as avaliações do produto X") e
//      cliente_id (para auditoria/anti-fraude), mas guarda cliente_nome como
//      SNAPSHOT para renderizar a lista de avaliações sem precisar buscar o
//      cliente a cada review (evita join na tela de produto, que é a mais
//      acessada do site).
//    - Chave de SHARD definida no Documento Arquitetural: produto_id (hashed).
//      Atenção: hashear distribui bem entre produtos DIFERENTES, mas não
//      resolve um único produto "viral" que concentre um volume desproporcional
//      de avaliações (isso é um hot key, não um hot chunk - limitação conhecida,
//      registrada no documento como risco aceito nesta versão do modelo).
// ----------------------------------------------------------------------------
const avaliacao1 = {
  _id: ObjectId(),
  produto_id: produtoEcho._id,
  cliente_id: clienteAna._id,
  cliente_nome: clienteAna.nome,
  nota: 5,
  comentario: "Excelente qualidade de som, configurei em minutos.",
  util_count: 12,
  data: new Date("2025-01-16T20:00:00Z"),
};

const avaliacao2 = {
  _id: ObjectId(),
  produto_id: produtoEcho._id,
  cliente_id: clienteCarlos._id,
  cliente_nome: clienteCarlos.nome,
  nota: 4,
  comentario: "Muito bom, só achei o app de configuração um pouco lento.",
  util_count: 3,
  data: new Date("2025-08-01T08:15:00Z"),
};

const avaliacao3 = {
  _id: ObjectId(),
  produto_id: produtoCamiseta._id,
  cliente_id: clienteCarlos._id,
  cliente_nome: clienteCarlos.nome,
  nota: 4,
  comentario: "Tecido bom, mas veste um pouco larga.",
  util_count: 1,
  data: new Date("2025-08-12T12:00:00Z"),
};

db.avaliacoes.insertMany([avaliacao1, avaliacao2, avaliacao3]);
db.avaliacoes.createIndex({ produto_id: 1, data: -1 });
db.avaliacoes.createIndex({ cliente_id: 1 });

// ----------------------------------------------------------------------------
// Resumo final
// ----------------------------------------------------------------------------
print(">> Seed concluído. Contagem de documentos por coleção:");
for (const c of COLLECTIONS) {
  print("   - " + c + ": " + db[c].countDocuments());
}
