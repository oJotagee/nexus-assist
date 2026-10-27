#!/bin/bash
set -e

# Cria databases extras a partir de POSTGRES_EXTRA_DATABASES (separados por vírgula).
# O database padrão (POSTGRES_DB) a imagem oficial já cria sozinha.

if [ -n "$POSTGRES_EXTRA_DATABASES" ]; then
  IFS=',' read -ra DATABASES <<< "$POSTGRES_EXTRA_DATABASES"
  for db in "${DATABASES[@]}"; do
    db=$(echo "$db" | xargs)
    echo "Creating database: $db"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
      SELECT 'CREATE DATABASE "$db"'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
  done
fi