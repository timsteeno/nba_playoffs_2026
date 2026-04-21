// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
const LOGO_BASE = "https://a.espncdn.com/i/teamlogos/nba/500";
const LOGO_SLUG = {
  DET: "det", BOS: "bos", NYK: "ny",  CLE: "cle", TOR: "tor",
  ATL: "atl", PHI: "phi", ORL: "orl", OKC: "okc", SAS: "sa",
  DEN: "den", LAL: "lal", HOU: "hou", MIN: "min", POR: "por", PHX: "phx",
};
const logoFor = (abbr) => LOGO_SLUG[abbr] ? `${LOGO_BASE}/${LOGO_SLUG[abbr]}.png` : "";

const ROUNDS = [
  { label: "R1",     games: 7 },
  { label: "R2",     games: 7 },
  { label: "CF",     games: 7 },
  { label: "Finals", games: 7 },
];
const GAMES_PER_ROUND = 7;
const MAX_DIFF = 40;
const MAX_BAR_PX = 34;
const MIN_BAR_PX = 4;

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const countWins   = (games) => games.filter((g) => g.diff > 0).length;
const countLosses = (games) => games.filter((g) => g.diff < 0).length;
const isSeriesWon  = (games) => countWins(games)   === 4;
const isEliminated = (games) => countLosses(games) === 4;

function seriesStatus(games) {
  const w = countWins(games);
  const l = countLosses(games);
  if (w === 4) return { label: `WON 4-${l}`,  cls: "leading"  };
  if (l === 4) return { label: `LOST ${w}-4`, cls: "trailing" };
  const cls = w > l ? "leading" : l > w ? "trailing" : "tied";
  return { label: `${w}-${l}`, cls };
}

// Show rounds that have started, plus the next one once the prior is wrapping up.
const visibleRounds = (totalPlayed) =>
  ROUNDS.filter((_, r) => r * GAMES_PER_ROUND <= totalPlayed + 1);

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
const longDate  = (d) => d.toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric",
});

// Collect today's games across both conferences, deduped by matchup.
function getTodayGames(data, todayKey) {
  const seen = new Set();
  const games = [];
  for (const team of [...data.east, ...data.west]) {
    for (const g of team.games) {
      if (g.date !== todayKey) continue;
      const pairKey = [team.abbr, team.opponent].sort().join("-");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const homeAbbr = g.home ? team.abbr    : team.opponent;
      const awayAbbr = g.home ? team.opponent : team.abbr;

      let homeScore = null, awayScore = null, homeWon = null;
      if (g.score && g.diff !== null) {
        const [teamScore, oppScore] = g.score.split("-").map(Number);
        homeScore = g.home ? teamScore : oppScore;
        awayScore = g.home ? oppScore  : teamScore;
        homeWon   = homeScore > awayScore;
      }
      games.push({ homeAbbr, awayAbbr, homeScore, awayScore, homeWon, played: g.diff !== null });
    }
  }
  return games;
}

// ─────────────────────────────────────────────
//  RENDERERS (return HTML strings; all dynamic values escaped)
// ─────────────────────────────────────────────
function renderXAxis(totalPlayed) {
  let gameNum = 0;
  const inner = visibleRounds(totalPlayed).map((round, r) => {
    const divider = r > 0 ? `<div class="x-divider"></div>` : "";
    const ticks = Array.from({ length: round.games }, (_, g) => {
      gameNum++;
      const played = gameNum <= totalPlayed ? " played" : "";
      return `<div class="x-tick${played}">G${g + 1}</div>`;
    }).join("");
    const group = `<div class="x-round">
      <div class="x-round-label">${esc(round.label)}</div>
      <div class="x-ticks">${ticks}</div>
    </div>`;
    return divider + group;
  }).join("");
  return `<div class="x-axis">${inner}</div>`;
}

function renderSlot(game, gameIndex, roundLabel, finished) {
  if (!game || game.diff === null) {
    return finished
      ? `<div class="bar-slot"></div>`
      : `<div class="bar-slot"><div class="upcoming-badge"></div></div>`;
  }
  const isWin = game.diff > 0;
  const px    = Math.max(Math.min(Math.abs(game.diff) / MAX_DIFF, 1) * MAX_BAR_PX, MIN_BAR_PX);
  const sign  = isWin ? "+" : "";
  const cls   = isWin ? "win" : "loss";
  const labelStyle = isWin
    ? `bottom: calc(50% + ${px + 2}px)`
    : `top: calc(50% + ${px + 2}px)`;
  return `
    <div class="bar-slot has-game"
      data-game="${gameIndex + 1}"
      data-round="${esc(roundLabel)}"
      data-score="${esc(game.score)}"
      data-diff="${sign}${game.diff}"
      data-date="${esc(game.date)}"
      data-result="${isWin ? "W" : "L"}">
      <div class="bar ${cls}" style="height:${px}px"></div>
      <span class="bar-label" style="${labelStyle}">${sign}${game.diff}</span>
    </div>`;
}

function renderBars(team) {
  const totalPlayed = team.games.length;
  const finished    = isSeriesWon(team.games) || isEliminated(team.games);
  return visibleRounds(totalPlayed).map((round, r) => {
    const divider = r > 0 ? `<div class="round-divider"></div>` : "";
    const slots = Array.from({ length: round.games }, (_, g) => {
      const idx = r * GAMES_PER_ROUND + g;
      return renderSlot(team.games[idx], g, round.label, finished);
    }).join("");
    return divider + slots;
  }).join("");
}

