# ProtoMusic Proxy

CORS proxy for ProtoMusic PWA deployed on GitHub Pages.

## Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

1. Click button above or go to https://render.com
2. Sign up / Login
3. New+ → Web Service
4. Connect this repo or manual deploy
5. Settings:
   - **Name**: protomusic-proxy
   - **Environment**: Node
   - **Build**: `npm install`
   - **Start**: `npm start`
   - **Plan**: Free
6. Deploy!

Your proxy URL will be: `https://protomusic-proxy.onrender.com`

## Test

```bash
curl https://YOUR_URL.onrender.com/api/media/getPublicMedia.php?limit=1
```

Should return JSON with video data.
