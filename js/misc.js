// ==================== SEARCH UI ====================
let query = "";
const searchUI = document.getElementById("searchui");
const charsWrap = document.getElementById("chars");
const placeholder = document.getElementById("ph");
const clearBtn = document.getElementById("clearbtn");

const appendChar = (c) => {
  placeholder.style.display = "none";
  const span = document.createElement("span");
  span.className = "char";
  span.textContent = c;
  charsWrap.appendChild(span);
};

const removeLastChar = () => {
  const last = charsWrap.lastElementChild;
  if (last) last.remove();
  if (!charsWrap.hasChildNodes()) placeholder.style.display = "block";
};

const clearSearch = () => {
  query = "";
  charsWrap.innerHTML = "";
  placeholder.style.display = "block";
  renderClassList("");
};

// Focus handling
searchUI.addEventListener("click", () => searchUI.focus());

searchUI.addEventListener("focus", () => {
  searchUI.classList.add("focused");
  if (!query) placeholder.style.display = "none";
});

searchUI.addEventListener("blur", () => {
  searchUI.classList.remove("focused");
  if (!query) placeholder.style.display = "block";
});

// Global key handler
document.addEventListener("keydown", (e) => {
  if (!searchUI.matches(":focus") && e.target !== searchUI) return;

  const key = e.key;

  if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    query += key;
    appendChar(key);
    renderClassList(query);
    e.preventDefault();
  } else if (key === "Backspace" && query) {
    query = query.slice(0, -1);
    removeLastChar();
    renderClassList(query);
    e.preventDefault();
  } else if (key === "Enter") {
    const active = document.querySelector(".class-item.active") ||
                   document.querySelector(".class-item");
    active?.click();
    e.preventDefault();
  } else if (key === "Escape") {
    clearSearch();
    searchUI.blur();
    e.preventDefault();
  }
});

clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  clearSearch();
  searchUI.focus();
});

// ==================== CUSTOM CURSOR (optional) ====================
const cursor = document.getElementById("cursor");
if (cursor) {
  document.addEventListener("mousemove", (e) => {
    cursor.style.transform = `translate(${e.clientX - 8}px, ${e.clientY - 8}px)`;
  });

  document.addEventListener("mousedown", () => cursor.classList.add("click"));
  document.addEventListener("mouseup", () => cursor.classList.remove("click"));
}