// script.js - Komplettfertig (Firebase entfernt, dynamischer Kalender - Option 2)

// === STICKERS DEFINIEREN ===
const STICKERS = [
  "Star",
  "Trophy",
  "Rocket",
  "Medal",
  "Crown",
  "Diamond",
  "Fire",
  "Rainbow",
  "Pizza",
  "IceCream",
];

const TASKS = [
  "Ranzen holen",
  "Hausaufgabenheft zeigen",
  "Hausaufgaben machen",
  "An den Schulplaner denken und notieren",
  "Zettel & Briefe raussuchen",
  "Was muss morgen mit? (z.B. Sportzeug)",
  "Wichtige Infos sagen (z.B. Test)",
  "Wichtige Sachen notieren",
  "Ranzen wieder packen",
];

const PARENT_PIN = "5656";
const CURRENT_PROFILE_KEY = "child1"; // default

// === STUNDENPLAN – Standard-Daten (für Initialisierung) ===
// Ursprüngliche Struktur mit "zeit" wird beim Start zu {von, bis: ""} migriert
let SCHULKALENDER = {
  Montag: [
    { zeit: "08:00", fach: "Englisch", lehrer: "Frau Müller", istPause: false },
    { zeit: "08:45", fach: "Sport", lehrer: "Herr Schulz", istPause: false },
    { zeit: "09:30", fach: "Pause", lehrer: "", istPause: true },
    { zeit: "09:50", fach: "Deutsch", lehrer: "Frau Müller", istPause: false },
    { zeit: "10:35", fach: "Mathe", lehrer: "Frau Schmidt", istPause: false },
  ],
  Dienstag: [
    { zeit: "08:00", fach: "Englisch", lehrer: "Frau Müller", istPause: false },
    { zeit: "08:45", fach: "Sport", lehrer: "Herr Schulz", istPause: false },
    { zeit: "09:30", fach: "Pause", lehrer: "", istPause: true },
    { zeit: "09:50", fach: "Deutsch", lehrer: "Frau Müller", istPause: false },
    { zeit: "10:35", fach: "Mathe", lehrer: "Frau Schmidt", istPause: false },
  ],
  Mittwoch: [
    { zeit: "08:00", fach: "Religion", lehrer: "Herr Meier", istPause: false },
    { zeit: "08:45", fach: "Sachkunde", lehrer: "Frau Schmidt", istPause: false },
    { zeit: "09:30", fach: "Pause", lehrer: "", istPause: true },
    { zeit: "09:50", fach: "Musik", lehrer: "Herr Weber", istPause: false },
    { zeit: "10:35", fach: "Deutsch", lehrer: "Herr Müller", istPause: false },
  ],
  Donnerstag: [
    { zeit: "08:00", fach: "Mathe", lehrer: "Frau Schmidt", istPause: false },
    { zeit: "08:45", fach: "Englisch", lehrer: "Frau Müller", istPause: false },
    { zeit: "09:30", fach: "Pause", lehrer: "", istPause: true },
    { zeit: "09:50", fach: "Sport", lehrer: "Herr Schulz", istPause: false },
    { zeit: "10:35", fach: "Freie Zeit", lehrer: "---", istPause: false },
  ],
  Freitag: [
    { zeit: "08:00", fach: "Deutsch", lehrer: "Herr Müller", istPause: false },
    { zeit: "08:45", fach: "Kunst", lehrer: "Herr Weber", istPause: false },
    { zeit: "09:30", fach: "Pause", lehrer: "", istPause: true },
    { zeit: "09:50", fach: "Sachkunde", lehrer: "Frau Schmidt", istPause: false },
    { zeit: "10:35", fach: "Mathe", lehrer: "Frau Schmidt", istPause: false },
  ],
  Samstag: [],
  Sonntag: [],
};

// === NEUE ZENTRALE DATENSTRUKTUR ===
let DATA = {
  profiles: {
    [CURRENT_PROFILE_KEY]: {
      streak: 0,
      unlockedStickers: [],
      tasksToday: TASKS.map(() => null),
    },
  },
  history: {},
  lastCheckedDate: new Date().toISOString().split("T")[0],
  schulkalender: SCHULKALENDER,
};

let deferredPrompt = null;
let speechEnabled = true; // Steuert die Sprachausgabe

// === HILFSFUNKTIONEN ===
function getCurrentProfile() {
  return DATA.profiles[CURRENT_PROFILE_KEY];
}

