
/* =========================================================
   LANGUAGE LEARNING DIARY
   Offline-first application core
   Version: 2.0
========================================================= */

/* 1. OFFLINE JAPANESE DICTIONARY */

const OFFLINE_DICTIONARY = {
  "日本語": { reading: "にほんご", meaning: "Japanese language" },
  "今日": { reading: "きょう", meaning: "Today" },
  "私": { reading: "わたし", meaning: "I / me" },
  "勉強": { reading: "べんきょう", meaning: "Study / learning" },
  "天気": { reading: "てんき", meaning: "Weather" },
  "日記": { reading: "にっき", meaning: "Diary / journal" },
  "学校": { reading: "がっこう", meaning: "School" },
  "小学生": { reading: "しょうがくせい", meaning: "Elementary school student; primary school pupil" },
  "友達": { reading: "ともだち", meaning: "Friend" },
  "日本": { reading: "にほん", meaning: "Japan" },
  "先生": { reading: "せんせい", meaning: "Teacher" },
  "本": { reading: "ほん", meaning: "Book" },
  "美味しい": { reading: "おいしい", meaning: "Delicious / tasty" },
  "食べる": { reading: "たべる", meaning: "To eat" },
  "行く": { reading: "いく", meaning: "To go" }
};


/* 2. APPLICATION CONFIGURATION */

// Polyfill replaceChildren for compatibility with older browsers/environments
if (!Element.prototype.replaceChildren) {
  Element.prototype.replaceChildren = function (...nodes) {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    this.append(...nodes);
  };
}

const STORAGE_KEY = "languageDiaryApp_v2";

const DEFAULT_NOTE = {
  id: "default-note",
  title: "11月5日の日記",
  content: "今日、私は日本語を勉強しました。天気はいいです。",
  updatedAt: new Date().toISOString()
};

const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV",
  "H1", "H2", "H3", "H4",
  "STRONG", "B", "EM", "I",
  "U", "S", "DEL",
  "SPAN", "UL", "OL", "LI",
  "BLOCKQUOTE"
]);

const ALLOWED_STYLES = new Set([
  "color",
  "background-color",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align"
]);


/* 3. APPLICATION STATE */

let diaryEntries = [];
let activeNoteId = null;
let currentMode = "review";
let currentView = "home"; // "home" | "editor"
let autosaveTimer = null;
let showFurigana = true;


/* 4. DOM SELECTORS */

const $ = (id) => document.getElementById(id);

const homeView = $("home-view");
const editorView = $("editor-view");
const brandHomeBtn = $("brand-home-btn");
const homeNewNoteBtn = $("home-new-note-btn");
const recentNotesGrid = $("recent-notes-grid");
const homeNotesCount = $("home-notes-count");

const editor = $("diary-editor");
const titleInput = $("diary-title");

const editBtn = $("edit-btn");
const saveBtn = $("save-btn");
const createNoteBtn = $("create-note-btn");
const quickNewNoteBtn = $("quick-new-note-btn");

const themeToggleBtn = $("theme-toggle-btn");
const formattingBar = $("formatting-bar");
const modeText = $("mode-text");

const furiganaBtn = $("toggle-furigana-btn");
const textSizeSelect = $("text-size");
const highlightColorSelect = $("highlight-color");
const checklistBtn = $("checklist-btn");
const tickBtn = $("tick-btn");

const menuBtn = $("menu-btn");
const sidebar = $("sidebar");
const closeSidebarBtn = $("close-sidebar-btn");
const sidebarOverlay = $("sidebar-overlay");
const entriesList = $("entries-list");

const dictDrawer = $("dict-drawer");
const dictWord = $("dict-word");
const dictReading = $("dict-reading");
const dictMeaning = $("dict-meaning");
const closeDrawerBtn = $("close-drawer");

const toolbarElements = formattingBar
  ? formattingBar.querySelectorAll("button, select")
  : [];


/* 5. STORAGE ENGINE */

