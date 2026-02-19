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
  reportDateTime: null,
  currentReportForMessage: null,
  supabaseOnline: false,
  viewMode: "home",
  imageViewer: {
    urls: [],
    index: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  },
  reportFocus: {
    reportId: null,
    marker: null,
    previousView: null,
  },
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

const defaultMarkerIconConfig = {
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  shadowSize: [41, 41],
};

function createDefaultMarkerIcon(colorHex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="${colorHex}" stroke="#ffffff" stroke-width="2" d="M12.5 1C6.2 1 1.1 6.1 1.1 12.4c0 8.8 11.4 27.6 11.4 27.6s11.4-18.8 11.4-27.6C23.9 6.1 18.8 1 12.5 1Z"/><circle cx="12.5" cy="12.4" r="4.7" fill="#ffffff"/></svg>`;
  return L.icon({ iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, ...defaultMarkerIconConfig });
}

const greenDefaultIcon = createDefaultMarkerIcon("#2e7d32");
const redDefaultIcon = createDefaultMarkerIcon("#c62828");

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
  messageModalCloseBtn: document.getElementById("messageModalCloseBtn"),
  reportManageModal: document.getElementById("reportManageModal"),
  reportManageModalCloseBtn: document.getElementById("reportManageModalCloseBtn"),
  reportManageDetails: document.getElementById("reportManageDetails"),
  openManageActionsBtn: document.getElementById("openManageActionsBtn"),
  manageActionsPanel: document.getElementById("manageActionsPanel"),
  manageReportTitleInput: document.getElementById("manageReportTitleInput"),
  manageReportDescInput: document.getElementById("manageReportDescInput"),
  saveManageChangesBtn: document.getElementById("saveManageChangesBtn"),
  deleteReportBtn: document.getElementById("deleteReportBtn"),
  imageViewerModal: document.getElementById("imageViewerModal"),
  imageStage: document.getElementById("imageStage"),
  imageViewerImg: document.getElementById("imageViewerImg"),
  imageCounter: document.getElementById("imageCounter"),
  imagePrevBtn: document.getElementById("imagePrevBtn"),
  imageNextBtn: document.getElementById("imageNextBtn"),
  imageViewerCloseBtn: document.getElementById("imageViewerCloseBtn"),
  reportDetailModal: document.getElementById("reportDetailModal"),
  reportDetailBody: document.getElementById("reportDetailBody"),
  reportDetailCloseBtn: document.getElementById("reportDetailCloseBtn"),
};

let selectedOwnReport = null;
const markerByReportId = new Map();

function stopFocusedReportJump() {
  const { marker, previousView } = state.reportFocus;
  if (!marker) return;

  const markerElement = marker.getElement?.();
  if (markerElement) markerElement.classList.remove("is-pulsing-marker");

  if (previousView && Array.isArray(previousView.center)) {
    map.setView(previousView.center, previousView.zoom, { animate: true });
  }

  state.reportFocus.reportId = null;
  state.reportFocus.marker = null;
  state.reportFocus.previousView = null;
}

function isMarkerInteractionTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(".leaflet-marker-icon, .leaflet-popup, .leaflet-control"));
}

function focusReportOnMap(reportId) {
  const marker = markerByReportId.get(reportId);
  if (!marker) return false;

  if (state.reportFocus.marker && state.reportFocus.reportId !== reportId) {
    const oldMarkerElement = state.reportFocus.marker.getElement?.();
    if (oldMarkerElement) oldMarkerElement.classList.remove("is-pulsing-marker");
  }

  state.reportFocus.reportId = reportId;
  state.reportFocus.marker = marker;
  state.reportFocus.previousView = {
    center: [map.getCenter().lat, map.getCenter().lng],
    zoom: map.getZoom(),
  };

  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 16), { duration: 0.6 });

  const markerElement = marker.getElement?.();
  if (markerElement) markerElement.classList.add("is-pulsing-marker");

  return true;
}

function setInfo(text) {
  const target = document.getElementById("supabaseStatus");
  if (target) target.textContent = text;
}

function hideFlowModals() {
  [el.kategoriaModal, el.valasztoModal, el.datumModal, el.helyModal].forEach((modal) => {
    modal.classList.add("hidden");
    modal.classList.remove("show");
  });
}

function resetReportFlow() {
  state.pendingCoords = null;
  if (state.pendingMarker) {
    map.removeLayer(state.pendingMarker);
    state.pendingMarker = null;
  }
  state.pendingLocationType = null;
  state.reportDateTime = null;
  state.selectedCategory = null;
  state.reportType = null;
  el.routeInput.value = "";
  el.descriptionInput.value = "";
  el.contactInput.value = "";
  el.photoInput.value = "";
  el.routeBox.classList.add("hidden");
  el.markerForm.classList.add("hidden");
  el.bejelentesBox.classList.add("hidden");
  hideFlowModals();
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

function getReportsForCurrentView() {
  if (state.viewMode === "myReports") {
    if (!state.user) return [];
    return state.reports.filter((report) => report.user_id === state.user.id);
  }

  return state.reports.filter(isReportVisible);
}

function updateVisibleItems() {
  el.reportItems.innerHTML = "";
  const visibleReports = getReportsForCurrentView();
  visibleReports.forEach((report) => {
    const isHomeView = state.viewMode === "home";
    const card = document.createElement("div");
    card.className = "report-card";
    if (isHomeView) card.classList.add("home-report-item");
    card.innerHTML = reportCardHtml(report, { includeDescription: !isHomeView, includeDetailButton: isHomeView });
    if (state.viewMode === "myReports") {
      card.classList.add("my-report-item");
      card.addEventListener("click", () => openManageReportModal(report));
    } else if (isHomeView) {
      const detailBtn = card.querySelector("[data-focus-report]");
      detailBtn?.addEventListener("click", () => {
        focusReportOnMap(report.id);
      });
    }
    el.reportItems.appendChild(card);
  });

  if (visibleReports.length === 0) {
    el.reportItems.innerHTML = state.viewMode === "myReports"
      ? "<p>Még nincs saját bejelentésed.</p>"
      : "<p>Nincs a szűrőknek megfelelő tárgy. Kapcsold be több kategóriát vagy típust.</p>";
  }
}

function openManageReportModal(report) {
  if (!report || !state.user || report.user_id !== state.user.id) return;
  selectedOwnReport = report;
  el.reportManageDetails.innerHTML = reportCardHtml(report);
  el.manageActionsPanel.classList.add("hidden");
  el.manageReportTitleInput.value = report.cim || "";
  el.manageReportDescInput.value = report.leiras || "";
  el.reportManageModal.classList.remove("hidden");
}

function closeManageReportModal() {
  selectedOwnReport = null;
  el.reportManageModal.classList.add("hidden");
  el.manageActionsPanel.classList.add("hidden");
}

async function handleSaveReportChanges() {
  if (!selectedOwnReport || !supabaseClient || !state.user) return;
  const newTitle = el.manageReportTitleInput.value.trim();
  const newDesc = el.manageReportDescInput.value.trim();

  const { error } = await supabaseClient
    .from("bejelentesek")
    .update({ cim: newTitle || "Utcán/épületben", leiras: newDesc })
    .eq("id", selectedOwnReport.id)
    .eq("user_id", state.user.id);

  if (error) {
    alert(`Módosítás sikertelen: ${error.message}`);
    return;
  }

  await loadReports();
  await refreshProfileData();
  closeManageReportModal();
  alert("Bejelentés sikeresen módosítva.");
}

async function handleDeleteReport() {
  if (!selectedOwnReport || !supabaseClient || !state.user) return;
  const ok = window.confirm("Biztosan törlöd ezt a bejelentést?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("bejelentesek")
    .delete()
    .eq("id", selectedOwnReport.id)
    .eq("user_id", state.user.id);

  if (error) {
    alert(`Törlés sikertelen: ${error.message}`);
    return;
  }

  await loadReports();
  await refreshProfileData();
  closeManageReportModal();
  alert("Bejelentés törölve.");
}

function reportCardHtml(report, options = {}) {
  const { includeDescription = true, includeDetailButton = false } = options;
  const imageUrls = getImageUrls(report.image_url);
  const descriptionRow = includeDescription
    ? `<strong>Leírás:</strong> ${report.leiras || "-"}<br>`
    : "";
  const detailButton = includeDetailButton
    ? `<button type="button" class="report-details-btn" data-focus-report="${report.id}">Részletek</button>`
    : "";

  return `
    <strong style="color:${report.tipus === "talalt" ? "green" : "#c62828"}">${typeToLabel[report.tipus] || report.tipus}</strong> – ${report.kategoria}<br>
    <small>${new Date(report.created_at).toLocaleString("hu-HU")}</small><br>
    <strong>Cím:</strong> ${report.cim || "-"}<br>
    ${descriptionRow}
    ${detailButton}
  `;
}

function getImageUrls(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue.filter(Boolean);

  const normalized = String(rawValue).trim();
  if (!normalized) return [];

  if (normalized.startsWith("[")) {
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return [];
    }
  }

  return normalized.split(",").map((url) => url.trim()).filter(Boolean);
}

function closeImageViewer() {
  el.imageViewerModal.classList.add("hidden");
  el.imageViewerImg.src = "";
}

function renderImageViewer() {
  const { urls, index, zoom, offsetX, offsetY } = state.imageViewer;
  if (!urls.length) return;

  el.imageViewerImg.src = urls[index];
  el.imageViewerImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`;
  el.imageCounter.textContent = `${index + 1} / ${urls.length}`;
  el.imagePrevBtn.disabled = urls.length <= 1;
  el.imageNextBtn.disabled = urls.length <= 1;
}

