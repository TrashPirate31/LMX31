/// <reference path="./sdk/kino.d.ts" />
// LigaMX31 v1.5.0
// Schedule: webws.365scores.com (Liga MX, competition 141)
// Streams: canales.m3u del repo (m3u8 directos, sin browser)
// Mapeo: canal por equipo local según derechos Apertura 2026

const SCORES_API = "https://webws.365scores.com/web/games/?appTypeId=5&langId=31&sports=1&competitions=141";
const MY_M3U     = "https://raw.githubusercontent.com/TrashPirate31/LMX31/refs/heads/main/canales.m3u";
const UA         = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";

const M3U_KEY = "ligamx-canales-v105";
const M3U_TTL = 2 * 60 * 60 * 1000; // 2 horas

// ── Mapeo equipo local → canales en orden de prioridad ──────────────────────
var TEAM_CHANNELS = {
  "atlante":           ["Azteca 7", "TUDN USA", "Univision TDN"],
  "fc juarez":         ["Azteca 7", "Estrella TV"],
  "juarez":            ["Azteca 7", "Estrella TV"],
  "necaxa":            ["Azteca 7", "TUDN USA", "Univision TDN"],
  "puebla":            ["Azteca 7", "TUDN USA", "Univision TDN"],
  "tigres":            ["Azteca 7", "Estrella TV"],
  "tigres uanl":       ["Azteca 7", "Estrella TV"],
  "toluca":            ["Azteca 7", "TUDN", "TUDN USA", "Univision TDN"],
  "america":           ["TUDN", "TUDN USA", "Univision TDN"],
  "club america":      ["TUDN", "TUDN USA", "Univision TDN"],
  "atlas":             ["TUDN", "TUDN USA", "Univision TDN"],
  "atletico san luis": ["Telemundo"],
  "atletico de san luis": ["Telemundo"],
  "san luis":          ["Telemundo"],
  "cruz azul":         ["TUDN", "TUDN USA", "Univision TDN"],
  "guadalajara":       ["Telemundo"],
  "chivas":            ["Telemundo"],
  "deportivo guadalajara": ["Telemundo"],
  "leon":              ["TUDN USA", "Univision TDN"],
  "monterrey":         ["TUDN", "TUDN USA", "Univision TDN"],
  "cf monterrey":      ["TUDN", "TUDN USA", "Univision TDN"],
  "rayados":           ["TUDN", "TUDN USA", "Univision TDN"],
  "pachuca":           ["TUDN USA", "Univision TDN"],
  "queretaro":         ["TUDN USA", "Univision TDN"],
  "santos laguna":     ["TUDN", "TUDN USA", "Univision TDN"],
  "santos":            ["TUDN", "TUDN USA", "Univision TDN"],
  "tijuana":           ["TUDN USA", "Univision TDN"],
  "xolos":             ["TUDN USA", "Univision TDN"],
  "pumas":             ["TUDN", "TUDN USA", "Univision TDN"],
  "pumas unam":        ["TUDN", "TUDN USA", "Univision TDN"],
  "mazatlan":          ["Azteca 7", "TUDN USA"],
  "mazatlan fc":       ["Azteca 7", "TUDN USA"]
};

var DEFAULT_CHANNELS = ["TUDN USA", "Univision TDN", "Azteca 7"];

function getChannelsForTeam(teamName) {
  if (!teamName) return DEFAULT_CHANNELS;
  var key = teamName.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
  return TEAM_CHANNELS[key] || DEFAULT_CHANNELS;
}

function isLigaMXTeam(teamName) {
  if (!teamName) return false;
  var key = teamName.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
  return !!TEAM_CHANNELS[key];
}

// ── Utilidades de Fecha y Hora Robustas ──────────────────────────────────────

function parseTime(startTime) {
  if (!startTime) return 0;
  if (typeof startTime === "number") {
    return startTime > 9999999999 ? startTime : startTime * 1000;
  }
  var s = String(startTime).trim();
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    s = s.replace(" ", "T");
    if (s.indexOf("Z") < 0 && s.indexOf("+") < 0 && s.lastIndexOf("-") <= 10) {
      s += "Z";
    }
  }
  var t = Date.parse(s);
  if (isNaN(t)) {
    t = Date.parse(startTime);
  }
  return isNaN(t) ? 0 : t;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._~-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "item";
}