function loadApplicationData() {
  try {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (!savedData) {
      diaryEntries = [{ ...DEFAULT_NOTE }];
      activeNoteId = DEFAULT_NOTE.id;
      persistData();
      return;
    }

    const parsed = JSON.parse(savedData);

    if (!Array.isArray(parsed.notes)) {
      throw new Error("Invalid diary storage format");
    }

    diaryEntries = parsed.notes.filter(note =>
      note &&
      note.id !== undefined &&
      typeof note.title === "string" &&
      typeof note.content === "string"
    );

    activeNoteId = parsed.activeNoteId;

    if (!diaryEntries.some(note => note.id === activeNoteId)) {
      activeNoteId = diaryEntries[0]?.id ?? null;
    }

  } catch (error) {
    console.error("Diary loading failed:", error);

    diaryEntries = [{ ...DEFAULT_NOTE }];
    activeNoteId = DEFAULT_NOTE.id;

    persistData();
  }
}


function persistData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      notes: diaryEntries,
      activeNoteId: activeNoteId
    }));

    return true;

  } catch (error) {
    console.error("Diary saving failed:", error);
    return false;
  }
}


function saveActiveNote() {
  const currentNote = diaryEntries.find(
    note => note.id === activeNoteId
  );

  if (!currentNote) return;

  currentNote.title = titleInput.value.trim() ||
    "Untitled Diary Entry";

  currentNote.content = sanitizeHTML(editor.innerHTML);

  currentNote.updatedAt = new Date().toISOString();

  persistData();
}


function scheduleAutosave() {
  clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(() => {
    if (currentMode === "edit") {
      saveActiveNote();
      renderSidebarList();
    }
  }, 500);
}


/* 6. SAFE HTML SANITIZER

   Preserves supported formatting while removing
   potentially unsafe HTML and attributes.
*/

function sanitizeHTML(html) {
  const parser = new DOMParser();

  const parsed = parser.parseFromString(
    html || "",
    "text/html"
  );

  function cleanNode(node) {

    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName;

    if (tag === "FONT") {
      const span = document.createElement("span");

      if (node.hasAttribute("color")) {
        span.style.color = node.getAttribute("color");
      }

      if (node.hasAttribute("face")) {
        span.style.fontFamily = node.getAttribute("face");
      }

      return appendCleanChildren(span, node);
    }

    if (!ALLOWED_TAGS.has(tag)) {
      return appendCleanChildren(
        document.createDocumentFragment(),
        node
      );
    }

    const element = document.createElement(tag.toLowerCase());

    for (const property of ALLOWED_STYLES) {
      const value = node.style.getPropertyValue(property);

      if (value) {
        element.style.setProperty(property, value);
      }
    }

    return appendCleanChildren(element, node);
  }


  function appendCleanChildren(target, source) {
    Array.from(source.childNodes).forEach(child => {
      target.appendChild(cleanNode(child));
    });

    return target;
  }


  const fragment = document.createDocumentFragment();

  Array.from(parsed.body.childNodes).forEach(node => {
    fragment.appendChild(cleanNode(node));
  });

  const container = document.createElement("div");
  container.appendChild(fragment);

  return container.innerHTML;
}


/* 7. ONLINE JAPANESE FURIGANA ENGINE
   Kuromoji is loaded from jsDelivr. Its dictionary files are also
   requested from jsDelivr; no API key or backend is required.
*/

const KUROMOJI_DICTIONARY_URL =
  "https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/";

let japaneseTokenizer = null;
let tokenizerLoading = false;

function katakanaToHiragana(value) {
  return String(value || "").replace(/[ァ-ヶ]/g, character =>
    String.fromCharCode(character.charCodeAt(0) - 0x60)
  );
}

function containsKanji(value) {
  return /[一-龯々〆ヵヶ]/.test(value || "");
}

function initializeJapaneseTokenizer() {
  if (japaneseTokenizer) return Promise.resolve(japaneseTokenizer);
  if (tokenizerLoading) {
    return new Promise((resolve, reject) => {
      const wait = () => {
        if (japaneseTokenizer) resolve(japaneseTokenizer);
        else if (!tokenizerLoading) reject(new Error("Tokenizer unavailable"));
        else setTimeout(wait, 100);
      };
      wait();
    });
  }

  tokenizerLoading = true;

  return new Promise((resolve, reject) => {
    if (!window.kuromoji) {
      tokenizerLoading = false;
      reject(new Error("Kuromoji library did not load. Check your internet connection."));
      return;
    }

    const dicPath = KUROMOJI_DICTIONARY_URL.endsWith("/")
      ? KUROMOJI_DICTIONARY_URL
      : KUROMOJI_DICTIONARY_URL + "/";

    window.kuromoji.builder({ dicPath }).build((error, tokenizer) => {
      tokenizerLoading = false;
      if (error) {
        reject(error);
        return;
      }
      japaneseTokenizer = tokenizer;
      resolve(tokenizer);
    });
  });
}