function clampImageOffset() {
  const stageRect = el.imageStage.getBoundingClientRect();
  const imageRect = el.imageViewerImg.getBoundingClientRect();
  const zoom = state.imageViewer.zoom;
  if (!stageRect.width || !stageRect.height || !imageRect.width || !imageRect.height) return;

  const naturalWidth = imageRect.width / zoom;
  const naturalHeight = imageRect.height / zoom;
  const scaledWidth = naturalWidth * zoom;
  const scaledHeight = naturalHeight * zoom;
  const maxOffsetX = Math.max((scaledWidth - stageRect.width) / 2, 0);
  const maxOffsetY = Math.max((scaledHeight - stageRect.height) / 2, 0);

  state.imageViewer.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, state.imageViewer.offsetX));
  state.imageViewer.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, state.imageViewer.offsetY));
}

function setImageZoom(nextZoom, center = null) {
  const previousZoom = state.imageViewer.zoom;
  const clampedZoom = Math.min(3, Math.max(1, nextZoom));
  if (Math.abs(clampedZoom - previousZoom) < 0.001) return;

  if (center && previousZoom > 0) {
    const ratio = clampedZoom / previousZoom;
    state.imageViewer.offsetX = (state.imageViewer.offsetX - center.x) * ratio + center.x;
    state.imageViewer.offsetY = (state.imageViewer.offsetY - center.y) * ratio + center.y;
  }

  state.imageViewer.zoom = clampedZoom;
  if (clampedZoom <= 1) {
    state.imageViewer.offsetX = 0;
    state.imageViewer.offsetY = 0;
  }

  clampImageOffset();
  renderImageViewer();
}

