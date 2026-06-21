// ThirdPlaceTable — Ranking de terceros lugares con columna "Avanza?"
import { useMemo } from 'react';
import thirdPlaceRanker from '../Bracket/thirdPlaceRanker.js';

export default function ThirdPlaceTable({ standings }) {
  const rankerResult = useMemo(() => {
    if (!standings || standings.length === 0) return null;
    return thirdPlaceRanker(standings);
  }, [standings]);

  if (!rankerResult) return null;

  const { rankings, thirdPlaceSlots } = rankerResult;

  // Build slot lookup: group → { matchupId }
  const slotMap = {};
  for (const slot of thirdPlaceSlots) {
    if (slot.team) {
      slotMap[slot.team.group] = { matchupId: slot.matchupId };
    }
  }

  return (
    <div className="mt-8 mx-auto max-w-xl">
      <h3 className="text-base font-bold text-gray-700 mb-3 text-center">
        Ranking de terceros lugares
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th className="px-2 py-2 text-center w-8">#</th>
              <th className="px-2 py-2 text-left">Equipo</th>
              <th className="px-2 py-2 text-center w-10">Grupo</th>
              <th className="px-2 py-2 text-center w-8">Pts</th>
              <th className="px-2 py-2 text-center w-7">PJ</th>
              <th className="px-2 py-2 text-center w-7">G</th>
              <th className="px-2 py-2 text-center w-7">E</th>
              <th className="px-2 py-2 text-center w-7">P</th>
              <th className="px-2 py-2 text-center w-7">GF</th>
              <th className="px-2 py-2 text-center w-7">GC</th>
              <th className="px-2 py-2 text-center w-8">DG</th>
              <th className="px-2 py-2 text-center w-20">Avanza?</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((team, idx) => {
              const advances = idx < 8;
              const slot = slotMap[team.group];
              return (
                <tr
                  key={team.group}
                  className={`border-t border-gray-100 ${
                    advances ? 'bg-green-50' : 'bg-red-50/30'
                  }`}
                >
                  <td className="px-2 py-1.5 text-center font-bold text-gray-600">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {team.logo && (
                        <img
                          src={team.logo}
                          alt=""
                          className="w-4 h-4 flex-shrink-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
                      <span className="font-medium text-gray-800 truncate max-w-[120px]">
                        {team.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-center font-medium text-gray-600">
                    {team.group}
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold text-gray-800">
                    {team.points}
                  </td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.played}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.wins}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.draws}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.losses}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.goalsFor}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">{team.goalsAgainst}</td>
                  <td
                    className={`px-2 py-1.5 text-center font-medium ${
                      team.goalDiff > 0
                        ? 'text-green-600'
                        : team.goalDiff < 0
                          ? 'text-red-500'
                          : 'text-gray-500'
                    }`}
                  >
                    {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {advances ? (
                      <span className="inline-flex items-center gap-1 text-green-700 font-medium text-xs">
                        <span className="text-green-600 text-sm">✓</span>
                        {slot?.matchupId || ''}
                      </span>
                    ) : (
                      <span className="text-red-400 font-medium text-sm">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-gray-400 text-right">
        Criterio: Pts &gt; DG &gt; GF. Asignación por algoritmo Kuhn.
      </p>
    </div>
  );
}
