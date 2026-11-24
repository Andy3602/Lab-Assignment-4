const API_URL = "http://localhost:8080";
const authCard = document.querySelector("#auth-card");
const dashboardCard = document.querySelector("#dashboard-card");
const authForm = document.querySelector("#auth-form");
const message = document.querySelector("#message");
const nameField = document.querySelector("#name-field");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const submitButton = document.querySelector("#submit-button");
const tokenKey = "notesapp_token";
const userKey = "notesapp_user";
let mode = "login";
let currentView = "all";
let currentCategory = "";
let categories = [];
let notes = [];
let searchTimer;

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
const formatDate = (date) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
const initials = (name = "U") => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}), Authorization: `Bearer ${localStorage.getItem(tokenKey) || ""}` },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) logout();
  if (!response.ok) throw new Error(data.msg || "Something went wrong");
  return data;
}

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  mode = tab.dataset.mode;
  document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("active", item === tab));
  nameField.classList.toggle("hidden", mode === "login");
  nameInput.required = mode === "register";
  submitButton.textContent = mode === "login" ? "Login" : "Create account";
  message.textContent = "";
}));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "message";
  message.textContent = mode === "login" ? "Signing you in..." : "Creating your account...";
  const body = { email: emailInput.value, password: passwordInput.value };
  if (mode === "register") body.name = nameInput.value;
  try {
    const data = await api(`/user/${mode}`, { method: "POST", body: JSON.stringify(body) });
    if (mode === "register") {
      document.querySelector('[data-mode="login"]').click();
      message.className = "message success";
      message.textContent = "Account created. You can now log in.";
      authForm.reset();
      return;
    }
    localStorage.setItem(tokenKey, data.token);
    localStorage.setItem(userKey, JSON.stringify(data.user));
    window.history.replaceState({}, "", `${window.location.pathname}#dashboard`);
    showDashboard(data.user);
  } catch (error) {
    message.textContent = error.message;
  }
});

function showDashboard(user = JSON.parse(localStorage.getItem(userKey) || "{}")) {
  authCard.classList.add("hidden");
  dashboardCard.classList.remove("hidden");
  const displayName = user.name || "there";
  $("#welcome-message").textContent = `Good to see you, ${displayName}!`;
  $("#top-name").textContent = displayName;
  $("#sidebar-name").textContent = displayName;
  $("#sidebar-email").textContent = user.email || "";
  $("#top-avatar").textContent = initials(displayName);
  $("#sidebar-avatar").textContent = initials(displayName);
  loadDashboard();
}

async function loadDashboard() {
  try {
    await Promise.all([loadCategories(), loadStats(), loadNotes()]);
  } catch (error) { showToast(error.message, true); }
}

async function loadStats() {
  const { stats } = await api("/api/notes/stats");
  $("#stat-total").textContent = stats.totalNotes;
  $("#stat-favorites").textContent = stats.favoriteNotes;
  $("#stat-recent").textContent = stats.recentNotes;
  $("#stat-categories").textContent = stats.totalCategories;
}

async function loadCategories() {
  const data = await api("/api/categories");
  categories = data.categories;
  $("#category-list").innerHTML = categories.length ? categories.map((category) => `<div class="category-item ${currentCategory === category._id ? "active" : ""}" data-category="${category._id}"><button class="category-filter"><span class="category-dot"></span><span class="category-name">${escapeHtml(category.name)}</span><small>${category.noteCount}</small></button><div class="category-actions"><button data-edit-category="${category._id}" aria-label="Edit category">✎</button><button data-delete-category="${category._id}" aria-label="Delete category">×</button></div></div>`).join("") : `<p class="sidebar-empty">No categories yet</p>`;
  $("#note-category").innerHTML = `<option value="">No category</option>${categories.map((category) => `<option value="${category._id}">${escapeHtml(category.name)}</option>`).join("")}`;
}

async function loadNotes() {
  $("#loading-state").classList.remove("hidden");
  $("#notes-grid").innerHTML = "";
  const params = new URLSearchParams({ view: currentView, sort: $("#sort-select").value });
  if (currentCategory) params.set("category", currentCategory);
  if ($("#search-input").value.trim()) params.set("search", $("#search-input").value.trim());
  try {
    const data = await api(`/api/notes?${params}`);
    notes = data.notes;
    renderNotes();
  } finally { $("#loading-state").classList.add("hidden"); }
}

