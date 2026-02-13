# 🚀 Deployment Guide to Render

## Prerequisites
- GitHub repository: RestaurantManager
- Render.com account (free)

## Step 1: Push Code to GitHub

```bash
cd c:\Users\eneal\Desktop\restaurant2

# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Ready for Render deployment"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/RestaurantManager.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Render

### Option A: Using Blueprint (Recommended - One Click!)

1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click **"New +" → "Blueprint"**
4. Select your **RestaurantManager** repository
5. Render will automatically detect `render.yaml` and create both services
6. **Important:** Set these environment variables in the Render dashboard:

**Backend Service Environment Variables:**
```
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your_secure_random_secret_here
CORS_ORIGIN=https://restaurant-frontend.onrender.com
LOG_LEVEL=info
```

**Frontend Service Environment Variables:**
```
VITE_API_URL=https://restaurant-backend.onrender.com/api
VITE_WS_URL=wss://restaurant-backend.onrender.com
```

**Important:** You'll need to create a PostgreSQL database first (see Step 2A below).

7. Click **"Apply"** and wait ~5 minutes for deployment

### Option B: Manual Setup

#### Step 2A: Create PostgreSQL Database
1. In Render Dashboard, click **"New +" → "PostgreSQL"**
2. Configure:
   - **Name:** `restaurant-database`
   - **Database:** `restaurant`
   - **User:** `restaurant_user` (or auto-generated)
   - **Region:** Oregon (US West) - same as backend
   - **Plan:** Free
3. Click **"Create Database"**
4. Wait for database to provision (~2 minutes)
5. Copy the **"External Database URL"** (starts with `postgresql://`)

#### Step 2B: Deploy Backend:
1. Click **"New +" → "Web Service"**
2. Connect **RestaurantManager** repository
3. Configure:
   - **Name:** `restaurant-backend`
   - **Region:** Oregon (US West) - same as database
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free

4. **Add Environment Variables:**
   ```
   NODE_ENV=production
   PORT=5000
   DATABASE_URL=<paste_your_postgresql_url_here>
   JWT_SECRET=<generate_secure_random_string>
   CORS_ORIGIN=https://restaurant-frontend.onrender.com
   LOG_LEVEL=info
   ```

5. Click **"Create Web Service"**

**Note:** No persistent disk needed with PostgreSQL!

#### Step 2C: Deploy Frontend:
1. Click **"New +" → "Static Site"**
2. Connect **RestaurantManager** repository
3. Configure:
   - **Name:** `restaurant-frontend`
   - **Branch:** `main`  
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

4. **Add Environment Variables:**
   ```
   VITE_API_URL=https://restaurant-backend.onrender.com/api
   VITE_WS_URL=wss://restaurant-backend.onrender.com
   ```

5. Click **"Create Static Site"**

## Step 3: Update CORS After Deployment

1. Once frontend deploys, copy its URL (e.g., `https://restaurant-frontend.onrender.com`)
2. Go to Backend service → Environment
3. Update `CORS_ORIGIN` to your frontend URL
4. Save (backend will redeploy automatically)

## Step 4: Test Your Deployment

Visit your frontend URL and test:
- ✅ Customer registration
- ✅ Login as waiter (`waiter1` / `waiter123`)
- ✅ Scan QR code for table
- ✅ Place order
- ✅ Real-time order updates
- ✅ Payment marking

## 🔐 Generate JWT Secret

**IMPORTANT:** Replace `JWT_SECRET` with this randomly generated secret:

```
c5a728e74c0b1e9e0ba6a3305eeacd5307ab23b043a89a8c64652f6000565ee17ebb10135
79bc2385d3ac875711421b45d06e4d4dcf3bb0f1ac828aa0a522756
```

⚠️ **Keep this secret safe! Never commit it to GitHub!**

## 📊 Monitoring Your App

### View Logs:
- Render Dashboard → Your Service → Logs tab
- Real-time logs and error tracking

### Check Database:
- Backend logs will show "✓ Database initialized"
- Default users created (kitchen, waiter1, waiter2, admin)

### Performance:
- First request after 15 min inactivity: ~50 seconds (cold start)
- Subsequent requests: instant

## 🔧 Troubleshooting

### Issue: "Failed to connect"
**Fix:** Check CORS_ORIGIN matches your frontend URL exactly

### Issue: "Database not persisting"
**Fix:** Ensure persistent disk is mounted at `/opt/render/project/data`

### Issue: "Socket.IO not working"
**Fix:** Verify VITE_API_URL is set correctly in frontend

### Issue: "Cold starts too slow"
**Solutions:**
1. Set up cron-job.org to ping `/health` endpoint every 14 minutes
2. Upgrade to paid plan ($7/month) for instant cold starts

## 🎉 Your App URLs

After deployment, you'll have:
- **Frontend:** `https://restaurant-frontend.onrender.com`
- **Backend API:** `https://restaurant-backend.onrender.com/api`
- **Backend Health:** `https://restaurant-backend.onrender.com/health`

## 🔄 Updating Your App

After making changes locally:

```bash
git add .
git commit -m "Description of changes"
git push
```

Render will automatically:
1. Detect the push
2. Run build commands
3. Deploy new version
4. Zero-downtime rollout

## 🎯 Next Steps

1. ✅ Deploy and test
2. ✅ Share frontend URL with test users
3. ✅ Monitor logs for errors
4. ✅ Set up custom domain (optional)
5. ✅ Consider upgrading to paid tier if cold starts are issue

---

**Need help?** Check Render documentation or contact support at render.com

