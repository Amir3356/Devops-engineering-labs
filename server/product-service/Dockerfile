FROM node:20-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY product-service/ ./product-service/

WORKDIR /app/product-service

EXPOSE 5002

ENV NODE_ENV=production
ENV PORT=5002

CMD ["node", "server.js"]
