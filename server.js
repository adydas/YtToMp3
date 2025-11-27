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

// Setup YouTube cookies if provided (helps bypass bot detection)
const cookiesPath = path.join(__dirname, 'youtube-cookies.txt');
if (process.env.YOUTUBE_COOKIES) {
  // Convert cookie string to Netscape format for yt-dlp
  const cookieLines = process.env.YOUTUBE_COOKIES.split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie) // Remove empty strings
    .map(cookie => {
      const equalIndex = cookie.indexOf('=');
      if (equalIndex === -1) return null;

      const name = cookie.substring(0, equalIndex).trim();
      const value = cookie.substring(equalIndex + 1).trim();

      // Netscape format: domain, flag, path, secure, expiration, name, value
      // Using longer expiration (year 2030) for better persistence
      return `.youtube.com\tTRUE\t/\tTRUE\t1893456000\t${name}\t${value}`;
    })
    .filter(line => line); // Remove null entries

  const cookieContent = `# Netscape HTTP Cookie File
# This file is generated from YOUTUBE_COOKIES environment variable
${cookieLines.join('\n')}`;

  fs.writeFileSync(cookiesPath, cookieContent);
  console.log(`✓ YouTube cookies configured (${cookieLines.length} cookies)`);

  // Log important cookies for debugging (without values)
  const importantCookies = ['CONSENT', '__Secure-1PSID', '__Secure-3PSID', 'LOGIN_INFO', 'VISITOR_INFO1_LIVE', 'YSC'];
  const foundCookies = cookieLines.map(line => line.split('\t')[5]).filter(name => importantCookies.includes(name));
  console.log('Important cookies found:', foundCookies.join(', ') || 'None');
} else {
  console.log('⚠️  No YouTube cookies set. Bot detection highly likely!');
  console.log('   Set YOUTUBE_COOKIES env var with cookies from logged-in YouTube session.');
  console.log('   Run: node scripts/extract-youtube-cookies.js for instructions.');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Helper function to try Cobalt.tools API
async function tryWithCobalt(url) {
  console.log('Trying Cobalt.tools API for:', url);

  try {
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

    // Call Cobalt API
    const response = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        aFormat: 'mp3',
        isAudioOnly: true,
        filenamePattern: 'basic'
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.text || 'Cobalt API error');
    }

    if (!data.url) {
      throw new Error('No download URL returned from Cobalt');
    }

    console.log('Cobalt.tools successful, downloading MP3...');

    // Download the MP3 from Cobalt's URL
    const mp3Response = await fetch(data.url);
    if (!mp3Response.ok) {
      throw new Error(`Failed to download MP3: ${mp3Response.statusText}`);
    }

    const timestamp = Date.now();
    const filename = `video-${timestamp}.mp3`;
    const outputPath = path.join(downloadsDir, filename);

    const buffer = await mp3Response.buffer();
    fs.writeFileSync(outputPath, buffer);

    console.log('Cobalt download complete:', filename);

    return {
      success: true,
      filename: filename,
      title: data.filename || 'video',
      method: 'cobalt'
    };
  } catch (error) {
    console.log('Cobalt.tools failed:', error.message);
    throw error;
  }
}

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

    // Try Cobalt.tools first (no auth needed, better success rate)
    try {
      const result = await tryWithCobalt(url);
      console.log('Success with Cobalt.tools');
      return res.json(result);
    } catch (cobaltError) {
      console.log('Cobalt failed, falling back to yt-dlp...');
    }

    // Fall back to yt-dlp if Cobalt fails
    const timestamp = Date.now();
    const outputTemplate = path.join(downloadsDir, `video-${timestamp}.%(ext)s`);

    // Use yt-dlp to download and convert to MP3
    // Strategy: Use cookies + web client for better authentication
    const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies "${cookiesPath}"` : '';

    // Build command with better options for Cloud Run
    let command = `yt-dlp -x --audio-format mp3 --audio-quality 128K `;

    // Add cookies if available (critical for bypassing bot detection)
    if (cookiesArg) {
      command += `${cookiesArg} `;
    }

    // Use web client when cookies are available, mobile clients as fallback
    if (fs.existsSync(cookiesPath)) {
      // With cookies, use web client (most stable with auth)
      command += `--extractor-args "youtube:player_client=web,android" `;
    } else {
      // Without cookies, try mobile clients first (sometimes bypass bot detection)
      command += `--extractor-args "youtube:player_client=android,ios,web,mweb" `;
      // Add mobile user agent for android client
      command += `--user-agent "com.google.android.youtube/19.09.37 (Linux; U; Android 13) gzip" `;
    }

    // Common options
    command += `--add-header "Accept-Language:en-US,en" `;
    command += `--add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" `;
    command += `--no-check-certificate `;
    command += `--no-warnings `;
    command += `-o "${outputTemplate}" "${url}"`;

    console.log('Downloading with yt-dlp:', url);
    console.log('Using cookies:', fs.existsSync(cookiesPath) ? 'Yes (web client)' : 'No (mobile clients)');

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
      title: videoTitle,
      method: 'yt-dlp'
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

    // Prepare headers with optional cookies
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    };

    // Add cookies if available (helps bypass bot detection)
    if (process.env.YOUTUBE_COOKIES) {
      headers['Cookie'] = process.env.YOUTUBE_COOKIES;
      console.log('Using YouTube cookies for authentication');
    } else {
      console.log('No YouTube cookies configured (may hit bot detection)');
    }

    https.get(url, { headers }, (ytResponse) => {
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