function toMXTime(startTime) {
  var ms = parseTime(startTime);
  if (!ms) return "";
  var d = new Date(ms - 6 * 60 * 60 * 1000); // UTC-6 México Central
  var h = d.getUTCHours();
  var m = d.getUTCMinutes();
  var ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + ":" + (m < 10 ? "0" : "") + m + " " + ampm + " MX";
}

function isToday(startTime) {
  var ms = parseTime(startTime);
  if (!ms) return false;
  var gameDate = new Date(ms - 6 * 60 * 60 * 1000);
  var now = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return gameDate.getUTCFullYear() === now.getUTCFullYear() &&
         gameDate.getUTCMonth() === now.getUTCMonth() &&
         gameDate.getUTCDate() === now.getUTCDate();
}

// ── Parsear M3U ───────────────────────────────────────────────────────────────

function parseM3U(text) {
  var lines = String(text || "").split("\n");
  var out = [];
  var meta = null;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf("#EXTINF:") === 0) {
      var nameM = line.match(/tvg-name="([^"]+)"/);
      var comma = line.lastIndexOf(",");
      meta = { name: (nameM && nameM[1]) || (comma >= 0 ? line.slice(comma + 1).trim() : "") };
    } else if (line.indexOf("http") === 0 && meta) {
      if (meta.name) out.push({ name: meta.name, url: line });
      meta = null;
    } else if (line.indexOf("#") !== 0) {
      meta = null;
    }
  }
  return out;
}

// ── Índice de canales ─────────────────────────────────────────────────────────

var _index = null;

async function getIndex() {
  await null;
  if (_index) return _index;

  var cached = kino.storage.get(M3U_KEY);
  if (cached) {
    try { _index = new Map(JSON.parse(cached)); return _index; } catch (e) { /* re-fetch */ }
  }

  var text = "";
  try {
    var r = await kino.fetch(MY_M3U, { headers: { "User-Agent": UA } });
    if (r.ok) text = r.text();
  } catch (e) { /* seguir con índice vacío */ }

  var channels = parseM3U(text);
  _index = new Map();
  for (var i = 0; i < channels.length; i++) {
    _index.set(channels[i].name, channels[i].url);
  }
  kino.log("Canales cargados:", _index.size);

  try {
    var ser = JSON.stringify([..._index]);
    if (ser.length < 250000) kino.storage.set(M3U_KEY, ser, { ttlMs: M3U_TTL });
  } catch (e) { /* ignorar */ }

  return _index;
}

// ── Fetch del schedule de Liga MX ─────────────────────────────────────────────

async function fetchMatches() {
  await null;
  var r;
  try {
    r = await kino.fetch(SCORES_API, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json",
        "Origin": "https://www.365scores.com",
        "Referer": "https://www.365scores.com/",
      }
    });
  } catch (e) {
    throw kino.error("unavailable", "Sin conexión con 365scores");
  }
  if (!r.ok) throw kino.error("unavailable", "365scores respondió " + r.status);
  var data = r.json();
  return data.games || [];
}

// ── liveCategories ────────────────────────────────────────────────────────────

export async function liveCategories() {
  await null;
  return [
    { id: "en-vivo",  title: "🔴 En Vivo" },
    { id: "proximos", title: "⏳ Próximos" },
    { id: "todos",    title: "📅 Todos Hoy" },
  ];
}

// ── liveChannels ──────────────────────────────────────────────────────────────

