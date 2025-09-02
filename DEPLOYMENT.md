# 🚀 Kasbah API Deployment Guide

This guide covers deploying the Kasbah Orders API to Railway, Docker, or other cloud platforms.

## 🛤️ Railway Deployment (Recommended)

### Step 1: Prepare Repository

Your code is already git-ready! The repository includes:
- ✅ `railway.json` - Railway configuration
- ✅ `Dockerfile` - Container configuration  
- ✅ `package.json` - Node.js dependencies
- ✅ Health check endpoint (`/v1/ping`)

### Step 2: Deploy to Railway

1. **Push to GitHub** (if not already):
   ```bash
   # Create GitHub repo and push
   git remote add origin https://github.com/your-username/kasbah-api.git
   git branch -M main
   git push -u origin main
   ```

2. **Deploy via Railway Dashboard**:
   - Go to [railway.app](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your kasbah-api repository
   - Railway will auto-detect Node.js and deploy

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   API_BASE_URL=https://your-app.railway.app
   ALLOWED_ORIGINS=https://kasbah.health,https://www.kasbah.health
   
   # Optional: Firebase credentials for production data
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email
   ```

4. **Custom Domain** (Optional):
   - Go to Settings → Domains
   - Add your custom domain (e.g., `api.kasbah.health`)
   - Update DNS records as instructed

### Step 3: Verify Deployment

```bash
# Test health check
curl https://your-app.railway.app/v1/ping

# Should return:
# {"status":"ok","timestamp":"2025-01-01T12:00:00Z","version":"1.0.0"}
```

## 🐳 Docker Deployment

### Build and Run Locally

```bash
# Build the image
docker build -t kasbah-api .

# Run container
docker run -p 3001:3001 -e NODE_ENV=production kasbah-api

# Test
curl http://localhost:3001/v1/ping
```

### Deploy to Docker Hub

```bash
# Tag for Docker Hub
docker tag kasbah-api your-username/kasbah-api:latest

# Push to Docker Hub
docker push your-username/kasbah-api:latest
```

### Deploy to Cloud Providers

**AWS ECS:**
```bash
# Use the Dockerfile with ECS task definitions
# Set environment variables in task definition
```

**Google Cloud Run:**
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/your-project/kasbah-api
gcloud run deploy --image gcr.io/your-project/kasbah-api --port 3001
```

**Azure Container Instances:**
```bash
# Deploy container
az container create --resource-group myResourceGroup \
  --name kasbah-api --image your-username/kasbah-api:latest \
  --ports 3001 --environment-variables NODE_ENV=production
```

## ☁️ Alternative Cloud Deployments

### Vercel (Serverless)

1. Install Vercel CLI: `npm i -g vercel`
2. Create `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [{"src": "src/auth-server.js", "use": "@vercel/node"}],
     "routes": [{"src": "/(.*)", "dest": "/src/auth-server.js"}]
   }
   ```
3. Deploy: `vercel --prod`

### Heroku

1. Create `Procfile`:
   ```
   web: node src/auth-server.js
   ```
2. Deploy:
   ```bash
   heroku create kasbah-api
   git push heroku main
   heroku config:set NODE_ENV=production
   ```

### DigitalOcean App Platform

1. Create `.do/app.yaml`:
   ```yaml
   name: kasbah-api
   services:
   - name: api
     source_dir: /
     github:
       repo: your-username/kasbah-api
       branch: main
     run_command: node src/auth-server.js
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     http_port: 3001
     envs:
     - key: NODE_ENV
       value: production
   ```

## 🔧 Production Configuration

### Environment Variables

**Required:**
- `NODE_ENV=production`
- `PORT=3001`

**Recommended:**
- `API_BASE_URL` - Your API's public URL
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins

**Optional (for real data):**
- Firebase credentials for production Firestore access

### Performance Tuning

**Memory & CPU:**
- **Minimum**: 512MB RAM, 0.5 CPU
- **Recommended**: 1GB RAM, 1 CPU  
- **High Traffic**: 2GB RAM, 2 CPU

**Scaling:**
- Railway: Auto-scales based on traffic
- Docker: Use orchestration (Kubernetes, Docker Swarm)
- Serverless: Auto-scales by default

### Monitoring

**Health Checks:**
- Endpoint: `GET /v1/ping`
- Expected: `200 OK` with `{"status":"ok"}`
- Frequency: Every 30 seconds

**Logs to Monitor:**
- Authentication failures
- Rate limit hits  
- API response times
- Error rates by endpoint

**Alerts to Set:**
- Response time > 2 seconds
- Error rate > 5%
- Health check failures
- Memory usage > 80%

## 🔒 Security Checklist

- ✅ HTTPS enforced (handled by Railway/cloud provider)
- ✅ HMAC authentication implemented  
- ✅ Rate limiting enabled
- ✅ No secrets in code (use environment variables)
- ✅ CORS configured for production domains
- ✅ Error messages don't leak sensitive info
- ✅ Request/response logging (excluding sensitive data)

## 📋 Post-Deployment

### 1. Update Postman Collection

Update the environment file:
```json
{
  "key": "baseUrl", 
  "value": "https://api.kasbah.health"
}
```

### 2. Partner Communication

Send partners:
- 📄 Production API endpoint
- 🔑 Their production API keys
- 📦 Updated Postman collection
- 📖 Integration documentation

### 3. Monitoring Setup

- Set up monitoring dashboards
- Configure alerts for errors/performance
- Monitor partner API usage patterns
- Track authentication failures

## 🚨 Troubleshooting

**API not responding:**
```bash
# Check health endpoint
curl https://your-api-url/v1/ping

# Check logs
railway logs  # or your platform's log command
```

**Authentication issues:**
- Verify HMAC signature generation
- Check timestamp drift (max 5 minutes)
- Validate API key format

**High error rates:**
- Check partner integration code
- Validate request formats
- Monitor rate limiting

## 🔄 Updates & Maintenance

**Deployment Updates:**
```bash
# Push changes
git add .
git commit -m "Update: description of changes"
git push origin main

# Railway auto-deploys from GitHub
# Other platforms may need manual trigger
```

**Zero-Downtime Updates:**
- Railway handles rolling deployments
- Health checks prevent bad deployments
- Rollback available via Railway dashboard

---

🎉 **Your Kasbah API is ready for production!**

Need help? Contact api@kasbah.health