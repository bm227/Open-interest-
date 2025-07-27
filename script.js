/*
 * Open Interest Tracker
 *
 * This script fetches options open‑interest data for a handful of tickers and
 * stores daily history in the browser’s localStorage.  When run, it
 * aggregates open interest across all strikes and expiration dates.  It then
 * displays the current value alongside the change from the previous day.
 */

// Symbols to track.  '^SPX' is the Yahoo Finance ticker for the S&P 500 index.
const symbols = ["QQQ", "SPY", "^SPX"];

// Retrieve historical open‑interest data from localStorage.  The object
// returned has keys for each symbol and values that are arrays of records
// sorted chronologically: {date: 'YYYY-MM-DD', openInterest: Number}.
function loadHistory() {
  const json = localStorage.getItem("openInterestHistory");
  if (!json) {
    const obj = {};
    symbols.forEach((sym) => {
      obj[sym] = [];
    });
    return obj;
  }
  try {
    const parsed = JSON.parse(json);
    // Ensure each symbol exists
    symbols.forEach((sym) => {
      if (!parsed[sym]) parsed[sym] = [];
    });
    return parsed;
  } catch (e) {
    console.error("Failed to parse history from localStorage", e);
    const obj = {};
    symbols.forEach((sym) => {
      obj[sym] = [];
    });
    return obj;
  }
}

// Save the history back to localStorage.
function saveHistory(history) {
  localStorage.setItem("openInterestHistory", JSON.stringify(history));
}

// Fetch open‑interest data for a symbol.  This function aggregates open
// interest across all call and put options returned by Yahoo Finance’s
// options API.  On success, returns a number.  On failure, returns null.
async function fetchOpenInterest(symbol) {
  const url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch ${symbol}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    const result = data.optionChain.result;
    if (!result || result.length === 0) {
      console.error(`No option data for ${symbol}`);
      return null;
    }
    let totalOpenInterest = 0;
    for (const optionDate of result[0].options) {
      for (const call of optionDate.calls) {
        if (call.openInterest != null) {
          totalOpenInterest += call.openInterest;
        }
      }
      for (const put of optionDate.puts) {
        if (put.openInterest != null) {
          totalOpenInterest += put.openInterest;
        }
      }
    }
    return totalOpenInterest;
  } catch (error) {
    console.error(`Error fetching data for ${symbol}`, error);
    return null;
  }
}

// Format a number with commas for readability.
function formatNumber(num) {
  return new Intl.NumberFormat("en-US").format(num);
}

// Update the HTML table based on the current history object.
function updateTable() {
  const history = loadHistory();
  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";
  symbols.forEach((sym) => {
    const records = history[sym];
    // Determine the latest record and previous record
    const latest = records.length > 0 ? records[records.length - 1] : null;
    const prev = records.length > 1 ? records[records.length - 2] : null;
    const row = document.createElement("tr");
    const symCell = document.createElement("td");
    symCell.textContent = sym.replace("^", "");
    row.appendChild(symCell);
    const dateCell = document.createElement("td");
    dateCell.textContent = latest ? latest.date : "—";
    row.appendChild(dateCell);
    const oiCell = document.createElement("td");
    oiCell.textContent = latest ? formatNumber(latest.openInterest) : "—";
    row.appendChild(oiCell);
    const changeCell = document.createElement("td");
    if (latest && prev) {
      const diff = latest.openInterest - prev.openInterest;
      const percentage = ((diff / prev.openInterest) * 100).toFixed(2);
      changeCell.textContent = `${diff > 0 ? "+" : ""}${formatNumber(diff)} (${diff > 0 ? "+" : ""}${percentage}% )`;
      changeCell.className = diff > 0 ? "positive" : diff < 0 ? "negative" : "";
    } else {
      changeCell.textContent = "—";
    }
    row.appendChild(changeCell);
    tbody.appendChild(row);
  });
}

// Fetch new data for all symbols and update history + table.
async function updateData() {
  const history = loadHistory();
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const updates = [];
  for (const sym of symbols) {
    const oi = await fetchOpenInterest(sym);
    if (oi != null) {
      if (!history[sym]) history[sym] = [];
      // Avoid duplicate entry if already recorded for today
      const last = history[sym].length > 0 ? history[sym][history[sym].length - 1] : null;
      if (!last || last.date !== dateStr) {
        history[sym].push({ date: dateStr, openInterest: oi });
      } else {
        // Overwrite existing record for today
        last.openInterest = oi;
      }
      updates.push({ sym, oi });
    }
  }
  saveHistory(history);
  updateTable();
  if (updates.length > 0) {
    console.log("Updated", updates);
  }
}

// Attach event listener to the button
document.getElementById("update-button").addEventListener("click", () => {
  updateData();
});

// On initial load, populate the table with existing history
updateTable();