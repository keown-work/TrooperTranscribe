/**
 * Trooper Transcribe&trade; — Frontend Application
 * &copy; Casey Keown 2026
 */

// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════
let state = {
  segments:     [],        // [{id, start, end, text, speaker}]
  speakerNames: {},        // {SPEAKER_01: "Detective Keown", ...}
  selected:     new Set(), // set of segment ids
  jobId:        null,
  pollTimer:    null,
  filename:     "",
  caseName:     "",
};

// ═══════════════════════════════════════════════════════════
// Speaker palette
// ═══════════════════════════════════════════════════════════
const SPEAKER_COLORS = ["spk-1","spk-2","spk-3","spk-4","spk-5","spk-6"];
const SWATCH_COLORS  = ["#4a9eff","#ff6b6b","#51cf66","#ffd43b","#e879f9","#C9A84C"];

function speakerIndex(speakerKey) {
  const keys = [...new Set(state.segments.map(s => s.speaker))].sort();
  const idx  = keys.indexOf(speakerKey);
  return idx >= 0 ? idx : 0;
}

function speakerClass(speakerKey) {
  return SPEAKER_COLORS[speakerIndex(speakerKey) % SPEAKER_COLORS.length];
}

function speakerSwatch(speakerKey) {
  return SWATCH_COLORS[speakerIndex(speakerKey) % SWATCH_COLORS.length];
}

function displayName(speakerKey) {
  return state.speakerNames[speakerKey] || speakerKey;
}

// ═══════════════════════════════════════════════════════════
// Panel management
// ═══════════════════════════════════════════════════════════
function showPanel(id) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ═══════════════════════════════════════════════════════════
// Hardware detection
// ═══════════════════════════════════════════════════════════
async function detectHardware() {
  try {
    const res = await fetch("/api/hardware");
    const hw  = await res.json();
    const badge = document.getElementById("hw-badge");
    badge.className = hw.cuda ? "hw-badge hw-gpu" : "hw-badge hw-cpu";
    badge.textContent = hw.cuda
      ? `GPU: ${hw.device}`
      : `CPU: ${hw.device}`;
  } catch {
    document.getElementById("hw-badge").textContent = "Hardware unknown";
  }
}

// ═══════════════════════════════════════════════════════════
// Upload panel
// ═══════════════════════════════════════════════════════════
const dropZone   = document.getElementById("drop-zone");
const fileInput  = document.getElementById("file-input");
const fileInfo   = document.getElementById("file-info");
const transcribeBtn = document.getElementById("transcribe-btn");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(file) {
  state.filename = file.name;
  dropZone.classList.add("has-file");
  fileInfo.textContent = `${file.name}  (${formatBytes(file.size)})`;
  fileInfo.classList.remove("hidden");
  transcribeBtn.disabled = false;
  // Store file object
  dropZone._file = file;
}

function formatBytes(b) {
  if (b >= 1e9) return (b/1e9).toFixed(2) + " GB";
  if (b >= 1e6) return (b/1e6).toFixed(1) + " MB";
  return (b/1e3).toFixed(0) + " KB";
}

// Model hint text
const modelHints = {
  "large-v2": "Best accuracy. Recommended for investigative use.",
  "small":    "Good accuracy. Faster processing time.",
  "base":     "Fastest. Best for quick reviews or clean audio.",
};
document.getElementById("model-select").addEventListener("change", function () {
  document.getElementById("model-hint").textContent = modelHints[this.value] || "";
});

// Begin transcription
transcribeBtn.addEventListener("click", async () => {
  const file = dropZone._file;
  if (!file) return;

  const model       = document.getElementById("model-select").value;
  const numSpeakers = document.getElementById("speakers-select").value;
  state.caseName    = document.getElementById("case-name").value.trim();

  const form = new FormData();
  form.append("file", file);
  form.append("model", model);
  form.append("num_speakers", numSpeakers);

  try {
    const res  = await fetch("/api/transcribe", { method: "POST", body: form });
    const data = await res.json();
    state.jobId = data.job_id;

    document.getElementById("proc-filename").textContent = file.name;
    showPanel("processing-panel");
    startPolling();
  } catch (err) {
    alert("Failed to start transcription: " + err.message);
  }
});

// ═══════════════════════════════════════════════════════════
// Processing / polling
// ═══════════════════════════════════════════════════════════
function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(pollJob, 1000);
}

