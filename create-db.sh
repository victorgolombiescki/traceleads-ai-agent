#!/bin/bash
# Script para criar o banco de dados PostgreSQL

echo "🔧 Criando banco de dados PostgreSQL..."

# Verifica se DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL não está configurado no .env"
  echo "📝 Por favor, configure DATABASE_URL no arquivo .env"
  echo ""
  echo "Exemplo:"
  echo "DATABASE_URL=postgresql://usuario:senha@localhost:5432/ai_agents"
  exit 1
fi

# Extrai informações da URL do banco
# Formato: postgresql://user:password@host:port/database
DB_URL=$(echo $DATABASE_URL | sed 's|postgresql://||')
DB_USER=$(echo $DB_URL | cut -d: -f1)
DB_PASS=$(echo $DB_URL | cut -d: -f2 | cut -d@ -f1)
DB_HOST=$(echo $DB_URL | cut -d@ -f2 | cut -d: -f1)
DB_PORT=$(echo $DB_URL | cut -d@ -f2 | cut -d: -f2 | cut -d/ -f1)
DB_NAME=$(echo $DB_URL | cut -d/ -f2)

echo "📊 Informações do banco:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo ""

# Tenta criar o banco de dados
PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ Banco de dados '$DB_NAME' criado com sucesso!"
else
  echo "⚠️  Banco de dados pode já existir ou houve um erro."
  echo "   Verifique as credenciais e permissões do PostgreSQL"
fi