function makeWordToken(token) {
  const surface = token.surface_form || "";
  const reading = token.reading && token.reading !== "*"
    ? katakanaToHiragana(token.reading)
    : "";

  if (!surface || !containsKanji(surface) || !reading) {
    return document.createTextNode(surface);
  }

  const wrapper = document.createElement("span");
  wrapper.className = "word-token";
  wrapper.dataset.word = surface;
  wrapper.dataset.reading = reading;
  wrapper.dataset.basicForm = token.basic_form || surface;

  const ruby = document.createElement("ruby");
  ruby.appendChild(document.createTextNode(surface));

  const rt = document.createElement("rt");
  rt.textContent = reading;
  ruby.appendChild(rt);
  wrapper.appendChild(ruby);

  return wrapper;
}

function tokenizeAndInjectFurigana(html) {
  const safeHTML = sanitizeHTML(html);
  const container = document.createElement("div");
  container.innerHTML = safeHTML;

  if (!japaneseTokenizer) return container.innerHTML;

  function processTextNode(textNode) {
    const text = textNode.textContent;
    if (!/[一-龯々〆ヵヶ]/.test(text)) return;

    let tokens;
    try {
      tokens = japaneseTokenizer.tokenize(text);
    } catch (error) {
      console.warn("Japanese tokenization failed:", error);
      return;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    tokens.forEach(token => {
      const surface = token.surface_form || "";
      if (!surface) return;

      // Kuromoji positions are one-based; indexOf is a safe fallback for
      // punctuation/unknown tokens and keeps offsets in JavaScript units.
      let position = Number.isFinite(token.word_position)
        ? token.word_position - 1
        : -1;
      if (position < cursor || text.slice(position, position + surface.length) !== surface) {
        position = text.indexOf(surface, cursor);
      }
      if (position < cursor) return;

      if (position > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, position)));
      }
      fragment.appendChild(makeWordToken(token));
      cursor = position + surface.length;
    });

    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }

    if (fragment.childNodes.length) textNode.replaceWith(fragment);
  }

  function walkTextNodes(node) {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        processTextNode(child);
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        !["SCRIPT", "STYLE", "RUBY", "RT", "TEXTAREA"].includes(child.tagName)
      ) {
        walkTextNodes(child);
      }
    });
  }

  walkTextNodes(container);
  return container.innerHTML;
}

/* 8. THEME ENGINE */

function initTheme() {
  try {
    const savedTheme = localStorage.getItem("theme");
    const theme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (error) {
    document.documentElement.setAttribute("data-theme", "light");
  }
}


function toggleTheme() {
  try {
    const currentTheme =
      document.documentElement.getAttribute("data-theme");

    const newTheme =
      currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      newTheme
    );

    localStorage.setItem("theme", newTheme);
  } catch (error) {
    console.warn("Could not persist theme preference:", error);
  }
}


/* 9. VIEW NAVIGATION & HOME SCREEN */

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  tmp.querySelectorAll("rt").forEach(rt => rt.remove());
  return tmp.textContent || tmp.innerText || "";
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
    }).format(date);
  } catch (e) {
    return "";
  }
}

