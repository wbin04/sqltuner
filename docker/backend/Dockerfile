FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies (for layer caching)
COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ /app/backend

# Set PYTHONPATH
ENV PYTHONPATH=/app

# Copy and make entrypoint script executable
COPY docker/backend/start.sh /app/start.sh
# Convert line endings from CRLF to LF (Windows to Unix)
RUN sed -i 's/\r$//' /app/start.sh && chmod +x /app/start.sh

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["./start.sh"]
