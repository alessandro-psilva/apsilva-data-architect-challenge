.PHONY: up down restart reset ps logs status seed-status shell failover-test demo

# Sobe os 3 nós do replica set + roda o mongo-setup (init do replica set + seed).
# NOTA: --wait só garante que mongo1/2/3 estão "healthy" (respondendo ping) —
# não garante que o mongo-setup já terminou de inicializar o replica set e
# popular os dados (ele não tem healthcheck próprio). Para ter certeza de que
# o seed já rodou, use `make demo` (que também zera os dados) ou espere até
# `make seed-status` mostrar as contagens.
up:
	docker compose up -d --wait

down:
	docker compose down

# Reinicia sem apagar dados (útil depois de mudar o docker-compose.yml).
restart: down up

# Zera tudo (apaga os volumes) e sobe de novo do zero. Útil antes de tirar
# prints "limpos" pro docs/EVIDENCIAS.md.
reset:
	docker compose down -v
	docker compose up -d --wait

ps:
	docker compose ps

# Acompanha o log do container one-shot que inicializa o replica set e faz o seed.
logs:
	docker logs -f amazonas-mongo-setup

# Estado de cada membro do replica set (um PRIMARY, dois SECONDARY esperados).
status:
	docker exec amazonas-mongo1 mongosh --quiet --eval \
		"rs.status().members.forEach(m => print(m.name + ' -> ' + m.stateStr))"

# Contagem de documentos por coleção (confirma que o seed rodou). Conecta
# pela replicaSet connection string (não direto em mongo1): countDocuments()
# é uma leitura que exige o PRIMARY, e mongo1 nem sempre é o primary (ex.:
# logo depois de um `make failover-test`) — a connection string deixa o
# driver descobrir sozinho qual nó é o primary agora.
seed-status:
	docker exec amazonas-mongo1 mongosh --quiet \
		"mongodb://mongo1:27017,mongo2:27017,mongo3:27017/amazonas_ecommerce?replicaSet=rsAmazonas" --eval \
		"for (const c of ['clientes','produtos','formas_pagamento','pedidos','carrinho','avaliacoes']) { print(c + ': ' + db[c].countDocuments()); }"

# Shell interativo dentro do banco amazonas_ecommerce, também pela
# replicaSet connection string (mesmo motivo do seed-status acima).
shell:
	docker exec -it amazonas-mongo1 mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/amazonas_ecommerce?replicaSet=rsAmazonas"

# Derruba o primary, mostra a eleição do novo primary, e restaura o nó caído
# como secondary. Prova a alta disponibilidade na prática.
failover-test:
	@echo ">> Estado antes do failover:"
	@$(MAKE) status
	@echo ">> Derrubando o primary (mongo1)..."
	docker stop amazonas-mongo1
	@echo ">> Aguardando a eleição de um novo PRIMARY (até 30s)..."
	@timeout 30 bash -c 'until docker exec amazonas-mongo2 mongosh --quiet --eval "printjson(rs.status().members)" 2>/dev/null | grep -q PRIMARY; do sleep 1; done'
	@echo ">> Estado após o failover (mongo1 fora do ar):"
	docker exec amazonas-mongo2 mongosh --quiet --eval \
		"rs.status().members.forEach(m => print(m.name + ' -> ' + m.stateStr))"
	@echo ">> Restaurando mongo1 (volta como secondary)..."
	docker start amazonas-mongo1

# Reset completo + espera o seed terminar: um comando só pra tirar as
# evidências limpas pedidas em docs/EVIDENCIAS.md. Usa `docker logs -f` (não
# `docker logs` puro): streaming + grep encerra assim que a linha aparece,
# em vez de reler o log inteiro do zero a cada 3s até o timeout.
demo: reset
	@echo ">> Aguardando o seed terminar..."
	@timeout 120 bash -c 'docker logs -f amazonas-mongo-setup 2>&1 | grep -qm1 "Seed concluído"'
	@$(MAKE) status
	@$(MAKE) seed-status
