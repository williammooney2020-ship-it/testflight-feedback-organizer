// TestFlight Beta Feedback Organizer — browser-only, localStorage persistence.

const STORAGE_KEY = "tf_feedback_v1";
const CATEGORIES = ["Bug", "Crash", "Feature Request", "UX Issue", "Question", "Praise"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["New", "In Progress", "Needs Info", "Fixed", "Won't Fix"];

const CATEGORY_META = {
  Bug: { color: "#f87171", bg: "rgba(248,113,113,.1)" },
  Crash: { color: "#fb923c", bg: "rgba(251,146,60,.1)" },
  "Feature Request": { color: "#60a5fa", bg: "rgba(96,165,250,.1)" },
  "UX Issue": { color: "#a78bfa", bg: "rgba(167,139,250,.1)" },
  Question: { color: "#fbbf24", bg: "rgba(251,191,36,.1)" },
  Praise: { color: "#34d399", bg: "rgba(52,211,153,.1)" },
};

const PRIORITY_META = {
  Critical: { color: "#f87171", icon: "🔴" },
  High: { color: "#fb923c", icon: "🟠" },
  Medium: { color: "#fbbf24", icon: "🟡" },
  Low: { color: "#9aa3b5", icon: "⚪" },
};

const STATUS_META = {
  New: { color: "#5b8cff", bg: "rgba(91,140,255,.12)" },
  "In Progress": { color: "#fbbf24", bg: "rgba(251,191,36,.12)" },
  "Needs Info": { color: "#a78bfa", bg: "rgba(167,139,250,.12)" },
  Fixed: { color: "#34d399", bg: "rgba(52,211,153,.12)" },
  "Won't Fix": { color: "#9aa3b5", bg: "rgba(154,163,181,.1)" },
};

// ── State ──────────────────────────────────────────────────────────────
let items = [];
let filterCat = "";
let filterStatus = "";
let filterPriority = "";
let sortBy = "date"; // date | priority | category | status
let editingId = null;
let nextId = 1;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    items = raw.items || [];
    nextId = raw.nextId || items.length + 1;
  } catch {
    items = [];
    nextId = 1;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, nextId }));
}

// ── Filters/sort state ─────────────────────────────────────────────────
function applyFilters(list) {
  return list.filter(i =>
    (!filterCat || i.category === filterCat) &&
    (!filterStatus || i.status === filterStatus) &&
    (!filterPriority || i.priority === filterPriority)
  );
}

const PRIORITY_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const STATUS_ORDER = { New: 0, "In Progress": 1, "Needs Info": 2, Fixed: 3, "Won't Fix": 4 };

