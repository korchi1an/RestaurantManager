# ✅ Pre-Deployment Checklist

Before deploying to Render, verify:

## Code Ready
- [ ] All code changes committed
- [ ] .env files NOT committed (in .gitignore)
- [ ] Database file NOT committed (in .gitignore)
- [ ] Tests passing (`npm test` in backend)
- [ ] No console errors in browser
- [ ] Socket.IO connects properly locally

## Configuration Files
- [ ] `render.yaml` exists in root
- [ ] `backend/.env.example` complete
- [ ] `frontend/.env.example` complete
- [ ] `.gitignore` updated for both frontend and backend

## Security
- [ ] JWT_SECRET generated and ready (see DEPLOYMENT.md)
- [ ] Default passwords noted for changing later
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled

## Database
- [ ] Database path uses environment variable
- [ ] Migrations/seed data work correctly
- [ ] Default users created (kitchen, waiter1, waiter2, admin)

## GitHub
- [ ] Repository created: RestaurantManager
- [ ] All files pushed to main branch
- [ ] Repository is public or Render has access

## Render Account
- [ ] Account created at render.com
- [ ] GitHub connected to Render
- [ ] Ready to create Blueprint

## Post-Deployment
- [ ] Test customer registration
- [ ] Test login (waiter1 / waiter123)
- [ ] Test QR code scanning
- [ ] Test order creation
- [ ] Test real-time order updates
- [ ] Test payment marking
- [ ] Update CORS_ORIGIN with actual frontend URL
- [ ] Monitor logs for errors

---

📖 **Full instructions:** See [DEPLOYMENT.md](DEPLOYMENT.md)
🔐 **JWT Secret:** `c5a728e74c0b1e9e0ba6a3305eeacd5307ab23b043a89a8c64652f6000565ee17ebb10135
79bc2385d3ac875711421b45d06e4d4dcf3bb0f1ac828aa0a522756`
