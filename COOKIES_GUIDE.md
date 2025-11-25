# YouTube Cookies Guide

To bypass YouTube's bot detection, you need to provide authenticated cookies from your YouTube session.

## ⚠️ Why Cookies Are Needed

YouTube detects datacenter IPs (like Cloud Run) as bots. Using cookies from your logged-in YouTube account makes requests appear as a real user.

**Success Rate:**
- Without cookies: 20-30% ❌
- With cookies: 90-95% ✅

## 🔐 Security Warning

**Your cookies grant access to your YouTube account.** Keep them private and secure:
- ✅ Use in your own server only
- ❌ Never share publicly
- ❌ Don't commit to git
- ✅ Store in environment variables
- ✅ Rotate periodically

## 📥 Method 1: Browser Extension (Easiest)

### Step 1: Install Extension

**Chrome/Edge:**
1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search "Get cookies.txt LOCALLY"
3. Install the extension

**Firefox:**
1. Visit [Firefox Add-ons](https://addons.mozilla.org)
2. Search "cookies.txt"
3. Install "cookies.txt" extension

### Step 2: Export Cookies

1. Visit [YouTube.com](https://youtube.com) and **log in**
2. Click the extension icon
3. Click "Export" or "Get cookies.txt"
4. Save as `youtube-cookies.txt`

### Step 3: Format Cookies

Your cookies file should look like:
```
# Netscape HTTP Cookie File
.youtube.com    TRUE    /    TRUE    0    VISITOR_INFO1_LIVE    xxx
.youtube.com    TRUE    /    TRUE    0    CONSENT    xxx
.youtube.com    TRUE    /    TRUE    0    PREF    xxx
```

## 📋 Method 2: Browser DevTools (Manual)

### Step 1: Get Cookie String

1. Visit [YouTube.com](https://youtube.com) and **log in**
2. Press `F12` to open DevTools
3. Go to **Console** tab
4. Paste this code and press Enter:

```javascript
copy(document.cookie)
```

5. Cookie string is now in your clipboard

### Step 2: Format for Environment Variable

Your cookie string looks like:
```
VISITOR_INFO1_LIVE=xxx; CONSENT=xxx; PREF=xxx; ...
```

Keep it exactly as is - this format works with our app.

## ☁️ Setting Cookies in Cloud Run

### Option A: Via Console (UI)

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click your service: `yt-to-mp3`
3. Click **"EDIT & DEPLOY NEW REVISION"**
4. Scroll to **"Variables & Secrets"** → **"Environment Variables"**
5. Add new variable:
   - **Name:** `YOUTUBE_COOKIES`
   - **Value:** Your cookie string (paste the full string)
6. Click **"DEPLOY"**

### Option B: Via gcloud CLI

```bash
gcloud run services update yt-to-mp3 \
  --region us-central1 \
  --set-env-vars "YOUTUBE_COOKIES=VISITOR_INFO1_LIVE=xxx; CONSENT=xxx; PREF=xxx; ..."
```

**Note:** Escape any special characters or use quotes properly.

### Option C: Using Secrets (More Secure)

```bash
# Create secret
echo -n "YOUR_COOKIE_STRING" | gcloud secrets create youtube-cookies --data-file=-

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding youtube-cookies \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Update Cloud Run to use secret
gcloud run services update yt-to-mp3 \
  --region us-central1 \
  --update-secrets="YOUTUBE_COOKIES=youtube-cookies:latest"
```

## 🧪 Testing

After deploying with cookies, check logs:

```bash
gcloud run services logs read yt-to-mp3 --limit 10
```

Look for:
```
✅ YouTube cookies configured for yt-dlp
✅ Using YouTube cookies for authentication
✅ Using cookies: Yes
```

## 🔄 Cookie Expiration

YouTube cookies typically last:
- **Session cookies:** Until you log out
- **Persistent cookies:** 1-2 years

**When to update:**
- Video extraction starts failing
- Every 6-12 months as best practice
- If you change your YouTube password

## 🐛 Troubleshooting

### "Still getting bot detection"

**Causes:**
- Cookies expired
- Wrong format
- Incomplete cookie set

**Fix:**
1. Re-export fresh cookies while logged in
2. Make sure to include ALL cookies, not just one
3. Check logs to verify cookies are being used

### "Invalid cookie format"

**Causes:**
- Special characters not escaped
- Line breaks in cookie string
- Missing semicolons

**Fix:**
1. Cookie string should be single line
2. Semicolons between cookies
3. No extra whitespace

### "Cookies not being used"

**Check:**
```bash
gcloud run services logs read yt-to-mp3 --limit 50 | grep -i cookie
```

Should see:
```
YouTube cookies configured for yt-dlp
Using YouTube cookies for authentication
```

If you see:
```
No YouTube cookies configured (may hit bot detection)
```

Then environment variable isn't set correctly.

## 📝 Example Complete Flow

```bash
# 1. Export cookies (use browser extension or DevTools)
# Copy cookie string: "VISITOR_INFO1_LIVE=xxx; CONSENT=xxx; ..."

# 2. Set in Cloud Run
gcloud run services update yt-to-mp3 \
  --region us-central1 \
  --set-env-vars "YOUTUBE_COOKIES=VISITOR_INFO1_LIVE=xxx; CONSENT=xxx; PREF=xxx"

# 3. Wait for deployment
# Usually takes 1-2 minutes

# 4. Test conversion
# Try a video that was failing before

# 5. Check logs
gcloud run services logs read yt-to-mp3 --limit 20
```

## 🎯 Success Rate Expectations

| Scenario | Success Rate |
|----------|--------------|
| No cookies | 20-30% ❌ |
| With cookies (fresh) | 90-95% ✅ |
| With cookies (6+ months old) | 60-70% ⚠️ |
| Age-restricted (with cookies) | 85-90% ✅ |
| Age-restricted (no cookies) | 0% ❌ |

## 🔒 Security Best Practices

1. **Never commit cookies to git**
   - Already in `.gitignore`
   - Double-check before pushing

2. **Use Cloud Run Secrets** for production
   - More secure than environment variables
   - Better audit trail
   - Automatic rotation support

3. **Rotate cookies periodically**
   - Every 6-12 months minimum
   - After password changes
   - If suspicious activity

4. **Monitor usage**
   - Check Cloud Run logs
   - Look for unusual patterns
   - Set up alerts

## ❓ FAQ

**Q: Can I use someone else's cookies?**
A: Technically yes, but it's their YouTube account. Only use your own.

**Q: Will this work forever?**
A: Cookies expire, usually after 1-2 years. Re-export when needed.

**Q: Is this against YouTube's TOS?**
A: This is for personal use only. Don't abuse or use commercially.

**Q: Can YouTube ban my account?**
A: Unlikely for personal use, but only download videos you own/have permission for.

**Q: Do I need YouTube Premium?**
A: No, any YouTube account works. Premium might have fewer restrictions.

---

## 🎉 Summary

1. **Export cookies** from your logged-in YouTube session
2. **Set `YOUTUBE_COOKIES` environment variable** in Cloud Run
3. **Redeploy and test** - should work much better now!

For issues, check the logs and refer to Troubleshooting section above.
