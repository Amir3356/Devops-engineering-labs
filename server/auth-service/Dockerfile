FROM node:24-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY auth-service/ ./auth-service/

WORKDIR /app/auth-service

EXPOSE 5008

ENV NODE_ENV=production
ENV PORT=5008

CMD ["node", "server.js"]