function renderTeamRow(team) {
  const status = seriesStatus(team.games);
  const elim   = isEliminated(team.games) ? " eliminated" : "";
  const logo   = logoFor(team.abbr);
  const img    = logo
    ? `<img class="team-logo" src="${esc(logo)}" alt="${esc(team.abbr)}" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  return `
    <div class="team-row${elim}">
      <div class="team-name-block">
        ${img}
        <div class="team-text">
          <div class="seed">#${team.seed} vs #${team.oppSeed} ${esc(team.opponent)}</div>
          <div class="team-abbr">${esc(team.abbr)}</div>
          <div class="series-status ${status.cls}">${esc(status.label)}</div>
        </div>
      </div>
      <div class="chart-area">${renderBars(team)}</div>
    </div>`;
}

function renderTodaySide(abbr, side, isWinner) {
  const logo = logoFor(abbr);
  const img = logo
    ? `<img class="team-logo" src="${esc(logo)}" alt="${esc(abbr)}" loading="lazy" referrerpolicy="no-referrer">`
    : "";
  const abbrEl = `<div class="today-abbr">${esc(abbr)}</div>`;
  const inner  = side === "away" ? `${img}${abbrEl}` : `${abbrEl}${img}`;
  return `<div class="today-side ${side}${isWinner ? " winner" : ""}">${inner}</div>`;
}

function renderTodayGame(g) {
  const mid = g.played
    ? `<div class="today-mid played">
         <span class="today-score${g.homeWon === false ? " winner" : ""}">${g.awayScore}</span>
         <span class="today-dash">—</span>
         <span class="today-score${g.homeWon === true  ? " winner" : ""}">${g.homeScore}</span>
         <div class="today-status">Final</div>
       </div>`
    : `<div class="today-mid">
         <span class="today-vs">@</span>
         <div class="today-status">Scheduled</div>
       </div>`;

  return `
    <div class="today-game">
      ${renderTodaySide(g.awayAbbr, "away", g.homeWon === false)}
      ${mid}
      ${renderTodaySide(g.homeAbbr, "home", g.homeWon === true)}
    </div>`;
}

function renderTodaySection(data, now) {
  const todayKey  = shortDate(now);
  const todayLong = longDate(now);
  const games     = getTodayGames(data, todayKey);

  const body = games.length === 0
    ? `<div class="today-empty">No games scheduled</div>`
    : `<div class="today-games count-${games.length}">${games.map(renderTodayGame).join("")}</div>`;

  return `
    <div class="today-section">
      <div class="conf-label today">
        Today
        <span class="round-tag">${esc(todayLong)}</span>
      </div>
      ${body}
    </div>`;
}

function renderConference({ teams, label, cls, round, lastUpdated }) {
  const maxGames = Math.max(...teams.map((t) => t.games.length));
  return `
    <div class="conf-section">
      <div class="conf-label ${cls}">
        ${esc(label)} Conference
        <span class="round-tag">${esc(round)} · updated ${esc(lastUpdated)}</span>
      </div>
      ${renderXAxis(maxGames)}
      ${teams.map(renderTeamRow).join("")}
    </div>`;
}

// ─────────────────────────────────────────────
//  TOOLTIP (event delegation, no inline handlers, no innerHTML)
// ─────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

function moveTip(e) {
  const p = e.touches?.[0] ?? e;
  tooltip.style.left = `${p.clientX + 14}px`;
  tooltip.style.top  = `${p.clientY - 10}px`;
}

function showTip(e, el) {
  const { result, round, game, date, score, diff } = el.dataset;
  const win = result === "W";

  const arrow = document.createElement("span");
  arrow.style.color = `var(--${win ? "win" : "loss"})`;
  arrow.textContent = win ? "▲ WIN" : "▼ LOSS";

  tooltip.replaceChildren(
    arrow,
    document.createTextNode(`  ${round} Game ${game} · ${date}`),
    document.createElement("br"),
    document.createTextNode(`Score: ${score}   Margin: ${diff}`),
  );
  tooltip.style.display = "block";
  moveTip(e);
}

const hideTip = () => { tooltip.style.display = "none"; };

document.addEventListener("mousemove", moveTip);
document.addEventListener("mouseover", (e) => {
  const slot = e.target.closest(".bar-slot.has-game");
  if (slot) showTip(e, slot);
});
document.addEventListener("mouseout", (e) => {
  const slot = e.target.closest(".bar-slot.has-game");
  if (slot && !slot.contains(e.relatedTarget)) hideTip();
});
document.addEventListener("touchstart", (e) => {
  const slot = e.target.closest(".bar-slot.has-game");
  if (slot) showTip(e, slot);
}, { passive: true });

// Hide broken team logos without inline onerror.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.classList.contains("team-logo")) {
    img.style.display = "none";
  }
}, true);

// ─────────────────────────────────────────────
//  LOAD DATA & RENDER
// ─────────────────────────────────────────────
async function init() {
  const content = document.getElementById("content");
  try {
    const res = await fetch("data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    content.innerHTML =
      renderTodaySection(data, new Date()) +
      renderConference({ teams: data.east, label: "Eastern", cls: "east", round: data.round, lastUpdated: data.lastUpdated }) +
      renderConference({ teams: data.west, label: "Western", cls: "west", round: data.round, lastUpdated: data.lastUpdated });

    document.getElementById("footer").textContent =
      `Data: data.json · Last updated ${data.lastUpdated} · Hover bars for game details`;
  } catch (err) {
    content.replaceChildren(
      Object.assign(document.createElement("div"), {
        className: "error",
        textContent: `Failed to load data.json — ${err.message}. Make sure data.json is in the same directory as index.html.`,
      }),
    );
  }
}

init();
