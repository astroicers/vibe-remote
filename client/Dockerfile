FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Expose port
EXPOSE 5173

# Start dev server with host binding
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
