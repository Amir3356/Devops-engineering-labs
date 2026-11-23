FROM node:20-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY purchase-service/ ./purchase-service/

WORKDIR /app/purchase-service

EXPOSE 5003

ENV NODE_ENV=production
ENV PORT=5003

CMD ["node", "server.js"]
