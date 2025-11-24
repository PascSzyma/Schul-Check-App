const STORAGE_KEY = "lokaler_stundenplan";
function saveKalender() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(schulplan));
alert("Stundenplan gespeichert!");
}


// ---- Tag wechseln ----
function changeDay(day) {
currentDay = day;
isEditing = false;
renderKalender();
}


// ---- Edit-Modus ----
function toggleEdit() {
isEditing = !isEditing;
renderKalender();
}


// ---- Neue Stunde hinzufügen ----
function addStunde() {
schulplan[currentDay].push({
von: "08:00",
bis: "08:45",
fach: "Neues Fach",
lehrer: "",
});
renderKalender();
}


// ---- Stunde löschen ----
function deleteStunde(index) {
schulplan[currentDay].splice(index, 1);
renderKalender();
}


// ---- Felder aktualisieren ----
function updateStunde(i, field, value) {
schulplan[currentDay][i][field] = value;
}


// ---- Rendern ----
function renderKalender() {
const container = document.getElementById("schulkalender-container");
const data = schulplan[currentDay];


let html = `<h3>Stundenplan – ${currentDay}</h3>`;


html += `<div class="day-navigation">`;
TAGE.forEach(tag => {
html += `<button class="day-nav-btn ${tag === currentDay ? "active" : ""}" onclick="changeDay('${tag}')">${tag.slice(0,2)}</button>`;
});
html += `</div>`;


html += `<button id="editBtn" onclick="toggleEdit()" class="actions-btn">${isEditing ? "Speichern" : "Bearbeiten"}</button>`;


if (isEditing) {
html += `<button onclick="addStunde()" class="actions-btn" style="background:#4CAF50; color:white">+ Hinzufügen</button>`;
}


html += `<table id="schedule-table"><thead><tr><th>Von</th><th>Bis</th><th>Fach</th><th>Lehrer</th>${isEditing ? "<th></th>" : ""}</tr></thead><tbody>`;


data.forEach((stunde, i) => {
if (isEditing) {
html += `<tr>
<td><input type="time" value="${stunde.von}" onchange="updateStunde(${i}, 'von', this.value)"></td>
<td><input type="time" value="${stunde.bis}" onchange="updateStunde(${i}, 'bis', this.value)"></td>
<td><input type="text" value="${stunde.fach}" onchange="updateStunde(${i}, 'fach', this.value)"></td>
<td><input type="text" value="${stunde.lehrer}" onchange="updateStunde(${i}, 'lehrer', this.value)"></td>
<td><button onclick="deleteStunde(${i})" class="delete-task-btn">🗑️</button></td>
</tr>`;
} else {
html += `<tr>
<td>${stunde.von}</td>
<td>${stunde.bis}</td>
<td>${stunde.fach}</td>
<td>${stunde.lehrer}</td>
</tr>`;
}
});


html += `</tbody></table>`;


container.innerHTML = html;


if (!isEditing) saveKalender();
}


// ---- Init ----
loadKalender();