# AGENTS.md - Football Calendar

## Project Context

**Project Name**: Football Calendar  
**Type**: SPA (Single Page Application) - Web App  
**Tech Stack**: React 18 + Vite + Tailwind CSS + Zustand  
**API**: football-data.org (free tier, 1000 req/day, API key required)

## Architecture

```
src/
├── api/                    # API abstraction layer (Adapter Pattern)
│   ├── adapter.js           # Common interface for API switching
│   ├── footballData.js      # football-data.org client (current)
│   └── sportsrc.js          # SportSRC client (deprecated - no scores)
├── components/             # React components
│   ├── MatchCard/           # Match display with scores
│   ├── MatchList/           # Match list with sorting
│   ├── LeagueFilter/        # League filter checkboxes
│   ├── DateNav/             # Date navigation
│   └── SortControl/         # Sort mode toggle
├── hooks/                  # Custom hooks
│   ├── useMatches.js        # Fetch, cache, polling for matches
│   └── useLeagues.js        # League handling
├── store/                  # Zustand store
│   └── useAppStore.js       # Global state management
└── utils/                  # Helper functions
    ├── leagueConfig.js      # League configuration
    ├── leagueDetector.js    # League detection
    ├── leagueUtils.js       # League utilities
    └── dateUtils.js         # Date utilities
```

## Features

1. **Lista de partidos del día**: Mostrar todos los partidos (pendientes, en vivo, finalizados)
2. **Ordenamiento**: 
   - Por horario (todas las ligas mezcladas)
   - Por liga (Argentina primero, luego las demás, cada liga ordenada por horario)
3. **Filtro de ligas**: Checkboxes con las principales pre-seleccionadas
4. **Navegación de fechas**: Día anterior / siguiente
5. **Actualización**: Botón manual + opcional auto-polling (5min normal, 1min en últimos 5min)
6. **Cache**: localStorage para partidos no-vivos
7. **Score display**: Mostrar scores de partidos
8. **Ver Global**: Para partidos de eliminación directa (Champions/Libertadores), click para ver score agregado de ida + vuelta

## Supported Leagues (football-data.org)

### International
- UEFA Champions League
- Copa Libertadores
- Copa Sudamericana

### England
- Premier League
- FA Cup
- EFL Cup

### Spain
- LaLiga
- Copa del Rey
- Supercopa de España

### Italy
- Serie A
- Coppa Italia

### Germany
- Bundesliga
- DFB-Pokal

**Note**: football-data.org free tier does NOT include Argentine leagues.

## API Configuration

### Environment Variables
Create `.env` file (DO NOT commit):
```
VITE_FOOTBALL_DATA_API_KEY=your_api_key_here
```

Template available in `.env.example`.

### API Endpoints (football-data.org)

- Matches: `GET /matches?dateFrom={YYYY-MM-DD}&dateTo={YYYY-MM-DD}`
- Competition matches: `GET /competitions/{id}/matches`
- Single match: `GET /matches/{id}`

### Vite Proxy Configuration
Located in `vite.config.js`:
```javascript
server: {
  proxy: {
    '/api/football-data': {
      target: 'https://api.football-data.org',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/football-data/, '/v4'),
    },
  },
}
```

This proxy solves CORS issues for development.

## Rules & Conventions

### State Management
- Usar Zustand para estado global
- Partidos en cache localStorage (key: `fc_matches_{date}`)
- Estado de ligas seleccionadas en localStorage (persistido por Zustand)

### API Calls
- NUNCA usar axios (vulnerabilidades recientes)
- Usar fetch nativo con async/await
- Implementar retry con exponential backoff
- Manejar errores graceful (mostrar mensaje al usuario)

### Polling Strategy
- Partidos finalizados/pendientes: NO hacer polling, usar cache
- Partidos en vivo:
  - Modo manual (default): solo al hacer click
  - Modo auto: cada 5 min
  - Últimos 5 min de partido: cada 1 min

### Component Structure
- Props claras con default values
- Memoización donde corresponda (useMemo, useCallback)
- Loading states y error states

### Aggregate Score (Ver Global)
- Solo se muestra para partidos de eliminación directa (ROUND_OF_16, QUARTER_FINALS, SEMI_FINALS, FINAL)
- Busca el partido de ida en los 15 días anteriores usando `/competitions/{id}/matches`
- Maneja equipos que cambian localía (swap de scores)
- Click lazy: solo hace la llamada a la API cuando el usuario hace click

## Git Workflow

- Commits use conventional format (e.g., `feat:`, `fix:`, `refactor:`)
- API keys stored in `.env` (never committed)
- `.env` and `.env.local` in `.gitignore`
- `.env.example` template is committed

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Dependencies

- react: ^18.x
- vite: ^5.x
- tailwindcss: ^3.x
- zustand: ^4.x
- autoprefixer (dev)
- postcss (dev)

## Skills Registry

### User-level Skills
Located at `~/.config/opencode/skills/`:
- `sdd-init` - Bootstrap SDD context
- `sdd-explore` - Investigate codebase
- `sdd-propose` - Create change proposals
- `sdd-spec` - Write specifications
- `sdd-design` - Technical design
- `sdd-tasks` - Task breakdown
- `sdd-apply` - Implementation
- `sdd-verify` - Validation
- `sdd-archive` - Archive completed changes

### Project Skills
None yet.

## Persistence

- **Engram**: Primary persistence backend for SDD artifacts
- **Openspec**: File-based artifacts available if needed
- **Mode**: `engram` (default)