function openImageViewer(urls, startIndex = 0) {
  if (!urls?.length) return;
  state.imageViewer.urls = urls;
  state.imageViewer.index = startIndex;
  state.imageViewer.zoom = 1;
  state.imageViewer.offsetX = 0;
  state.imageViewer.offsetY = 0;
  renderImageViewer();
  el.imageViewerModal.classList.remove("hidden");
}

function setupImageViewerEvents() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".open-image-btn");
    if (!trigger) return;
    const raw = trigger.dataset.images;
    if (!raw) return;
    let urls = [];
    try {
      urls = JSON.parse(decodeURIComponent(raw));
    } catch {
      return;
    }
    openImageViewer(urls, 0);
  });

  el.imageViewerCloseBtn.addEventListener("click", closeImageViewer);

  el.reportDetailCloseBtn.addEventListener("click", closeReportDetailModal);
  el.imageViewerModal.addEventListener("click", (event) => {
    if (event.target === el.imageViewerModal) closeImageViewer();
  });

  el.imagePrevBtn.addEventListener("click", () => {
    const { urls, index } = state.imageViewer;
    if (urls.length <= 1) return;
    state.imageViewer.index = (index - 1 + urls.length) % urls.length;
    state.imageViewer.zoom = 1;
    state.imageViewer.offsetX = 0;
    state.imageViewer.offsetY = 0;
    renderImageViewer();
  });

  el.imageNextBtn.addEventListener("click", () => {
    const { urls, index } = state.imageViewer;
    if (urls.length <= 1) return;
    state.imageViewer.index = (index + 1) % urls.length;
    state.imageViewer.zoom = 1;
    state.imageViewer.offsetX = 0;
    state.imageViewer.offsetY = 0;
    renderImageViewer();
  });


  el.imageStage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 0.2 : -0.2;
    const stageRect = el.imageStage.getBoundingClientRect();
    setImageZoom(state.imageViewer.zoom + direction, {
      x: event.clientX - stageRect.left - stageRect.width / 2,
      y: event.clientY - stageRect.top - stageRect.height / 2,
    });
  });

  const activePointers = new Map();
  let lastPanPoint = null;
  let pinchDistance = 0;
  let pinchZoomStart = 1;

  function pointerCenterOffset() {
    const points = [...activePointers.values()];
    const centerX = (points[0].clientX + points[1].clientX) / 2;
    const centerY = (points[0].clientY + points[1].clientY) / 2;
    const stageRect = el.imageStage.getBoundingClientRect();
    return {
      x: centerX - stageRect.left - stageRect.width / 2,
      y: centerY - stageRect.top - stageRect.height / 2,
    };
  }

  function pointerDistance() {
    const points = [...activePointers.values()];
    return Math.hypot(points[0].clientX - points[1].clientX, points[0].clientY - points[1].clientY);
  }

  el.imageStage.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    el.imageStage.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size === 1) {
      lastPanPoint = { x: event.clientX, y: event.clientY };
    }

    if (activePointers.size === 2) {
      pinchDistance = pointerDistance();
      pinchZoomStart = state.imageViewer.zoom;
      lastPanPoint = null;
    }
  });

  el.imageStage.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    event.preventDefault();
    activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.size === 2) {
      const distance = pointerDistance();
      if (pinchDistance > 0) {
        setImageZoom((distance / pinchDistance) * pinchZoomStart, pointerCenterOffset());
      }
      return;
    }

    if (activePointers.size === 1 && state.imageViewer.zoom > 1 && lastPanPoint) {
      state.imageViewer.offsetX += event.clientX - lastPanPoint.x;
      state.imageViewer.offsetY += event.clientY - lastPanPoint.y;
      lastPanPoint = { x: event.clientX, y: event.clientY };
      clampImageOffset();
      renderImageViewer();
    }
  });

  function clearPointer(event) {
    activePointers.delete(event.pointerId);
    if (activePointers.size === 1) {
      const remaining = [...activePointers.values()][0];
      lastPanPoint = { x: remaining.clientX, y: remaining.clientY };
    } else {
      lastPanPoint = null;
      pinchDistance = 0;
    }
  }

  el.imageStage.addEventListener("pointerup", clearPointer);
  el.imageStage.addEventListener("pointercancel", clearPointer);
}

