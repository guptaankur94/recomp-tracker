/* Small shared helpers: safe JSON, text escaping, number and date formatting. */

/* Helpers */
function readJSON(key, fallback) {
  try {
    const val = JSON.parse(localStorage.getItem(key));
    return val ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtNum(n) {
  return (Math.round(n * 10) / 10).toLocaleString('en-US');
}

// Local calendar date (YYYY-MM-DD). toISOString() is UTC and shifts early-morning workouts to the previous day.
function localDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Session ids are creation timestamps, so the local date is derived from them (this also corrects older UTC-dated logs).
function sessionDateStr(session) {
  return typeof session.id === 'number' ? localDateStr(new Date(session.id)) : session.dateStr;
}

function shortDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function removeKeysMatching(regex) {
  Object.keys(localStorage).filter(k => regex.test(k)).forEach(k => localStorage.removeItem(k));
}
