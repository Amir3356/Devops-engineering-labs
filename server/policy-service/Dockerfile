FROM node:24-alpine

WORKDIR /app

# Install dependencies from root package manifest
COPY package*.json ./
RUN npm install --omit=dev

# Copy shared utilities
COPY utils/ ./utils/

# Copy service source code
COPY policy-service/ ./policy-service/

WORKDIR /app/policy-service

EXPOSE 5009

ENV NODE_ENV=production
ENV PORT=5009

CMD ["node", "server.js"]
