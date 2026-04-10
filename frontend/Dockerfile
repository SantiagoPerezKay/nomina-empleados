# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM nginx:alpine

# Copiar build estático
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar template de nginx (usa envsubst para inyectar API_URL)
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# API_URL se configura como variable de entorno en EasyPanel
# Ejemplo: http://trabajo-calzalindo-api-nomina:8000
ENV API_URL=http://localhost:8000
