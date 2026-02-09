# Production Setup Instructions

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

## Installation Steps

### 1. Install Dependencies

#### Backend
```bash
cd backend
npm install helmet compression express-rate-limit winston jsonwebtoken @types/jsonwebtoken
```

#### Frontend  
```bash
cd frontend
# All dependencies already installed
```

### 2. Environment Configuration

#### Backend (.env)
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

**Important:** Change `JWT_SECRET` to a secure random string in production!

#### Frontend (.env)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Start Development Servers

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm run dev
```

## Production Features Implemented

### ✅ Frontend (api.ts)
- **Timeout Handling**: 10-second timeout on all requests
- **Retry Logic**: Up to 3 retries with exponential backoff for server errors
- **Enhanced Error Handling**: Custom ApiError class with status codes
- **Request/Response Logging**: Console logging in dev, ready for Sentry in prod
- **Authentication Headers**: Automatic Bearer token injection from localStorage
- **Environment Configuration**: Configurable API base URL via VITE_API_URL

### ✅ Backend Security
- **Helmet**: Security headers protection
- **Compression**: Response compression for faster transfers
- **Rate Limiting**: 
  - General API: 100 req/15min per IP
  - Order creation: 10 req/min per IP
  - Session creation: 5 req/min per IP
- **Authentication Middleware**: JWT token verification (optional auth for now)
- **Error Handler**: Centralized error handling with proper logging
- **Logger**: Winston logger with file rotation and levels

### ✅ Environment Configuration
- Development and production environment files
- Configurable CORS origins
- Configurable log levels
- Database path configuration

## Production Deployment Checklist

### Before Deploying:
- [ ] Change `JWT_SECRET` in backend `.env` to a secure random value
- [ ] Update `CORS_ORIGIN` to your actual domain(s)
- [ ] Set `NODE_ENV=production` in backend
- [ ] Update `VITE_API_URL` in frontend to production API URL
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure database backups
- [ ] Set up error tracking (Sentry, LogRocket)
- [ ] Set up monitoring (Prometheus, Grafana, or similar)
- [ ] Review and adjust rate limits for your use case
- [ ] Set up CI/CD pipeline
- [ ] Configure firewall rules
- [ ] Set up log rotation for Winston logs
- [ ] Review all console.log statements and replace with logger

### Optional Enhancements:
- [ ] Add input validation (Zod, Joi, or express-validator)
- [ ] Implement actual authentication endpoints (login/register)
- [ ] Add refresh tokens for JWT
- [ ] Set up database migrations
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement request ID tracking across services
- [ ] Add health check endpoints for monitoring
- [ ] Set up APM (Application Performance Monitoring)
- [ ] Add CSRF protection
- [ ] Implement role-based access control fully
- [ ] Add audit logging for sensitive operations

## Testing

### Test Rate Limiting
```bash
# Should block after 10 requests in 1 minute
for i in {1..15}; do curl -X POST http://localhost:5000/api/orders -H "Content-Type: application/json" -d '{"test": true}'; done
```

### Test Error Handling
```bash
# Should return proper error response
curl http://localhost:5000/api/invalid-route
```

### Test Health Check
```bash
curl http://localhost:5000/health
```

## Logs

Backend logs are stored in `backend/logs/`:
- `error.log`: Error level logs only
- `combined.log`: All logs

## Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Change default JWT_SECRET** - Use a strong random value
3. **Use HTTPS in production** - Never send tokens over HTTP
4. **Review CORS settings** - Only allow trusted domains
5. **Monitor rate limit violations** - May indicate attacks
6. **Regularly update dependencies** - Run `npm audit` and fix vulnerabilities

## Performance Notes

- Compression middleware reduces response size by ~70%
- Rate limiting prevents abuse and DoS attacks
- Request timeouts prevent hanging connections
- Retry logic handles transient failures automatically

## Troubleshooting

### "Cannot find module 'helmet'" or similar
Run: `npm install helmet compression express-rate-limit winston jsonwebtoken @types/jsonwebtoken` in backend folder

### Rate limit too strict during development
Adjust values in `backend/src/middleware/rateLimiter.ts`

### Logs not appearing
Check `LOG_LEVEL` in `.env` - set to `debug` for verbose logging

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.