function reportDetailHtml(report) {
  const imageUrls = getImageUrls(report.image_url);
  const imageRibbon = imageUrls.length > 0
    ? `<div class="popup-image-ribbon">${imageUrls.map((url, index) => `<button class="popup-thumb-btn" data-popup-image-report="${report.id}" data-image-index="${index}" type="button"><img src="${url}" alt="Bejelentés kép ${index + 1}"></button>`).join("")}</div>`
    : '<p class="popup-no-image">Ehhez a bejelentéshez nincs feltöltött kép.</p>';

  const reportButton = `<button class="modal-secondary-btn popup-action-btn" data-report-issue="${report.id}" type="button">Jelentés</button>`;
  const msgButton = state.user && state.user.id !== report.user_id
    ? `<button class="claim-btn popup-action-btn" data-message-report="${report.id}" type="button">Üzenetküldés</button>`
    : `<button class="claim-btn popup-action-btn" disabled type="button">Üzenetküldés</button>`;

  return `
    <div class="marker-popup-content">
      ${reportCardHtml(report)}
      ${imageRibbon}
      <div class="popup-action-row">${reportButton}${msgButton}</div>
    </div>
  `;
}

function closeReportDetailModal() {
  el.reportDetailModal.classList.add("hidden");
  el.reportDetailBody.innerHTML = "";
}

function handleModalCloseButton(closeBtn) {
  if (!closeBtn) return;

  if (closeBtn.dataset.flowClose === "true") {
    resetReportFlow();
    return;
  }

  if (closeBtn.dataset.authClose === "true") {
    el.modal.classList.add("hidden");
    el.modal.classList.remove("show");
    return;
  }

  const parentModal = closeBtn.closest(".modal");
  if (!parentModal) return;

  if (parentModal === el.reportDetailModal) {
    closeReportDetailModal();
    return;
  }
  if (parentModal === el.imageViewerModal) {
    closeImageViewer();
    return;
  }
  if (parentModal === el.reportManageModal) {
    closeManageReportModal();
    return;
  }

  parentModal.classList.add("hidden");
  parentModal.classList.remove("show");
}