function renderRecentNotes() {
  if (!recentNotesGrid) return;
  recentNotesGrid.replaceChildren();

  if (homeNotesCount) {
    const count = diaryEntries.length;
    homeNotesCount.textContent = count === 1 ? "1 diary entry saved" : `${count} diary entries saved`;
  }

  if (diaryEntries.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "home-empty-state";
    emptyState.innerHTML = `
      <p class="empty-state-title">No diary entries yet</p>
      <p class="empty-state-desc">Write your first Japanese sentence and start your learning diary!</p>
      <button class="primary-btn empty-create-btn" type="button"><span aria-hidden="true">＋</span> Create your first note</button>
    `;
    emptyState.querySelector(".empty-create-btn")?.addEventListener("click", createNewNote);
    recentNotesGrid.appendChild(emptyState);
    return;
  }

  diaryEntries.forEach(note => {
    const card = document.createElement("article");
    card.className = "recent-note-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open note: ${note.title || "Untitled Diary Entry"}`);

    const cardHeader = document.createElement("div");
    cardHeader.className = "recent-card-header";

    const cardTitle = document.createElement("h3");
    cardTitle.className = "recent-card-title";
    cardTitle.textContent = note.title || "Untitled Diary Entry";

    const cardDate = document.createElement("span");
    cardDate.className = "recent-card-date";
    cardDate.textContent = formatDate(note.updatedAt);

    cardHeader.append(cardTitle, cardDate);

    const cardSnippet = document.createElement("p");
    cardSnippet.className = "recent-card-snippet";
    const plainText = stripHtml(note.content).trim();
    cardSnippet.textContent = plainText ? (plainText.length > 120 ? plainText.slice(0, 120) + "…" : plainText) : "No text content yet…";

    const cardFooter = document.createElement("div");
    cardFooter.className = "recent-card-footer";
    cardFooter.innerHTML = `<span class="recent-card-open">Open note <span aria-hidden="true">→</span></span>`;

    card.append(cardHeader, cardSnippet, cardFooter);

    const openCard = () => {
      loadNote(note.id);
    };

    card.addEventListener("click", openCard);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCard();
      }
    });

    recentNotesGrid.appendChild(card);
  });
}

function navigateToHome() {
  if (currentMode === "edit") {
    saveActiveNote();
  }

  currentView = "home";
  homeView?.classList.remove("hidden");
  editorView?.classList.add("hidden");

  if (modeText) {
    modeText.textContent = "Home";
  }

  closeDictionaryDrawer();
  renderSidebarList();
  renderRecentNotes();
}

function showEditorView() {
  currentView = "editor";
  homeView?.classList.add("hidden");
  editorView?.classList.remove("hidden");
}


/* 10. EDIT MODE */

function startEditing() {
  if (!activeNoteId) {
    createNewNote();
    return;
  }

  showEditorView();
  currentMode = "edit";

  if (modeText) {
    modeText.textContent = "Edit Mode";
  }

  if (editBtn) {
    editBtn.disabled = true;
    editBtn.setAttribute("aria-pressed", "true");
  }
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.setAttribute("aria-label", "Done editing and save this note");
  }

  formattingBar?.classList.remove("disabled-toolbar");

  toolbarElements.forEach(element => {
    element.disabled = false;
  });

  if (titleInput) {
    titleInput.disabled = false;
  }

  // Restore original content, not generated Furigana HTML.
  const currentNote = diaryEntries.find(
    note => note.id === activeNoteId
  );

  if (currentNote) {
    editor.innerHTML = sanitizeHTML(currentNote.content);
  }

  editor.contentEditable = "true";
  editor.focus();

  closeDictionaryDrawer();
}


/* 11. REVIEW MODE */

function startReviewing() {
  if (!activeNoteId) return;

  saveActiveNote();
  showEditorView();

  currentMode = "review";

  if (modeText) {
    modeText.textContent = "Review Mode";
  }

  if (editBtn) {
    editBtn.disabled = false;
    editBtn.setAttribute("aria-pressed", "false");
  }
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.setAttribute("aria-label", "Done editing and save this note");
  }

  formattingBar?.classList.add("disabled-toolbar");

  toolbarElements.forEach(element => {
    element.disabled = true;
  });

  if (titleInput) {
    titleInput.disabled = true;
  }

  const currentNote = diaryEntries.find(
    note => note.id === activeNoteId
  );

  if (!currentNote) return;

  editor.contentEditable = "false";

  editor.innerHTML = tokenizeAndInjectFurigana(
    currentNote.content
  );

  editor.classList.toggle(
    "furigana-disabled",
    !showFurigana
  );

  renderSidebarList();
}


/* 12. NOTE MANAGEMENT */

