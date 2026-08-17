#!/usr/bin/env bash
# Orquestra a inicialização do ambiente: espera os 3 nós ficarem prontos,
# inicia o replica set, aguarda a eleição do primary e roda o seed de dados.
set -euo pipefail

echo ">> Aguardando mongo1 responder..."
until mongosh --host mongo1 --port 27017 --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
  sleep 2
done
echo ">> mongo1 respondendo."

echo ">> Verificando/inicializando o replica set rsAmazonas..."
mongosh --host mongo1 --port 27017 --quiet /scripts/01-rs-init.js

echo ">> Aguardando eleição de um PRIMARY..."
until mongosh --host mongo1 --port 27017 --quiet --eval "rs.isMaster().ismaster" 2>/dev/null | grep -q true; do
  sleep 2
done
echo ">> Replica set com PRIMARY eleito."

echo ">> Populando coleções de exemplo (seed) via mongos do replica set..."
mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rsAmazonas" --quiet /scripts/02-seed-data.js

echo ">> Setup concluído com sucesso."
