# GitHub Setup Instructions

Follow these steps to push your YouTube to MP3 converter to GitHub.

## Step 1: Create a New Repository on GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Fill in the details:
   - **Repository name**: `YtToMp3` (or your preferred name)
   - **Description**: "YouTube to MP3 converter web application"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

## Step 2: Update Package.json

Before pushing, update the repository URL in `package.json`:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/YOUR_USERNAME/YtToMp3.git"
}
```

Replace `YOUR_USERNAME` with your actual GitHub username.

## Step 3: Push to GitHub

Run these commands in your terminal:

```bash
# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/YtToMp3.git

# Push your code to GitHub
git push -u origin main
```

If you're using SSH instead of HTTPS:

```bash
git remote add origin git@github.com:YOUR_USERNAME/YtToMp3.git
git push -u origin main
```

## Step 4: Verify

1. Refresh your GitHub repository page
2. You should see all your files uploaded
3. The README.md will be displayed on the repository homepage

## Step 5: Update README Links (Optional)

If you want to update the clone URL in the README to match your repository:

1. Open `README.md`
2. Update this line:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YtToMp3.git
   ```
3. Replace `YOUR_USERNAME` with your actual username
4. Commit and push:
   ```bash
   git add README.md
   git commit -m "Update clone URL in README"
   git push
   ```

## Common Issues

### Authentication Required

If you're asked for credentials:

**Using HTTPS:**
- Username: Your GitHub username
- Password: Use a Personal Access Token (not your password)
  - Go to GitHub Settings → Developer settings → Personal access tokens → Generate new token
  - Select `repo` scope
  - Copy the token and use it as your password

**Using SSH:**
- Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### Repository Already Exists Error

If you get an error about the repository already existing:

```bash
# Remove the existing remote and re-add it
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/YtToMp3.git
git push -u origin main
```

## Next Steps

Once your code is on GitHub:

1. **Add Repository Secrets** (for CI/CD):
   - Go to Settings → Secrets and variables → Actions
   - Add any necessary secrets for deployment

2. **Enable GitHub Pages** (if you want to host the frontend):
   - Go to Settings → Pages
   - Select source branch
   - Note: This project needs a backend server, so you'll need to deploy the full stack elsewhere

3. **Set up Continuous Deployment**:
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options
   - Many platforms (Railway, Heroku, etc.) can auto-deploy from GitHub

4. **Add a License**:
   - Go to your repository
   - Click "Add file" → "Create new file"
   - Name it "LICENSE"
   - Choose a license template (MIT is already specified in package.json)

5. **Add Topics**:
   - On your repository page, click the gear icon next to "About"
   - Add topics like: `youtube`, `mp3`, `converter`, `nodejs`, `express`, `yt-dlp`

## Contributing

If you want to allow contributions:

1. Create a `CONTRIBUTING.md` file with guidelines
2. Add issue templates in `.github/ISSUE_TEMPLATE/`
3. Add a pull request template in `.github/PULL_REQUEST_TEMPLATE.md`

Your project is now ready to be shared and deployed! 🎉
