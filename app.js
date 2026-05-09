// Siva Vimel Rajhen — digital persona front-end
const API_URL = "https://digitaloman.ai/api/digitalomanai/svr/chat";
const CONTEXT_PAIRS = 2; // last N user/assistant pairs sent for context awareness

// ---------- Theme ----------
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const THEME_KEY = "svr-theme";

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  const themeColor = theme === "dark" ? "#000000" : "#ffffff";
  document.querySelector('meta[name="theme-color"]').setAttribute("content", themeColor);
}

(function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
  } else {
    applyTheme("dark"); // default
  }
})();

themeToggle.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

// ---------- DOM refs ----------
const hero = document.getElementById("hero");
const chat = document.getElementById("chat");
const heroForm = document.getElementById("heroForm");
const heroInput = document.getElementById("heroInput");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const messagesEl = document.getElementById("messages");

// Wrap messages in an inner column for max-width centering
const messagesInner = document.createElement("div");
messagesInner.className = "messages-inner";
messagesEl.appendChild(messagesInner);

// ---------- State ----------
const history = []; // [{role: 'user'|'assistant', content: string}]
let isSending = false;

// ---------- Auto-grow textareas ----------
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
}
[heroInput, chatInput].forEach((el) => {
  el.addEventListener("input", () => autoGrow(el));
});

// Enter to send, Shift+Enter for newline
function bindEnterSubmit(input, form) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}
bindEnterSubmit(heroInput, heroForm);
bindEnterSubmit(chatInput, chatForm);

// ---------- Suggestion chips ----------
document.querySelectorAll(".chip[data-prompt]").forEach((chip) => {
  chip.addEventListener("click", () => {
    heroInput.value = chip.dataset.prompt;
    autoGrow(heroInput);
    heroInput.focus();
  });
});

// ---------- Message rendering ----------
function appendMessage({ role, html, text }) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "assistant" && html) {
    bubble.innerHTML = html;
    // open links in new tab safely
    bubble.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
  } else {
    bubble.textContent = text;
  }
  wrap.appendChild(bubble);
  messagesInner.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function appendTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg assistant";
  wrap.dataset.typing = "1";
  const bubble = document.createElement("div");
  bubble.className = "bubble typing";
  bubble.innerHTML = "<span></span><span></span><span></span>";
  wrap.appendChild(bubble);
  messagesInner.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function scrollToBottom() {
  // next frame so layout settles
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

// ---------- HTML → text (for context injection) ----------
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

// ---------- Build contextual message ----------
function buildContextualMessage(userMessage) {
  const recent = history.slice(-(CONTEXT_PAIRS * 2));
  if (!recent.length) return userMessage;

  const lines = recent.map((m) => {
    const speaker = m.role === "user" ? "User" : "Siva";
    return `${speaker}: ${m.content}`;
  });

  return [
    "Previous conversation (for context — do not repeat verbatim):",
    ...lines,
    "",
    `Current user message: ${userMessage}`,
  ].join("\n");
}

// ---------- Network ----------
async function fetchReply(userMessage) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: buildContextualMessage(userMessage) }),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).detail || ""; } catch (_) {}
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------- Hero → Chat transition ----------
function switchToChat() {
  if (!hero.classList.contains("hidden")) {
    hero.classList.add("hidden");
    chat.classList.remove("hidden");
    setTimeout(() => chatInput.focus(), 350);
  }
}

// ---------- Send flow ----------
async function send(userMessage) {
  if (isSending) return;
  const text = userMessage.trim();
  if (!text) return;

  isSending = true;
  switchToChat();

  appendMessage({ role: "user", text });
  history.push({ role: "user", content: text });

  const typingEl = appendTyping();

  try {
    const data = await fetchReply(text);
    const replyHtml = data.reply || "";
    typingEl.remove();
    appendMessage({ role: "assistant", html: replyHtml });
    history.push({ role: "assistant", content: stripHtml(replyHtml) });
  } catch (err) {
    typingEl.remove();
    appendMessage({
      role: "assistant",
      html: `<p>Hmm, something broke on my side — ${escapeHtml(err.message || "couldn't reach the server")}. Try again in a moment.</p>`,
    });
  } finally {
    isSending = false;
    chatInput.value = "";
    autoGrow(chatInput);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Form handlers ----------
heroForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = heroInput.value;
  heroInput.value = "";
  autoGrow(heroInput);
  send(v);
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = chatInput.value;
  chatInput.value = "";
  autoGrow(chatInput);
  send(v);
});

// Focus hero input on load
window.addEventListener("load", () => {
  if (!hero.classList.contains("hidden")) heroInput.focus();
});
