FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk add --no-cache openssl curl && \
    npm install --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf /var/cache/apk/* /tmp/*

COPY . .

RUN npm run build && \
    echo "📋 Verificando arquivos gerados no build:" && \
    ls -la dist/ && \
    echo "📋 Verificando se main.js existe:" && \
    test -f dist/src/main.js && echo "✅ dist/src/main.js encontrado" || (echo "❌ Erro: dist/src/main.js não foi gerado pelo build" && find dist -name "main.js" && exit 1)

FROM node:20-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk add --no-cache openssl curl && \
    npm install --omit=dev --legacy-peer-deps && \
    npm cache clean --force && \
    rm -rf /var/cache/apk/* /tmp/*

COPY --from=development /usr/src/app/dist ./dist

RUN echo "📋 Verificando arquivos copiados:" && \
    ls -la dist/ && \
    test -f dist/src/main.js && echo "✅ dist/src/main.js encontrado no stage de produção" || (echo "❌ Erro: dist/src/main.js não encontrado no stage de produção" && find dist -name "main.js" && exit 1)

CMD ["node", "dist/src/main.js"]