async function pollJob() {
  try {
    const res  = await fetch(`/api/job/${state.jobId}`);
    const data = await res.json();

    updateProgress(data.progress, data.message);
    updateStages(data.progress);

    if (data.status === "complete") {
      clearInterval(state.pollTimer);
      loadTranscript(data.result, data.filename);
    } else if (data.status === "error") {
      clearInterval(state.pollTimer);
      alert("Transcription error:\n" + data.error);
      showPanel("upload-panel");
    }
  } catch {
    // Network blip — keep polling
  }
}

function updateProgress(pct, msg) {
  document.getElementById("progress-bar").style.width = pct + "%";
  document.getElementById("progress-pct").textContent = pct + "%";
  document.getElementById("progress-msg").textContent = msg || "";
}

function updateStages(pct) {
  const s1 = document.getElementById("stage-transcribe");
  const s2 = document.getElementById("stage-diarize");
  const s3 = document.getElementById("stage-merge");

  if (pct < 66) {
    setStage(s1, "active"); setStage(s2, ""); setStage(s3, "");
  } else if (pct < 92) {
    setStage(s1, "done");  setStage(s2, "active"); setStage(s3, "");
  } else if (pct < 100) {
    setStage(s1, "done");  setStage(s2, "done");   setStage(s3, "active");
  } else {
    setStage(s1, "done");  setStage(s2, "done");   setStage(s3, "done");
  }
}

function setStage(el, cls) {
  el.classList.remove("active", "done");
  if (cls) el.classList.add(cls);
}

// ═══════════════════════════════════════════════════════════
// Transcript loading
// ═══════════════════════════════════════════════════════════
function loadTranscript(segments, filename) {
  state.segments     = segments;
  state.speakerNames = {};
  state.selected     = new Set();

  document.getElementById("editor-filename").textContent =
    state.caseName ? `${state.caseName}  —  ${filename || state.filename}` : (filename || state.filename);

  const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))];
  document.getElementById("editor-stats").textContent =
    `${segments.length} segments · ${uniqueSpeakers.length} speaker${uniqueSpeakers.length !== 1 ? "s" : ""}`;

  renderLegend();
  renderTranscript();
  showPanel("editor-panel");
}

// ═══════════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════════
function renderLegend() {
  const legend = document.getElementById("speaker-legend");
  const unique = [...new Set(state.segments.map(s => s.speaker))].sort();

  legend.innerHTML = unique.map(spk => `
    <div class="speaker-pill" data-speaker="${spk}" title="Click to rename">
      <div class="speaker-swatch" style="background:${speakerSwatch(spk)}"></div>
      <span class="speaker-name">${escHtml(displayName(spk))}</span>
      <span class="speaker-edit-hint">✎</span>
    </div>
  `).join("");

  legend.querySelectorAll(".speaker-pill").forEach(pill => {
    pill.addEventListener("click", () => openRenameDialog(pill.dataset.speaker));
  });

  // Update bulk speaker dropdown too
  const bulkSelect = document.getElementById("bulk-speaker-select");
  bulkSelect.innerHTML = unique.map(spk =>
    `<option value="${spk}">${escHtml(displayName(spk))}</option>`
  ).join("");
}

function renderTranscript() {
  const container = document.getElementById("transcript");
  container.innerHTML = state.segments.map(seg => {
    const cls    = speakerClass(seg.speaker);
    const name   = escHtml(displayName(seg.speaker));
    const ts     = formatTime(seg.start);
    const text   = escHtml(seg.text);
    const checked = state.selected.has(seg.id) ? "checked" : "";
    const selCls  = state.selected.has(seg.id) ? " selected" : "";
    return `
      <div class="segment${selCls}" data-id="${seg.id}">
        <input class="seg-check" type="checkbox" data-id="${seg.id}" ${checked} />
        <span class="seg-time">${ts}</span>
        <span class="seg-speaker ${cls}" data-speaker="${seg.speaker}">${name}</span>
        <span class="seg-text">${text}</span>
      </div>`;
  }).join("");

  // Checkbox events
  container.querySelectorAll(".seg-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const id = cb.dataset.id;
      if (cb.checked) state.selected.add(id);
      else            state.selected.delete(id);
      cb.closest(".segment").classList.toggle("selected", cb.checked);
      updateBulkBar();
    });
  });

  // Speaker label click -> rename
  container.querySelectorAll(".seg-speaker").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      openRenameDialog(el.dataset.speaker);
    });
  });
}

