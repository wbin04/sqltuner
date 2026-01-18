# Frontend Dockerfile for React + Vite
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Expose port
EXPOSE 5173

# Start development server with host access
CMD ["npm", "run", "dev", "--", "--host"]