function generateNoteId() {
  if (typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random()
    .toString(36).slice(2)}`;
}


function createNewNote() {
  if (currentMode === "edit") {
    saveActiveNote();
  }

  const newNote = {
    id: generateNoteId(),
    title: "",
    content: "",
    updatedAt: new Date().toISOString()
  };

  diaryEntries.unshift(newNote);
  activeNoteId = newNote.id;

  if (titleInput) titleInput.value = "";
  if (editor) editor.innerHTML = "";

  persistData();
  renderSidebarList();

  showEditorView();
  startEditing();
  closeSidebar();
}


function loadNote(id) {
  if (currentMode === "edit") {
    saveActiveNote();
  }

  const selectedNote = diaryEntries.find(
    note => note.id === id
  );

  if (!selectedNote) return;

  activeNoteId = id;

  if (titleInput) titleInput.value = selectedNote.title;
  if (editor) {
    editor.innerHTML = sanitizeHTML(selectedNote.content);
  }

  persistData();

  showEditorView();
  startReviewing();
  closeSidebar();
}


function deleteNote(id, event) {
  event?.stopPropagation();

  const confirmed = confirm(
    "Are you sure you want to delete this diary entry?"
  );

  if (!confirmed) return;

  diaryEntries = diaryEntries.filter(
    note => note.id !== id
  );

  if (activeNoteId === id) {
    if (diaryEntries.length > 0) {
      activeNoteId = diaryEntries[0].id;

      const nextNote = diaryEntries[0];

      if (titleInput) titleInput.value = nextNote.title;
      if (editor) {
        editor.innerHTML = sanitizeHTML(nextNote.content);
      }

      if (currentView === "editor") {
        startReviewing();
      }
    } else {
      activeNoteId = null;

      if (titleInput) titleInput.value = "";
      if (editor) editor.innerHTML = "";

      currentMode = "review";

      if (currentView === "editor") {
        navigateToHome();
      }
    }
  }

  persistData();
  renderSidebarList();
  renderRecentNotes();
}


/* 12. SIDEBAR RENDERING */

function renderSidebarList() {

  if (!entriesList) return;

  entriesList.replaceChildren();

  diaryEntries.forEach(note => {

    const row = document.createElement("li");

    row.className =
      `entry-item-wrapper ${
        note.id === activeNoteId ? "active-item" : ""
      }`;

    const title = document.createElement("div");

    title.className = "entry-title-click";

    title.textContent =
      note.title || "Untitled Diary Entry";

    title.addEventListener("click", () => {
      loadNote(note.id);
    });

    const rowActions = document.createElement("div");
    rowActions.className = "entry-row-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "entry-edit-btn";
    edit.textContent = "✎";
    edit.title = "Edit this note";
    edit.setAttribute("aria-label", `Edit ${note.title || "untitled diary entry"}`);
    edit.addEventListener("click", event => {
      event.stopPropagation();
      loadNote(note.id);
      startEditing();
    });

    const trash = document.createElement("button");
    trash.type = "button";
    trash.className = "delete-note-btn";
    trash.textContent = "×";
    trash.title = "Delete this note";
    trash.setAttribute("aria-label", "Delete diary entry");
    trash.addEventListener("click", event => {
      deleteNote(note.id, event);
    });

    rowActions.append(edit, trash);
    row.append(title, rowActions);

    entriesList.appendChild(row);

  });
}


/* 13. SIDEBAR CONTROLS */

function openSidebar() {
  sidebar?.classList.remove("hidden-sidebar");
  sidebarOverlay?.classList.remove("hidden");
  menuBtn?.setAttribute("aria-expanded", "true");
  renderSidebarList();
}


function closeSidebar() {
  sidebar?.classList.add("hidden-sidebar");
  sidebarOverlay?.classList.add("hidden");
  menuBtn?.setAttribute("aria-expanded", "false");
}


function toggleSidebar() {
  if (sidebar?.classList.contains("hidden-sidebar")) {
    openSidebar();
  } else {
    closeSidebar();
  }
}


/* 14. ONLINE VOCABULARY DICTIONARY */

let dictionaryRequestNumber = 0;
const dictionaryCache = new Map();

function dictionaryText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(dictionaryText).filter(Boolean).join("; ");
  if (value && typeof value === "object") {
    return [value.text, value.gloss, value.definition, value.meaning, value.value]
      .find(item => typeof item === "string" && item.trim())?.trim() || "";
  }
  return "";
}

function normalizeJotobaEntry(payload, requestedWord) {
  const containers = [
    payload?.words, payload?.results, payload?.data?.words,
    payload?.data?.results, payload?.data, payload?.result?.words,
    payload?.result
  ];

  let entry = null;
  for (const item of containers) {
    if (Array.isArray(item) && item.length) { entry = item[0]; break; }
    if (item && typeof item === "object" && !Array.isArray(item)) {
      entry = item;
      break;
    }
  }
  if (!entry) return null;

  const spellings = entry.kanji || entry.japanese || entry.writings || entry.forms || [];
  const readings = entry.readings || entry.reading || entry.kana || [];
  const spelling = Array.isArray(spellings) ? spellings[0] : spellings;
  const readingItem = Array.isArray(readings) ? readings[0] : readings;

  const word = [
    entry.word, entry.expression, entry.slug,
    typeof spelling === "string" ? spelling : spelling?.word,
    typeof spelling === "object" ? spelling?.expression : "",
    requestedWord
  ].find(value => typeof value === "string" && value.trim()) || requestedWord;

  const reading = [
    typeof readingItem === "string" ? readingItem : "",
    readingItem?.reading, readingItem?.kana, entry.kana, entry.reading_text
  ].find(value => typeof value === "string" && value.trim()) || "";

  const senses = entry.senses || entry.meanings || entry.definitions || [];
  const senseList = Array.isArray(senses) ? senses : [senses];
  const meanings = [];
  const partsOfSpeech = new Set();
  const examples = [];

  for (const sense of senseList) {
    if (!sense) continue;
    const definition = dictionaryText(
      sense.glosses || sense.gloss || sense.english_definitions ||
      sense.definitions || sense.meaning || sense.translation || []
    );
    if (definition) meanings.push(definition);

    const pos = dictionaryText(
      sense.pos || sense.parts_of_speech || sense.part_of_speech ||
      sense.grammatical_info || []
    );
    if (pos) pos.split(/[;,]/).map(item => item.trim()).filter(Boolean)
      .forEach(item => partsOfSpeech.add(item));

    const sampleList = sense.examples || sense.sentences || [];
    if (Array.isArray(sampleList)) {
      for (const sample of sampleList) {
        if (typeof sample === "string") {
          examples.push({ japanese: sample, english: "" });
        } else if (sample && typeof sample === "object") {
          const jp = sample.japanese || sample.jp || sample.text || sample.sentence || "";
          const en = sample.english || sample.en || sample.translation || "";
          if (jp || en) examples.push({ japanese: String(jp), english: String(en) });
        }
      }
    }
  }

  if (!meanings.length) {
    const direct = dictionaryText(entry.glosses || entry.english_definitions || entry.definition);
    if (direct) meanings.push(direct);
  }
  if (!partsOfSpeech.size) {
    const directPos = dictionaryText(entry.pos || entry.parts_of_speech || entry.part_of_speech);
    if (directPos) directPos.split(/[;,]/).map(item => item.trim()).filter(Boolean)
      .forEach(item => partsOfSpeech.add(item));
  }

  if (!meanings.length && !reading && !partsOfSpeech.size) return null;
  return {
    word, reading,
    meanings: [...new Set(meanings)].slice(0, 6),
    partsOfSpeech: [...partsOfSpeech].slice(0, 5),
    examples: examples.slice(0, 2)
  };
}

function renderDictionaryStatus(message, state = "") {
  const status = $("dict-status");
  if (!status) return;
  status.textContent = message;
  status.className = `dict-status${state ? ` ${state}` : ""}`;
}

function renderDictionaryEntry(entry, requestedWord, fallbackReading = "") {
  dictWord.textContent = entry.word || requestedWord;
  dictReading.textContent = `【${entry.reading || fallbackReading || "Reading not available"}】`;

  dictMeaning.textContent = entry.meanings?.length
    ? entry.meanings.map((meaning, index) => `${index + 1}. ${meaning}`).join("\n")
    : "No English definition was returned for this word.";

  const pos = $("dict-pos");
  if (pos) {
    pos.textContent = `Part of speech: ${
      entry.partsOfSpeech?.length ? entry.partsOfSpeech.join(" · ") : "Not available"
    }`;
  }

  const examples = $("dict-examples");
  if (examples) {
    examples.replaceChildren();
    (entry.examples || []).forEach(sample => {
      const row = document.createElement("p");
      row.className = "dict-example";
      if (sample.japanese) {
        const jp = document.createElement("strong");
        jp.textContent = sample.japanese;
        row.appendChild(jp);
      }
      if (sample.english) {
        const en = document.createElement("span");
        en.textContent = sample.english;
        row.appendChild(en);
      }
      examples.appendChild(row);
    });
  }
}

async function fetchOnlineDictionary(word) {
  if (dictionaryCache.has(word)) return dictionaryCache.get(word);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch("https://jotoba.de/api/search/words", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        query: word,
        language: "English",
        no_kanji: false,
        only_common: false,
        limit: 5
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Dictionary service returned ${response.status}`);

    const payload = await response.json();
    const entry = normalizeJotobaEntry(payload, word);
    if (entry) dictionaryCache.set(word, entry);
    return entry;
  } finally {
    clearTimeout(timeout);
  }
}

