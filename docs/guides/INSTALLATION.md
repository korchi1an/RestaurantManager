# 🚀 Installation & Running Instructions

## Prerequisites Check

Before starting, ensure you have:
- ✅ Node.js (v18 or higher) - [Download](https://nodejs.org/)
- ✅ npm (comes with Node.js)
- ✅ A code editor (VS Code recommended)

Verify installation:
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

---

## 🔧 Installation Steps

### Step 1: Open Two Terminals

In VS Code:
1. Press `` Ctrl + ` `` to open terminal
2. Click the "+" icon to open a second terminal
3. Or use "Split Terminal" icon

### Step 2: Install Backend Dependencies

**Terminal 1:**
```bash
cd backend
npm install
```

Wait for installation to complete. You should see:
```
added XXX packages in Xs
```

### Step 3: Install Frontend Dependencies

**Terminal 2:**
```bash
cd frontend
npm install
```

Wait for installation to complete. You should see:
```
added XXX packages in Xs
```

---

## ▶️ Running the Application

### Start Backend Server

**Terminal 1:**
```bash
cd backend
npm run dev
```

✅ **Expected Output:**
```
✓ Database initialized
✓ Seeded menu items
✓ Seeded tables
✓ Server running on http://localhost:5000
✓ Socket.IO server ready
```

⚠️ **Keep this terminal running!**

### Start Frontend Server

**Terminal 2:**
```bash
cd frontend
npm run dev
```

✅ **Expected Output:**
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h to show help
```

⚠️ **Keep this terminal running!**

### Access the Application

🌐 **Open in browser:** http://localhost:3000

The application should load with three navigation options:
- 👥 Customer
- 👨‍🍳 Kitchen
- 🍽️ Waiter

---

## 🧪 Testing the Application

### Quick Test Flow

1. **Switch to Customer View** (👥 Customer button)
   - Select a table number (e.g., Table 3)
   - Click on some menu items to add to cart
   - Adjust quantities using +/- buttons
   - Click "Submit Order"
   - ✅ You should see "Order submitted successfully!"

2. **Switch to Kitchen View** (👨‍🍳 Kitchen button)
   - ✅ You should see your order appear in real-time
   - Click "Start Preparing" or "Mark as Ready"
   - ✅ Order status updates

3. **Switch to Waiter View** (🍽️ Waiter button)
   - ✅ If order is "Ready", you'll see it here with notification
   - Click "Mark as Served"
   - ✅ Order moves to "Recently Served" section

4. **Back to Customer View**
   - ✅ Your order status should show "Served"

---

## 🐛 Troubleshooting

### Problem: Port 5000 already in use

**Solution:**
Edit `backend/src/server.ts`, line ~70:
```typescript
const PORT = process.env.PORT || 5001; // Changed from 5000
```

Also update `frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:5001', // Changed from 5000
```

### Problem: Port 3000 already in use

**Solution:**
Edit `frontend/vite.config.ts`:
```typescript
server: {
  port: 3001, // Changed from 3000
```

### Problem: Cannot find module 'express'

**Solution:**
Make sure you're in the correct directory and dependencies are installed:
```bash
cd backend
npm install
```

### Problem: Socket.IO not connecting

**Solution:**
1. Check backend server is running (Terminal 1)
2. Check browser console for errors (F12)
3. Verify URL in `frontend/src/services/socket.ts` matches backend URL

### Problem: Database errors

**Solution:**
Delete the database and restart:
```bash
cd backend
rm restaurant.db  # or del restaurant.db on Windows
npm run dev       # Recreates database with seed data
```

### Problem: Module not found errors

**Solution:**
Clear node_modules and reinstall:
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## 🔄 Stopping the Application

1. In **Terminal 1** (Backend): Press `Ctrl + C`
2. In **Terminal 2** (Frontend): Press `Ctrl + C`

---

## 📦 Building for Production

### Build Backend
```bash
cd backend
npm run build
```
Output will be in `backend/dist/`

### Build Frontend
```bash
cd frontend
npm run build
```
Output will be in `frontend/dist/`

### Run Production Build

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
Serve the `dist` folder with a static file server:
```bash
cd frontend
npm install -g serve
serve -s dist -p 3000
```

---

## 🗂️ Project Structure at a Glance

```
restaurant2/
├── backend/          # Node.js server
│   ├── src/          # Source code
│   └── package.json  # Dependencies
│
├── frontend/         # React app
│   ├── src/          # Source code
│   └── package.json  # Dependencies
│
└── *.md              # Documentation
```

---

## 📚 Next Steps

1. ✅ Read [README.md](README.md) for full documentation
2. ✅ Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
3. ✅ See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for feature overview
4. ✅ Start customizing the code!

---

## 🎯 Quick Command Reference

### Development
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

### Production Build
```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
```

### Fresh Install
```bash
# Backend
cd backend && rm -rf node_modules && npm install

# Frontend
cd frontend && rm -rf node_modules && npm install
```

---

## ✅ Success Checklist

- [ ] Node.js and npm installed
- [ ] Backend dependencies installed (`backend/node_modules/` exists)
- [ ] Frontend dependencies installed (`frontend/node_modules/` exists)
- [ ] Backend server running (http://localhost:5000)
- [ ] Frontend server running (http://localhost:3000)
- [ ] Application loads in browser
- [ ] Can switch between Customer/Kitchen/Waiter views
- [ ] Can place an order
- [ ] Real-time updates work across views

---

**Need Help?** Check the troubleshooting section above or review the documentation files!

🎉 **Happy Coding!**
