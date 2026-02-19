const SUPABASE_URL = "https://eishxohixndoiltazdzu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5FlWmjnmAOU47zsUSwVLrg_5h2Kk9yT";

function isSupabaseConfigUsable(url, key) {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".supabase.co")) return false;
    return Boolean(key && key.length > 20);
  } catch {
    return false;
  }
}

const state = {
  user: null,
  profile: null,
  markers: [],
  reports: [],
  activeTypes: new Set(["talalt", "keresett"]),
  activeCategories: new Set(),
  reportType: null,
  selectedCategory: null,
  pendingCoords: null,
  pendingMarker: null,
  pendingLocationType: null,
  currentReportForMessage: null,
  supabaseOnline: false,
};

const typeToLabel = {
  talalt: "Talált",
  keresett: "Keresett",
};

const categoryMap = {
  "Telefon -és Kiegészítők": "Telefon -és Kiegészítők",
  "Pénz, Pénztárca": "Pénz, Pénztárca",
  "Okmányok": "Okmányok",
  "Ruházat, táska": "Ruházat, táska",
  "Kulcs": "Kulcs",
  "Háziállat": "Háziállat",
  "Ékszer": "Ékszer",
  "Egyéb": "Egyéb",
  Telefon: "Telefon -és Kiegészítők",
  Pénztárca: "Pénz, Pénztárca",
  Okmány: "Okmányok",
  Ruházat: "Ruházat, táska",
};

const greenBusIcon = L.icon({ iconUrl: "bus-green.png", iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -35] });
const redBusIcon = L.icon({ iconUrl: "bus-red.png", iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -35] });

