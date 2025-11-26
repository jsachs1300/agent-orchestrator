# Build stage
FROM node:20-bullseye as builder
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production image
FROM node:20-bullseye-slim
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /usr/src/app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets
COPY --from=builder /usr/src/app/dist ./dist

# Expose the service port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
