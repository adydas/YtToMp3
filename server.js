const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_AGE_MS = parseInt(process.env.MAX_FILE_AGE_MS) || 3600000; // 1 hour
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS) || 600000; // 10 minutes

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route to convert YouTube video to MP3
app.post('/api/convert', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    // Validate YouTube URL (basic check)
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const timestamp = Date.now();
    const outputTemplate = path.join(downloadsDir, `video-${timestamp}.%(ext)s`);

    // Use yt-dlp to download and convert to MP3
    // Using mobile clients (android, ios) which have better bot bypass
    const command = `yt-dlp -x --audio-format mp3 --audio-quality 128K \
      --extractor-args "youtube:player_client=android,ios,web" \
      --user-agent "com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip" \
      --add-header "Accept-Language:en-US,en" \
      --add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
      --no-check-certificate \
      -o "${outputTemplate}" "${url}"`;

    console.log('Downloading and converting:', url);
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });

    console.log('yt-dlp output:', stdout);
    if (stderr) console.log('yt-dlp stderr:', stderr);

    // Find the created MP3 file
    const files = fs.readdirSync(downloadsDir);
    const mp3File = files.find(file => file.startsWith(`video-${timestamp}`) && file.endsWith('.mp3'));

    if (!mp3File) {
      throw new Error('MP3 file not found after conversion');
    }

    // Extract video title from filename or use default
    const videoTitle = mp3File.replace(`video-${timestamp}.`, '').replace('.mp3', '') || 'video';

    console.log('Conversion finished:', mp3File);
    res.json({
      success: true,
      filename: mp3File,
      title: videoTitle
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process video: ' + error.message });
  }
});

// Route to convert from client-extracted stream URL (hybrid mode)
app.post('/api/convert-from-stream', async (req, res) => {
  try {
    const { streamUrl, title, videoId } = req.body;

    if (!streamUrl) {
      return res.status(400).json({ error: 'Stream URL is required' });
    }

    const timestamp = Date.now();
    const safeTitle = (title || 'video').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
    const filename = `${safeTitle}-${timestamp}.mp3`;
    const outputPath = path.join(downloadsDir, filename);

    console.log('Converting from stream URL:', { videoId, title });

    // Use FFmpeg to download from stream URL and convert to MP3
    const command = `ffmpeg -i "${streamUrl}" -vn -acodec libmp3lame -q:a 2 -y "${outputPath}"`;

    await execAsync(command, {
      timeout: 300000, // 5 minutes
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });

    console.log('Stream conversion finished:', filename);

    res.json({
      success: true,
      filename: filename,
      title: safeTitle
    });

  } catch (error) {
    console.error('Stream conversion error:', error);
    res.status(500).json({ error: 'Failed to convert stream: ' + error.message });
  }
});

// Proxy endpoint to fetch YouTube page (avoids CORS in browser)
app.post('/api/fetch-youtube', async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Fetch YouTube page from server (no CORS restrictions)
    const https = require('https');
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (ytResponse) => {
      let html = '';

      ytResponse.on('data', (chunk) => {
        html += chunk;
      });

      ytResponse.on('end', () => {
        res.json({ html });
      });
    }).on('error', (error) => {
      console.error('YouTube fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch YouTube page' });
    });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Proxy failed: ' + error.message });
  }
});

// Route to download converted MP3
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(downloadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
    }
    // Delete file after download
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted file:', filename);
      }
    }, 1000);
  });
});

// Clean up old files
setInterval(() => {
  try {
    const files = fs.readdirSync(downloadsDir);
    const now = Date.now();

    files.forEach(file => {
      try {
        const filePath = path.join(downloadsDir, file);
        const stats = fs.statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > MAX_FILE_AGE_MS) {
          fs.unlinkSync(filePath);
          console.log('Cleaned up old file:', file);
        }
      } catch (err) {
        console.error('Error cleaning up file:', file, err.message);
      }
    });
  } catch (err) {
    console.error('Error during cleanup:', err.message);
  }
}, CLEANUP_INTERVAL_MS);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