function isWeekend(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  const day = date.getDay();
  return day === 0 || day === 6;
}

// PWA Install
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById("installBtn");
  if (btn) btn.style.display = "block";
});
document.getElementById("installBtn")?.addEventListener("click", () => {
  document.getElementById("installBtn").style.display = "none";
  deferredPrompt?.prompt();
  deferredPrompt?.userChoice.then(() => (deferredPrompt = null));
});

// === Persistenz: Speichern & Laden ===
function save() {
  localStorage.setItem("schulcheckzeit_DATA", JSON.stringify(DATA));
}

function load() {
  const saved = localStorage.getItem("schulcheckzeit_DATA");
  if (saved) {
    try {
      const loadedData = JSON.parse(saved);
      // tiefes Merge auf top-level (profile/history/schulkalender)
      DATA = { ...DATA, ...loadedData };

      if (!DATA.profiles || !DATA.profiles[CURRENT_PROFILE_KEY]) {
        DATA.profiles = {
          [CURRENT_PROFILE_KEY]: {
            streak: 0,
            unlockedStickers: [],
            tasksToday: TASKS.map(() => null),
          },
        };
      }

      if (!DATA.schulkalender) {
        DATA.schulkalender = SCHULKALENDER;
      }
    } catch (e) {
      console.error("Daten korrupt:", e);
      resetAllData();
      return;
    }
  }

  // Sicherstellen, dass alle Tage im Kalender vorhanden sind
  const days = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
  days.forEach(d => {
    if (!DATA.schulkalender[d]) DATA.schulkalender[d] = [];
  });

  // Migration: Falls alte Einträge noch 'zeit' statt 'von' enthalten, konvertieren
  migrateSchulkalenderFormat();
  updateStreak();
  updateDate();
  render();
}

// Migration-Funktion: zeit -> von, bis:""
function migrateSchulkalenderFormat() {
  const kal = DATA.schulkalender;
  Object.keys(kal).forEach(day => {
    kal[day] = kal[day].map(entry => {
      // Wenn 'von' existiert, nehme es; sonst wenn 'zeit' existiert, migriere
      if (entry.von) return entry; // bereits neues Format
      if (entry.zeit) {
        const von = entry.zeit;
        return {
          von,
          bis: "", // Option 2: bis leer, Nutzer füllt es
          fach: entry.fach || "",
          lehrer: entry.lehrer || "",
          istPause: !!entry.istPause,
        };
      }
      // Wenn nichts, gib sauberes Objekt zurück
      return {
        von: entry.von || "",
        bis: entry.bis || "",
        fach: entry.fach || "",
        lehrer: entry.lehrer || "",
        istPause: !!entry.istPause,
      };
    });
  });

  // Update globale SCHULKALENDER Referenz
  SCHULKALENDER = DATA.schulkalender;
}

// === Datum / Streak / Sprach-Helpers ===
function updateDate() {
  const options = {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  };
  const dateEl = document.getElementById("date");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("de-DE", options);
}

function updateStreak() {
  const profile = getCurrentProfile();
  let count = 0;
  const sortedHistory = Object.keys(DATA.history)
    .sort()
    .reverse();
  for (let i = 0; i < sortedHistory.length; i++) {
    const status = DATA.history[sortedHistory[i]].status;
    if (status === "success" || status === "neutral") count++;
    else break;
  }
  profile.streak = count;
}

function speak(text) {
  if (!speechEnabled) return;
  if ("speechSynthesis" in window && text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = 0.9;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }
}

function toggleSpeech() {
  speechEnabled = !speechEnabled;
  const btn = document.getElementById("speechToggle");
  if (btn) {
    btn.textContent = `Sprache: ${speechEnabled ? "AN" : "AUS"}`;
    btn.style.backgroundColor = speechEnabled ? "#2196F3" : "#9E9E9E";
    btn.style.color = "white";
    btn.style.marginRight = "10px";
  }
  if (speechEnabled) speak("Sprachausgabe aktiviert.");
}

