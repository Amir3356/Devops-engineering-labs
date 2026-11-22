FROM node:20-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY inventory-service/ ./inventory-service/

WORKDIR /app/inventory-service

EXPOSE 5006

ENV NODE_ENV=production
ENV PORT=5006

CMD ["node", "server.js"]