const map = L.map("map").setView([47.4979, 19.0402], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap közreműködők" }).addTo(map);

const supabaseClient = isSupabaseConfigUsable(SUPABASE_URL, SUPABASE_ANON_KEY)
  ? window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const el = {
  foundBtn: document.getElementById("foundBtn"),
  lostBtn: document.getElementById("lostBtn"),
  modal: document.getElementById("modal"),
  modalContent: document.querySelector("#modal .modal-content"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginBtn: document.getElementById("menuLoginBtn"),
  loggedUser: document.getElementById("loggedUser"),
  reportItems: document.getElementById("reportItems"),
  markerForm: document.getElementById("markerForm"),
  descriptionInput: document.getElementById("descriptionInput"),
  contactInput: document.getElementById("contactInput"),
  photoInput: document.getElementById("photoInput"),
  routeInput: document.getElementById("routeInput"),
  routeBox: document.getElementById("járatBox"),
  valasztoModal: document.getElementById("valasztoModal"),
  datumModal: document.getElementById("datumModal"),
  helyModal: document.getElementById("helyModal"),
  kategoriaModal: document.getElementById("kategoriavalasztoModal"),
  bejelentesBox: document.getElementById("bejelentesBox"),
  valasztoBox: document.getElementById("valasztoBox"),
  profileView: document.getElementById("profileView"),
  mainContainer: document.querySelector(".main-container"),
  homeBtn: document.getElementById("homeBtn"),
  myReportsBtn: document.getElementById("myReportsBtn"),
  myMessagesBtn: document.getElementById("myMessagesBtn"),
  profileUserInfo: document.getElementById("profileUserInfo"),
  myReportsList: document.getElementById("myReportsList"),
  messageList: document.getElementById("messageList"),
  messageModal: document.getElementById("messageModal"),
  messageBody: document.getElementById("messageBody"),
  sendFirstMessageBtn: document.getElementById("sendFirstMessageBtn"),
  cancelFirstMessageBtn: document.getElementById("cancelFirstMessageBtn"),
};

function setInfo(text) {
  const target = document.getElementById("supabaseStatus");
  if (target) target.textContent = text;
}

function resetReportFlow() {
  state.pendingCoords = null;
  if (state.pendingMarker) {
    map.removeLayer(state.pendingMarker);
    state.pendingMarker = null;
  }
  state.pendingLocationType = null;
  state.selectedCategory = null;
  state.reportType = null;
  el.routeInput.value = "";
  el.descriptionInput.value = "";
  el.contactInput.value = "";
  el.photoInput.value = "";
  el.routeBox.classList.add("hidden");
  el.markerForm.classList.add("hidden");
  el.bejelentesBox.classList.add("hidden");
}

function typeFromSelection() {
  return state.reportType === "talaltam" ? "talalt" : "keresett";
}

function normalizeCategory(category) {
  const key = String(category || "").trim();
  return categoryMap[key] || key;
}

function normalizeReport(report) {
  const lat = Number(report.lat);
  const lng = Number(report.lng);
  return {
    ...report,
    kategoria: normalizeCategory(report.kategoria),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function isReportVisible(report) {
  return state.activeTypes.has(report.tipus) && state.activeCategories.has(normalizeCategory(report.kategoria));
}

function updateVisibleItems() {
  el.reportItems.innerHTML = "";
  const visibleReports = state.reports.filter(isReportVisible);
  visibleReports.forEach((report) => {
    const card = document.createElement("div");
    card.className = "report-card";
    card.innerHTML = reportCardHtml(report);
    el.reportItems.appendChild(card);
  });

  if (visibleReports.length === 0) {
    el.reportItems.innerHTML = "<p>Nincs a szűrőknek megfelelő tárgy. Kapcsold be több kategóriát vagy típust.</p>";
  }
}

function reportCardHtml(report) {
  return `
    <strong style="color:${report.tipus === "talalt" ? "green" : "#c62828"}">${typeToLabel[report.tipus] || report.tipus}</strong> – ${report.kategoria}<br>
    <small>${new Date(report.created_at).toLocaleString("hu-HU")}</small><br>
    <strong>Cím:</strong> ${report.cim || "-"}<br>
    <strong>Leírás:</strong> ${report.leiras || "-"}<br>
    ${report.image_url ? `<a href="${report.image_url}" target="_blank" rel="noopener">Kép megnyitása</a><br>` : ""}
  `;
}

function markerPopupHtml(report) {
  const msgButton = state.user && state.user.id !== report.user_id
    ? `<button class="claim-btn" data-message-report="${report.id}">Üzenetküldés</button>`
    : "";

  return `${reportCardHtml(report)}${msgButton}`;
}

function clearMarkers() {
  state.markers.forEach((m) => map.removeLayer(m));
  state.markers = [];
}

function renderMapMarkers() {
  clearMarkers();
  state.reports.filter(isReportVisible).forEach((report) => {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const icon = report.tipus === "talalt" ? greenBusIcon : redBusIcon;
    const marker = L.marker([report.lat, report.lng], { icon });
    marker.bindPopup(markerPopupHtml(report));
    marker.on("popupopen", () => {
      const btn = document.querySelector(`[data-message-report=\"${report.id}\"]`);
      if (btn) btn.onclick = () => openFirstMessageModal(report);
    });
    marker.addTo(map);
    state.markers.push(marker);
  });
}

async function checkSupabaseConnection() {
  if (!supabaseClient) {
    setInfo("Supabase kliens nem inicializálható (URL vagy kulcs hibás).");
    return false;
  }

  const { error } = await supabaseClient.from("bejelentesek").select("id", { count: "exact", head: true });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("relation") && msg.includes("does not exist")) {
      setInfo("Supabase hiba: hiányzik a bejelentesek tábla. Futtasd le a supabase_schema.sql fájlt.");
    } else if (msg.includes("permission denied") || msg.includes("row-level security")) {
      setInfo("Supabase hiba: RLS policy hiányzik vagy hibás. Ellenőrizd a select policy-ket.");
    } else {
      setInfo(`Supabase hiba: ${error.message}`);
    }
    console.error("Supabase kapcsolat hiba:", error);
    return false;
  }
  setInfo("Supabase kapcsolat rendben.");
  return true;
}

async function loadReports() {
  if (!state.supabaseOnline) {
    state.reports = [];
    setInfo("Supabase kapcsolat hiba: csak éles adatbázisból töltünk. Ellenőrizd az RLS policy-ket és a táblákat.");
    updateVisibleItems();
    renderMapMarkers();
    return;
  }
  const { data, error } = await supabaseClient.from("bejelentesek").select("*").order("created_at", { ascending: false });
  if (error) {
    setInfo(`Bejelentések betöltése sikertelen: ${error.message}`);
    state.reports = [];
    updateVisibleItems();
    renderMapMarkers();
    return;
  }
  state.reports = (data || []).map(normalizeReport);
  if (!data || data.length === 0) {
    setInfo("Nincs még éles bejelentés az adatbázisban.");
  }
  updateVisibleItems();
  renderMapMarkers();
}

async function refreshProfileData() {
  if (!state.user || !state.supabaseOnline) return;
  const { data: myReports } = await supabaseClient
    .from("bejelentesek")
    .select("*")
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false });

  el.myReportsList.innerHTML = (myReports || []).map(reportCardHtml).map((h) => `<div class="report-card">${h}</div>`).join("") || "<p>Nincs saját bejelentés.</p>";

  const { data: messages } = await supabaseClient
    .from("uzenetek")
    .select("*")
    .or(`from_user_id.eq.${state.user.id},to_user_id.eq.${state.user.id}`)
    .order("created_at", { ascending: false });

  el.messageList.innerHTML = (messages || []).map((msg) => {
    const inOut = msg.from_user_id === state.user.id ? "Kimenő" : "Bejövő";
    return `<div class="report-card"><strong>${inOut}</strong> #${msg.report_id}<br>${msg.body}<br><small>${new Date(msg.created_at).toLocaleString("hu-HU")}</small>${msg.to_user_id !== state.user.id ? "" : `<br><button class=\"claim-btn\" data-reply-report=\"${msg.report_id}\" data-reply-user=\"${msg.from_user_id}\">Válasz</button>`}</div>`;
  }).join("") || "<p>Nincs üzenet.</p>";

  document.querySelectorAll("[data-reply-report]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentReportForMessage = { id: Number(btn.dataset.replyReport), user_id: btn.dataset.replyUser };
      openFirstMessageModal(state.currentReportForMessage, true);
    });
  });
}

