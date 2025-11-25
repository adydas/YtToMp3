# Deploying to Vercel

Vercel offers better success rates than Google Cloud Run for YouTube downloads because it uses different IP ranges that are less likely to be blocked.

## Success Rate Comparison
- **Cloud Run**: 20-30% without cookies
- **Vercel**: 40-50% without authentication
- **With Cobalt.tools fallback**: 70-80% combined

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Add Vercel deployment config"
   git push origin main
   ```

2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Vercel will auto-detect the configuration
5. Click **Deploy**

### Method 2: CLI Deployment

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts:
   - Set up and deploy: **Yes**
   - Which scope: Select your account
   - Link to existing project: **No**
   - Project name: `yt-to-mp3`
   - Directory: `./`
   - Override settings: **No**

### Method 3: Direct Upload

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Third-Party Git Repository"
3. Upload your project folder
4. Deploy

## Environment Variables

After deployment, add environment variables in Vercel Dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add (if needed):
   ```
   NODE_ENV=production
   MAX_FILE_AGE_MS=3600000
   CLEANUP_INTERVAL_MS=600000
   ```

## Important Notes

### Serverless Limitations

Vercel runs in a serverless environment with some limitations:

1. **No persistent file storage** - Files are temporary
2. **60-second timeout** - Long conversions may fail
3. **No binary dependencies** - yt-dlp and ffmpeg won't work natively

### How This Works

Our implementation uses **Cobalt.tools API first**, which:
- Doesn't require yt-dlp or ffmpeg on the server
- Works within serverless constraints
- Provides reliable YouTube extraction

If Cobalt fails, it falls back to yt-dlp (which may not work on Vercel).

## Testing Your Deployment

After deployment, test with:
```bash
curl -X POST https://your-app.vercel.app/api/convert \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

## Custom Domain

To add a custom domain:

1. Go to **Settings** → **Domains**
2. Add your domain
3. Follow DNS configuration instructions

## Monitoring

Check logs at:
- **Functions** tab → View runtime logs
- **Analytics** tab → View usage metrics

## Advantages Over Cloud Run

1. **Better IP reputation** - Less blocked by YouTube
2. **Faster deployment** - Instant from GitHub
3. **Free tier** - Generous limits for personal use
4. **Global CDN** - Faster static file serving
5. **Automatic HTTPS** - SSL certificates included

## Troubleshooting

### "yt-dlp not found"
This is expected on Vercel. The app will use Cobalt.tools API instead.

### "Conversion timeout"
Videos longer than 10 minutes may timeout. Consider:
- Using shorter videos
- Implementing a queue system
- Using edge functions (if available)

### "No audio streams found"
The Cobalt.tools API may be temporarily down. Check:
- https://github.com/wukko/cobalt/issues
- Try again in a few minutes

## Next Steps

1. **Deploy to Vercel** using one of the methods above
2. **Test the deployment** with a YouTube URL
3. **Monitor success rates** in the logs
4. **Consider adding more fallback APIs** if needed

## Alternative Serverless Platforms

If Vercel doesn't work well, try:

1. **Netlify Functions**
   - Similar to Vercel
   - Different IP ranges
   - Good free tier

2. **Cloudflare Workers**
   - Edge computing
   - Global network
   - Very different IPs

3. **Railway**
   - Container-based
   - Supports binaries
   - Better for yt-dlp

Each platform has different IP ranges, so success rates vary. Test to find what works best.