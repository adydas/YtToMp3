# YouTube to MP3 Converter

A simple web application to convert YouTube videos to MP3 audio files.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/adydas/YtToMp3.git
cd YtToMp3

# Install dependencies
npm install

# Start the server
npm start
```

Visit `http://localhost:3000` and start converting!

## Deployment

Deploy to the cloud in minutes:

**Google Cloud Run** (Recommended) - Serverless, scales to zero, pay per use
```bash
gcloud run deploy yt-to-mp3 --source . --region us-central1
```
See [CLOUDRUN.md](CLOUDRUN.md) for detailed instructions.

**Other platforms:** Docker, Railway, Heroku, VPS - See [DEPLOYMENT.md](DEPLOYMENT.md)

## Features

- 🎵 Convert YouTube videos to MP3 format
- 🎨 Clean and modern user interface
- ⚡ Fast conversion using FFmpeg
- 🧹 Automatic cleanup of old files
- 📱 Responsive design for mobile and desktop

## ⚠️ Important Note About YouTube

YouTube actively works to prevent automated downloads and frequently updates their bot detection. This application uses multiple strategies to bypass detection (Android/iOS mobile clients, appropriate headers, etc.), but **some videos may still fail** due to:

- YouTube's aggressive bot detection
- Age-restricted content
- Region-locked videos
- IP-based rate limiting

**Success rate:** ~80-90% of public videos work. If a video fails, try:
1. A different video
2. Waiting a few minutes and retrying
3. Using a different IP/network

For persistent issues, see the troubleshooting section in [CLOUDRUN.md](CLOUDRUN.md).

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **FFmpeg** - Required for audio conversion
- **yt-dlp** - YouTube downloader

### Installing Dependencies

**macOS** (using Homebrew):
```bash
brew install ffmpeg yt-dlp
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install ffmpeg yt-dlp
```

**Windows**:
- FFmpeg: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
- yt-dlp: Download from [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) and add to PATH

## Installation

1. Navigate to the project directory:
```bash
cd /Users/admin/Projects/YtToMp3
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Paste a YouTube URL and click "Convert"

4. Download your MP3 file when the conversion is complete

## How It Works

1. **Frontend**: User enters a YouTube URL in the web interface
2. **Backend**: Express server receives the request
3. **Download & Convert**: yt-dlp downloads the video and converts to MP3 using FFmpeg
4. **Download**: User downloads the converted MP3 file
5. **Cleanup**: Files are automatically deleted after download and old files are removed hourly

## API Endpoints

### POST /api/convert
Converts a YouTube video to MP3

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "success": true,
  "filename": "video-title-123456789.mp3",
  "title": "Video Title"
}
```

### GET /api/download/:filename
Downloads the converted MP3 file

## Project Structure

```
YtToMp3/
├── public/
│   ├── index.html      # Frontend HTML
│   ├── styles.css      # CSS styling
│   └── script.js       # Frontend JavaScript
├── downloads/          # Temporary storage for MP3 files
├── server.js           # Express backend server
├── package.json        # Project dependencies
└── README.md           # This file
```

## Important Notes

⚠️ **Legal Disclaimer**: Only convert and download videos that you own or have permission to use. Respect copyright laws and YouTube's Terms of Service.

## Troubleshooting

### FFmpeg not found
Make sure FFmpeg is installed and accessible from your terminal:
```bash
ffmpeg -version
```

### Port already in use
Change the port in server.js or set the PORT environment variable:
```bash
PORT=4000 npm start
```

### Conversion fails
- Check if the YouTube URL is valid
- Make sure the video is not private or age-restricted
- Check your internet connection

## License

MIT