// === Zufälliges Sticker-System ===
function unlockSticker() {
  const profile = getCurrentProfile();
  const unlockedStickers = profile.unlockedStickers;
  const lockedIndexes = STICKERS.map((_, i) => i).filter(i => !unlockedStickers.includes(i));
  if (lockedIndexes.length === 0) {
    console.log("Alle Sticker freigeschaltet!");
    return;
  }
  const chosen = lockedIndexes[Math.floor(Math.random() * lockedIndexes.length)];
  unlockedStickers.push(chosen);
  save();
  const stickerName = STICKERS[chosen];
  const level = unlockedStickers.length;
  const fileName = stickerName.toLowerCase() + ".png";
  const newStickerEl = document.getElementById("new-sticker");
  const rewardTextEl = document.getElementById("reward-text");
  if (newStickerEl && rewardTextEl) {
    newStickerEl.innerHTML = `<img src="assets/images/${fileName}" alt="${stickerName}" style="width:100px;height:100px;animation:pop 0.6s ease;">`;
    rewardTextEl.textContent = `${stickerName} freigeschaltet! (Sticker #${level})`;
  }
  showModal("reward");
  speak(`Toll! Neuer Sticker: ${stickerName}`);
}

// === RENDER / CHECKLIST / STICKERS / DAYS ===
function render() {
  const profile = getCurrentProfile();
  const todayISO = new Date().toISOString().split("T")[0];

  renderDays();
  renderTable();
  renderStickers();

  const streakEl = document.getElementById("streak");
  if (streakEl) streakEl.textContent = profile.streak;

  const allDone = profile.tasksToday.every(t => t !== null);
  const dayClosed = DATA.history[todayISO];
  const isTodayWeekend = isWeekend(todayISO);

  const btnConfirm = document.getElementById("confirmDayBtn");
  if (btnConfirm) {
    btnConfirm.style.display = allDone && !dayClosed && !isTodayWeekend ? "block" : "none";
  }

  const btnAll = document.querySelector(".btn-all");
  if (btnAll) {
    btnAll.style.display = !dayClosed && !isTodayWeekend ? "inline-block" : "none";
  }

  const btnReset = document.querySelector(".btn-reset");
  if (btnReset) {
    btnReset.style.display = !isTodayWeekend ? "inline-block" : "none";
  }
}

function renderDays() {
  const container = document.getElementById("days-container");
  if (!container) return;
  container.innerHTML = "";

  const sortedHistory = Object.keys(DATA.history)
    .filter(date => !isWeekend(date))
    .sort();

  for (let i = 0; i < 5; i++) {
    const div = document.createElement("div");
    div.className = "day-circle";
    if (i < sortedHistory.length) {
      const s = DATA.history[sortedHistory[i]].status;
      if (s === "success" || s === "neutral") {
        div.classList.add("success");
        div.textContent = "✔";
      } else {
        div.classList.add("fail");
        div.textContent = "✖";
      }
    } else {
      const todayISO = new Date().toISOString().split("T")[0];
      const dayClosed = DATA.history[todayISO];
      if (i === sortedHistory.length && !dayClosed && !isWeekend(todayISO)) {
        div.classList.add("active");
        div.textContent = "✔";
      } else {
        div.textContent = i + 1;
      }
    }
    container.appendChild(div);
  }
}

function renderStickers() {
  const profile = getCurrentProfile();
  const container = document.getElementById("stickers");
  if (!container) return;
  container.innerHTML = "";

  STICKERS.forEach((name, i) => {
    const img = document.createElement("img");
    const fileName = name.toLowerCase() + ".png";
    img.src = `assets/images/${fileName}`;
    img.alt = name;
    img.className = "sticker";
    if (profile.unlockedStickers.includes(i)) {
      img.classList.add("unlocked");
      img.style.animation = "pop 0.6s ease";
    } else {
      img.classList.add("locked");
    }
    container.appendChild(img);
  });
}

function renderTable() {
  const profile = getCurrentProfile();
  const tbody = document.getElementById("checklist");
  if (!tbody) return;
  tbody.innerHTML = "";

  const todayISO = new Date().toISOString().split("T")[0];
  const dayClosed = DATA.history[todayISO];

  TASKS.forEach((task, i) => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = `${i + 1}. ${task}`;
    tr.appendChild(td1);

    const td2 = document.createElement("td");
    const group = document.createElement("div");
    group.className = "btn-group";

    const opts = [
      { l: "OK", v: "success", c: "btn-success" },
      { l: "nn", v: "neutral", c: "btn-neutral" },
      { l: "X", v: "fail", c: "btn-fail" },
    ];

    opts.forEach(o => {
      const btn = document.createElement("button");
      btn.className = `btn ${o.c}`;
      btn.textContent = o.l;

      const isSelected = profile.tasksToday[i] === o.v;
      const isDisabled = dayClosed || isSelected;

      btn.disabled = isDisabled;
      btn.style.opacity = isSelected ? "1" : "0.7";
      btn.style.cursor = isDisabled ? "not-allowed" : "pointer";

      btn.onclick = () => {
        if (isDisabled) return;
        profile.tasksToday[i] = o.v;
        if (speechEnabled) {
          speak(o.v === "success" ? "Super!" : o.v === "neutral" ? "Ok, nicht notwendig" : "Hast es versucht, war aber dennoch nichts");
        }
        save();
        render();
      };

      if (isSelected) btn.classList.add("selected");
      group.appendChild(btn);
    });

    td2.appendChild(group);
    tr.appendChild(td2);
    tbody.appendChild(tr);
  });
}

