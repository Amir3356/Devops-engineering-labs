FROM node:24-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY sale-service/ ./sale-service/

WORKDIR /app/sale-service

EXPOSE 5005

ENV NODE_ENV=production
ENV PORT=5005

CMD ["node", "server.js"]
