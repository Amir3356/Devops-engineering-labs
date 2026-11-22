FROM node:20-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY notification-service/ ./notification-service/

WORKDIR /app/notification-service

EXPOSE 5007

ENV NODE_ENV=production
ENV PORT=5007

CMD ["node", "server.js"]
