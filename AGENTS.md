# AGENTS.md - Football Calendar

## Project Context

**Project Name**: Football Calendar  
**Type**: SPA (Single Application) - Web App  
**Tech Stack**: React 18 + Vite + Tailwind CSS + Zustand  
**API**: [API-Football](https://www.api-sports.io/) (v3, 100 req/day free tier, API key required)

## Architecture

```
src/
├── api/                       # API abstraction layer (Adapter Pattern)
│   ├── adapter.js              # Common interface for API switching
│   ├── apiFootball.js          # API-Football client (current, primary)
│   ├── footballData.js         # football-data.org client (deprecated)
│   └── sportsrc.js             # SportSRC client (deprecated - no scores)
├── components/                # React components (shared)
│   ├── MatchCard/              # Match display with scores
│   ├── MatchList/              # Match list with sorting
│   ├── LeagueFilter/           # League filter checkboxes
│   ├── DateNav/                # Date navigation
│   └── SortControl/            # Sort mode toggle
├── hooks/                     # Custom hooks
│   ├── useMatches.js           # Fetch, cache, polling for matches
│   ├── useLeagues.js           # League handling
│   └── useWorldCup.js          # Fetch/cache World Cup standings + rounds
├── pages/                     # Page-level components
│   └── WorldCupPage/           # World Cup 2026 section
│       ├── WorldCupPage.jsx     # Container: reads wcTab, renders sub-pages
│       ├── SubTabBar.jsx        # "Grupos" / "Llaves" sub-navigation
│       ├── GroupStandings/      # Group tables section
│       │   ├── GroupStandings.jsx  # 4×3 responsive grid of group tables
│       │   └── GroupTable.jsx      # Single group table (Pos, team, Pts, PJ, G, E, P, GF, GC, DG)
│       └── Bracket/             # R32 bracket section
│           ├── Bracket.jsx       # 16 R32 matchups with third-place simulation
│           └── thirdPlaceRanker.js # Kuhn bipartite matching for 8 third-place slots
├── store/                     # Zustand store
│   └── useAppStore.js          # Global state (matches, leagues, WC data, view)
└── utils/                     # Helper functions
    ├── leagueConfig.js          # League configuration (IDs, groups, defaults)
    ├── leagueDetector.js        # League detection
    ├── leagueUtils.js           # League utilities
    └── dateUtils.js             # Date utilities
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
9. **Mundial 2026**: Pestaña dedicada con:
   - Tabla de grupos (12 grupos A-L con tabla de posiciones)
   - Llaves (R32 con simulación de mejores terceros)
   - Partidos del Mundial integrados en la lista principal

## Supported Leagues (API-Football)

### International
- World Cup 2026
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

**Note**: API-Football includes Argentine leagues (unlike football-data.org).

## API Configuration

### Environment Variables
Create `.env` file (DO NOT commit):
```
VITE_FOOTBALL_DATA_API_KEY=your_football_data_key_here
VITE_API_FOOTBALL_API_KEY=your_api_football_key_here
```

Template available in `.env.example`.

### API-Football (Primary)
- Base URL: `https://v3.football.api-sports.io`
- Proxy path: `/api/api-football`
- Auth header: `x-apisports-key`
- Rate limit: 100 requests/day (free tier)

### API Endpoints (API-Football)

- Fixtures: `GET /fixtures?date={YYYY-MM-DD}` (all leagues)
- League fixtures: `GET /fixtures?league={id}&season={YYYY}`
- Standings: `GET /standings?league={id}&season={YYYY}`
- Rounds: `GET /rounds?league={id}&season={YYYY}`
- Live fixtures: `GET /fixtures?live=all`

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
    '/api/api-football': {
      target: 'https://v3.football.api-sports.io',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api\/api-football/, ''),
    },
  },
}
```

## Rules & Conventions

### State Management
- Usar Zustand para estado global
- Partidos en cache localStorage (key: `fc_matches_{date}`)
- Estado de ligas seleccionadas en localStorage (persistido por Zustand)
- World Cup data (standings, rounds) en store, NO persistida (se refetchea si stale > 5min)

### API Calls
- NUNCA usar axios (vulnerabilidades recientes)
- Usar fetch nativo con async/await
- Implementar retry con exponential backoff (3 retries, 1s delay)
- Manejar errores graceful (mostrar mensaje al usuario)

### Timezone Handling
- La API guarda fechas en UTC
- Para mostrar partidos por fecha LOCAL: se consultan las 2 fechas UTC que cubren el día local (ej: para Argentina UTC-3, se consultan 19-Jun y 20-Jun), luego se filtran del lado del cliente con `new Date(f.fixture.date).getDate()` (JS convierte automáticamente a timezone del browser)
- Esto evita depender del parámetro `timezone` de la API y funciona en cualquier timezone sin configuración

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
- Busca el partido de ida en los 15 días anteriores usando apiFootball
- Maneja equipos que cambian localía (swap de scores)
- Click lazy: solo hace la llamada a la API cuando el usuario hace click

### World Cup Specific Conventions
- **Grupos**: La API devuelve 13 arrays (12 grupos A-L + 1 ranking combinado de terceros). Se descarta el 13ro y se toman los primeros 12.
- **NormalizeStandings**: Toma `data.response[0].standings` (o `league.standings` anidado), slices a 12 grupos, asigna letras A-L por índice.
- **Terceros**: Se rankean 12 equipos por Pts > GD > GF. Los top 8 se asignan a slots específicos usando **Kuhn bipartite matching** (DFS con backtracking) para cumplir las restricciones de FIFA (no enfrentar equipo del mismo grupo, candidate sets fijos).
- **Bracket**: R32 con 16 matchups (8 fijos + 8 slots de terceros). Botón "Simular" ejecuta el ranker, muestra "SIMULACIÓN" badge. No se propaga más allá de R32.

## Git Workflow

- Commits use conventional format (e.g., `feat:`, `fix:`, `refactor:`)
- API keys stored in `.env` (never committed)
- `.env` and `.env.local` in `.gitignore`
- `.env.example` template is committed

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm test` - Run Vitest unit tests

## Dependencies

- react: ^18.x
- vite: ^5.x
- tailwindcss: ^3.x
- zustand: ^4.x
- vitest: ^3.x (dev)
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
