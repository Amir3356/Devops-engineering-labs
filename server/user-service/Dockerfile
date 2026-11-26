FROM node:24-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY user-service/ ./user-service/

WORKDIR /app/user-service

EXPOSE 5001

ENV NODE_ENV=production
ENV PORT=5001

CMD ["node", "server.js"]