function renderNotes() {
  const grid = $("#notes-grid");
  $("#notes-count").textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
  grid.innerHTML = notes.map((note) => {
    const actions = currentView === "trash"
      ? `<button data-restore-note="${note._id}">Restore</button><button data-permanent-delete="${note._id}">Delete forever</button>`
      : `<button data-view-note="${note._id}">Open</button><button data-edit-note="${note._id}">Edit</button><button data-delete-note="${note._id}">Delete</button>`;
    return `<article class="note-card"><div class="note-card-top"><span class="note-date">${formatDate(note.createdAt)}</span>${currentView === "trash" ? "" : `<button class="favorite-button ${note.isFavorite ? "active" : ""}" data-favorite="${note._id}" aria-label="Toggle favourite">★</button>`}</div><h4>${escapeHtml(note.title)}</h4><p>${escapeHtml(note.description)}</p><div class="note-card-bottom"><span class="note-category ${note.categoryId ? "" : "muted"}">${note.categoryId ? escapeHtml(note.categoryId.name) : "Uncategorized"}</span><div class="note-actions">${actions}</div></div><small class="updated-label">Updated ${formatDate(note.updatedAt)}</small></article>`;
  }).join("");
  const empty = $("#empty-state");
  empty.classList.toggle("hidden", notes.length > 0);
  if (!notes.length) {
    $("#empty-title").textContent = currentView === "trash" ? "Trash is empty" : currentView === "favorites" ? "No favourite notes" : "No notes found";
    $("#empty-copy").textContent = currentView === "trash" ? "Deleted notes will appear here." : "Create a note to get started or try a different search.";
    $("#empty-action").classList.toggle("hidden", currentView === "trash");
  }
}

function openNoteModal(note = null) {
  $("#note-id").value = note?._id || "";
  $("#note-title").value = note?.title || "";
  $("#note-description").value = note?.description || "";
  $("#note-category").value = note?.categoryId?._id || "";
  $("#note-modal-eyebrow").textContent = note ? "Edit note" : "New note";
  $("#note-modal-title").textContent = note ? "Update your note" : "Create a note";
  $("#note-message").textContent = "";
  $("#note-modal").classList.remove("hidden");
  $("#note-title").focus();
}

function openCategoryModal(category = null) {
  $("#category-id").value = category?._id || "";
  $("#category-name").value = category?.name || "";
  $("#category-modal-title").textContent = category ? "Rename category" : "New category";
  $("#category-message").textContent = "";
  $("#category-modal").classList.remove("hidden");
  $("#category-name").focus();
}

$("#note-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#note-id").value;
  const payload = { title: $("#note-title").value, description: $("#note-description").value, categoryId: $("#note-category").value || null };
  try { await api(id ? `/api/notes/${id}` : "/api/notes", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) }); closeModal("note-modal"); showToast(id ? "Note updated" : "Note created"); await Promise.all([loadNotes(), loadStats(), loadCategories()]); }
  catch (error) { $("#note-message").textContent = error.message; }
});