function sortItems(list) {
  return [...list].sort((a, b) => {
    if (sortBy === "priority") return (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
    if (sortBy === "status") return (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5);
    if (sortBy === "category") return a.category.localeCompare(b.category);
    return b.createdAt - a.createdAt; // date desc
  });
}

// ── Render ─────────────────────────────────────────────────────────────
function render() {
  renderStats();
  renderFilters();
  renderList();
}

function renderStats() {
  const total = items.length;
  const open = items.filter(i => i.status !== "Fixed" && i.status !== "Won't Fix").length;
  const fixed = items.filter(i => i.status === "Fixed").length;
  const bugs = items.filter(i => i.category === "Bug" || i.category === "Crash").length;
  const byPriority = {};
  PRIORITIES.forEach(p => { byPriority[p] = items.filter(i => i.priority === p).length; });

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statOpen").textContent = open;
  document.getElementById("statFixed").textContent = fixed;
  document.getElementById("statBugs").textContent = bugs;

  const catPills = CATEGORIES.map(c => {
    const count = items.filter(i => i.category === c).length;
    const m = CATEGORY_META[c];
    return `<span class="stat-pill" style="color:${m.color};background:${m.bg}">${c}: ${count}</span>`;
  }).join("");
  document.getElementById("catStats").innerHTML = catPills;
}

function renderFilters() {
  document.getElementById("filterCat").value = filterCat;
  document.getElementById("filterStatus").value = filterStatus;
  document.getElementById("filterPriority").value = filterPriority;
  document.getElementById("sortBy").value = sortBy;
}

function renderList() {
  const container = document.getElementById("feedbackList");
  const filtered = sortItems(applyFilters(items));
  const shown = document.getElementById("shownCount");
  shown.textContent = `${filtered.length} of ${items.length}`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">${items.length === 0 ? "No feedback yet — add your first item below or import from text." : "No items match the current filters."}</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const catM = CATEGORY_META[item.category] || { color: "#9aa3b5", bg: "rgba(154,163,181,.1)" };
    const priM = PRIORITY_META[item.priority] || { color: "#9aa3b5", icon: "⚪" };
    const statusM = STATUS_META[item.status] || { color: "#9aa3b5", bg: "rgba(154,163,181,.1)" };
    const date = new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const noteHtml = item.note ? `<div class="item-note">${esc(item.note)}</div>` : "";
    const testerHtml = item.tester ? `<span class="item-tester">👤 ${esc(item.tester)}</span>` : "";
    return `
      <div class="feedback-item" data-id="${item.id}">
        <div class="item-top">
          <div class="item-badges">
            <span class="badge-pill" style="color:${catM.color};background:${catM.bg}">${item.category}</span>
            <span class="badge-pill" style="color:${statusM.color};background:${statusM.bg}">${item.status}</span>
            <span class="prio-chip" style="color:${priM.color}">${priM.icon} ${item.priority}</span>
            ${testerHtml}
          </div>
          <div class="item-actions">
            <span class="item-date">${date}</span>
            <button class="icon-btn" onclick="editItem(${item.id})" title="Edit">✏️</button>
            <button class="icon-btn" onclick="deleteItem(${item.id})" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="item-text">${esc(item.text)}</div>
        ${noteHtml}
        <div class="quick-status">
          ${STATUSES.map(s => `<button class="qs-btn${item.status === s ? " active" : ""}" onclick="quickStatus(${item.id},'${s}')" style="${item.status === s ? `color:${(STATUS_META[s]||{}).color||"#fff"};border-color:${(STATUS_META[s]||{}).color||"#fff"}` : ""}">${s}</button>`).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Item management ────────────────────────────────────────────────────
function addItem(data) {
  const item = {
    id: nextId++,
    text: data.text,
    note: data.note || "",
    tester: data.tester || "",
    category: data.category || "Bug",
    priority: data.priority || "Medium",
    status: "New",
    createdAt: Date.now(),
  };
  items.unshift(item);
  save();
  return item;
}

function quickStatus(id, status) {
  const item = items.find(i => i.id === id);
  if (item) { item.status = status; save(); render(); }
}

function editItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById("formTitle").textContent = "Edit Feedback Item";
  document.getElementById("feedbackText").value = item.text;
  document.getElementById("feedbackNote").value = item.note || "";
  document.getElementById("feedbackTester").value = item.tester || "";
  document.getElementById("feedbackCategory").value = item.category;
  document.getElementById("feedbackPriority").value = item.priority;
  document.getElementById("feedbackStatus").value = item.status;
  document.getElementById("feedbackStatus").style.display = "block";
  document.getElementById("statusRow").style.display = "flex";
  document.getElementById("addForm").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("feedbackText").focus();
}

function deleteItem(id) {
  if (!confirm("Delete this feedback item?")) return;
  items = items.filter(i => i.id !== id);
  save(); render();
}

function submitForm(e) {
  e.preventDefault();
  const text = document.getElementById("feedbackText").value.trim();
  if (!text) return;
  const data = {
    text,
    note: document.getElementById("feedbackNote").value.trim(),
    tester: document.getElementById("feedbackTester").value.trim(),
    category: document.getElementById("feedbackCategory").value,
    priority: document.getElementById("feedbackPriority").value,
  };

  if (editingId !== null) {
    const item = items.find(i => i.id === editingId);
    if (item) {
      Object.assign(item, data);
      item.status = document.getElementById("feedbackStatus").value;
    }
    editingId = null;
    document.getElementById("formTitle").textContent = "Add Feedback";
    document.getElementById("statusRow").style.display = "none";
  } else {
    addItem(data);
  }

  e.target.reset();
  save();
  render();
}

function cancelEdit() {
  editingId = null;
  document.getElementById("formTitle").textContent = "Add Feedback";
  document.getElementById("statusRow").style.display = "none";
  document.getElementById("addForm").reset();
}

// ── Import ─────────────────────────────────────────────────────────────
function showImport() {
  document.getElementById("importModal").style.display = "flex";
}

function hideImport() {
  document.getElementById("importModal").style.display = "none";
}

function doImport() {
  const text = document.getElementById("importText").value.trim();
  if (!text) return;
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line => {
    if (line.startsWith("//") || line.startsWith("#")) return;
    const catMatch = line.match(/\[(Bug|Crash|Feature Request|UX Issue|Question|Praise)\]/i);
    const priMatch = line.match(/\[(Critical|High|Medium|Low)\]/i);
    const testerMatch = line.match(/@(\S+)/);
    const cleanText = line.replace(/\[(.*?)\]/g, "").replace(/@\S+/, "").trim();
    if (!cleanText) return;
    addItem({
      text: cleanText,
      category: catMatch ? catMatch[1] : "Bug",
      priority: priMatch ? priMatch[1] : "Medium",
      tester: testerMatch ? testerMatch[1] : "",
    });
    added++;
  });
  hideImport();
  document.getElementById("importText").value = "";
  save(); render();
  if (added > 0) setTimeout(() => alert(`Imported ${added} feedback item${added > 1 ? "s" : ""}.`), 100);
}

