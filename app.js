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

/** Optional per-game in data.json: "youtubeId" (from youtube.com/watch?v=… or youtu.be/…).
 *  NBA highlight titles often look like:
 *  #3 NUGGETS at #6 TIMBERWOLVES | FULL GAME 3 HIGHLIGHTS | April 23, 2026
 */
function sanitizeYoutubeId(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  const m = s.match(/^[a-zA-Z0-9_-]{6,32}$/);
  return m ? m[0] : "";
}

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

const PLAYOFFS_YEAR = 2026;
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (d) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
const longDate  = (d) => d.toLocaleDateString(undefined, {
  weekday: "long", month: "long", day: "numeric", year: "numeric",
});

/** Parse "Apr 19" into a Date (playoff season year from PLAYOFFS_YEAR). */
function parseGameDateString(dateStr) {
  const m = String(dateStr).match(/^([A-Za-z]{3}) (\d{1,2})$/);
  if (!m) return null;
  const monthIdx = MONTHS_SHORT.indexOf(m[1]);
  if (monthIdx < 0) return null;
  return new Date(PLAYOFFS_YEAR, monthIdx, Number(m[2]));
}

/** Newest calendar date among games with a final score (diff is set). */
function getLatestResultDate(data) {
  let max = null;
  for (const team of [...data.east, ...data.west]) {
    for (const g of team.games) {
      if (g.diff == null) continue;
      const d = parseGameDateString(g.date);
      if (d && (!max || d > max)) max = d;
    }
  }
  return max;
}

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
  const yt = sanitizeYoutubeId(game.youtubeId);
  return `
    <div class="bar-slot has-game"
      data-game="${gameIndex + 1}"
      data-round="${esc(roundLabel)}"
      data-score="${esc(game.score)}"
      data-diff="${sign}${game.diff}"
      data-date="${esc(game.date)}"
      data-result="${isWin ? "W" : "L"}"
      ${yt ? `data-youtube-id="${esc(yt)}"` : ""}>
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
      return renderSlot(team.games[idx], idx, round.label, finished);
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

function renderDayGamesSection(data, dayDate, title, labelCls) {
  const dateKey = shortDate(dayDate);
  const dateLong = longDate(dayDate);
  const games = getTodayGames(data, dateKey);

  const body = games.length === 0
    ? `<div class="today-empty">No games scheduled</div>`
    : `<div class="today-games count-${games.length}">${games.map(renderTodayGame).join("")}</div>`;

  return `
    <div class="today-section">
      <div class="conf-label ${labelCls}">
        ${esc(title)}
        <span class="round-tag">${esc(dateLong)}</span>
      </div>
      ${body}
    </div>`;
}

function renderConference({ teams, label, cls, round }) {
  const maxGames = Math.max(...teams.map((t) => t.games.length));
  return `
    <div class="conf-section">
      <div class="conf-label ${cls}">
        ${esc(label)} Conference
        <span class="round-tag">${esc(round)}</span>
      </div>
      ${renderXAxis(maxGames)}
      ${teams.map(renderTeamRow).join("")}
    </div>`;
}

// ─────────────────────────────────────────────
//  TOOLTIP (event delegation, no inline handlers, no innerHTML)
// ─────────────────────────────────────────────
const tooltip = document.getElementById("tooltip");

let hideTooltipTimer = null;

function clearHideTooltipTimer() {
  if (hideTooltipTimer != null) {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = null;
  }
}

function moveTip(e) {
  const p = e.touches?.[0] ?? e;
  tooltip.style.left = `${p.clientX + 14}px`;
  tooltip.style.top  = `${p.clientY - 10}px`;
}

/** Pin the card next to the bar so it does not follow the cursor (avoids “chasing” the popup). */
function anchorTooltipToSlot(slot) {
  const place = () => {
    const rect = slot.getBoundingClientRect();
    const gap = 10;
    const margin = 12;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    let left = rect.right + gap;
    if (left + w + margin > window.innerWidth) {
      left = rect.left - gap - w;
    }
    if (left < margin) left = margin;
    let top = rect.top + (rect.height - h) / 2;
    if (top + h + margin > window.innerHeight) {
      top = window.innerHeight - h - margin;
    }
    if (top < margin) top = margin;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  };

  tooltip.style.display = "block";
  place();
  requestAnimationFrame(() => requestAnimationFrame(place));
}

function showTip(e, el) {
  const { result, round, game, date, score, diff, youtubeId } = el.dataset;
  const win = result === "W";
  const yt = sanitizeYoutubeId(youtubeId);

  clearHideTooltipTimer();
  tooltip.classList.toggle("tooltip--video", Boolean(yt));
  tooltip.replaceChildren();

  const head = document.createElement("div");
  head.className = "tooltip-head";

  const arrow = document.createElement("span");
  arrow.className = "tooltip-result";
  arrow.style.color = `var(--${win ? "win" : "loss"})`;
  arrow.textContent = win ? "▲ WIN" : "▼ LOSS";

  head.append(arrow, document.createTextNode(`  ${round} Game ${game} · ${date}`));

  const meta = document.createElement("div");
  meta.className = "tooltip-meta";
  meta.textContent = `Score: ${score}   Margin: ${diff}`;

  tooltip.append(head, meta);

  if (yt) {
    const wrap = document.createElement("div");
    wrap.className = "tooltip-video-wrap";

    const iframe = document.createElement("iframe");
    iframe.className = "tooltip-video";
    iframe.width = "320";
    iframe.height = "180";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.title = "NBA game highlights";
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(yt)}`;

    const ytLink = document.createElement("a");
    ytLink.className = "tooltip-yt-link";
    ytLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(yt)}`;
    ytLink.target = "_blank";
    ytLink.rel = "noopener noreferrer";
    ytLink.textContent = "Open on YouTube";

    wrap.append(iframe, ytLink);
    tooltip.append(wrap);
  }

  if (yt) {
    anchorTooltipToSlot(el);
  } else {
    tooltip.style.display = "block";
    moveTip(e);
  }
}

const hideTip = () => {
  clearHideTooltipTimer();
  const frame = tooltip.querySelector("iframe.tooltip-video");
  if (frame) {
    frame.src = "about:blank";
  }
  tooltip.style.display = "none";
  tooltip.classList.remove("tooltip--video");
};

document.addEventListener("mousemove", (e) => {
  if (tooltip.style.display === "none") return;
  if (tooltip.classList.contains("tooltip--video")) return;
  moveTip(e);
});
document.addEventListener("mouseover", (e) => {
  const slot = e.target.closest(".bar-slot.has-game");
  if (slot) showTip(e, slot);
});
document.addEventListener("mouseout", (e) => {
  const slot = e.target.closest(".bar-slot.has-game");
  if (!slot) return;
  const rt = e.relatedTarget;
  if (rt && (slot.contains(rt) || (rt instanceof Node && tooltip.contains(rt)))) return;

  if (tooltip.classList.contains("tooltip--video")) {
    clearHideTooltipTimer();
    hideTooltipTimer = setTimeout(() => {
      hideTooltipTimer = null;
      if (!tooltip.matches(":hover")) hideTip();
    }, 280);
    return;
  }
  hideTip();
});

tooltip.addEventListener("mouseenter", clearHideTooltipTimer);
tooltip.addEventListener("mouseleave", () => hideTip());
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

    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    content.innerHTML =
      renderDayGamesSection(data, yesterday, "Yesterday", "yesterday") +
      renderDayGamesSection(data, now, "Today", "today") +
      renderConference({ teams: data.east, label: "Eastern", cls: "east", round: data.round }) +
      renderConference({ teams: data.west, label: "Western", cls: "west", round: data.round });

    const latest = getLatestResultDate(data);
    const lastUpdatedEl = document.getElementById("last-updated");
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = latest
        ? `Last updated — ${longDate(latest)}`
        : "";
    }

    document.getElementById("footer").textContent =
      "Hover a bar for details; highlight cards sit beside the bar so you can click play. “Video unavailable” is often an IDE preview blocking embeds, a bad id, or embed disabled — try a normal browser or Open on YouTube.";
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
