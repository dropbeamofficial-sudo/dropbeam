FROM node:18-alpine
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy app
COPY . .

# Ensure uploads dir exists
RUN mkdir -p /app/uploads

EXPOSE 3000
CMD ["node", "server.js"]
