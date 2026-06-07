# OAuth setup (Google & Discord)

Social login uses the **backend** as the OAuth callback host, not the Vite frontend.

## Local development

1. Start backend on port **3000** and frontend on **5173**.
2. Open `GET http://localhost:3000/api/oauth/config` or sign in page (dev shows setup panel).
3. Copy the exact redirect URIs:

   - Google: `http://localhost:3000/api/oauth/google/callback`
   - Discord: `http://localhost:3000/api/oauth/discord/callback`

4. Register them in each provider console:

   - [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   - [Discord Developer Portal](https://discord.com/developers/applications)

5. Set backend `.env`:

   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   DISCORD_CLIENT_ID=...
   DISCORD_CLIENT_SECRET=...
   API_PUBLIC_URL=http://localhost:3000
   CLIENT_URL=http://localhost:5173
   ```

## Common error: `redirect_uri_mismatch`

Google/Discord rejected the callback URL. The URI in the provider console must **exactly** match `API_PUBLIC_URL` + `/api/oauth/{provider}/callback`.

- Use port **3000** (API), not **5173** (frontend).
- No trailing slash unless your config includes one.
- `http` vs `https` must match.

## Production

When deploying:

1. Set `API_PUBLIC_URL` to your Render (or other) backend URL, e.g. `https://your-api.onrender.com`.
2. Set `CLIENT_URL` to your Vercel frontend URL.
3. Add production callback URIs to Google/Discord:
   - `https://your-api.onrender.com/api/oauth/google/callback`
   - `https://your-api.onrender.com/api/oauth/discord/callback`

Stripe test/live mode does **not** affect OAuth.
