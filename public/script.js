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

    // Extract ytInitialPlayerResponse JSON - try multiple patterns
    let playerResponse = null;

    // Pattern 1: var ytInitialPlayerResponse = {...}
    let match = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!match) {
      // Pattern 2: window.ytInitialPlayerResponse = {...}
      match = html.match(/window\["ytInitialPlayerResponse"\]\s*=\s*(\{.+?\});/s);
    }
    if (!match) {
      // Pattern 3: Between script tags
      match = html.match(/ytInitialPlayerResponse\s*=\s*(\{[^<]+\});/s);
    }

    if (!match) {
      console.error('Could not find ytInitialPlayerResponse in HTML');
      console.log('HTML length:', html.length);
      console.log('HTML preview:', html.substring(0, 500));
      throw new Error('Could not find player response in page');
    }

    try {
      playerResponse = JSON.parse(match[1]);
    } catch (parseError) {
      console.error('Failed to parse player response:', parseError);
      console.log('Matched string:', match[1].substring(0, 200));
      throw new Error('Failed to parse player response JSON');
    }

    console.log('Player response:', playerResponse);

    // Check for playability issues
    if (playerResponse.playabilityStatus?.status !== 'OK') {
      const reason = playerResponse.playabilityStatus?.reason || 'Video unavailable';
      console.error('Video not playable:', reason);
      throw new Error(reason);
    }

    // Get video details
    const videoDetails = playerResponse.videoDetails;
    if (!videoDetails) {
      throw new Error('No video details found');
    }

    console.log('Video title:', videoDetails.title);

    // Extract audio streams
    const streamingData = playerResponse.streamingData;
    if (!streamingData) {
      throw new Error('No streaming data found');
    }

    const formats = streamingData.adaptiveFormats || streamingData.formats || [];
    const audioFormats = formats.filter(f =>
      f.mimeType?.includes('audio') ||
      (f.audioQuality && !f.qualityLabel)
    );

    console.log('Found audio formats:', audioFormats.length);

    if (audioFormats.length === 0) {
      console.error('No audio streams. Available formats:', formats.length);
      throw new Error('No audio streams found');
    }

    // Select best audio quality
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const bestAudio = audioFormats[0];

    console.log('Best audio format:', bestAudio);

    // Check if stream has direct URL or requires signature decoding
    if (!bestAudio.url && !bestAudio.signatureCipher) {
      console.error('Audio stream has neither url nor signatureCipher:', bestAudio);
      throw new Error('Audio stream has no URL or cipher');
    }

    if (bestAudio.signatureCipher) {
      console.warn('Stream uses signatureCipher (requires complex decoding)');
      console.log('signatureCipher:', bestAudio.signatureCipher.substring(0, 100) + '...');
      throw new Error('Stream requires signature decoding (falling back to server-side)');
    }

    console.log('Selected audio:', {
      bitrate: bestAudio.bitrate,
      mimeType: bestAudio.mimeType,
      hasUrl: !!bestAudio.url
    });

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
    const method = data.method === 'cobalt' ? 'Cobalt.tools API' : 'yt-dlp';
    showStatus(`✅ Conversion successful! (${method})`, 'success');

    // Show download button
    resultDiv.innerHTML = `
      <p style="margin-bottom: 15px; color: #333;">
        <strong>${data.title}</strong>
      </p>
      <a href="/api/download/${data.filename}" class="download-btn" download>
        Download MP3
      </a>
      <p style="margin-top: 10px; font-size: 0.85rem; color: #666;">
        ${data.method === 'cobalt' ? '🚀 Used Cobalt.tools API (no auth needed)' : '🔄 Used yt-dlp (server-side)'}
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
