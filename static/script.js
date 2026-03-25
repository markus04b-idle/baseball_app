const yearSelect = document.getElementById('year-select');
const yearsCount = document.getElementById('years-count');
const status = document.getElementById('load-status');

/* ---- helpers ---- */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtHeight(inches) {
  if (!inches) return 'Unknown';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

/* ---- modal card ---- */
function openPlayerCard(html) {
  closePlayerCard();
  const overlay = document.createElement('div');
  overlay.id = 'player-card-overlay';
  overlay.innerHTML = `<div class="player-card">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePlayerCard(); });
  document.body.appendChild(overlay);
}

function closePlayerCard() {
  const old = document.getElementById('player-card-overlay');
  if (old) old.remove();
}

/* ---- data loading ---- */
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
    yearSelect.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
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
  if (!year) { teamList.innerHTML = '<li>Please select a year.</li>'; return; }

  try {
    const res = await fetch(`/teams?year=${year}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const teams = await res.json();
    if (!Array.isArray(teams) || teams.length === 0) {
      teamList.innerHTML = '<li>No teams found for this year.</li>';
      return;
    }

    const grouped = teams.reduce((acc, team) => {
      const lg = team.league || 'Unknown';
      const dv = team.division || 'Unknown';
      if (!acc[lg]) acc[lg] = {};
      if (!acc[lg][dv]) acc[lg][dv] = [];
      acc[lg][dv].push(team);
      return acc;
    }, {});

    let html = '';
    for (const [league, divisions] of Object.entries(grouped)) {
      html += `<li class="league-block"><strong>League: ${league}</strong><ul class="division-list">`;
      for (const [division, entries] of Object.entries(divisions)) {
        html += `<li><em>${division}</em><ul>`;
        html += entries.map((e) => `<li><button class="team-button" data-teamid="${e.teamID}" data-year="${year}">${e.name}</button></li>`).join('');
        html += `</ul></li>`;
      }
      html += `</ul></li>`;
    }
    teamList.innerHTML = html;
    teamResults.style.display = 'block';

    // hide panels from previous selection
    document.getElementById('players-panel').style.display = 'none';
    document.getElementById('player-stats-panel').style.display = 'none';

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
  document.getElementById('player-stats-panel').style.display = 'none';
  playersPanel.style.display = 'block';
  playersList.innerHTML = '<li>Loading players...</li>';

  try {
    const res = await fetch(`/team-players?year=${year}&teamID=${encodeURIComponent(teamID)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const players = await res.json();
    if (!Array.isArray(players) || players.length === 0) {
      playersList.innerHTML = `<li>No players found for ${esc(teamName)}.</li>`;
      return;
    }

    playersList.innerHTML = players.map(
      (p) => `<li><button class="player-button" data-playerid="${esc(p.playerID)}" data-teamid="${esc(teamID)}">${esc(p.first)} ${esc(p.last)}</button></li>`
    ).join('');

    document.querySelectorAll('.player-button').forEach((btn) => {
      btn.addEventListener('click', () => {
        showPlayerCard(btn.dataset.playerid, year, btn.dataset.teamid);
      });
    });
  } catch (error) {
    console.error(error);
    playersList.innerHTML = '<li>Could not load players for this team.</li>';
  }
}

async function showPlayerCard(playerID, year, teamID) {
  openPlayerCard('<p class="card-loading">Loading player info...</p>');

  try {
    const [detailsRes, statsRes] = await Promise.all([
      fetch(`/player-details?playerID=${encodeURIComponent(playerID)}`),
      fetch(`/player-stats?playerID=${encodeURIComponent(playerID)}&year=${year}&teamID=${encodeURIComponent(teamID)}`)
    ]);

    if (!detailsRes.ok) throw new Error(`Details: ${detailsRes.status}`);
    if (!statsRes.ok) throw new Error(`Stats: ${statsRes.status}`);

    const info = await detailsRes.json();
    const { stats, other_teams } = await statsRes.json();

    if (info.error) throw new Error(info.error);

    const birthParts = [info.birthCity, info.birthState, info.birthCountry].filter(Boolean);
    const birthDateParts = [info.birthYear, info.birthMonth, info.birthDay].filter((v) => v != null);

    let html = `
      <button class="card-close" onclick="closePlayerCard()">&times;</button>
      <div class="card-header">
        <h2>${esc(info.first)} ${esc(info.last)}</h2>
        <span class="card-id">${esc(info.playerID)}</span>
      </div>
      <div class="card-section">
        <h3>Bio</h3>
        <table class="card-table">
          <tr><td>Given Name</td><td>${esc(info.given) || '—'}</td></tr>
          <tr><td>Born</td><td>${birthDateParts.join('-') || '—'}</td></tr>
          <tr><td>Birthplace</td><td>${birthParts.join(', ') || '—'}</td></tr>
          <tr><td>Height</td><td>${fmtHeight(info.height)}</td></tr>
          <tr><td>Weight</td><td>${info.weight ? info.weight + ' lbs' : '—'}</td></tr>
          <tr><td>Bats / Throws</td><td>${esc(info.bats) || '—'} / ${esc(info.throws) || '—'}</td></tr>
          <tr><td>Debut</td><td>${esc(info.debut) || '—'}</td></tr>
          <tr><td>Final Game</td><td>${esc(info.finalGame) || '—'}</td></tr>
        </table>
      </div>
      <div class="card-section">
        <h3>${year} Batting Stats</h3>
        <table class="card-table stats-table">
          <thead><tr><th>G</th><th>AB</th><th>R</th><th>H</th><th>2B</th><th>3B</th><th>HR</th><th>RBI</th><th>SB</th><th>CS</th></tr></thead>
          <tbody><tr>
            <td>${stats.G}</td><td>${stats.AB}</td><td>${stats.R}</td><td>${stats.H}</td>
            <td>${stats['2B']}</td><td>${stats['3B']}</td><td>${stats.HR}</td><td>${stats.RBI}</td>
            <td>${stats.SB}</td><td>${stats.CS}</td>
          </tr></tbody>
        </table>
      </div>`;

    if (other_teams && other_teams.length > 0) {
      html += `<div class="card-section"><h3>Also played for (${year})</h3><p>${other_teams.map(esc).join(', ')}</p></div>`;
    }

    openPlayerCard(html);
  } catch (error) {
    console.error(error);
    openPlayerCard(`<button class="card-close" onclick="closePlayerCard()">&times;</button><p>Could not load details for <strong>${esc(playerID)}</strong>.</p><p class="card-error">${esc(error.message)}</p>`);
  }
}

window.addEventListener('DOMContentLoaded', loadYears);
