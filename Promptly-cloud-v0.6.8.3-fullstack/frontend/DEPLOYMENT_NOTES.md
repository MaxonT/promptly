# Frontend Deployment Guide (Vercel/Netlify/etc.)

## Quick Setup

### Option 1: Edit config.js directly (Recommended)

1. Open `frontend/config.js`
2. Update line 10 with your backend URL:
   ```javascript
   window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";
   ```
3. Deploy the frontend folder to Vercel/Netlify

### Option 2: Use environment variable injection

Some static hosting platforms (like Vercel) support environment variable injection during build time.

Set environment variable:
- Name: `PROMPTLY_API_BASE`
- Value: `https://your-backend.onrender.com`

Then create a build script that replaces the placeholder in config.js.

## Testing

After deployment:
1. Open browser developer console (F12)
2. You should see: `[Promptly] API Base configured: https://your-backend.onrender.com`
3. Try starting a question session
4. Check Network tab to verify requests go to your backend URL

## Troubleshooting

### 404 Errors on API calls
- Check that `window.PROMPTLY_API_BASE` is set correctly (open console and type `window.PROMPTLY_API_BASE`)
- Verify your backend is running on Render (visit `https://your-backend.onrender.com/api/health`)
- Ensure CORS is configured correctly in backend (check `CORS_ORIGIN` env var)

### CORS Errors
In your Render backend, set environment variable:
- Name: `CORS_ORIGIN`
- Value: `https://your-frontend.vercel.app` (or `*` for testing)

## Complete Deployment Checklist

### Backend (Render)
- [ ] Deploy backend folder
- [ ] Set `OPENAI_API_KEY` environment variable
- [ ] Set `CORS_ORIGIN` to your frontend URL
- [ ] Verify health endpoint: `/api/health`
- [ ] Note your backend URL (e.g., `https://promptly-backend-xxx.onrender.com`)

### Frontend (Vercel)
- [ ] Edit `config.js` with your backend URL
- [ ] Deploy frontend folder
- [ ] Test in browser console that API_BASE is correct
- [ ] Test question wizard functionality
