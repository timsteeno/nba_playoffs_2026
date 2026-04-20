// ─────────────────────────────────────────────
//  LOGO MAP  (ESPN CDN — works on open web)
// ─────────────────────────────────────────────
const LOGOS = {
  DET: "https://a.espncdn.com/i/teamlogos/nba/500/det.png",
  BOS: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png",
  NYK: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png",
  CLE: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png",
  TOR: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png",
  ATL: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png",
  PHI: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png",
  ORL: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png",
  OKC: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png",
  SAS: "https://a.espncdn.com/i/teamlogos/nba/500/sa.png",
  DEN: "https://a.espncdn.com/i/teamlogos/nba/500/den.png",
  LAL: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png",
  HOU: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png",
  MIN: "https://a.espncdn.com/i/teamlogos/nba/500/min.png",
  POR: "https://a.espncdn.com/i/teamlogos/nba/500/por.png",
  PHX: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png",
};

// Round labels shown as dividers on the x-axis
// Each entry: { label, gamesPerRound }
// gamesPerRound = max games in that round (7 for a full series)
const ROUNDS = [
  { label: "R1", games: 7 },
  { label: "R2", games: 7 },
  { label: "CF", games: 7 },
  { label: "Finals", games: 7 },
];

const MAX_DIFF = 40;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function getSeriesStatus(games) {
  const wins = games.filter(g => g.diff > 0).length;
  const losses = games.filter(g => g.diff < 0).length;
  if (wins === 4) return { label: `WON 4-${losses}`, cls: "leading" };
  if (losses === 4) return { label: `LOST ${wins}-4`, cls: "trailing" };
  if (wins > losses) return { label: `${wins}-${losses}`, cls: "leading" };
  if (losses > wins) return { label: `${wins}-${losses}`, cls: "trailing" };
  if (wins === 0 && losses === 0) return { label: "0-0", cls: "tied" };
  return { label: `${wins}-${losses}`, cls: "tied" };
}

function isEliminated(games) {
  return games.filter(g => g.diff < 0).length === 4;
}

function isSeriesWon(games) {
  return games.filter(g => g.diff > 0).length === 4;
}

// Work out how many games have been played in each round
// Round boundary: every 7 games
function gamesPlayedInRound(roundIndex, games) {
  const start = roundIndex * 7;
  return games.slice(start, start + 7);
}

function buildXAxis(totalGamesPlayed) {
  let html = '';
  let gameNum = 0;

  for (let r = 0; r < ROUNDS.length; r++) {
    const roundStart = r * 7;
    // Only show rounds that have started or are the next upcoming
    if (roundStart > totalGamesPlayed + 1) break;

    if (r > 0) {
      html += `<div class="x-divider"></div>`;
    }
    html += `<span class="x-round-label">${ROUNDS[r].label}</span>`;

    for (let g = 0; g < ROUNDS[r].games; g++) {
      gameNum++;
      const played = gameNum <= totalGamesPlayed;
      html += `<div class="x-tick${played ? ' played' : ''}">G${g + 1}</div>`;
    }
  }
  return `<div class="x-axis">${html}</div>`;
}

function buildBarHTML(team) {
  const games = team.games;
  const totalPlayed = games.length;
  const elim = isEliminated(games);
  const won = isSeriesWon(games);
  let slots = '';

  for (let r = 0; r < ROUNDS.length; r++) {
    const roundStart = r * 7;
    if (roundStart > totalPlayed + 1) break;

    if (r > 0) {
      slots += `<div class="round-divider"></div>`;
    }

    for (let g = 0; g < ROUNDS[r].games; g++) {
      const idx = roundStart + g;
      const game = games[idx];

      if (!game) {
        // Don't show future slots if series is over
        if (elim || won) {
          slots += `<div class="bar-slot"></div>`;
        } else {
          slots += `<div class="bar-slot"><div class="upcoming-badge"></div></div>`;
        }
      } else {
        const pct = Math.min(Math.abs(game.diff) / MAX_DIFF, 1);
        const px = Math.max(pct * 34, 4);
        const cls = game.diff > 0 ? 'win' : 'loss';
        const sign = game.diff > 0 ? '+' : '';
        const labelStyle = game.diff > 0
          ? `bottom: calc(50% + ${px + 2}px)`
          : `top: calc(50% + ${px + 2}px)`;

        slots += `
          <div class="bar-slot has-game"
            data-game="${g + 1}"
            data-round="${ROUNDS[r].label}"
            data-score="${game.score}"
            data-diff="${sign}${game.diff}"
            data-date="${game.date}"
            data-result="${game.diff > 0 ? 'W' : 'L'}"
            onmouseenter="showTip(event,this)"
            onmouseleave="hideTip()"
            ontouchstart="showTip(event,this)">
            <div class="bar ${cls}" style="height:${px}px"></div>
            <span class="bar-label" style="${labelStyle}">${sign}${game.diff}</span>
          </div>`;
      }
    }
  }
  return slots;
}

function buildTeamRow(team) {
  const status = getSeriesStatus(team.games);
  const elim = isEliminated(team.games);
  const logo = LOGOS[team.abbr] || '';
  return `
    <div class="team-row${elim ? ' eliminated' : ''}">
      <div class="team-name-block">
        ${logo ? `<img class="team-logo" src="${logo}" alt="${team.abbr}" onerror="this.style.display='none'">` : ''}
        <div class="team-text">
          <div class="seed">#${team.seed} vs #${team.oppSeed} ${team.opponent}</div>
          <div class="team-abbr">${team.abbr}</div>
          <div class="series-status ${status.cls}">${status.label}</div>
        </div>
      </div>
      <div class="chart-area">${buildBarHTML(team)}</div>
    </div>`;
}

function buildConference(teams, label, cls, round, lastUpdated) {
  const maxGames = Math.max(...teams.map(t => t.games.length));
  return `
    <div class="conf-section">
      <div class="conf-label ${cls}">
        ${label} Conference
        <span class="round-tag">${round} · updated ${lastUpdated}</span>
      </div>
      ${buildXAxis(maxGames)}
      ${teams.map(buildTeamRow).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
//  TOOLTIP
// ─────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');
function showTip(e, el) {
  const result = el.dataset.result;
  tooltip.innerHTML = `
    <span style="color:${result === 'W' ? 'var(--win)' : 'var(--loss)'}">${result === 'W' ? '▲ WIN' : '▼ LOSS'}</span>  ${el.dataset.round} Game ${el.dataset.game} · ${el.dataset.date}<br>
    Score: ${el.dataset.score} &nbsp; Margin: ${el.dataset.diff}
  `;
  tooltip.style.display = 'block';
  moveTip(e);
}
function moveTip(e) {
  const x = (e.touches ? e.touches[0].clientX : e.clientX) + 14;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - 10;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function hideTip() { tooltip.style.display = 'none'; }
document.addEventListener('mousemove', moveTip);

// ─────────────────────────────────────────────
//  LOAD DATA & RENDER
// ─────────────────────────────────────────────
async function init() {
  const content = document.getElementById('content');
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    content.innerHTML =
      buildConference(data.east, 'Eastern', 'east', data.round, data.lastUpdated) +
      buildConference(data.west, 'Western', 'west', data.round, data.lastUpdated);

    document.getElementById('footer').textContent =
      `Data: data.json · Last updated ${data.lastUpdated} · Hover bars for game details`;

  } catch (err) {
    content.innerHTML = `<div class="error">Failed to load data.json — ${err.message}<br><br>Make sure data.json is in the same directory as index.html.</div>`;
  }
}

init();
