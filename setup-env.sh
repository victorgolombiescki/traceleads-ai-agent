#!/bin/bash

# Script para configurar o arquivo .env

echo "🔧 Configurando variáveis de ambiente..."

if [ -f .env ]; then
    echo "⚠️  Arquivo .env já existe. Deseja sobrescrever? (s/N)"
    read -r response
    if [[ ! "$response" =~ ^[Ss]$ ]]; then
        echo "❌ Operação cancelada."
        exit 0
    fi
fi

# Copiar exemplo
cp .env.example .env

echo "✅ Arquivo .env criado a partir do .env.example"
echo ""
echo "📝 Por favor, edite o arquivo .env e configure as seguintes variáveis:"
echo ""
echo "  1. DATABASE_URL - URL de conexão do PostgreSQL"
echo "  2. OPENAI_API_KEY - Chave da API OpenAI (opcional)"
echo "  3. OWNER_OPEN_ID - OpenID do proprietário (opcional)"
echo ""
echo "💡 Exemplo de DATABASE_URL:"
echo "   postgresql://usuario:senha@localhost:5432/ai_agents"
echo ""



