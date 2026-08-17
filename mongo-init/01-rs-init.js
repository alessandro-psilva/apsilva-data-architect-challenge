// Inicializa o Replica Set "rsAmazonas" (1 primary + 2 secondaries).
// Idempotente: se o replica set já foi inicializado, apenas ignora o erro.

const config = {
  _id: "rsAmazonas",
  members: [
    { _id: 0, host: "mongo1:27017", priority: 2 }, // maior prioridade = candidato preferencial a primary
    { _id: 1, host: "mongo2:27017", priority: 1 },
    { _id: 2, host: "mongo3:27017", priority: 1 },
  ],
};

try {
  const status = rs.status();
  print(">> Replica set já inicializado: " + status.set);
} catch (e) {
  // rs.status() lança "NotYetInitialized" (codeName) quando o replica set
  // ainda não existe — é o único caso em que devemos tentar inicializar.
  // Qualquer outro erro (ex.: falha transitória de conexão) deve propagar
  // em vez de ser tratado como "primeira execução", senão rs.initiate()
  // seria chamado num set que já existe, e falharia de forma confusa.
  if (e.codeName !== "NotYetInitialized") {
    print(">> Erro inesperado ao consultar rs.status(): " + e);
    throw e;
  }
  print(">> Inicializando replica set com a configuração:");
  printjson(config);
  const result = rs.initiate(config);
  printjson(result);
}