function openDictionaryDrawer(word, reading = "", basicForm = "") {
  if (!dictDrawer) return;

  const lookupWord = basicForm && basicForm !== "*" ? basicForm : word;
  const fallback = OFFLINE_DICTIONARY[word] || OFFLINE_DICTIONARY[lookupWord] || null;
  const requestNumber = ++dictionaryRequestNumber;

  dictWord.textContent = word;
  dictReading.textContent = `【${reading || fallback?.reading || "Searching…"}】`;
  dictMeaning.textContent = fallback?.meaning || "Searching the online Japanese dictionary…";

  const pos = $("dict-pos");
  if (pos) pos.textContent = fallback ? "Part of speech: —" : "";
  $("dict-examples")?.replaceChildren();

  const link = $("dict-online-link");
  if (link) {
    link.href = `https://jotoba.de/search/0/${encodeURIComponent(lookupWord)}`;
    link.textContent = `Open “${lookupWord}” on Jotoba ↗`;
  }

  renderDictionaryStatus("Searching online dictionary…", "loading");
  dictDrawer.classList.remove("hidden");

  fetchOnlineDictionary(lookupWord).then(entry => {
    if (requestNumber !== dictionaryRequestNumber || dictDrawer.classList.contains("hidden")) return;

    if (entry) {
      renderDictionaryEntry(entry, word, reading || fallback?.reading || "");
      renderDictionaryStatus("Online definition loaded · Jotoba", "success");
    } else if (fallback) {
      renderDictionaryEntry({
        word, reading: fallback.reading, meanings: [fallback.meaning],
        partsOfSpeech: [], examples: []
      }, word, reading);
      renderDictionaryStatus("Online result not found · Showing saved definition", "fallback");
    } else {
      dictReading.textContent = `【${reading || "Reading not available"}】`;
      dictMeaning.textContent = `No online definition was found for “${lookupWord}”. Open Jotoba to check other matches.`;
      renderDictionaryStatus("No matching dictionary entry found", "fallback");
    }
  }).catch(error => {
    if (requestNumber !== dictionaryRequestNumber || dictDrawer.classList.contains("hidden")) return;
    console.warn("Online dictionary lookup failed:", error);

    if (fallback) {
      renderDictionaryEntry({
        word, reading: fallback.reading, meanings: [fallback.meaning],
        partsOfSpeech: [], examples: []
      }, word, reading);
      renderDictionaryStatus("Offline definition · Online lookup unavailable", "fallback");
    } else {
      dictReading.textContent = `【${reading || "Reading not available"}】`;
      dictMeaning.textContent = "The online dictionary could not be reached. Check your internet connection or open Jotoba directly.";
      renderDictionaryStatus("Could not connect to online dictionary", "error");
    }
  });
}

