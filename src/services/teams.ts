import type { Player, Team } from '../types/quiz';

export const MAX_TEAMS = 6;
const COLORS: Team['color'][] = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];

/** `names` holds one name per color, in the interface language. */
export function makeTeams(count: number, names: Record<Team['color'], string>): Team[] {
  return COLORS.slice(0, Math.max(2, Math.min(MAX_TEAMS, count))).map(color => ({ id: `team-${color}`, name: names[color], color }));
}

export interface TeamStanding { team: Team; members: Player[]; score: number }
/** Average score of the members, best first; a team without members scores nothing and goes last. */
export function teamStandings(teams: Team[], players: Player[]): TeamStanding[] {
  return teams.map(team => {
    const members = players.filter(player => player.teamId === team.id);
    return { team, members, score: members.length ? Math.round(members.reduce((sum, player) => sum + player.score, 0) / members.length) : 0 };
  }).sort((a, b) => Number(!a.members.length) - Number(!b.members.length) || b.score - a.score);
}

/** Participants without a valid team go to the smallest one, in order of arrival, so teams stay even. */
export function assignTeams(players: Record<string, Player>, teams: Team[]): Record<string, Player> {
  const ids = new Set(teams.map(team => team.id));
  const sizes = new Map(teams.map(team => [team.id, Object.values(players).filter(player => player.teamId && player.teamId === team.id).length]));
  const result = { ...players };
  for (const player of Object.values(players).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))) {
    if (player.teamId && ids.has(player.teamId)) continue;
    const smallest = teams.reduce((best, team) => sizes.get(team.id)! < sizes.get(best.id)! ? team : best, teams[0]);
    result[player.id] = { ...player, teamId: smallest.id };
    sizes.set(smallest.id, sizes.get(smallest.id)! + 1);
  }
  return result;
}
