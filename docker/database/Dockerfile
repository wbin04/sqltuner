FROM pgvector/pgvector:pg16

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    make \
    gcc \
    postgresql-server-dev-16 \
    && rm -rf /var/lib/apt/lists/*

# Clone and install HypoPG
RUN git clone https://github.com/HypoPG/hypopg.git /tmp/hypopg \
    && cd /tmp/hypopg \
    && make \
    && make install \
    && rm -rf /tmp/hypopg

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/
