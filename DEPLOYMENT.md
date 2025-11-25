# Deployment Guide

This guide covers deploying the YouTube to MP3 converter to various platforms.

## Prerequisites

Your server must have:
- Node.js (v14 or higher)
- FFmpeg
- yt-dlp

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
PORT=3000
NODE_ENV=production
MAX_FILE_AGE_MS=3600000
CLEANUP_INTERVAL_MS=600000
```

## VPS Deployment (Ubuntu/Debian)

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg and yt-dlp
sudo apt install -y ffmpeg yt-dlp

# Verify installations
node --version
npm --version
ffmpeg -version
yt-dlp --version
```

### 2. Clone and Setup Application

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YtToMp3.git
cd YtToMp3

# Install dependencies
npm install

# Create environment file
cp .env.example .env
nano .env  # Edit as needed
```

### 3. Setup PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start server.js --name yt-to-mp3

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

### 4. Setup Nginx Reverse Proxy (Optional)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/yt-to-mp3
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Increase timeout for large file downloads
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/yt-to-mp3 /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is set up automatically
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
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

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  yt-to-mp3:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - MAX_FILE_AGE_MS=3600000
      - CLEANUP_INTERVAL_MS=600000
    volumes:
      - ./downloads:/app/downloads
    restart: unless-stopped
```

### 3. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Cloud Platform Deployment

### Google Cloud Run (Recommended)

**See [CLOUDRUN.md](CLOUDRUN.md) for detailed instructions.**

Quick deploy:
```bash
gcloud run deploy yt-to-mp3 \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600
```

**Pros:**
- Serverless, scales to zero
- Pay only for actual usage
- Handles high traffic automatically
- Fast global deployment

**Cons:**
- Request timeout limit (60 min max)
- Cold start delay on first request

### Railway

1. Push your code to GitHub
2. Connect your GitHub repo to Railway
3. Set environment variables in Railway dashboard
4. Railway will auto-detect and deploy your Node.js app
5. Note: You may need to use a custom buildpack for FFmpeg/yt-dlp

### Heroku

1. Create `Procfile`:
```
web: node server.js
```

2. Add buildpacks:
```bash
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git
heroku buildpacks:add https://github.com/amirshnll/heroku-buildpack-yt-dlp.git
```

3. Deploy:
```bash
heroku create your-app-name
git push heroku main
```

### DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure build command: `npm install`
3. Configure run command: `node server.js`
4. Add FFmpeg and yt-dlp as packages (may require custom Dockerfile)

## Monitoring and Maintenance

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs yt-to-mp3

# Restart
pm2 restart yt-to-mp3

# Stop
pm2 stop yt-to-mp3

# Monitor
pm2 monit
```

### Disk Space Management

The app automatically cleans up old files, but monitor disk space:

```bash
# Check disk usage
df -h

# Check downloads directory size
du -sh /path/to/YtToMp3/downloads
```

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart with PM2
pm2 restart yt-to-mp3
```

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to prevent abuse
2. **File Size Limits**: Configure limits for conversion file sizes
3. **CORS**: Update CORS settings in production if needed
4. **Firewall**: Configure UFW or iptables to only allow necessary ports
5. **Regular Updates**: Keep Node.js, FFmpeg, and yt-dlp updated

## Troubleshooting

### FFmpeg Not Found
```bash
which ffmpeg
# If not found, reinstall: sudo apt install ffmpeg
```

### yt-dlp Not Found
```bash
which yt-dlp
# If not found, reinstall: sudo apt install yt-dlp
# Or: pip3 install yt-dlp
```

### Port Already in Use
```bash
# Find process using port 3000
sudo lsof -i :3000
# Kill process
sudo kill -9 <PID>
```

### Permission Issues
```bash
# Ensure downloads directory is writable
chmod 755 downloads
```
