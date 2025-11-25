# Google Cloud Run Deployment Guide

Deploy your YouTube to MP3 converter to Google Cloud Run - a fully managed serverless platform.

## Prerequisites

1. **Google Cloud Account** - [Sign up here](https://cloud.google.com/)
2. **gcloud CLI** - [Install instructions](https://cloud.google.com/sdk/docs/install)
3. **Billing enabled** on your GCP project

## Important Considerations for Cloud Run

### ✅ What Works
- Stateless HTTP requests
- Container-based deployment with FFmpeg and yt-dlp
- Automatic scaling from 0 to many instances
- Pay-per-use pricing

### ⚠️ Limitations to Be Aware Of
- **Request Timeout**: Default 5 minutes, max 60 minutes
  - Long videos may timeout (configure max timeout)
- **Ephemeral Storage**: Downloads directory is temporary per instance
  - Files don't persist between container instances
  - This is fine since we clean up after download
- **Cold Starts**: First request may be slower
- **Memory Limits**: Default 512MB, increase if needed

## Quick Deploy

### Option 1: Deploy with One Command

```bash
# Set your GCP project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Deploy to Cloud Run
gcloud run deploy yt-to-mp3 \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production"
```

This command will:
1. Build your container image using Cloud Build
2. Push it to Google Container Registry
3. Deploy it to Cloud Run
4. Give you a public URL

### Option 2: Deploy Using Dockerfile

```bash
# Set variables
export PROJECT_ID="your-project-id"
export REGION="us-central1"
export SERVICE_NAME="yt-to-mp3"

# Configure project
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build container
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --min-instances 0 \
  --set-env-vars "NODE_ENV=production,MAX_FILE_AGE_MS=1800000,CLEANUP_INTERVAL_MS=300000"
```

## Configuration Explained

### Memory and CPU
```bash
--memory 2Gi          # 2GB RAM (video processing needs memory)
--cpu 2               # 2 vCPUs (faster conversion)
```

### Timeout
```bash
--timeout 3600        # 60 minutes max (for large videos)
```
- Default is 300 seconds (5 minutes)
- Increase for longer videos
- Max is 3600 seconds (60 minutes)

### Scaling
```bash
--max-instances 10    # Maximum concurrent instances
--min-instances 0     # Scale to zero when idle (save money)
```

### Environment Variables
```bash
--set-env-vars "NODE_ENV=production,MAX_FILE_AGE_MS=1800000"
```

## Environment Variables for Cloud Run

```bash
NODE_ENV=production                    # Production mode
PORT=8080                              # Auto-set by Cloud Run
MAX_FILE_AGE_MS=1800000               # 30 min (shorter for serverless)
CLEANUP_INTERVAL_MS=300000            # 5 min cleanup interval
```

## Access Your Application

After deployment, you'll get a URL like:
```
https://yt-to-mp3-xxxxx-uc.a.run.app
```

Test it:
```bash
curl https://your-service-url/health
```

## Update Your Deployment

To deploy updates:

```bash
# Quick redeploy from source
gcloud run deploy yt-to-mp3 --source .

# Or rebuild and deploy
gcloud builds submit --tag gcr.io/$PROJECT_ID/yt-to-mp3
gcloud run deploy yt-to-mp3 --image gcr.io/$PROJECT_ID/yt-to-mp3
```

## Custom Domain Setup

### 1. Add Domain Mapping

```bash
# Add your domain
gcloud run domain-mappings create \
  --service yt-to-mp3 \
  --domain yourdomain.com \
  --region us-central1
```

### 2. Update DNS Records

Follow the instructions provided by the command above to add DNS records.

## Monitoring and Logs

### View Logs
```bash
# Stream logs
gcloud run services logs tail yt-to-mp3 --region us-central1

# View logs in console
https://console.cloud.google.com/run
```

### Monitoring
```bash
# View metrics
gcloud run services describe yt-to-mp3 --region us-central1
```

Or visit Cloud Console → Cloud Run → your-service → Metrics

## Cost Optimization

Cloud Run pricing is based on:
- **CPU**: $0.00002400/vCPU-second
- **Memory**: $0.00000250/GiB-second
- **Requests**: $0.40 per million requests
- **Free Tier**: 2 million requests/month, 360,000 GiB-seconds

### Tips to Reduce Costs:
1. **Scale to zero**: Set `--min-instances 0`
2. **Right-size resources**: Start with 1GB RAM, adjust as needed
3. **Set request timeout**: Don't use max timeout if not needed
4. **Set max instances**: Prevent unexpected scaling costs

Example low-cost configuration:
```bash
gcloud run deploy yt-to-mp3 \
  --source . \
  --memory 1Gi \
  --cpu 1 \
  --timeout 600 \
  --max-instances 5 \
  --min-instances 0
```

## Security

### Enable Authentication (Optional)

To require authentication:

```bash
# Deploy with authentication required
gcloud run deploy yt-to-mp3 --no-allow-unauthenticated

# Allow specific users
gcloud run services add-iam-policy-binding yt-to-mp3 \
  --member="user:email@example.com" \
  --role="roles/run.invoker"
```

### Set CORS Policy

If you need specific CORS settings, update `server.js`:

```javascript
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

## CI/CD with GitHub Actions

Create `.github/workflows/deploy-cloudrun.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: yt-to-mp3
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - id: auth
      uses: google-github-actions/auth@v1
      with:
        credentials_json: ${{ secrets.GCP_SA_KEY }}

    - name: Set up Cloud SDK
      uses: google-github-actions/setup-gcloud@v1

    - name: Deploy to Cloud Run
      run: |
        gcloud run deploy $SERVICE_NAME \
          --source . \
          --platform managed \
          --region $REGION \
          --allow-unauthenticated \
          --memory 2Gi \
          --timeout 3600
```

Add these secrets to your GitHub repository:
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_SA_KEY`: Service account JSON key

## Troubleshooting

### Container Failed to Start
Check logs:
```bash
gcloud run services logs read yt-to-mp3 --limit 50
```

### FFmpeg Not Found
Ensure Dockerfile includes FFmpeg installation (already included in your Dockerfile).

### Out of Memory
Increase memory:
```bash
gcloud run services update yt-to-mp3 --memory 4Gi
```

### Timeout Errors
Increase timeout:
```bash
gcloud run services update yt-to-mp3 --timeout 3600
```

### Permission Denied
Check service account permissions in IAM & Admin.

## Useful Commands

```bash
# List all services
gcloud run services list

# Describe service
gcloud run services describe yt-to-mp3

# Delete service
gcloud run services delete yt-to-mp3

# View revisions
gcloud run revisions list --service yt-to-mp3

# Rollback to previous revision
gcloud run services update-traffic yt-to-mp3 \
  --to-revisions REVISION-NAME=100
```

## Comparison: Cloud Run vs Other Platforms

| Feature | Cloud Run | Heroku | Railway |
|---------|-----------|--------|---------|
| Pricing | Pay per use | Monthly dyno | Pay per use |
| Scale to Zero | ✅ Yes | ❌ No | ✅ Yes |
| Cold Start | ~1-3s | None | ~1-2s |
| Max Timeout | 60 min | 30s-120s | 60 min |
| Custom Domain | ✅ Free | ✅ Paid plans | ✅ Free |
| Auto-deploy from Git | Via Actions | ✅ Native | ✅ Native |

## Next Steps

1. ✅ Deploy your application
2. 🔒 Set up custom domain (optional)
3. 📊 Set up monitoring and alerting
4. 🔄 Configure CI/CD (optional)
5. 💰 Set up budget alerts to monitor costs

Your YouTube to MP3 converter is now running serverless on Google Cloud Run! 🎉
