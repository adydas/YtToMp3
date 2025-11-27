FROM node:20-slim

# Install FFmpeg, yt-dlp, and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && pip3 install --break-system-packages --upgrade --force-reinstall yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Update yt-dlp to latest version on every build
RUN yt-dlp -U || true

# Verify Node.js is available for yt-dlp JavaScript runtime
RUN node --version && which node

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

# Copy and set permissions for start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Switch to non-root user
USER appuser

# Cloud Run sets PORT env variable, expose it (default 8080)
EXPOSE 8080

# Start application with update check
CMD ["/bin/bash", "/app/start.sh"]
