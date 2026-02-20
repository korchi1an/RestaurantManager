# 🚀 DEPLOYMENT QUICKSTART

## Pre-Deployment: Generate JWT Secret

```bash
# Generate a secure 32+ character JWT secret
openssl rand -base64 32
```

**Save this output** - you'll need it in step 3.

---

## Step 1: Commit and Push Changes

```bash
cd c:\Users\eneal\Desktop\restaurant2

# Check what was changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix deployment blockers: JWT validation, DB init, WebSocket config"

# Push to GitHub
git push origin main
```

---

## Step 2: Deploy to Render (Blueprint Method)

1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click **"New" → "Blueprint"**
4. Select your **RestaurantManager** repository
5. Render detects `render.yaml` automatically
6. Click **"Apply"**

---

## Step 3: Set Required Environment Variables

### Backend Service

In Render dashboard → `restaurant-backend` → Environment:

| Variable | Value | Example |
|----------|-------|---------|
| `DATABASE_URL` | Your PostgreSQL URL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Output from Step 1 | `abcd1234...` (32+ chars) |
| `CORS_ORIGIN` | Frontend URL | `https://restaurant-frontend-85q6.onrender.com` |
| `FRONTEND_URL` | Frontend URL | `https://restaurant-frontend-85q6.onrender.com` |
| `NODE_ENV` | `production` | Already set in render.yaml |
| `LOG_LEVEL` | `info` | Already set in render.yaml |

**⚠️ CRITICAL**: Make sure `JWT_SECRET` is at least 32 characters!

### Frontend Service

In Render dashboard → `restaurant-frontend` → Environment:

| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Backend API URL | `https://restaurant-backend-85q6.onrender.com/api` |
| `VITE_WS_URL` | Backend WebSocket URL | `https://restaurant-backend-85q6.onrender.com` |

**Note**: These are already set in render.yaml, but verify they match your actual URLs.

---

## Step 4: Monitor Deployment

### Watch Backend Logs

In Render dashboard → `restaurant-backend` → Logs

**Look for this sequence:**
```
=== SERVER STARTING ===
Node version: v20.x.x
Environment: production
Port: 10000
CORS Origin: https://restaurant-frontend-85q6.onrender.com
Testing database connection...
✓ Database connection successful
Initializing database schema...
✓ Database initialized
✓ Server running on port 10000
✓ Socket.IO server ready
=== SERVER READY ===
```

### Watch Frontend Build

In Render dashboard → `restaurant-frontend` → Logs

**Look for:**
```
vite v5.x.x building for production...
✓ built in Xs
```

---

## Step 5: Verify Deployment

### Test Backend Health
```bash
curl https://restaurant-backend-85q6.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T...",
  "uptime": 123.45,
  "environment": "production",
  "database": "connected"
}
```

### Test API
```bash
curl https://restaurant-backend-85q6.onrender.com/api/menu
```

**Expected**: JSON array of menu items

### Test Frontend
Open in browser:
```
https://restaurant-frontend-85q6.onrender.com
```

**Expected**: Restaurant app loads

### Test WebSocket (Browser Console)
1. Open frontend URL in browser
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for: `[API Info] Request: GET ...` messages

**If you see API errors**, WebSocket isn't connecting - check VITE_WS_URL.

---

## Troubleshooting

### ❌ "Missing required environment variables"

**Solution**: 
1. Go to Render dashboard → Backend service → Environment
2. Click "Environment Variables"
3. Add the missing variables (see Step 3)
4. Click "Save Changes" (triggers redeploy)

### ❌ "JWT_SECRET must be at least 32 characters"

**Solution**: 
1. Generate new secret: `openssl rand -base64 32`
2. Update JWT_SECRET in Render dashboard
3. Minimum 32 characters required

### ❌ "Failed to connect to database"

**Solution**:
1. Verify DATABASE_URL is correct
2. Check database service is running in Render dashboard
3. Ensure database allows connections from Render IPs

### ❌ Frontend shows "Network Error"

**Solution**:
1. Check VITE_API_URL matches backend URL exactly (including `/api`)
2. Check CORS_ORIGIN on backend matches frontend URL
3. Verify backend service is running (check health endpoint)

### ❌ Real-time features don't work

**Solution**:
1. Check VITE_WS_URL is set (should NOT include `/api`)
2. Verify WebSocket connection in browser console
3. Check Socket.IO logs in backend

---

## Post-Deployment Checklist

- [ ] Backend health check returns `"status":"healthy"`
- [ ] Frontend loads without errors
- [ ] Can view menu items
- [ ] Can login as employee (Kitchen/Waiter/Admin)
- [ ] Can register as customer
- [ ] Can create order
- [ ] Real-time order updates work (Kitchen receives orders)
- [ ] No errors in browser console
- [ ] No errors in Render backend logs

---

## Default Test Accounts

After deployment, these accounts are available:

| Username | Password | Role |
|----------|----------|------|
| Chef | kitchen123 | Kitchen |
| Ana | waiter123 | Waiter |
| Mihai | waiter123 | Waiter |
| Admin | admin123 | Admin |

**⚠️ IMPORTANT**: Change these passwords in production!

---

## Next Steps After Deployment

1. **Change default passwords** for preloaded accounts
2. **Generate QR codes** for tables (Admin panel)
3. **Test order flow** end-to-end
4. **Monitor logs** for first 24 hours
5. **Set up monitoring** (optional: Sentry, Datadog)

---

## Support

If deployment fails after following this guide:

1. Check [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) for detailed troubleshooting
2. Review Render logs for specific error messages
3. Verify all environment variables are set correctly
4. Ensure database URL is accessible from Render

---

**Last Updated**: February 20, 2026  
**Status**: ✅ Ready for production deployment
