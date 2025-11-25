async function convertVideo() {
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
  showStatus('Processing your video...', 'info');
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
    showStatus('Conversion successful!', 'success');

    // Show download button
    resultDiv.innerHTML = `
      <p style="margin-bottom: 15px; color: #333;">
        <strong>${data.title}</strong>
      </p>
      <a href="/api/download/${data.filename}" class="download-btn" download>
        Download MP3
      </a>
    `;
    resultDiv.classList.remove('hidden');

    // Clear input
    urlInput.value = '';

  } catch (error) {
    progressDiv.classList.add('hidden');
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = 'Convert';
  }
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
