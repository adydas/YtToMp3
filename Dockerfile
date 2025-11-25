FROM node:20-slim

# Install FFmpeg and yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && pip3 install --break-system-packages yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create downloads directory with proper permissions
RUN mkdir -p downloads && chmod 755 downloads

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Cloud Run sets PORT env variable, expose it (default 8080)
EXPOSE 8080

# Start application
CMD ["node", "server.js"]
