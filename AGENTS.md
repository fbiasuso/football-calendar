# AGENTS.md - Football Calendar

## Project Context

**Project Name**: Football Calendar  
**Type**: SPA (Single Page Application) - Web App  
**Tech Stack**: React 18 + Vite + Tailwind CSS + Zustand  
**API**: SportSRC (free tier, 1000 req/day, no API key required)

## Architecture

```
src/
├── api/              # Capa de abstracción API (Adapter Pattern)
│   ├── sportsrc.js   # Implementación SportSRC
│   └── adapter.js    # Interfaz común (para cambiar de API)
├── components/      # Componentes React
├── hooks/           # Custom hooks
├── store/           # Zustand stores
└── utils/           # Helpers
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

## Supported Leagues

### Argentina
- Liga Profesional
- Copa Argentina
- Copa de la Liga

### Internacional
- Copa Libertadores
- Copa Sudamericana
- Champions League
- Copa Intercontinental
- Europa League
- Conference League
- Mundial de Clubes

### Inglaterra
- Premier League
- Carabao Cup
- FA Cup

### España
- La Liga
- Copa del Rey
- Supercopa

### Italia
- Serie A
- Coppa Italia
- Supercopa

### Alemania
- Bundesliga
- DFB-Pokal

## API Endpoints (SportSRC)

- Partidos del día: `GET https://api.sportsrc.org/?type=matches&sport=football&date={YYYY-MM-DD}`
- Partidos en vivo: `GET https://api.sportsrc.org/?type=matches&sport=football&status=inprogress&date={YYYY-MM-DD}`

## Rules & Conventions

### State Management
- Usar Zustand para estado global
- Partidos en cache localStorage (key: `fc_matches_{date}`)
- Estado de ligas seleccionadas en localStorage (key: `fc_selected_leagues`)

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

## Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