$("#category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#category-id").value;
  try { await api(id ? `/api/categories/${id}` : "/api/categories", { method: id ? "PATCH" : "POST", body: JSON.stringify({ name: $("#category-name").value }) }); closeModal("category-modal"); showToast(id ? "Category renamed" : "Category created"); await Promise.all([loadCategories(), loadStats(), loadNotes()]); }
  catch (error) { $("#category-message").textContent = error.message; }
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  const note = notes.find((item) => item._id === target.dataset.editNote || item._id === target.dataset.viewNote);
  if (target.closest("[data-close]")) closeModal(target.closest("[data-close]").dataset.close);
  if (target.id === "create-note-button" || target.id === "empty-action") openNoteModal();
  if (target.id === "new-category-sidebar") openCategoryModal();
  if (target.dataset.editNote) openNoteModal(note);
  if (target.dataset.viewNote) openNoteModal(note);
  if (target.dataset.favorite) { try { await api(`/api/notes/${target.dataset.favorite}`, { method: "PATCH", body: JSON.stringify({ isFavorite: !target.classList.contains("active") }) }); await Promise.all([loadNotes(), loadStats()]); } catch (error) { showToast(error.message, true); } }
  if (target.dataset.deleteNote) {
    const result = await Swal.fire({ title: "Move this note to Trash?", text: "You can restore it later from Trash.", icon: "warning", showCancelButton: true, confirmButtonText: "Move to Trash", cancelButtonText: "Keep note", confirmButtonColor: "#ef6a82", cancelButtonColor: "#e8ebff", reverseButtons: true });
    if (result.isConfirmed) { try { await api(`/api/notes/${target.dataset.deleteNote}`, { method: "DELETE" }); await Swal.fire({ title: "Moved to Trash", text: "Your note was moved successfully.", icon: "success", timer: 1600, showConfirmButton: false }); await Promise.all([loadNotes(), loadStats(), loadCategories()]); } catch (error) { showToast(error.message, true); } }
  }
  if (target.dataset.restoreNote) { try { await api(`/api/notes/${target.dataset.restoreNote}/restore`, { method: "PATCH" }); showToast("Note restored"); await Promise.all([loadNotes(), loadStats(), loadCategories()]); } catch (error) { showToast(error.message, true); } }
  if (target.dataset.permanentDelete) { const result = await Swal.fire({ title: "Delete permanently?", text: "This note cannot be restored.", icon: "warning", showCancelButton: true, confirmButtonText: "Delete forever", cancelButtonText: "Cancel", confirmButtonColor: "#ef6a82", reverseButtons: true }); if (result.isConfirmed) { try { await api(`/api/notes/${target.dataset.permanentDelete}/permanent`, { method: "DELETE" }); showToast("Note permanently deleted"); await Promise.all([loadNotes(), loadStats(), loadCategories()]); } catch (error) { showToast(error.message, true); } } }
  if (target.dataset.editCategory) openCategoryModal(categories.find((category) => category._id === target.dataset.editCategory));
  if (target.dataset.deleteCategory && window.confirm("Delete this category? Notes will be kept but uncategorized.")) { try { await api(`/api/categories/${target.dataset.deleteCategory}`, { method: "DELETE" }); if (currentCategory === target.dataset.deleteCategory) currentCategory = ""; showToast("Category deleted"); await Promise.all([loadCategories(), loadStats(), loadNotes()]); } catch (error) { showToast(error.message, true); } }
  const categoryButton = target.closest("[data-category]");
  if (categoryButton && !target.closest(".category-actions")) { currentCategory = categoryButton.dataset.category; currentView = "all"; updateNav(); await loadNotes(); }
  if (target.closest(".nav-item")) { currentView = target.closest(".nav-item").dataset.view; currentCategory = ""; updateNav(); await loadNotes(); }
  if (target.id === "menu-button") $("#sidebar").classList.add("open");
  if (target.id === "sidebar-close") $("#sidebar").classList.remove("open");
});

function updateNav() {
  const names = { all: currentCategory ? categories.find((category) => category._id === currentCategory)?.name || "Category" : "All notes", favorites: "My favourites", recent: "Recent notes", trash: "Trash" };
  $("#page-title").textContent = names[currentView];
  $("#notes-heading").textContent = names[currentView];
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === currentView && (!currentCategory || item.textContent.includes("Dashboard"))));
  document.querySelectorAll(".category-item").forEach((item) => item.classList.toggle("active", item.dataset.category === currentCategory));
  $("#sidebar").classList.remove("open");
}

$("#search-input").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadNotes, 250); });
$("#sort-select").addEventListener("change", loadNotes);
$("#empty-action").addEventListener("click", () => openNoteModal());

function closeModal(id) { $("#" + id).classList.add("hidden"); }
function showToast(text, isError = false) { const toast = $("#toast"); toast.textContent = text; toast.className = `toast ${isError ? "error" : ""}`; setTimeout(() => toast.classList.add("hidden"), 3000); }
function logout() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); window.history.replaceState({}, "", window.location.pathname); dashboardCard.classList.add("hidden"); authCard.classList.remove("hidden"); authForm.reset(); }
$("#logout-button").addEventListener("click", logout);

if (localStorage.getItem(tokenKey)) {
  if (window.location.hash !== "#dashboard") window.history.replaceState({}, "", `${window.location.pathname}#dashboard`);
  showDashboard();
}