// === ALLE ERLEDIGT / ERFOLGSEFFEKTE ===
function checkAllSuccess() {
  const todayISO = new Date().toISOString().split("T")[0];
  const profile = getCurrentProfile();
  if (isWeekend(todayISO) || DATA.history[todayISO]) return;
  if (confirm("Alle Aufgaben als erledigt markieren?")) {
    profile.tasksToday = TASKS.map(() => "success");
    save();
    render();
    playSuccessSound();
    triggerConfetti();
    showSuccessSticker();
  }
}

function playSuccessSound() {
  const audio = new Audio("assets/sounds/success.wav");
  audio.volume = 0.7;
  audio.play().catch(() => {
    const unlock = () => {
      audio.play().catch(() => {});
      document.body.removeEventListener("click", unlock);
      document.body.removeEventListener("touchstart", unlock);
    };
    document.body.addEventListener("click", unlock);
    document.body.addEventListener("touchstart", unlock);
  });
}

function triggerConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confetti = [];
  const colors = ["#4CAF50", "#FFC107", "#F44336", "#1976D2", "#FF9800"];

  for (let i = 0; i < 300; i++) {
    confetti.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 1,
      d: Math.random() * 8 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
      tiltAngle: 0,
    });
  }

  let animationId;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.tiltAngle += p.tiltAngleIncrement;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      p.y += p.d;
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.r / 2);
      ctx.stroke();
      if (p.y > canvas.height) confetti.splice(i, 1);
    }
    if (confetti.length > 0) {
      animationId = requestAnimationFrame(animate);
    } else {
      document.body.removeChild(canvas);
      cancelAnimationFrame(animationId);
    }
  }
  animate();
}

function showSuccessSticker() {
  const sticker = document.getElementById("sticker");
  if (sticker) {
    sticker.style.display = "flex";
    setTimeout(() => (sticker.style.display = "none"), 3000);
  }
}

// === RESET / PIN / EXPORT ===
function promptReset() { showResetMenu(); }

function showResetMenu() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;
  const sortedHistoryKeys = Object.keys(DATA.history).sort().reverse();
  const resettableDays = sortedHistoryKeys.filter(d => !isWeekend(d)).map(d => ({ date: d, ...DATA.history[d] }));
  historyList.innerHTML = "";

  resettableDays.forEach(h => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.style.padding = "8px";
    li.style.borderBottom = "1px solid #eee";
    li.style.backgroundColor = "#f9f9f9";
    li.style.borderRadius = "3px";
    li.style.marginBottom = "5px";
    li.textContent = `${new Date(h.date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })} Status: ${h.status === "success" ? "Erfolg" : h.status === "fail" ? "Fehler" : "Neutral"}`;
    li.onclick = () => {
      hideModal("resetMenuModal");
      showModal("pinModal");
      const pinInput = document.getElementById("pinInput");
      if (pinInput) {
        pinInput.dataset.resetDate = h.date;
        pinInput.dataset.resetType = "single";
        setTimeout(() => pinInput.focus(), 100);
      }
    };
    historyList.appendChild(li);
  });

  if (resettableDays.length === 0) {
    historyList.innerHTML = '<li style="padding:10px; color:#555;">Keine abschließbaren Wochentage zur Auswahl.</li>';
  }

  showModal("resetMenuModal");
}