function showProfile() {
  if (!state.user) return;
  el.mainContainer.classList.add("hidden");
  el.bejelentesBox.classList.add("hidden");
  el.valasztoBox.classList.add("hidden");
  el.profileView.classList.remove("hidden");
  el.profileUserInfo.textContent = `${state.user.email}`;
  refreshProfileData();
}

function showHome() {
  el.profileView.classList.add("hidden");
  el.mainContainer.classList.remove("hidden");
  el.bejelentesBox.classList.add("hidden");
}

async function uploadImageIfAny(file) {
  if (!file || !state.supabaseOnline) return null;
  const ext = file.name.split(".").pop();
  const path = `${state.user.id}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage.from("report-images").upload(path, file, { upsert: false });
  if (error) {
    const msg = String(error.message || "").toLowerCase();
    if (msg.includes("bucket") && msg.includes("not found")) {
      throw new Error("A report-images storage bucket hiányzik a Supabase projektben.");
    }
    if (msg.includes("permission") || msg.includes("row-level")) {
      throw new Error("Nincs jogosultság kép feltöltésre (Storage policy hiányzik vagy hibás).");
    }
    throw new Error(`Kép feltöltési hiba: ${error.message}`);
  }
  const { data } = supabaseClient.storage.from("report-images").getPublicUrl(path);
  return data.publicUrl;
}

async function saveReport() {
  if (!supabaseClient) return alert("Supabase nincs beállítva.");
  if (!state.supabaseOnline) return alert("A Supabase kapcsolat nem működik, így az éles bejelentés most nem menthető.");
  if (!state.user) return alert("Bejelentkezés szükséges.");
  if (!state.pendingCoords) return alert("Előbb jelöld a helyet a térképen.");
  if (!state.selectedCategory) return alert("Válassz kategóriát.");
  if (state.pendingLocationType === "jarmu" && !el.routeInput.value.trim()) {
    return alert("Járművön történt esetnél add meg a járatszámot.");
  }

  let imageUrl = null;
  try {
    imageUrl = await uploadImageIfAny(el.photoInput.files?.[0]);
  } catch (err) {
    alert(err.message || "Kép feltöltési hiba.");
    return;
  }

  const payload = {
    user_id: state.user.id,
    tipus: typeFromSelection(),
    kategoria: normalizeCategory(state.selectedCategory),
    cim: state.pendingLocationType === "jarmu" ? `Járat: ${el.routeInput.value || "n/a"}` : "Utcán/épületben",
    leiras: el.descriptionInput.value,
    lat: state.pendingCoords.lat,
    lng: state.pendingCoords.lng,
    image_url: imageUrl,
    status: "aktiv",
  };

  const { error } = await supabaseClient.from("bejelentesek").insert([payload]);
  if (error) return alert(`Mentési hiba: ${error.message}`);

  resetReportFlow();
  await loadReports();
  await refreshProfileData();
  alert("Bejelentés mentve.");
}

function renderAuthModal(mode = "choice") {
  if (mode === "choice") {
    el.modalContent.innerHTML = `
      <p>Ehhez a művelethez regisztráció szükséges. Jelentkezz be vagy regisztrálj.</p>
      <div class="modal-buttons">
        <button id="loginBtn">Belépés</button>
        <button id="registerBtn">Regisztráció</button>
      </div>`;
    document.getElementById("loginBtn").onclick = () => renderAuthModal("login");
    document.getElementById("registerBtn").onclick = () => renderAuthModal("register");
    return;
  }

  el.modalContent.innerHTML = `
    <h3>${mode === "login" ? "Bejelentkezés" : "Regisztráció"}</h3>
    <input type="email" id="authEmail" placeholder="Email cím"><br><br>
    <input type="password" id="authPassword" placeholder="Jelszó"><br><br>
    <button id="authSubmitBtn">${mode === "login" ? "Bejelentkezés" : "Regisztráció"}</button><br><br>
    <button id="authBackBtn">Vissza</button>
  `;

  document.getElementById("authBackBtn").onclick = () => renderAuthModal("choice");
  document.getElementById("authSubmitBtn").onclick = async () => {
    if (!supabaseClient) return alert("Supabase nincs beállítva.");
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;

    const action = mode === "login"
      ? supabaseClient.auth.signInWithPassword({ email, password })
      : supabaseClient.auth.signUp({ email, password });

    const { error } = await action;
    if (error) return alert(error.message);

    if (mode === "register") {
      alert("Regisztráció kész. Ha email megerősítés kell, igazold vissza.");
      return;
    }
    await hydrateAuth();
    el.modal.classList.add("hidden");
    el.modal.classList.remove("show");
  };
}

async function hydrateAuth() {
  if (!supabaseClient) {
    state.user = null;
    el.loggedUser.classList.add("hidden");
    el.loginBtn.classList.remove("hidden");
    el.logoutBtn.classList.add("hidden");
    el.homeBtn.classList.add("hidden");
    return;
  }

  const { data } = await supabaseClient.auth.getUser();
  state.user = data.user || null;

  if (state.user) {
    el.loggedUser.textContent = `Bejelentkezve: ${state.user.email}`;
    el.loggedUser.classList.remove("hidden");
    el.loginBtn.classList.add("hidden");
    el.logoutBtn.classList.remove("hidden");
    el.homeBtn.classList.remove("hidden");
  } else {
    el.loggedUser.classList.add("hidden");
    el.loginBtn.classList.remove("hidden");
    el.logoutBtn.classList.add("hidden");
    el.homeBtn.classList.add("hidden");
    showHome();
  }
}

function openFirstMessageModal(report, isReply = false) {
  if (!state.user) return alert("Előbb jelentkezz be.");
  state.currentReportForMessage = report;
  el.messageBody.value = "";
  document.getElementById("messageModalTitle").textContent = isReply ? "Válasz üzenet" : "Első kapcsolatfelvétel";
  el.messageModal.classList.remove("hidden");
}

async function sendMessageFromModal() {
  if (!supabaseClient) return;
  const body = el.messageBody.value.trim();
  if (!body || !state.currentReportForMessage || !state.user) return;

  const targetUser = String(state.currentReportForMessage.user_id);
  const { error } = await supabaseClient.from("uzenetek").insert([{
    from_user_id: state.user.id,
    to_user_id: targetUser,
    report_id: Number(state.currentReportForMessage.id),
    body,
  }]);
  if (error) return alert("Üzenet mentési hiba.");

  el.messageModal.classList.add("hidden");
  await refreshProfileData();
}

function initFilters() {
  document.querySelectorAll(".filter-cat").forEach((btn) => {
    const cat = btn.dataset.cat;
    state.activeCategories.add(cat);
    btn.addEventListener("click", () => {
      if (state.activeCategories.has(cat)) {
        state.activeCategories.delete(cat);
        btn.classList.remove("active");
      } else {
        state.activeCategories.add(cat);
        btn.classList.add("active");
      }
      updateVisibleItems();
      renderMapMarkers();
    });
  });

  document.getElementById("filterTalaltam").addEventListener("click", function () {
    this.classList.toggle("active");
    state.activeTypes.has("talalt") ? state.activeTypes.delete("talalt") : state.activeTypes.add("talalt");
    updateVisibleItems();
    renderMapMarkers();
  });

  document.getElementById("filterKeresem").addEventListener("click", function () {
    this.classList.toggle("active");
    state.activeTypes.has("keresett") ? state.activeTypes.delete("keresett") : state.activeTypes.add("keresett");
    updateVisibleItems();
    renderMapMarkers();
  });
}

function initReportFlow() {
  el.foundBtn.addEventListener("click", () => {
    if (!state.user) {
      renderAuthModal("choice");
      el.modal.classList.remove("hidden");
      el.modal.classList.add("show");
      return;
    }
    state.reportType = "talaltam";
    el.bejelentesBox.classList.remove("hidden");
    el.kategoriaModal.classList.remove("hidden");
  });

  el.lostBtn.addEventListener("click", () => {
    if (!state.user) {
      renderAuthModal("choice");
      el.modal.classList.remove("hidden");
      el.modal.classList.add("show");
      return;
    }
    state.reportType = "keresem";
    el.bejelentesBox.classList.remove("hidden");
    el.kategoriaModal.classList.remove("hidden");
  });

  document.querySelectorAll(".kat-valaszto-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCategory = btn.textContent.trim();
      el.kategoriaModal.classList.add("hidden");
      el.valasztoModal.classList.remove("hidden");
      el.valasztoModal.classList.add("show");
    });
  });

  document.getElementById("modalUtcaBtn").addEventListener("click", () => {
    state.pendingLocationType = "utca";
    el.valasztoModal.classList.add("hidden");
    el.datumModal.classList.remove("hidden");
    initializeDatePicker();
  });

  document.getElementById("modalJarmuBtn").addEventListener("click", () => {
    state.pendingLocationType = "jarmu";
    el.valasztoModal.classList.add("hidden");
    el.datumModal.classList.remove("hidden");
    initializeDatePicker();
  });

  document.getElementById("datumModalOkBtn").addEventListener("click", () => {
    el.datumModal.classList.add("hidden");
    el.helyModal.classList.remove("hidden");
  });

  document.getElementById("helyModalOkBtn").addEventListener("click", () => {
    el.helyModal.classList.add("hidden");
  });

  map.on("click", (e) => {
    if (!state.user || !state.reportType || !state.selectedCategory) return;
    state.pendingCoords = e.latlng;
    if (state.pendingMarker) {
      map.removeLayer(state.pendingMarker);
    }
    state.pendingMarker = L.marker(e.latlng).addTo(map);
    state.pendingMarker.bindPopup("Kijelölt hely").openPopup();
    el.markerForm.classList.remove("hidden");
    if (state.pendingLocationType === "jarmu") el.routeBox.classList.remove("hidden");
    else el.routeBox.classList.add("hidden");
  });

  document.getElementById("saveBtn").addEventListener("click", saveReport);
  document.querySelector(".back-btn").addEventListener("click", () => {
    resetReportFlow();
  });
}

function initializeDatePicker() {
  const yearSelect = document.getElementById("selectYear");
  const monthSelect = document.getElementById("selectMonth");
  const daySelect = document.getElementById("selectDay");
  const dayOfWeek = document.getElementById("dayOfWeek");
  const today = new Date();
  const y = today.getFullYear();

  yearSelect.innerHTML = `<option value="${y}">${y}</option>`;
  monthSelect.innerHTML = "";
  for (let m = today.getMonth(); m >= 0; m--) {
    const monthName = new Date(y, m).toLocaleString("hu-HU", { month: "long" });
    monthSelect.innerHTML += `<option value="${m}">${monthName}</option>`;
  }

  const updateDays = () => {
    const year = Number(yearSelect.value);
    const month = Number(monthSelect.value);
    const maxDay = month === today.getMonth() ? today.getDate() : new Date(year, month + 1, 0).getDate();
    daySelect.innerHTML = "";
    for (let d = maxDay; d >= 1; d--) daySelect.innerHTML += `<option value="${d}">${d}</option>`;
    const date = new Date(year, month, Number(daySelect.value));
    const dayName = date.toLocaleDateString("hu-HU", { weekday: "long" });
    dayOfWeek.textContent = dayName[0].toUpperCase() + dayName.slice(1);
  };

  yearSelect.onchange = updateDays;
  monthSelect.onchange = updateDays;
  daySelect.onchange = updateDays;
  updateDays();
}

function bindMenu() {
  el.loginBtn.addEventListener("click", () => {
    renderAuthModal("choice");
    el.modal.classList.remove("hidden");
    el.modal.classList.add("show");
  });

  el.logoutBtn.addEventListener("click", async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    state.user = null;
    await hydrateAuth();
  });

  el.homeBtn.addEventListener("click", showHome);
  el.myReportsBtn.addEventListener("click", showProfile);
  el.myMessagesBtn.addEventListener("click", showProfile);

  el.sendFirstMessageBtn.addEventListener("click", sendMessageFromModal);
  el.cancelFirstMessageBtn.addEventListener("click", () => el.messageModal.classList.add("hidden"));
}

async function init() {
  bindMenu();
  initFilters();
  initReportFlow();

  state.supabaseOnline = await checkSupabaseConnection();
  await hydrateAuth();
  await loadReports();
}

init();