function bindGlobalCloseButtons() {
  const handleCloseEvent = (event) => {
    const closeBtn = event.target.closest(".modal-close-btn");
    if (!closeBtn) return;
    event.preventDefault();
    event.stopPropagation();
    handleModalCloseButton(closeBtn);
  };

  document.addEventListener("click", handleCloseEvent, true);
  document.addEventListener("pointerup", handleCloseEvent, true);
}

function openReportDetailModal(report) {
  el.reportDetailBody.innerHTML = reportDetailHtml(report);

  const messageBtn = el.reportDetailBody.querySelector(`[data-message-report="${report.id}"]`);
  if (messageBtn) {
    messageBtn.addEventListener("click", () => openFirstMessageModal(report));
  }

  const reportIssueBtn = el.reportDetailBody.querySelector(`[data-report-issue="${report.id}"]`);
  if (reportIssueBtn) {
    reportIssueBtn.addEventListener("click", () => {
      const accepted = window.confirm("Szeretnéd jelenteni ezt a bejelentést? A funkció véglegesítése folyamatban van.");
      if (accepted) alert("Köszönjük, a jelentésedet rögzítettük. Hamarosan véglegesítjük a teljes folyamatot.");
    });
  }

  el.reportDetailBody.querySelectorAll(`[data-popup-image-report="${report.id}"]`).forEach((thumbBtn) => {
    thumbBtn.addEventListener("click", () => {
      const imageUrls = getImageUrls(report.image_url);
      openImageViewer(imageUrls, Number(thumbBtn.dataset.imageIndex || 0));
    });
  });

  el.reportDetailModal.classList.remove("hidden");
}

function clearMarkers() {
  stopFocusedReportJump();
  markerByReportId.clear();
  state.markers.forEach((m) => map.removeLayer(m));
  state.markers = [];
}