function closeDictionaryDrawer() {
  dictionaryRequestNumber += 1;
  dictDrawer?.classList.add("hidden");
}


/* 15. FURIGANA VISIBILITY */

function toggleFurigana() {

  showFurigana = !showFurigana;

  furiganaBtn?.classList.toggle(
    "active",
    showFurigana
  );

  editor.classList.toggle(
    "furigana-disabled",
    !showFurigana
  );
}


/* 16. RICH TEXT FORMATTING */

function setupFormattingToolbar() {

  document.querySelectorAll(".fmt-btn").forEach(btn => {

    btn.addEventListener("mousedown", event => {
      event.preventDefault();
    });

    btn.addEventListener("click", event => {

      event.preventDefault();

      if (currentMode !== "edit") return;

      const command = btn.dataset.cmd;
      const value = btn.dataset.val || null;

      if (!command) return;

      editor.focus();

      document.execCommand(
        command,
        false,
        value
      );

      scheduleAutosave();
    });

  });


  highlightColorSelect?.addEventListener("change", () => {
    if (currentMode !== "edit") return;

    const color = highlightColorSelect.value;
    editor.focus();
    document.execCommand(
      "hiliteColor",
      false,
      color === "transparent" ? "transparent" : color
    );
    scheduleAutosave();
  });

  checklistBtn?.addEventListener("mousedown", event => event.preventDefault());
  checklistBtn?.addEventListener("click", () => {
    if (currentMode !== "edit") return;
    editor.focus();
    document.execCommand("insertText", false, "☐ ");
    scheduleAutosave();
  });

  tickBtn?.addEventListener("mousedown", event => event.preventDefault());
  tickBtn?.addEventListener("click", () => {
    if (currentMode !== "edit") return;
    editor.focus();
    document.execCommand("insertText", false, "✓ ");
    scheduleAutosave();
  });

  textSizeSelect?.addEventListener("change", () => {

    if (currentMode !== "edit") return;

    const heading = textSizeSelect.value;

    if (!["p", "h1", "h2", "h3", "h4"].includes(heading)) {
      return;
    }

    editor.focus();

    document.execCommand(
      "formatBlock",
      false,
      heading
    );

    scheduleAutosave();
  });

}