export async function liveChannels({ categoryId, cursor }) {
  await null;

  var [index, games] = await Promise.all([getIndex(), fetchMatches()]);

  var items = [];
  var seenIds = new Set();

  for (var i = 0; i < games.length; i++) {
    var g = games[i];

    var home = g.homeCompetitor && g.homeCompetitor.name;
    var away = g.awayCompetitor && g.awayCompetitor.name;
    if (!home || !away) continue;

    if (!isLigaMXTeam(home) && !isLigaMXTeam(away)) continue;
    if (!isToday(g.startTime)) continue;

    var statusNum = g.statusGroup; // 3 = finalizado
    if (statusNum === 3) continue;

    var isLive = (statusNum === 2);
    var isUpcoming = !isLive;

    if (categoryId === "en-vivo" && !isLive) continue;
    if (categoryId === "proximos" && !isUpcoming) continue;

    var matchTitle = home + " vs " + away;
    var baseId = "lmx-" + slugify(home + "-" + away + "-" + (g.id || i));

    var timeStr = toMXTime(g.startTime);

    var scoreBadge = "";
    if (isLive && g.homeCompetitor && g.awayCompetitor) {
      var hs = g.homeCompetitor.score;
      var as2 = g.awayCompetitor.score;
      if (hs !== undefined && as2 !== undefined) {
        scoreBadge = hs + " - " + as2;
      }
    }

    var channels = getChannelsForTeam(home);

    for (var j = 0; j < channels.length; j++) {
      var chName = channels[j];
      var chUrl = index.get(chName);
      if (!chUrl) continue;

      var id = baseId + "-" + slugify(chName);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      var prefix = isLive ? "🔴 " : "⏳ ";
      var title = prefix + matchTitle + " · " + chName;

      var badges = [];
      if (scoreBadge) badges.push(scoreBadge);
      else if (timeStr) badges.push(timeStr);
      if (g.competition && g.competition.name) badges.push(g.competition.name.slice(0, 20));

      items.push({
        id: id,
        title: title.slice(0, 200),
        categoryId: categoryId,
        ref: "live|" + id + "|" + encodeURIComponent(chUrl),
        badges: badges,
      });
    }
  }

  if (!items.length) {
    var msg = categoryId === "en-vivo"
      ? "No hay partidos de Liga MX en vivo ahora"
      : categoryId === "proximos"
      ? "No hay próximos partidos programados hoy"
      : "No hay partidos de Liga MX hoy";
    return {
      items: [{
        id: "sin-partidos-" + categoryId,
        title: msg,
        categoryId: categoryId,
        ref: "live|vacio|sin-stream",
      }]
    };
  }

  return { items: items };
}

// ── search ────────────────────────────────────────────────────────────────────

export async function search(query) {
  await null;
  var q = String((query && query.q) || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!q) return [];

  var [index, games] = await Promise.all([getIndex(), fetchMatches()]);
  var items = [];
  var seenIds = new Set();

  for (var i = 0; i < games.length; i++) {
    var g = games[i];
    var home = g.homeCompetitor && g.homeCompetitor.name;
    var away = g.awayCompetitor && g.awayCompetitor.name;
    if (!home || !away) continue;

    if (!isLigaMXTeam(home) && !isLigaMXTeam(away)) continue;
    if (!isToday(g.startTime)) continue;
    if (g.statusGroup === 3) continue;

    var title = home + " vs " + away;
    var normTitle = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normTitle.indexOf(q) < 0) continue;

    var channels = getChannelsForTeam(home);
    var baseId = "lmx-" + slugify(home + "-" + away + "-" + (g.id || i));

    for (var j = 0; j < channels.length; j++) {
      var chName = channels[j];
      var chUrl = index.get(chName);
      if (!chUrl) continue;
      var id = baseId + "-" + slugify(chName);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      var isLive = (g.statusGroup === 2);
      var prefix = isLive ? "🔴 " : "⏳ ";
      items.push({
        id: id,
        title: prefix + title + " · " + chName,
        kind: "live",
        ref: "live|" + id + "|" + encodeURIComponent(chUrl),
        badges: ["Liga MX"],
      });
    }
  }

  return items.slice(0, 50);
}

// ── resolve ───────────────────────────────────────────────────────────────────

export async function resolve(ref) {
  await null;
  var parts = String(ref).split("|");
  if (parts.length < 3 || parts[0] !== "live") {
    throw kino.error("not_found", "ref desconocida");
  }

  var type = parts[2];

  if (type === "vacio" || type === "sin-stream") {
    throw kino.error("unavailable", "No hay stream disponible");
  }

  var url = decodeURIComponent(type);
  if (!url || url.indexOf("http") !== 0) {
    throw kino.error("not_found", "URL de stream inválida");
  }

  return {
    url: url,
    mime: "application/vnd.apple.mpegurl",
  };
      }
                                                           
