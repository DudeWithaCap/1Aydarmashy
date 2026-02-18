let isEnabled = true;
let popup = null;
let dictionaryModal = null;
let wordListContainer = null;
let currentFilter = "all"; // / favorites

function getDictionary() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kk_dictionary"], (result) => {
      resolve(result.kk_dictionary || []);
    });
  });
}

function saveDictionary(data) {
  chrome.storage.local.set({ kk_dictionary: data });
}

async function translate(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=kk&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data[0][0][0];
}

function showPopup(text, translation, x, y) {
  if (popup) popup.remove();

  popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    background: #f1eee4e1;
    color: #111;
    padding: 12px 16px;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
    font-family: system-ui;
    z-index: 999999;
    max-width: 260px;
  `;

  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <strong>${text}</strong>
      <span id="closePopup" style="cursor:pointer">✕</span>
    </div>
    <div style="margin-top:6px;font-size:15px">${translation}</div>
  `;

  document.body.appendChild(popup);

  document.getElementById("closePopup").onclick = () => popup.remove();
  document.addEventListener("mousedown", removePopupOnClick);
}

function removePopupOnClick(e) {
  if (popup && !popup.contains(e.target)) {
    popup.remove();
    document.removeEventListener("mousedown", removePopupOnClick);
  }
}

document.addEventListener("mouseup", async (e) => {
  if (!isEnabled) return;

  const text = window.getSelection().toString().trim();
  if (!text) return;

  const translation = await translate(text);

  const dict = await getDictionary();
  dict.push({
    ru: text,
    kk: translation,
    date: new Date().toLocaleDateString(),
    favorite: false
  });
  saveDictionary(dict);

  showPopup(text, translation, e.clientX + 10, e.clientY + 10);
});

const toggleBtn = document.createElement("button");
toggleBtn.textContent = "🌐";
toggleBtn.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  padding: 10px;
  border-radius: 50%;
  border: none;
  background: #a4b6dc;
  color: white;
  cursor: pointer;
`;
toggleBtn.onclick = () => {
  isEnabled = !isEnabled;
  toggleBtn.style.opacity = isEnabled ? "1" : "0.4";
};
document.body.appendChild(toggleBtn);

const dictBtn = document.createElement("button");
dictBtn.textContent = "📘";
dictBtn.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 70px;
  z-index: 999999;
  padding: 10px;
  border-radius: 50%;
  border: none;
  background: #527bc7;
  color: white;
  cursor: pointer;
`;
dictBtn.onclick = openDictionary;
document.body.appendChild(dictBtn);

function openDictionary() {
  if (dictionaryModal) dictionaryModal.remove();

  dictionaryModal = document.createElement("div");
  dictionaryModal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 999998;
    display:flex;
    justify-content:center;
    align-items:center;
  `;

  const panel = document.createElement("div");
  panel.style.cssText = `
    background: #fff;
    width: 560px;
    max-height: 80vh;
    border-radius: 16px;
    padding: 20px;
    font-family: system-ui;
    display:flex;
    flex-direction:column;
  `;

  panel.innerHTML = `
    <h2 style="margin:0 0 10px">📘 Сөздік</h2>

    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button id="filterAll">Сөздік</button>
      <button id="filterFav">⭐ Таңдалған сөздер</button>
    </div>

    <input id="searchInput" placeholder="Сөздерді іздеу (RU / KZ)"
      style="padding:8px;border-radius:8px;border:1px solid #ddd;margin-bottom:12px"/>

    <div id="wordList"
      style="display:grid;grid-template-columns:1fr 1fr;gap:10px;overflow:auto">
    </div>
  `;

  dictionaryModal.appendChild(panel);
  document.body.appendChild(dictionaryModal);

  wordListContainer = panel.querySelector("#wordList");

  const searchInput = panel.querySelector("#searchInput");

  panel.querySelector("#filterAll").onclick = () => {
    currentFilter = "all";
    updateList(searchInput.value);
  };

  panel.querySelector("#filterFav").onclick = () => {
    currentFilter = "favorites";
    updateList(searchInput.value);
  };

  searchInput.addEventListener("input", () => {
    updateList(searchInput.value);
  });

  updateList("");

  dictionaryModal.onclick = (e) => {
    if (e.target === dictionaryModal) dictionaryModal.remove();
  };
}

async function updateList(query) {
  let words = await getDictionary();

  if (currentFilter === "favorites") {
    words = words.filter(w => w.favorite);
  }

  if (query) {
    const q = query.toLowerCase();
    words = words.filter(
      w => w.ru.toLowerCase().includes(q) || w.kk.toLowerCase().includes(q)
    );
  }

  renderWordList(words);
}

function renderWordList(words) {
  wordListContainer.innerHTML = "";

  if (words.length === 0) {
    wordListContainer.innerHTML = "<p>Ошибка</p>";
    return;
  }

  words.forEach((w, index) => {
    const card = document.createElement("div");
    card.style.cssText = `
      padding:10px;
      border:1px solid #e5e7eb;
      border-radius:10px;
      font-size:14px;
      position:relative;
    `;

    const star = document.createElement("span");
    star.textContent = w.favorite ? "⭐" : "☆";
    star.style.cssText = `
      position:absolute;
      top:8px;
      right:10px;
      cursor:pointer;
      font-size:18px;
    `;

    star.onclick = async () => {
      const dict = await getDictionary();
      dict[index].favorite = !dict[index].favorite;
      saveDictionary(dict);
      updateList("");
    };

    card.innerHTML = `
      <strong>${w.ru}</strong><br/>
      <span>${w.kk}</span><br/>
      <small style="color:#677">${w.date}</small>
    `;

    card.appendChild(star);
    wordListContainer.appendChild(card);
  });
}
