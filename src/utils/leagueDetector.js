// League detection based on teams - comprehensive list
// Priority: more specific matches first

const TEAM_LEAGUES = {
  'Champions League': [
    'real madrid', 'barcelona', 'bayern munich', 'manchester city', 'liverpool',
    'chelsea', 'arsenal', 'tottenham', 'psg', 'juventus', 'inter', 'milan',
    'sporting cp', 'sporting lisbon', 'monaco', 'dortmund', 'leverkusen',
    'atletico madrid', 'benfica', 'ajax', 'porto', 'shakhtar', 'celtic'
  ],
  'Copa Libertadores': [
    'boca juniors', 'river plate', 'flamengo', 'palmeiras', 'bragantino',
    'athletico paranaense', 'são paulo', 'atlético mineiro', 'corinthians',
    'botafogo', 'fluminense', 'santos', 'argentinos juniors', 'racing club',
    'independiente', 'san lorenzo', 'huracán', 'vélez sarsfield'
  ],
  'Copa Sudamericana': [
    'Independiente del Valle', 'Sportivo Luqueño', ' Deportivo Cali'
  ],
  'Premier League': [
    'manchester united', 'manchester city', 'liverpool', 'chelsea',
    'arsenal', 'tottenham', 'newcastle', 'west ham', 'aston villa',
    'fulham', 'wolves', 'brighton', 'crystal palace', 'everton',
    'nottingham forest', 'bournemouth', 'leicester', 'west brom'
  ],
  'La Liga': [
    'real madrid', 'barcelona', 'atlético madrid', 'sevilla', 'real betis',
    'valencia', 'villarreal', 'real sociedad', 'osasuna', 'celta vigo',
    'alavés', 'espanyol', 'girona', 'mallorca', 'rayo vallecano'
  ],
  'Serie A': [
    'juventus', 'inter', 'milan', 'napoli', 'roma', 'lazio',
    'fiorentina', 'atalanta', 'torino', 'bologna', 'sampdoria',
    'monza', 'lecce', 'frosinone', 'verona'
  ],
  'Bundesliga': [
    'bayern munich', 'borussia dortmund', 'rb leipzig', 'leverkusen',
    'frankfurt', 'wolfsburg', 'stuttgart', 'freiburg', 'union berlin',
    ' Mainz 05', 'augsburg', 'hertha berlin', 'köln', 'borussia mönchengladbach'
  ],
  'Liga Profesional Argentina': [
    'river plate', 'boca juniors', 'independiente', 'racing club',
    'san lorenzo', 'huracán', 'vélez sarsfield', 'lanús', 'godoy cruz',
    'belgrano', 'central córdoba', 'platense', 'talleres córdoba',
    'unión santa fe', 'banfield', 'estudiantes', 'gimnasia lp',
    'rosario central', 'newell old boys', 'arsenal fc'
  ],
  'Copa Argentina': ['copa argentina'],
  'Copa de la Liga Argentina': ['copa de la liga']
};

// League keywords (higher priority than team names)
const LEAGUE_KEYWORDS = [
  { pattern: 'ucl', league: 'Champions League' },
  { pattern: 'champions league', league: 'Champions League' },
  { pattern: 'libertadores', league: 'Copa Libertadores' },
  { pattern: 'sudamericana', league: 'Copa Sudamericana' },
  { pattern: 'premier league', league: 'Premier League' },
  { pattern: 'la liga', league: 'La Liga' },
  { pattern: 'serie a', league: 'Serie A' },
  { pattern: 'bundesliga', league: 'Bundesliga' },
  { pattern: 'liga profesional', league: 'Liga Profesional Argentina' },
  { pattern: 'copa argentina', league: 'Copa Argentina' },
  { pattern: 'copa de la liga', league: 'Copa de la Liga Argentina' },
];

export function detectLeague(title, id) {
  if (!title && !id) return 'Otros';
  
  const text = (title + ' ' + id).toLowerCase();
  
  // First: check league keywords
  for (const { pattern, league } of LEAGUE_KEYWORDS) {
    if (text.includes(pattern)) {
      return league;
    }
  }
  
  // Second: check team names (more specific detection with word boundaries)
  for (const [league, teams] of Object.entries(TEAM_LEAGUES)) {
    for (const team of teams) {
      // Use word boundary for exact match
      const regex = new RegExp('\\b' + team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (regex.test(text)) {
        return league;
      }
    }
  }
  
  return 'Otros';
}