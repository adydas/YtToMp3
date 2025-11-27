#!/bin/bash

# Try to update yt-dlp at startup (non-blocking, fail silently)
echo "Checking for yt-dlp updates..."
timeout 10 yt-dlp -U 2>/dev/null || echo "yt-dlp update check completed"

# Start the Node.js server
echo "Starting server on port ${PORT:-8080}..."
exec node server.js