/* 17. EVENT LISTENERS */

function setupEventListeners() {

  brandHomeBtn?.addEventListener("click", event => {
    event.preventDefault();
    navigateToHome();
  });

  homeNewNoteBtn?.addEventListener("click", () => {
    createNewNote();
  });

  menuBtn?.addEventListener("click", event => {
    event.preventDefault();
    toggleSidebar();
  });

  closeSidebarBtn?.addEventListener(
    "click",
    closeSidebar
  );

  sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
  );

  createNoteBtn?.addEventListener(
    "click",
    createNewNote
  );

  quickNewNoteBtn?.addEventListener(
    "click",
    createNewNote
  );

  editBtn?.addEventListener(
    "click",
    startEditing
  );

  saveBtn?.addEventListener(
    "click",
    startReviewing
  );

  themeToggleBtn?.addEventListener(
    "click",
    toggleTheme
  );

  furiganaBtn?.addEventListener(
    "click",
    toggleFurigana
  );

  closeDrawerBtn?.addEventListener(
    "click",
    closeDictionaryDrawer
  );


  // Automatic content saving.

  editor?.addEventListener("input", () => {
    if (currentMode === "edit") {
      scheduleAutosave();
    }
  });


  titleInput?.addEventListener("input", () => {
    if (currentMode === "edit") {
      scheduleAutosave();
    }
  });


  // Open dictionary when tapping recognized vocabulary.

  editor?.addEventListener("click", event => {

    if (currentMode !== "review") return;

    const token = event.target.closest(".word-token");

    if (!token || !editor.contains(token)) return;

    openDictionaryDrawer(
      token.dataset.word,
      token.dataset.reading,
      token.dataset.basicForm
    );

  });


  // Close dictionary with Escape.

  document.addEventListener("keydown", event => {

    if (event.key === "Escape") {
      closeDictionaryDrawer();
      closeSidebar();
    }

  });


  setupFormattingToolbar();

}


/* 18. APPLICATION INITIALIZATION */

function initializeApplication() {

  if (!editor || !titleInput) {
    console.error(
      "Application initialization failed: " +
      "Required diary editor elements were not found."
    );

    return;
  }

  initTheme();

  loadApplicationData();

  setupEventListeners();

  window.addEventListener("pagehide", () => {
    clearTimeout(autosaveTimer);

    if (currentMode === "edit") {
      saveActiveNote();
    }
  });

  // Start on Home view with recent notes and New Note button
  navigateToHome();

  console.log("Language Learning Diary initialized successfully.");
}


/* START APPLICATION */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication, { once: true });
} else {
  initializeApplication();
}

// Load the tokenizer in the background so the diary remains usable even
// when the network is temporarily unavailable.
window.addEventListener("load", async () => {
  const status = $("engine-status");
  try {
    await initializeJapaneseTokenizer();
    if (status) status.textContent = "Japanese reading engine ready";
    if (currentView === "editor" && currentMode === "review" && activeNoteId) {
      startReviewing();
    }
  } catch (error) {
    console.warn("Online Japanese reading engine unavailable:", error);
    if (status) status.textContent = "Furigana engine needs an internet connection";
  }
});