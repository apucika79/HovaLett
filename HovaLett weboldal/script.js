// Egyszerű tesztfelhasználó (memóriában)
const testUser = {
  email: "a@a.hu",
  password: "a",
  name: "Teszt Elek"
};
let loggedInUser = null;
let isLoggedIn = false;
let bejelentesTipus = "";
let ideiglenesMarker = null;
let selectedCategory = "";
let helyValasztasKesz = false;



const greenBusIcon = L.icon({
  iconUrl: 'bus-green.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35]
});

const redBusIcon = L.icon({
  iconUrl: 'bus-red.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -35]
});

const map = L.map('map').setView([47.4979, 19.0402], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap közreműködők',
}).addTo(map);

const activeTypes = new Set(['talaltam', 'keresem']);
const activeCategories = new Set(['Telefon', 'Kulcs', 'Pénztárca', 'Hátizsák', 'Szemüveg', 'Kisállat', 'Kabát', 'Egyéb']);
const allReports = [];

function updateVisibleItems() {
  const reportItems = document.getElementById('reportItems');
  reportItems.innerHTML = '';
  allReports.forEach(item => {
    if (
      (activeTypes.size === 0 || activeTypes.has(item.type)) &&
      (activeCategories.size === 0 || activeCategories.has(item.category))
    ) {
      const card = document.createElement('div');
      card.className = 'report-card';
      card.innerHTML = item.html;
      reportItems.appendChild(card);
    }
  });
}

function toggleFilter(button, set, value) {
  if (set.has(value)) {
    set.delete(value);
    button.classList.remove('active');
  } else {
    set.add(value);
    button.classList.add('active');
  }
  updateVisibleItems();
}

document.getElementById('filterTalaltam').addEventListener('click', function () {
  toggleFilter(this, activeTypes, 'talaltam');
});
document.getElementById('filterKeresem').addEventListener('click', function () {
  toggleFilter(this, activeTypes, 'keresem');
});

document.querySelectorAll('.filter-cat').forEach(btn => {
  btn.addEventListener('click', function () {
    const cat = this.getAttribute('data-cat');
    toggleFilter(this, activeCategories, cat);
  });
});

document.getElementById('foundBtn').addEventListener('click', () => {
  if (!isLoggedIn) {
    document.getElementById('modal').classList.add('show');
    return;
  }
  bejelentesTipus = "talaltam";
  document.getElementById('foundBtn').style.display = "none";
  document.getElementById('lostBtn').style.display = "none";
  document.getElementById('valasztoBox').classList.remove('hidden');
});

document.getElementById('lostBtn').addEventListener('click', () => {
  if (!isLoggedIn) {
    document.getElementById('modal').classList.add('show');
    return;
  }
  bejelentesTipus = "keresem";
  document.getElementById('foundBtn').style.display = "none";
  document.getElementById('lostBtn').style.display = "none";
  document.getElementById('valasztoBox').classList.remove('hidden');
});


document.getElementById('utcaBtn').addEventListener('click', () => {
  bejelentesTipus += "_utca";
  document.getElementById('valasztoBox').classList.add('hidden');
  document.getElementById('bejelentesBox').classList.remove('hidden');
});

document.getElementById('jarmuBtn').addEventListener('click', () => {
  bejelentesTipus += "_jarmu";
  document.getElementById('valasztoBox').classList.add('hidden');
  document.getElementById('bejelentesBox').classList.remove('hidden');
});

document.querySelector('.back-btn').addEventListener('click', () => {
  document.getElementById('foundBtn').style.display = "inline-block";
  document.getElementById('lostBtn').style.display = "inline-block";
  document.getElementById('bejelentesBox').classList.add('hidden');
  document.getElementById('valasztoBox').classList.add('hidden');
});

document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!isLoggedIn) {
      document.getElementById('modal').classList.add('show');
    }
  });
});

document.getElementById('loginBtn').addEventListener('click', () => {
  const modalContent = document.querySelector('.modal-content');
  modalContent.innerHTML = `
  <h3>Bejelentkezés</h3>
  <input type="email" id="loginEmail" placeholder="Email cím"><br><br>
  <input type="password" id="loginPassword" placeholder="Jelszó"><br><br>
  <button id="submitLoginBtn" class="standard-btn">Bejelentkezés</button><br>
  <button class="social-login facebook">Facebook</button>
  <button class="social-login google">Google</button><br><br>
  <button id="backToChoiceBtn" class="standard-btn">Vissza</button>
`;


  // Vissza a fő modal nézetre
  document.getElementById('backToChoiceBtn').addEventListener('click', () => {
    location.reload();
  });

  // ⬇ Itt jön a valódi bejelentkezési logika:
  document.getElementById('submitLoginBtn').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (email === testUser.email && password === testUser.password) {
  isLoggedIn = true;
  loggedInUser = testUser;

  document.getElementById('modal').classList.remove('show');
  document.getElementById('kategoriavalasztoModal').classList.remove('hidden');


  document.getElementById('loggedUser').textContent = "Bejelentkezve: " + loggedInUser.name;
  document.getElementById('loggedUser').classList.remove('hidden');
  document.getElementById('menuLoginBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');

  document.getElementById('foundBtn').style.display = "none";
  document.getElementById('lostBtn').style.display = "none";
} else {
  alert("Hibás e-mail vagy jelszó.");
}

  });
});


