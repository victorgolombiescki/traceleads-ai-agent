#!/bin/bash

set -a

echo "🔄 Carregando variáveis de ambiente..."

if [ -r /root/.bashrc ]; then
    echo "   📄 Carregando /root/.bashrc..."
    source /root/.bashrc 2>/dev/null || true
fi

if [ -r ~/.bashrc ] && [ "$HOME/.bashrc" != "/root/.bashrc" ]; then
    echo "   📄 Carregando ~/.bashrc..."
    source ~/.bashrc 2>/dev/null || true
fi

if [ -r ~/.bash_profile ]; then
    echo "   📄 Carregando ~/.bash_profile..."
    source ~/.bash_profile 2>/dev/null || true
fi

if [ -r ~/.profile ]; then
    echo "   📄 Carregando ~/.profile..."
    source ~/.profile 2>/dev/null || true
fi

load_env_file() {
    local file=$1
    if [ -r "$file" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
                continue
            fi
            if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
                local key="${BASH_REMATCH[1]}"
                local value="${BASH_REMATCH[2]}"
                key=$(echo "$key" | xargs)
                value=$(echo "$value" | xargs)
                
                if [[ "$value" =~ ^\'.*\'$ ]]; then
                    value="${value:1:-1}"
                elif [[ "$value" =~ ^\".*\"$ ]]; then
                    value="${value:1:-1}"
                    value=$(eval echo "$value")
                elif [[ "$value" =~ ^\$[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
                    local var_name="${value#\$}"
                    if [ -n "${!var_name:-}" ]; then
                        value="${!var_name}"
                    fi
                fi
                
                export "$key=$value"
            fi
        done < "$file"
    fi
}

if [ -r .env ]; then
    echo "📄 Carregando variáveis do arquivo .env..."
    load_env_file .env
fi

if [ -r .env.local ]; then
    echo "📄 Carregando variáveis do arquivo .env.local..."
    load_env_file .env.local
fi

set +a

check_docker_permissions() {
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Erro de permissão do Docker detectado"
        echo ""
        echo "Soluções possíveis:"
        echo "1. Adicionar usuário ao grupo docker:"
        echo "   sudo usermod -aG docker $USER"
        echo "   newgrp docker"
        echo ""
        echo "2. Executar com sudo (não recomendado):"
        echo "   sudo ./deploy.sh"
        echo ""
        echo "3. Verificar se o Docker está rodando:"
        echo "   sudo systemctl status docker"
        echo ""
        read -p "Deseja tentar executar com sudo? (s/N): " usar_sudo
        if [[ "$usar_sudo" =~ ^[Ss]$ ]]; then
            echo "⚠️ Executando com sudo..."
            sudo "$0" "$@"
            exit $?
        else
            echo "❌ Não é possível continuar sem permissões do Docker"
            return 1
        fi
    fi
    return 0
}

imagem() {
    echo -e "\nBuild da imagem, aguarde...\n"

    if ! check_docker_permissions; then
        main
        return
    fi

    if [ -z "$NODE_ENV_AI_AGENT" ]; then
        echo "⚠️ Variável NODE_ENV_AI_AGENT não definida."
        echo "Escolha o ambiente:"
        select env in production homolog; do
            export NODE_ENV_AI_AGENT=$env
            break
        done
        if [ -z "$NODE_ENV_AI_AGENT" ]; then
            echo "❌ Ambiente não selecionado. Cancelando..."
            sleep 1
            main
            return
        fi
    fi

    if [ "$NODE_ENV_AI_AGENT" != "production" ] && [ "$NODE_ENV_AI_AGENT" != "homolog" ]; then
        echo "Erro: Ambiente inválido: $NODE_ENV_AI_AGENT. Use 'production' ou 'homolog'"
        sleep 1
        main
        return
    fi

    if [ "$NODE_ENV_AI_AGENT" == "production" ]; then
        TAG_NAME="latest"
    else
        TAG_NAME="homolog"
    fi

    IMAGE_TAG="ghcr.io/victorgolombiescki/ai-agent-backend:${TAG_NAME}"
    
    echo "🔧 Ambiente: $NODE_ENV_AI_AGENT"
    echo "🏷️ Tag da imagem: $IMAGE_TAG"
    
    echo ""
    echo "Escolha o tipo de build:"
    select build_type in "Build limpo (sem cache)" "Build rápido (com cache)"; do
        USE_CACHE=$([ "$build_type" == "Build rápido (com cache)" ] && echo "" || echo "--no-cache")
        break
    done

    echo "🔐 Verificando autenticação no GitHub Container Registry..."
    if ! docker info >/dev/null 2>&1 | grep -q "ghcr.io" 2>/dev/null; then
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "⚠️ Não autenticado e GITHUB_TOKEN não definido."
            echo "Tentando fazer login..."
            read -sp "Digite seu GitHub Personal Access Token (ou pressione Enter para tentar login interativo): " token_input
            echo
            if [ -n "$token_input" ]; then
                echo "$token_input" | docker login ghcr.io -u victorgolombiescki --password-stdin
            else
                docker login ghcr.io -u victorgolombiescki
            fi
            if [ $? -ne 0 ]; then
                echo "❌ Erro ao autenticar. Configure GITHUB_TOKEN ou faça login manualmente:"
                echo "   docker login ghcr.io -u victorgolombiescki"
                main
                return
            fi
        else
            echo "$GITHUB_TOKEN" | docker login ghcr.io -u victorgolombiescki --password-stdin
            if [ $? -ne 0 ]; then
                echo "❌ Erro ao autenticar com GITHUB_TOKEN"
                main
                return
            fi
        fi
        echo "✅ Autenticação realizada com sucesso"
    else
        echo "✅ Já autenticado"
    fi

    echo "🔨 Construindo imagem Docker..."
    if [ -n "$USE_CACHE" ]; then
        echo "⚠️ Build limpo (sem cache) - garantindo que todas as mudanças sejam incluídas"
    else
        echo "⚡ Build rápido (com cache) - mais rápido mas pode não incluir mudanças recentes"
    fi
    
    BUILD_CMD="docker build"
    if [ -n "$USE_CACHE" ]; then
        BUILD_CMD="$BUILD_CMD $USE_CACHE"
    fi
    BUILD_CMD="$BUILD_CMD --build-arg NODE_ENV=$NODE_ENV_AI_AGENT"
    BUILD_CMD="$BUILD_CMD -t $IMAGE_TAG ."
    
    eval $BUILD_CMD
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao construir a imagem"
        main
        return
    fi

    echo "📤 Fazendo push da imagem para o registry..."
    docker push "$IMAGE_TAG"
    
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao fazer push da imagem"
        echo ""
        echo "Possíveis causas:"
        echo "1. Token sem permissões corretas (write:packages, read:packages)"
        echo "2. Token expirado ou inválido"
        echo ""
        echo "Solução:"
        echo "1. Crie um novo Personal Access Token em: https://github.com/settings/tokens"
        echo "2. Selecione as permissões: write:packages, read:packages"
        echo "3. Faça login novamente:"
        echo "   docker login ghcr.io -u victorgolombiescki"
        echo "   (use o novo token como senha)"
        echo ""
        echo "Ou configure GITHUB_TOKEN:"
        echo "   export GITHUB_TOKEN=seu_novo_token"
        main
        return
    fi
    
    echo "✅ Imagem construída e enviada com sucesso!"

    sleep 1
    main
}

deploy() {
    echo -e "\nDeploy docker...\n"

    if ! check_docker_permissions; then
        main
        return
    fi

    if [ -z "$NODE_ENV_AI_AGENT" ]; then
        echo "⚠️ Variável NODE_ENV_AI_AGENT não definida."
        echo "Escolha o ambiente:"
        select env in production homolog; do
            export NODE_ENV_AI_AGENT=$env
            break
        done
        if [ -z "$NODE_ENV_AI_AGENT" ]; then
            echo "❌ Ambiente não selecionado. Cancelando..."
            sleep 1
            main
            return
        fi
    fi

    if [ "$NODE_ENV_AI_AGENT" == "production" ]; then
        export IMAGE_TAG="latest"
    else
        export IMAGE_TAG="homolog"
    fi

    IMAGE_FULL="ghcr.io/victorgolombiescki/ai-agent-backend:${IMAGE_TAG}"
    
    echo "🔍 Verificando variáveis de ambiente necessárias..."
    
    REQUIRED_VARS=(
        "DB_HOST" "DB_PORT" "DB_USERNAME" "DB_PASSWORD" "DB_DATABASE"
        "JWT_SECRET"
        "OPENAI_API_KEY"
        "AI_AGENT_TRAEFIK_URL"
    )
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -gt 0 ]; then
        echo ""
        echo "⚠️ Variáveis de ambiente faltando: ${MISSING_VARS[*]}"
        echo ""
        echo "💡 Soluções:"
        echo "1. Verifique se as variáveis estão exportadas no .bashrc:"
        echo "   grep -E '(DB_HOST|JWT_SECRET|OPENAI_API_KEY|AI_AGENT_TRAEFIK_URL)' ~/.bashrc"
        echo ""
        echo "2. Ou exporte manualmente antes de executar o script:"
        echo "   export DB_HOST='seu_host'"
        echo "   export JWT_SECRET='seu_secret'"
        echo "   export OPENAI_API_KEY='sua_key'"
        echo "   export AI_AGENT_TRAEFIK_URL='ai-agent.traceleads.com.br'"
        echo ""
        read -p "Deseja continuar mesmo assim? (s/N): " continuar
        if [[ ! "$continuar" =~ ^[Ss]$ ]]; then
            echo "Deploy cancelado."
            sleep 1
            main
            return
        fi
    else
        echo "✅ Todas as variáveis de ambiente necessárias estão definidas"
    fi
    
    echo "🔍 Verificando se a imagem existe no registry..."
    if ! docker manifest inspect "$IMAGE_FULL" > /dev/null 2>&1; then
        echo "⚠️ Aviso: Imagem $IMAGE_FULL não encontrada no registry."
        echo "É necessário buildar a imagem primeiro. Execute a opção 'imagem' antes de fazer o deploy."
        read -p "Deseja continuar mesmo assim? (s/N): " continuar
        if [[ ! "$continuar" =~ ^[Ss]$ ]]; then
            echo "Deploy cancelado."
            sleep 1
            main
            return
        fi
    else
        echo "✅ Imagem $IMAGE_FULL encontrada no registry."
    fi

    echo "🔐 Verificando autenticação no registry..."
    if ! docker pull "$IMAGE_FULL" > /dev/null 2>&1; then
        echo "⚠️ Não foi possível fazer pull da imagem. Verificando autenticação..."
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "⚠️ Variável GITHUB_TOKEN não definida."
            echo "Para autenticar no GitHub Container Registry, você precisa:"
            echo "1. Criar um Personal Access Token (PAT) no GitHub com permissão 'read:packages'"
            echo "2. Fazer login: docker login ghcr.io -u victorgolombiescki -p TOKEN"
            echo "3. Ou exportar GITHUB_TOKEN e executar: echo \$GITHUB_TOKEN | docker login ghcr.io -u victorgolombiescki --password-stdin"
            read -p "Deseja continuar mesmo assim? (s/N): " continuar
            if [[ ! "$continuar" =~ ^[Ss]$ ]]; then
                echo "Deploy cancelado."
                sleep 1
                main
                return
            fi
        fi
    else
        echo "✅ Autenticação no registry OK."
    fi

    SERVICE_NAME="trace_leads_ai_agent_backend"
    DESIRED_IMAGE="ghcr.io/victorgolombiescki/ai-agent-backend:${IMAGE_TAG}"
    
    echo "🔄 Forçando pull da imagem mais recente do registry..."
    docker pull "$DESIRED_IMAGE" || echo "⚠️ Não foi possível fazer pull (pode não existir ainda)"
    
    echo "🚀 Fazendo deploy do stack..."
    echo "📋 Variáveis que serão usadas no deploy:"
    echo "   IMAGE_TAG=${IMAGE_TAG}"
    echo "   NODE_ENV=${NODE_ENV:-production}"
    echo "   DB_HOST=${DB_HOST:-não definido}"
    echo "   DB_PORT=${DB_PORT:-não definido}"
    echo "   DB_DATABASE=${DB_DATABASE:-não definido}"
    echo "   DB_USERNAME=${DB_USERNAME:-não definido}"
    echo "   JWT_SECRET=${JWT_SECRET:+definido}"
    echo "   OPENAI_API_KEY=${OPENAI_API_KEY:+definido}"
    echo "   AI_AGENT_TRAEFIK_URL=${AI_AGENT_TRAEFIK_URL:-não definido}"
    
    set -a
    docker stack deploy -d --with-registry-auth -c ./docker-compose.yml trace_leads
    set +a
    
    echo -e "\n⏳ Aguardando o stack ser criado/atualizado...\n"
    sleep 3
    
    if docker service ls | grep -q "$SERVICE_NAME"; then
        echo "✅ Serviço $SERVICE_NAME encontrado"
        CURRENT_IMAGE=$(docker service inspect $SERVICE_NAME --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null | cut -d'@' -f1)
        
        if [ "$CURRENT_IMAGE" != "$DESIRED_IMAGE" ]; then
            echo "📦 Imagem diferente detectada. Atualizando serviço..."
            echo "   Atual: $CURRENT_IMAGE"
            echo "   Nova:  $DESIRED_IMAGE"
            docker service update --image "$DESIRED_IMAGE" --with-registry-auth $SERVICE_NAME
            echo -e "\n⏳ Aguardando atualização do serviço...\n"
            sleep 5
        else
            echo "🔄 Forçando atualização do serviço mesmo com mesma tag..."
            echo "   Imagem: $DESIRED_IMAGE"
            docker service update --force --image "$DESIRED_IMAGE" --with-registry-auth $SERVICE_NAME
            echo -e "\n⏳ Aguardando atualização do serviço...\n"
            sleep 5
        fi
    else
        echo "⚠️ Serviço $SERVICE_NAME não encontrado. Aguardando criação..."
        sleep 5
    fi
    
    echo -e "\n📊 Status do serviço:\n"
    docker service ps $SERVICE_NAME --no-trunc 2>/dev/null || echo "⚠️ Serviço ainda não está disponível"
    
    sleep 1
    main
}

sair() {
    exec bash
}

main() {
    echo -e "\nEscolha uma opcao:"
    select OPT in imagem deploy sair; do
        $OPT
    done
}

echo -e "\nScript de deploy - AI Agent Backend\n"

echo -e "Tentando atualizar código do repositório...\n"
if git pull origin main 2>/dev/null; then
    echo "✅ Código atualizado"
    git checkout main 2>/dev/null
else
    echo "⚠️ Não foi possível fazer git pull (pode ser falta de permissão SSH ou já está atualizado)"
    echo "Continuando com o código local..."
fi

main $1