function formatTime(secs) {
  const h  = Math.floor(secs / 3600);
  const m  = Math.floor((secs % 3600) / 60);
  const s  = Math.floor(secs % 60);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2, "0"); }
function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ═══════════════════════════════════════════════════════════
// Bulk selection
// ═══════════════════════════════════════════════════════════
document.getElementById("select-all-btn").addEventListener("click", () => {
  state.segments.forEach(s => state.selected.add(s.id));
  renderTranscript();
  updateBulkBar();
});

document.getElementById("deselect-btn").addEventListener("click", () => {
  state.selected.clear();
  renderTranscript();
  updateBulkBar();
});

function updateBulkBar() {
  const n   = state.selected.size;
  const bar = document.getElementById("bulk-bar");
  if (n === 0) {
    bar.classList.add("hidden");
  } else {
    bar.classList.remove("hidden");
    document.getElementById("bulk-count").textContent = `${n} segment${n !== 1 ? "s" : ""} selected`;
  }
}

document.getElementById("bulk-assign-btn").addEventListener("click", () => {
  const targetSpk = document.getElementById("bulk-speaker-select").value;
  state.selected.forEach(id => {
    const seg = state.segments.find(s => s.id === id);
    if (seg) seg.speaker = targetSpk;
  });
  state.selected.clear();
  renderLegend();
  renderTranscript();
  updateBulkBar();
});

// ═══════════════════════════════════════════════════════════
// Rename dialog
// ═══════════════════════════════════════════════════════════
let _renameTarget = null;

function openRenameDialog(speakerKey) {
  _renameTarget = speakerKey;
  const count = state.segments.filter(s => s.speaker === speakerKey).length;
  document.getElementById("rename-sub").textContent =
    `Renaming "${displayName(speakerKey)}" — will update all ${count} segment${count !== 1 ? "s" : ""}.`;
  document.getElementById("rename-input").value = displayName(speakerKey);
  document.getElementById("rename-overlay").classList.remove("hidden");
  document.getElementById("rename-input").focus();
  document.getElementById("rename-input").select();
}

document.getElementById("rename-cancel").addEventListener("click", closeRenameDialog);
document.getElementById("rename-overlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeRenameDialog();
});

function closeRenameDialog() {
  _renameTarget = null;
  document.getElementById("rename-overlay").classList.add("hidden");
}

document.getElementById("rename-confirm").addEventListener("click", applyRename);
document.getElementById("rename-input").addEventListener("keydown", e => {
  if (e.key === "Enter") applyRename();
  if (e.key === "Escape") closeRenameDialog();
});

function applyRename() {
  if (!_renameTarget) return;
  const newName = document.getElementById("rename-input").value.trim();
  if (!newName) return;
  state.speakerNames[_renameTarget] = newName;
  closeRenameDialog();
  renderLegend();
  renderTranscript();
}

// ═══════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════
document.querySelectorAll(".btn-export").forEach(btn => {
  btn.addEventListener("click", () => exportTranscript(btn.dataset.fmt));
});

async function exportTranscript(fmt) {
  const baseName = state.caseName || state.filename.replace(/\.[^/.]+$/, "") || "transcript";

  try {
    const res = await fetch(`/api/export/${fmt}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments: state.segments,
        filename: baseName,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Export failed: " + (err.detail || res.statusText));
      return;
    }

    // Trigger save dialog
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${baseName}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    alert("Export error: " + err.message);
  }
}

// ═══════════════════════════════════════════════════════════
// New file
// ═══════════════════════════════════════════════════════════
document.getElementById("new-file-btn").addEventListener("click", () => {
  state.segments     = [];
  state.speakerNames = {};
  state.selected     = new Set();
  state.jobId        = null;
  state.filename     = "";
  state.caseName     = "";

  // Reset upload form
  dropZone._file = null;
  dropZone.classList.remove("has-file");
  fileInfo.textContent = "";
  fileInfo.classList.add("hidden");
  fileInput.value = "";
  document.getElementById("case-name").value = "";
  transcribeBtn.disabled = true;

  showPanel("upload-panel");
});

// ═══════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════
detectHardware();