document.getElementById('registerBtn').addEventListener('click', () => {
  const modalContent = document.querySelector('.modal-content');
  modalContent.innerHTML = `
    <h3>Regisztráció</h3>
    <input type="text" id="regName" placeholder="Teljes név"><br><br>
    <input type="email" id="regEmail" placeholder="Email cím"><br><br>
    <input type="password" id="regPassword" placeholder="Jelszó"><br><br>
    <button id="submitRegisterBtn">Regisztráció</button><br><br>
    <button class="social-login facebook">Facebook</button>
    <button class="social-login google">Google</button><br><br>
    <button id="backToChoiceBtn">Vissza</button>
  `;

  // Visszalépés az eredeti kétgombos nézethez
  document.getElementById('backToChoiceBtn').addEventListener('click', () => {
    location.reload(); // újratöltés
  });
});


function sikeresBelepes() {
  isLoggedIn = true;
  loggedInUser = testUser;
  document.getElementById('modal').classList.remove('show');

  document.getElementById('loggedUser').textContent = "Bejelentkezve: " + loggedInUser.name;
  document.getElementById('loggedUser').classList.remove('hidden');
  document.getElementById('menuLoginBtn').classList.add('hidden');
  document.getElementById('logoutBtn').classList.remove('hidden');
  
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  isLoggedIn = false;
  loggedInUser = null;

  document.getElementById('loggedUser').classList.add('hidden');
  document.getElementById('menuLoginBtn').classList.remove('hidden');
  document.getElementById('logoutBtn').classList.add('hidden');

  // visszaállítás a főoldalra
  document.getElementById('valasztoBox').classList.add('hidden');
  document.getElementById('bejelentesBox').classList.add('hidden');
  document.getElementById('foundBtn').style.display = "inline-block";
  document.getElementById('lostBtn').style.display = "inline-block";
});


map.on('click', function (e) {
  if (!isLoggedIn) {
    alert("Kérlek, előbb jelentkezz be!");
    return;
  }

  const { lat, lng } = e.latlng;
  let icon = null;

  if (bejelentesTipus.includes("jarmu")) {
    icon = bejelentesTipus.includes("talaltam") ? greenBusIcon : redBusIcon;
    document.getElementById('járatBox').classList.remove('hidden');
  } else {
    document.getElementById('járatBox').classList.add('hidden');
  }

  if (ideiglenesMarker) {
    map.removeLayer(ideiglenesMarker);
  }

  ideiglenesMarker = icon ? L.marker([lat, lng], { icon }).addTo(map) : L.marker([lat, lng]).addTo(map);
  ideiglenesMarker.bindPopup("Bejelentés folyamatban...").openPopup();
  document.getElementById('markerForm').classList.remove('hidden');
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const desc = document.getElementById('descriptionInput').value;
  const contact = document.getElementById('contactInput').value;
  const route = document.getElementById('routeInput').value;
  const tipusSzoveg = bejelentesTipus.includes("talaltam") ? "<span style='color:green;font-weight:bold'>Találtam</span>" : "<span style='color:red;font-weight:bold'>Keresem</span>";
  const kategoriaSzoveg = selectedCategory || "Ismeretlen";


  const html = `
    <div class="report-card">
      ${tipusSzoveg} – ${kategoriaSzoveg}<br>
      <strong>Leírás:</strong> ${desc || '–'}<br>
      ${contact ? `<strong>Kapcsolat:</strong> ${contact}<br>` : ''}
      ${bejelentesTipus.includes("jarmu") && route ? `<strong>Járat:</strong> ${route}<br>` : ''}
      <br><button class="claim-btn">Ez az enyém</button>
    </div>
  `;

  allReports.unshift({ html, type: bejelentesTipus.includes("talaltam") ? "talaltam" : "keresem", category: kategoriaSzoveg });
  updateVisibleItems();


  document.getElementById('markerForm').classList.add('hidden');
  document.getElementById('photoInput').value = "";
  document.getElementById('descriptionInput').value = "";
  document.getElementById('contactInput').value = "";
  document.getElementById('routeInput').value = "";
  ideiglenesMarker = null;
});

updateVisibleItems();

