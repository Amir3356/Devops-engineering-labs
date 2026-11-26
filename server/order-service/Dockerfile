FROM node:24-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY order-service/ ./order-service/

WORKDIR /app/order-service

EXPOSE 5004

ENV NODE_ENV=production
ENV PORT=5004

CMD ["node", "server.js"]
