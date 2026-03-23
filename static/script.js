const yearSelect = document.getElementById('year-select');
const yearsCount = document.getElementById('years-count');
const status = document.getElementById('load-status');

async function loadYears() {
  try {
    const res = await fetch('/years');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const years = await res.json();
    if (!Array.isArray(years) || years.length === 0) {
      yearSelect.innerHTML = '<option>No years available</option>';
      status.textContent = 'No seasons were found in the database.';
      return;
    }

    yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
    yearsCount.textContent = `${years.length}`;
    status.textContent = `Loaded ${years.length} seasons from the API.`;
    yearSelect.addEventListener('change', () => loadTeamsForYear(Number(yearSelect.value)));
    loadTeamsForYear(Number(yearSelect.value));
  } catch (error) {
    console.error(error);
    yearSelect.innerHTML = '<option>Error loading data</option>';
    yearsCount.textContent = '0';
    status.textContent = 'Could not load years. Check the backend and retry.';
  }
}

async function loadTeamsForYear(year) {
  const teamList = document.getElementById('team-list');
  const teamResults = document.getElementById('team-results');

  if (!year) {
    teamList.innerHTML = '<li>Please select a year.</li>';
    return;
  }

  try {
    const res = await fetch(`/teams?year=${year}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const teams = await res.json();
    if (!Array.isArray(teams) || teams.length === 0) {
      teamList.innerHTML = '<li>No teams found for this year.</li>';
      return;
    }

    const grouped = teams.reduce((acc, team) => {
      const league = team.league || 'Unknown';
      const division = team.division || 'Unknown';
      if (!acc[league]) acc[league] = {};
      if (!acc[league][division]) acc[league][division] = [];
      acc[league][division].push(team);
      return acc;
    }, {});

    let html = '';
    for (const [league, divisions] of Object.entries(grouped)) {
      html += `<li class="league-block"><strong>League: ${league}</strong><ul class="division-list">`;
      for (const [division, entries] of Object.entries(divisions)) {
        html += `<li><em>${division}</em><ul>`;
        html += entries.map((entry) => `<li><button class="team-button" data-teamid="${entry.teamID}" data-year="${year}">${entry.name}</button></li>`).join('');
        html += `</ul></li>`;
      }
      html += `</ul></li>`;
    }

    teamList.innerHTML = html;
    teamResults.style.display = 'block';
    document.querySelectorAll('.team-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        loadPlayersForTeam(Number(btn.dataset.year), btn.dataset.teamid, btn.textContent);
      });
    });
  } catch (error) {
    console.error(error);
    teamList.innerHTML = '<li>Could not load teams. Please try again.</li>';
  }
}

async function loadPlayersForTeam(year, teamID, teamName) {
  const playersList = document.getElementById('players-list');
  const playersPanel = document.getElementById('players-panel');
  playersPanel.style.display = 'block';
  playersList.innerHTML = '<li>Loading players...</li>';

  try {
    const res = await fetch(`/team-players-by-name?year=${year}&team_name=${encodeURIComponent(teamName)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const players = await res.json();
    if (!Array.isArray(players) || players.length === 0) {
      playersList.innerHTML = `<li>No players found for ${teamName}.</li>`;
      return;
    }

    playersList.innerHTML = players.map((p) => `<li><button class="player-button" data-playerid="${p.playerID}" data-teamid="${teamID}">${p.first} ${p.last}</button></li>`).join('');

    document.querySelectorAll('.player-button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const playerDetails = document.getElementById('player-details');
        const playerStatsPanel = document.getElementById('player-stats-panel');
        try {
          const res = await fetch(`/player-stats?playerID=${btn.dataset.playerid}&year=${year}&teamID=${encodeURIComponent(btn.dataset.teamid)}`);
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          const data = await res.json();
          const stats = data.stats;
          const other = data.other_teams;
          let details = `<p><strong>${btn.textContent}</strong></p>`;
          details += `<p>Games: ${stats.G}, At Bats: ${stats.AB}, Runs: ${stats.R}, Hits: ${stats.H}, Doubles: ${stats['2B']}, Triples: ${stats['3B']}, Home Runs: ${stats.HR}, RBIs: ${stats.RBI}, Stolen Bases: ${stats.SB}, Caught Stealing: ${stats.CS}</p>`;
          if (other.length > 0) {
            details += `<p>Played for: ${other.join(', ')}</p>`;
          }
          playerDetails.innerHTML = details;
          playerStatsPanel.style.display = 'block';
        } catch (error) {
          console.error(error);
          playerDetails.innerHTML = '<p>Could not load player stats.</p>';
        }
      });
    });
  } catch (error) {
    console.error(error);
    playersList.innerHTML = '<li>Could not load players for this team.</li>';
  }
}

window.addEventListener('DOMContentLoaded', loadYears);
