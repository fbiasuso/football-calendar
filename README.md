# Football Calendar

Calendario de fútbol con partidos del día, Mundial 2026 y predicciones de llaves.

**Stack:** React 18 + Vite + Tailwind CSS + Zustand  
**API:** [API-Football](https://www.api-sports.io/) (v3, 100 req/day free tier)  
**Backend:** Supabase (Edge Function + pg_cron + Realtime)

## Prerrequisitos

Copiar `.env.example` a `.env` y completar:

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `VITE_API_FOOTBALL_API_KEY` | ✅ | API key de api-sports.io |
| `VITE_SUPABASE_URL` | ❌ (sin Supabase cae a API directa) | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ❌ | Anon key del proyecto Supabase |

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run lint     # ESLint
npm test         # Vitest (136 tests)
```

## Arquitectura

```
src/
├── api/            # Capa de adaptación de APIs (adapter pattern)
├── components/     # Componentes React compartidos
├── hooks/          # Custom hooks (matches, leagues, World Cup)
├── pages/          # Componentes de página
├── store/          # Estado global con Zustand
├── lib/            # Cliente Supabase
└── utils/          # Helpers (fechas, ligas, detector)

supabase/
├── functions/      # Edge Function fetch-data (scheduler + API)
└── migrations/     # Migraciones SQL versionadas
```

## Despliegue

- Frontend: cualquier static host (Vercel, Netlify, GitHub Pages)
- Backend: Supabase (Edge Function + migrations)
- Scheduler automático vía Edge Function con pg_cron

### Sin Supabase

Si no configurás Supabase, la app funciona igual consultando la API directo desde el frontend (sin persistencia ni scheduler automático).
