# Joymed Integration

Meditation canvas game embedded in `web_hoc_stripe` frontend at `/` (iframe → `/game/shell.html`).

## Stack

- **Game**: `frontend/public/game/` — vanilla canvas (from meditation)
- **Portal**: React SPA — auth, store, billing, Gold Rush at `/bonus`
- **API**: `backend/` — Stripe billing + `/api/game/*` endpoints

## Local dev

```bash
# Terminal 1
cd web_hoc_stripe/backend && npm start

# Terminal 2
cd web_hoc_stripe/frontend && npm run dev
```

Open http://localhost:5173 — sign in, play meditation, store at `/deposit`.

## Monetization (hybrid)

| Product | Fulfillment |
|---------|-------------|
| `energy_refill` | Full energy refill (5) |
| `energy_pack_5` | +5 energy (cap 10) |
| `gold_*` | Wallet Gold |
| `premium_monthly` | VIP unlimited plays |
| Spend 100 Gold | `POST /api/game/spend-gold` |

## API

- `GET /api/game/profile` — JWT required
- `GET /api/game/energy-status`
- `POST /api/game/start`
- `POST /api/game/score`
- `GET /api/game/leaderboard`
- `POST /api/game/spend-gold`