document.getElementById('menuLoginBtn').addEventListener('click', () => {
  document.getElementById('modal').classList.add('show');
});

// Szinkronizálás a kezdéskor: ha van 'active' class, tegyük a Set-be
document.querySelectorAll('.filter-cat.active').forEach(btn => {
  const cat = btn.getAttribute('data-cat');
  activeCategories.add(cat);
});

document.addEventListener('click', function(event) {
  if (event.target.id === 'modalUtcaBtn') {
    bejelentesTipus = bejelentesTipus || "talaltam";
    bejelentesTipus += "_utca";
    document.getElementById('valasztoModal').classList.remove('show');
    initializeDatePicker();
    document.getElementById('datumModal').classList.remove('hidden');
  }

  if (event.target.id === 'modalJarmuBtn') {
    bejelentesTipus = bejelentesTipus || "talaltam";
    bejelentesTipus += "_jarmu";
    document.getElementById('valasztoModal').classList.remove('show');
    initializeDatePicker();
    document.getElementById('datumModal').classList.remove('hidden');
  }
});

document.getElementById('datumModalOkBtn').addEventListener('click', () => {
    helyValasztasKesz = true;
  document.getElementById('datumModal').classList.add('hidden');
  document.getElementById('helyModal').classList.remove('hidden');
});




document.getElementById('helyModalOkBtn').addEventListener('click', () => {
  document.getElementById('helyModal').classList.add('hidden');

  // Útmutatás megjelenítése, pl. alerttel vagy egy külön divvel
  

  // semmit ne nyissunk meg itt, mert a térképre kattintás után indul a markerForm
});


  // Dátumválasztó mezők feltöltése és nap meghatározás
const yearSelect = document.getElementById('selectYear');
const monthSelect = document.getElementById('selectMonth');
const daySelect = document.getElementById('selectDay');
const dayOfWeek = document.getElementById('dayOfWeek');

// Dátumfeltöltés 1 évre visszamenőleg
function initializeDatePicker() {
  const today = new Date();
  const currentYear = today.getFullYear();

  // Év: csak az aktuális év
  yearSelect.innerHTML = `<option value="${currentYear}">${currentYear}</option>`;

  // Hónap: csak a mai hónapig visszafelé
  const currentMonth = today.getMonth();
  monthSelect.innerHTML = '';
  for (let m = currentMonth; m >= 0; m--) {
    const monthName = new Date(currentYear, m).toLocaleString('hu-HU', { month: 'long' });
    monthSelect.innerHTML += `<option value="${m}">${monthName}</option>`;
  }

  updateDays(); // tölti a napokat és a hét napját is
}

function updateDays() {
  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  const today = new Date();
  const currentDay = today.getDate();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  daySelect.innerHTML = '';

  // Ha aktuális hónap, csak a mai napig visszamenőleg
  for (let d = currentDay; d >= 1; d--) {
    daySelect.innerHTML += `<option value="${d}">${d}</option>`;
  }

  updateDayOfWeek();
}

function updateDayOfWeek() {
  const year = parseInt(yearSelect.value);
  const month = parseInt(monthSelect.value);
  const day = parseInt(daySelect.value);
  const date = new Date(year, month, day);

  const dayName = date.toLocaleDateString('hu-HU', { weekday: 'long' });
  dayOfWeek.textContent = dayName.charAt(0).toUpperCase() + dayName.slice(1);
}

// eseménykezelők a dátum módosításához
yearSelect.addEventListener('change', updateDays);
monthSelect.addEventListener('change', updateDays);
daySelect.addEventListener('change', updateDayOfWeek);

document.querySelectorAll('.kat-valaszto-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedCategory = btn.textContent.trim();

    document.getElementById('kategoriavalasztoModal').classList.add('hidden');

    // Ha még nincs eldöntve, hogy utcán vagy járművön találták, akkor most kérdezzük meg
    if (!bejelentesTipus.includes("_")) {
      document.getElementById('valasztoModal').classList.remove('hidden');
      document.getElementById('valasztoModal').classList.add('show');
    } else {
      initializeDatePicker();
      document.getElementById('datumModal').classList.remove('hidden');
    }
  });
});



document.getElementById('modalUtcaBtn').addEventListener('click', () => {
  if (!bejelentesTipus.includes("_")) {
    bejelentesTipus += "_utca";
  }
  document.getElementById('valasztoModal').classList.remove('show');
  initializeDatePicker();
  document.getElementById('datumModal').classList.remove('hidden');
});

document.getElementById('modalJarmuBtn').addEventListener('click', () => {
  if (!bejelentesTipus.includes("_")) {
    bejelentesTipus += "_jarmu";
  }
  document.getElementById('valasztoModal').classList.remove('show');
  initializeDatePicker();
  document.getElementById('datumModal').classList.remove('hidden');
});



