// GroupTable component - Single group standings table
export default function GroupTable({ group }) {
  if (!group || !group.teams || group.teams.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Group header */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <h3 className="font-bold text-sm text-gray-700">Grupo {group.group}</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase tracking-wider">
              <th className="px-1 py-1.5 text-center w-6">#</th>
              <th className="px-1 py-1.5 text-left w-32">Equipo</th>
              <th className="px-1.5 py-1.5 text-center w-6">Pts</th>
              <th className="px-1 py-1.5 text-center w-5">PJ</th>
              <th className="px-1 py-1.5 text-center w-5">G</th>
              <th className="px-1 py-1.5 text-center w-5">E</th>
              <th className="px-1 py-1.5 text-center w-5">P</th>
              <th className="px-1 py-1.5 text-center w-5">GF</th>
              <th className="px-1 py-1.5 text-center w-5">GC</th>
              <th className="px-1.5 py-1.5 text-center w-6">DG</th>
            </tr>
          </thead>
          <tbody>
            {group.teams.map((team) => (
              <tr
                key={team.rank}
                className={`border-t border-gray-100 ${
                  team.rank === 1 || team.rank === 2 ? 'bg-green-50' : team.rank === 3 ? 'bg-yellow-50' : ''
                }`}
              >
                <td className={`px-1 py-1.5 text-center font-bold ${
                  team.rank === 1 || team.rank === 2 ? 'text-green-700' : team.rank === 3 ? 'text-yellow-700' : 'text-gray-600'
                }`}>
                  {team.rank}
                </td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center gap-1.5">
                    {team.logo && (
                      <img
                        src={team.logo}
                        alt=""
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <span className="truncate max-w-[120px]" title={team.name}>
                      {team.name}
                    </span>
                  </div>
                </td>
                <td className="px-1.5 py-1.5 text-center font-bold text-gray-800">
                  {team.points}
                </td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.played}</td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.wins}</td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.draws}</td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.losses}</td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.goalsFor}</td>
                <td className="px-1 py-1.5 text-center text-gray-600">{team.goalsAgainst}</td>
                <td className={`px-1.5 py-1.5 text-center font-medium ${
                  team.goalDiff > 0 ? 'text-green-600' : team.goalDiff < 0 ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-1.5 text-[10px] text-gray-400 text-right border-t border-gray-100">
        Criterio de grupo: Pts &gt; DG &gt; GF &gt; H2H
      </p>
    </div>
  );
}