function renderMapMarkers() {
  clearMarkers();
  getReportsForCurrentView().forEach((report) => {
    if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
    const icon = report.tipus === "talalt" ? greenDefaultIcon : redDefaultIcon;
    const marker = L.marker([report.lat, report.lng], { icon });
    marker.on("click", () => openReportDetailModal(report));
    marker.addTo(map);
    state.markers.push(marker);
    markerByReportId.set(report.id, marker);
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
  state.viewMode = "home";
  const reportPanelTitle = document.getElementById("reportPanelTitle");
  if (reportPanelTitle) reportPanelTitle.textContent = "Legfrissebb jelentések";
  el.profileView.classList.add("hidden");
  el.mainContainer.classList.remove("hidden");
  el.bejelentesBox.classList.add("hidden");
  updateVisibleItems();
  renderMapMarkers();
}

function showMyReports() {
  if (!state.user) {
    renderAuthModal("choice");
    el.modal.classList.remove("hidden");
    el.modal.classList.add("show");
    return;
  }

  state.viewMode = "myReports";
  const reportPanelTitle = document.getElementById("reportPanelTitle");
  if (reportPanelTitle) reportPanelTitle.textContent = "Legfrissebb jelentéseim";
  el.profileView.classList.add("hidden");
  el.mainContainer.classList.remove("hidden");
  el.bejelentesBox.classList.add("hidden");
  updateVisibleItems();
  renderMapMarkers();
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
    created_at: (state.reportDateTime || new Date()).toISOString(),
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
      <button class="modal-close-btn" data-auth-close="true" aria-label="Bezárás">✕</button>
      <p>Ehhez a művelethez regisztráció szükséges. Jelentkezz be vagy regisztrálj.</p>
      <div class="modal-actions">
        <button id="loginBtn" class="modal-primary-btn">Belépés</button>
        <button id="registerBtn" class="modal-secondary-btn">Regisztráció</button>
      </div>`;
    document.querySelector("[data-auth-close='true']").onclick = () => {
      el.modal.classList.add("hidden");
      el.modal.classList.remove("show");
    };
    document.getElementById("loginBtn").onclick = () => renderAuthModal("login");
    document.getElementById("registerBtn").onclick = () => renderAuthModal("register");
    return;
  }

  el.modalContent.innerHTML = `
    <button class="modal-close-btn" data-auth-close="true" aria-label="Bezárás">✕</button>
    <h3>${mode === "login" ? "Bejelentkezés" : "Regisztráció"}</h3>
    <input type="email" id="authEmail" placeholder="Email cím"><br><br>
    <input type="password" id="authPassword" placeholder="Jelszó"><br><br>
    <div class="modal-actions">
      <button id="authBackBtn" class="modal-secondary-btn">Vissza</button>
      <button id="authSubmitBtn" class="modal-primary-btn">${mode === "login" ? "Bejelentkezés" : "Regisztráció"}</button>
    </div>
  `;

  document.querySelector("[data-auth-close='true']").onclick = () => {
    el.modal.classList.add("hidden");
    el.modal.classList.remove("show");
  };

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
  const advanceToReportForm = () => {
    el.helyModal.classList.add("hidden");
    el.helyModal.classList.remove("show");
    el.bejelentesBox.classList.remove("hidden");
    el.markerForm.classList.remove("hidden");
    el.markerForm.scrollIntoView({ behavior: "smooth", block: "start" });
    if (state.pendingLocationType === "jarmu") el.routeBox.classList.remove("hidden");
    else el.routeBox.classList.add("hidden");
  };

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
    if (isMarkerInteractionTarget(e.originalEvent?.target)) return;
    stopFocusedReportJump();
    if (!state.user || !state.reportType || !state.selectedCategory) return;
    state.pendingCoords = e.latlng;
    if (state.pendingMarker) {
      map.removeLayer(state.pendingMarker);
    }
    state.pendingMarker = L.marker(e.latlng).addTo(map);
    state.pendingMarker.bindPopup("Kijelölt hely").openPopup();
    advanceToReportForm();
  });

  document.querySelectorAll('[data-flow-close="true"]').forEach((btn) => {
    btn.addEventListener("click", resetReportFlow);
  });

  document.getElementById("kategoriaBackBtn").addEventListener("click", resetReportFlow);
  document.getElementById("valasztoBackBtn").addEventListener("click", () => {
    el.valasztoModal.classList.add("hidden");
    el.kategoriaModal.classList.remove("hidden");
  });
  document.getElementById("datumBackBtn").addEventListener("click", () => {
    el.datumModal.classList.add("hidden");
    el.valasztoModal.classList.remove("hidden");
  });
  document.getElementById("helyBackBtn").addEventListener("click", () => {
    el.helyModal.classList.add("hidden");
    el.datumModal.classList.remove("hidden");
  });

  document.getElementById("saveBtn").addEventListener("click", saveReport);
  document.querySelector(".back-btn").addEventListener("click", () => {
    resetReportFlow();
  });
}

function initializeDatePicker() {
  const dateInput = document.getElementById("reportDateInput");
  const timeInput = document.getElementById("reportTimeInput");
  const dayOfWeek = document.getElementById("dayOfWeek");
  const now = new Date();

  const currentDate = now.toISOString().slice(0, 10);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  dateInput.value = currentDate;
  dateInput.max = currentDate;
  timeInput.value = currentTime;

  const updateDateTime = () => {
    const selectedDate = dateInput.value || currentDate;
    const selectedTime = timeInput.value || currentTime;
    const date = new Date(`${selectedDate}T${selectedTime}`);
    state.reportDateTime = date;
    const dayName = date.toLocaleDateString("hu-HU", { weekday: "long" });
    dayOfWeek.textContent = dayName[0].toUpperCase() + dayName.slice(1);
  };

  dateInput.onchange = updateDateTime;
  timeInput.onchange = updateDateTime;
  updateDateTime();
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
  el.myReportsBtn.addEventListener("click", showMyReports);
  el.myMessagesBtn.addEventListener("click", showProfile);

  el.sendFirstMessageBtn.addEventListener("click", sendMessageFromModal);
  el.cancelFirstMessageBtn.addEventListener("click", () => el.messageModal.classList.add("hidden"));
  el.messageModalCloseBtn.addEventListener("click", () => el.messageModal.classList.add("hidden"));

  el.openManageActionsBtn.addEventListener("click", () => {
    el.manageActionsPanel.classList.remove("hidden");
  });
  el.reportManageModalCloseBtn.addEventListener("click", closeManageReportModal);
  el.saveManageChangesBtn.addEventListener("click", handleSaveReportChanges);
  el.deleteReportBtn.addEventListener("click", handleDeleteReport);
}

async function init() {
  bindMenu();
  initFilters();
  initReportFlow();
  setupImageViewerEvents();
  bindGlobalCloseButtons();

  state.supabaseOnline = await checkSupabaseConnection();
  await hydrateAuth();
  await loadReports();

  document.addEventListener("click", (event) => {
    if (!state.reportFocus.marker) return;
    const clickedReportCard = event.target.closest(".home-report-item");
    if (clickedReportCard) return;
    if (isMarkerInteractionTarget(event.target)) return;
    stopFocusedReportJump();
  });
}

init();