function checkPin(resetType) {
  const todayISO = new Date().toISOString().split("T")[0];
  const profile = getCurrentProfile();
  hideModal("pinModal");
  const pinInput = document.getElementById("pinInput");
  const pin = pinInput?.value.trim() || "";
  if (pinInput) pinInput.value = "";

  if (pin === PARENT_PIN) {
    if (resetType === "single") {
      const dateToReset = pinInput?.dataset.resetDate;
      if (dateToReset) {
        delete DATA.history[dateToReset];
        if (dateToReset === todayISO) profile.tasksToday = TASKS.map(() => null);
        updateStreak();
        save();
        render();
        speak(`Tag ${new Date(dateToReset).toLocaleDateString("de-DE")} zurückgesetzt.`);
      }
    } else if (resetType === "all") {
      resetAllData();
    }
  } else if (resetType !== "cancel") {
    alert("Falsche PIN!");
  }

  if (pinInput) {
    delete pinInput.dataset.resetDate;
    delete pinInput.dataset.resetType;
  }
}

function resetAllData() {
  const todayISO = new Date().toISOString().split("T")[0];
  DATA = {
    profiles: {
      [CURRENT_PROFILE_KEY]: {
        streak: 0,
        unlockedStickers: [],
        tasksToday: TASKS.map(() => null),
      },
    },
    history: {},
    lastCheckedDate: todayISO,
    schulkalender: SCHULKALENDER,
  };
  save();
  load();
  speak("Alle Daten wurden zurückgesetzt.");
  alert("Alle Daten, Sticker und der Streak wurden gelöscht.");
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "flex";
}
function hideModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = "none";
}

function exportData() {
  const profile = getCurrentProfile();
  const todayISO = new Date().toISOString().split("T")[0];
  const todayEntry = DATA.history[todayISO];
  const currentTasks = todayEntry ? todayEntry.tasks : profile.tasksToday;
  const lines = [
    `Schul-Check-Zeit – ${new Date().toLocaleDateString("de-DE")}`,
    "",
    ...currentTasks.map((s, i) => `${i + 1}. ${TASKS[i]} → ${s === "success" ? "Erledigt" : s === "neutral" ? "Nicht nötig" : s === "fail" ? "Nicht geschafft" : "Offen"}`)
  ];
  lines.push("", `Streak: ${profile.streak}/5`, `Sticker: ${profile.unlockedStickers.length}`);
  const text = lines.join("\n");
  navigator.clipboard.writeText(text).then(() => alert("In Zwischenablage kopiert!"));
}

// === DYNAMISCHER STUNDENPLAN (Option 2: von, bis leer) ===
let calendarIsEditing = false;
let calendarCurrentDay = "";

// Lade Kalender aus DATA und migriere falls nötig
function loadSchulkalender() {
  if (DATA && DATA.schulkalender) SCHULKALENDER = DATA.schulkalender;
  // Migration falls noch 'zeit' benutzt wird
  migrateSchulkalenderFormat();
}

// Speichern in DATA
function saveSchulkalender() {
  DATA.schulkalender = SCHULKALENDER;
  save();
  alert("Stundenplan gespeichert!");
}

// Tag wechseln
function changeDay(day) {
  calendarCurrentDay = day;
  calendarIsEditing = false;
  renderSchulkalender();
}

// Edit-Modus an/aus
function toggleEditMode() {
  if (calendarIsEditing) saveSchedule();
  calendarIsEditing = !calendarIsEditing;
  renderSchulkalender();
}

// Neue Stunde hinzufügen
function addScheduleItem() {
  if (!SCHULKALENDER[calendarCurrentDay]) SCHULKALENDER[calendarCurrentDay] = [];
  SCHULKALENDER[calendarCurrentDay].push({
    von: "08:00",
    bis: "",
    fach: "",
    lehrer: "",
    istPause: false
  });
  renderSchulkalender();
}

// Löschen einer Stunde
function deleteScheduleItem(index) {
  if (!SCHULKALENDER[calendarCurrentDay]) return;
  if (confirm("Diese Stunde wirklich löschen?")) {
    SCHULKALENDER[calendarCurrentDay].splice(index, 1);
    renderSchulkalender();
  }
}

// Pause umschalten
function togglePause(index) {
  if (!SCHULKALENDER[calendarCurrentDay] || !SCHULKALENDER[calendarCurrentDay][index]) return;
  const stunde = SCHULKALENDER[calendarCurrentDay][index];
  stunde.istPause = !stunde.istPause;
  if (stunde.istPause) {
    stunde.lehrer = "";
    stunde.fach = stunde.fach || "Pause";
  } else {
    if (stunde.fach === "Pause") stunde.fach = "";
  }
  renderSchulkalender();
}

