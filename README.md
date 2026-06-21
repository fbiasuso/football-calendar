# Football Calendar

Calendario de fútbol con partidos del día, Mundial 2026 y predicciones de llaves.

**Stack:** React 18 + Vite + Tailwind CSS + Zustand  
**API:** [API-Football](https://www.api-sports.io/) (v3, 100 req/day free tier)

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build para producción
npm run lint     # ESLint
npm test         # Vitest
```

## Toggle Data Fetch

El fetching automático de datos (partidos en vivo, posiciones) corre cada ~30 minutos mediante GitHub Actions.

### Desactivar

1. Ir a **Actions** > **Toggle Data Fetch**
2. **Run workflow** > seleccionar `pause`
3. El schedule deja de correr
4. Aparece "Actualizaciones desactivadas" en rojo en la página

### Fetch manual (aunque esté desactivado)

1. **Actions** > **fetch-football-data**
2. **Run workflow**

### Reactivar

1. **Actions** > **Toggle Data Fetch**
2. **Run workflow** > seleccionar `resume`
3. El schedule vuelve a correr cada 30'
4. El badge rojo desaparece