// ── Export ─────────────────────────────────────────────────────────────
function exportCSV() {
  const rows = [["ID","Text","Note","Tester","Category","Priority","Status","Date"]];
  items.forEach(i => {
    rows.push([
      i.id, i.text, i.note || "", i.tester || "", i.category, i.priority, i.status,
      new Date(i.createdAt).toLocaleDateString(),
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
  a.download = "testflight-feedback.csv";
  a.click();
}

function exportMarkdown() {
  let md = "# TestFlight Feedback\n\n";
  STATUSES.forEach(status => {
    const group = items.filter(i => i.status === status);
    if (group.length === 0) return;
    md += `## ${status} (${group.length})\n\n`;
    group.forEach(i => {
      const priM = PRIORITY_META[i.priority] || {};
      md += `- ${priM.icon || ""} **[${i.category}]** ${i.text}`;
      if (i.tester) md += ` — @${i.tester}`;
      md += "\n";
      if (i.note) md += `  > ${i.note}\n`;
    });
    md += "\n";
  });
  const a = document.createElement("a");
  a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(md);
  a.download = "testflight-feedback.md";
  a.click();
}

function clearAll() {
  if (!confirm("Clear ALL feedback? This cannot be undone.")) return;
  items = []; nextId = 1;
  save(); render();
}

// ── Filter/sort controls ───────────────────────────────────────────────
function onFilterChange() {
  filterCat = document.getElementById("filterCat").value;
  filterStatus = document.getElementById("filterStatus").value;
  filterPriority = document.getElementById("filterPriority").value;
  sortBy = document.getElementById("sortBy").value;
  render();
}

// ── Init ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  load();
  render();
  document.getElementById("addForm").addEventListener("submit", submitForm);
  document.getElementById("filterCat").addEventListener("change", onFilterChange);
  document.getElementById("filterStatus").addEventListener("change", onFilterChange);
  document.getElementById("filterPriority").addEventListener("change", onFilterChange);
  document.getElementById("sortBy").addEventListener("change", onFilterChange);
});
