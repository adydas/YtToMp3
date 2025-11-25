// Extract video ID from YouTube URL
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Client-side extraction: Get YouTube stream URLs from user's browser
async function extractYouTubeStreams(url) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  try {
    // Fetch YouTube page through our proxy (avoids CORS)
    const response = await fetch('/api/fetch-youtube', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch YouTube page');
    }

    const data = await response.json();
    const html = data.html;

    // Extract ytInitialPlayerResponse JSON
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
    if (!playerResponseMatch) {
      throw new Error('Could not find player response');
    }

    const playerResponse = JSON.parse(playerResponseMatch[1]);

    // Check for playability issues
    if (playerResponse.playabilityStatus?.status !== 'OK') {
      const reason = playerResponse.playabilityStatus?.reason || 'Video unavailable';
      throw new Error(reason);
    }

    // Get video details
    const videoDetails = playerResponse.videoDetails;

    // Extract audio streams
    const formats = playerResponse.streamingData?.adaptiveFormats || [];
    const audioFormats = formats.filter(f => f.mimeType?.includes('audio'));

    if (audioFormats.length === 0) {
      throw new Error('No audio streams found');
    }

    // Select best audio quality
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const bestAudio = audioFormats[0];

    return {
      videoId,
      title: videoDetails.title,
      streamUrl: bestAudio.url,
      duration: videoDetails.lengthSeconds,
    };
  } catch (error) {
    console.error('Client-side extraction failed:', error);
    throw error;
  }
}

// Convert using client-side extraction (hybrid mode)
async function convertVideoHybrid() {
  const urlInput = document.getElementById('youtubeUrl');
  const convertBtn = document.getElementById('convertBtn');
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  const resultDiv = document.getElementById('result');

  const url = urlInput.value.trim();

  if (!url) {
    showStatus('Please enter a YouTube URL', 'error');
    return;
  }

  // Basic YouTube URL validation
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    showStatus('Please enter a valid YouTube URL', 'error');
    return;
  }

  // Disable button and show progress
  convertBtn.disabled = true;
  convertBtn.textContent = 'Converting...';
  showStatus('Extracting video info from your browser...', 'info');
  progressDiv.classList.remove('hidden');
  resultDiv.classList.add('hidden');

  try {
    // Try client-side extraction first
    showStatus('🔍 Extracting stream URL (client-side)...', 'info');
    const streamInfo = await extractYouTubeStreams(url);

    // Send to server for conversion
    showStatus('⚙️ Converting to MP3 (server-side)...', 'info');
    const response = await fetch('/api/convert-from-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        streamUrl: streamInfo.streamUrl,
        title: streamInfo.title,
        videoId: streamInfo.videoId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Conversion failed');
    }

    // Hide progress and show success
    progressDiv.classList.add('hidden');
    showStatus('✅ Conversion successful! (Hybrid mode)', 'success');

    // Show download button
    resultDiv.innerHTML = `
      <p style="margin-bottom: 15px; color: #333;">
        <strong>${data.title}</strong>
      </p>
      <a href="/api/download/${data.filename}" class="download-btn" download>
        Download MP3
      </a>
      <p style="margin-top: 10px; font-size: 0.85rem; color: #666;">
        ✨ Used hybrid mode (client-side extraction)
      </p>
    `;
    resultDiv.classList.remove('hidden');

    // Clear input
    urlInput.value = '';

  } catch (error) {
    console.error('Hybrid mode failed:', error);
    progressDiv.classList.add('hidden');
    showStatus(`⚠️ Client-side failed: ${error.message}. Trying server-side...`, 'info');

    // Fallback to server-side extraction
    setTimeout(() => convertVideoServerSide(url), 1500);
  } finally {
    if (convertBtn.disabled && !convertBtn.textContent.includes('...')) {
      convertBtn.disabled = false;
      convertBtn.textContent = 'Convert';
    }
  }
}

// Original server-side conversion (fallback)
async function convertVideoServerSide(url) {
  const urlInput = document.getElementById('youtubeUrl');
  const convertBtn = document.getElementById('convertBtn');
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  const resultDiv = document.getElementById('result');

  convertBtn.disabled = true;
  convertBtn.textContent = 'Converting...';
  showStatus('🔄 Using server-side extraction...', 'info');
  progressDiv.classList.remove('hidden');
  resultDiv.classList.add('hidden');

  try {
    const response = await fetch('/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Conversion failed');
    }

    // Hide progress and show success
    progressDiv.classList.add('hidden');
    showStatus('✅ Conversion successful! (Server mode)', 'success');

    // Show download button
    resultDiv.innerHTML = `
      <p style="margin-bottom: 15px; color: #333;">
        <strong>${data.title}</strong>
      </p>
      <a href="/api/download/${data.filename}" class="download-btn" download>
        Download MP3
      </a>
      <p style="margin-top: 10px; font-size: 0.85rem; color: #666;">
        🔄 Used server-side mode
      </p>
    `;
    resultDiv.classList.remove('hidden');

    // Clear input
    urlInput.value = '';

  } catch (error) {
    progressDiv.classList.add('hidden');
    showStatus(`❌ Error: ${error.message}`, 'error');
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
  }
}

// Main conversion function (tries hybrid first)
async function convertVideo() {
  await convertVideoHybrid();
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
}

// Allow Enter key to submit
document.getElementById('youtubeUrl').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    convertVideo();
  }
});