// Speichern (Eingabefelder übernehmen)
function saveSchedule() {
  const rows = document.querySelectorAll("#schedule-table tbody tr");
  const updated = [];
  rows.forEach(row => {
    const idx = parseInt(row.dataset.index, 10);
    const isPause = row.classList.contains("pause");
    const von = row.querySelector(".from-input")?.value || "";
    const bis = row.querySelector(".to-input")?.value || "";
    const fach = row.querySelector(".fach-input")?.value || "";
    const lehrer = isPause ? "" : (row.querySelector(".lehrer-input")?.value || "");
    updated.push({ von, bis, fach, lehrer, istPause: isPause });
  });
  SCHULKALENDER[calendarCurrentDay] = updated;
  saveSchulkalender();
}

// Render-Engine
function renderSchulkalender() {
  const container = document.getElementById("schulkalender-container");
  if (!container) return;

  if (!calendarCurrentDay) {
    const heute = new Date().toLocaleDateString("de-DE", { weekday: "long" });
    calendarCurrentDay = heute.charAt(0).toUpperCase() + heute.slice(1);
  }

  const data = SCHULKALENDER[calendarCurrentDay] || [];

  let html = `<h3>Stundenplan für ${calendarCurrentDay}</h3>`;
  html += `<div class="day-navigation">`;
  ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag"].forEach(tag => {
    html += `<button class="day-nav-btn ${tag === calendarCurrentDay ? "active" : ""}" onclick="changeDay('${tag}')">${tag.slice(0,2)}</button>`;
  });
  html += `</div>`;

  html += `<div style="margin:8px 0;">`;
  html += `<button id="toggleEditBtn" onclick="toggleEditMode()" class="actions-btn">${calendarIsEditing ? "Speichern 💾" : "Bearbeiten ✏️"}</button>`;
  if (calendarIsEditing) html += `<button onclick="addScheduleItem()" class="actions-btn" style="background:#4CAF50;color:white;margin-left:8px;">+ Neue Stunde</button>`;
  html += `</div>`;

  if (data.length === 0 && !calendarIsEditing) {
    container.innerHTML = `${html}<p style="text-align:center;">Kein Stundenplan eingetragen</p>`;
    return;
  }

  html += `<table id="schedule-table"><thead><tr><th>Von</th><th>Bis</th><th>Fach</th><th>Lehrer</th>${calendarIsEditing ? "<th></th>" : ""}</tr></thead><tbody>`;

  data.forEach((stunde, i) => {
    const pauseClass = stunde.istPause ? "pause" : "";
    html += `<tr class="${pauseClass}" data-index="${i}">`;
    if (calendarIsEditing) {
      html += `<td><input type="time" class="from-input" value="${stunde.von || ""}"></td>`;
      html += `<td><input type="time" class="to-input" value="${stunde.bis || ""}"></td>`;
      if (stunde.istPause) {
        html += `<td colspan="2"><input class="fach-input" value="${stunde.fach || ""}"></td>`;
      } else {
        html += `<td><input class="fach-input" value="${stunde.fach || ""}"></td>`;
        html += `<td><input class="lehrer-input" value="${stunde.lehrer || ""}"></td>`;
      }
      html += `<td style="white-space:nowrap;">
                <button onclick="togglePause(${i})" title="Pause umschalten">⏸</button>
                <button onclick="deleteScheduleItem(${i})" title="Löschen" style="color:red;margin-left:6px;">🗑️</button>
               </td>`;
    } else {
      html += `<td>${stunde.von || ""}</td>`;
      html += `<td>${stunde.bis || ""}</td>`;
      if (stunde.istPause) {
        html += `<td colspan="2">${stunde.fach || "Pause"}</td>`;
      } else {
        html += `<td>${stunde.fach || ""}</td><td>${stunde.lehrer || ""}</td>`;
      }
    }
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Initialisierung
load();
loadSchulkalender();
renderSchulkalender();

// Expose calendar functions globally for inline onclick handlers
window.changeDay = changeDay;
window.toggleEditMode = toggleEditMode;
window.addScheduleItem = addScheduleItem;
window.deleteScheduleItem = deleteScheduleItem;
window.togglePause = togglePause;
window.saveSchedule = saveSchedule;
window.saveSchulkalender = saveSchulkalender;
window.loadSchulkalender = loadSchulkalender;
window.renderSchulkalender = renderSchulkalender;
window.checkPin = checkPin;
window.promptReset = promptReset;
window.resetAll = resetAll;
window.exportData = exportData;
window.toggleSpeech = toggleSpeech;
window.confirmDay = confirmDay;
window.checkAllSuccess = checkAllSuccess;

