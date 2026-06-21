const form = document.getElementById("query-form");
const questionInput = document.getElementById("question");
const topKInput = document.getElementById("top-k");
const submitButton = document.getElementById("submit-button");
const statusOutput = document.getElementById("status");
const answerOutput = document.getElementById("answer-output");
const contextOutput = document.getElementById("context-output");
const resultsOutput = document.getElementById("results-output");
const speakButton = document.getElementById("speak-button");
const promptChips = document.querySelectorAll(".prompt-chip");
const filterButtons = document.querySelectorAll(".nav-filter, .catalog-summary");
const collectionCards = document.querySelectorAll(".collection-card");
const productCards = document.querySelectorAll(".product-card");
const addToCartButtons = document.querySelectorAll(".add-to-cart");
const cartItemsOutput = document.getElementById("cart-items");
const cartTotalOutput = document.getElementById("cart-total");
const cartCountOutput = document.getElementById("cart-count");
const cartPanel = document.getElementById("cart-panel");
const cartToggles = document.querySelectorAll("[data-open-cart]");
const searchInput = document.getElementById("catalog-search");

let lastAnswer = "";
let activeUtterance = null;
const cart = new Map();
let activeFilter = "all";

function updateNavState(filter) {
  document.querySelectorAll(".nav-filter").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });
}

function formatPrice(value) {
  return `${value.toFixed(2)} EUR`;
}

function renderCart() {
  const items = Array.from(cart.values());
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  cartCountOutput.textContent = String(count);
  cartTotalOutput.textContent = formatPrice(total);

  if (!items.length) {
    cartItemsOutput.innerHTML = '<p class="placeholder">Tu carrito esta vacio.</p>';
    return;
  }

  cartItemsOutput.innerHTML = items
    .map(
      (item) => `
        <article class="cart-item">
          <div>
            <strong>${item.name}</strong>
            <span>${formatPrice(item.price)} x ${item.quantity}</span>
          </div>
          <button type="button" class="cart-remove" data-remove-id="${item.id}">Quitar</button>
        </article>
      `,
    )
    .join("");

  document.querySelectorAll(".cart-remove").forEach((button) => {
    button.addEventListener("click", () => {
      cart.delete(button.dataset.removeId);
      renderCart();
    });
  });
}

function addToCart(button) {
  const id = button.dataset.productId;
  const name = button.dataset.productName;
  const price = Number.parseFloat(button.dataset.productPrice || "0");
  const existing = cart.get(id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.set(id, { id, name, price, quantity: 1 });
  }

  renderCart();
  cartPanel.classList.add("is-open");
  cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function filterProducts(filter, searchTerm = "") {
  productCards.forEach((card) => {
    const matchesFilter = filter === "all" || card.dataset.category === filter;
    const matchesSearch = !searchTerm || card.dataset.name.includes(searchTerm);
    card.hidden = !(matchesFilter && matchesSearch);
  });
}

function renderResults(results) {
  if (!results.length) {
    resultsOutput.innerHTML = '<p class="placeholder">No se recuperaron fragmentos.</p>';
    return;
  }

  resultsOutput.innerHTML = results
    .map(
      (result) => `
        <article class="result-card">
          <div class="result-head">
            <h3 class="result-title">${result.source_type}: ${result.source_label ?? result.source_id}</h3>
            <strong>${result.distance.toFixed(3)}</strong>
          </div>
          <p class="result-meta">Chunk: ${result.chunk_key}</p>
          <p>${result.content}</p>
        </article>
      `,
    )
    .join("");
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  speakButton.textContent = "Escuchar respuesta";
}

function speakLastAnswer() {
  if (!lastAnswer || !("speechSynthesis" in window)) {
    return;
  }

  if (activeUtterance) {
    stopSpeech();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(lastAnswer);
  utterance.lang = "es-ES";
  utterance.rate = 1;
  utterance.onend = stopSpeech;
  utterance.onerror = stopSpeech;
  activeUtterance = utterance;
  speakButton.textContent = "Detener audio";
  window.speechSynthesis.speak(utterance);
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    updateNavState(activeFilter);
    filterProducts(activeFilter, (searchInput?.value || "").trim().toLowerCase());
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

collectionCards.forEach((card) => {
  card.addEventListener("click", () => {
    activeFilter = card.dataset.filter || "all";
    updateNavState(activeFilter);
    filterProducts(activeFilter, (searchInput?.value || "").trim().toLowerCase());
    document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

searchInput?.addEventListener("input", () => {
  filterProducts(activeFilter, searchInput.value.trim().toLowerCase());
});

addToCartButtons.forEach((button) => {
  button.addEventListener("click", () => addToCart(button));
});

cartToggles.forEach((button) => {
  button.addEventListener("click", () => {
    cartPanel.classList.toggle("is-open");
    cartPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    questionInput.value = chip.dataset.question || "";
    questionInput.focus();
  });
});

speakButton.addEventListener("click", speakLastAnswer);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  const topK = Number.parseInt(topKInput.value, 10);

  if (!question) {
    statusOutput.textContent = "Debes escribir una pregunta.";
    return;
  }

  stopSpeech();
  submitButton.disabled = true;
  speakButton.disabled = true;
  statusOutput.textContent = "Buscando contexto semantico...";
  answerOutput.textContent = "";
  contextOutput.textContent = "";
  resultsOutput.innerHTML = "";

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, top_k: topK }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Error desconocido");
    }

    lastAnswer = payload.answer || "";
    answerOutput.textContent = lastAnswer || "No se genero respuesta.";
    contextOutput.textContent = payload.context || "No se genero contexto.";
    renderResults(payload.results || []);
    statusOutput.textContent = `Recuperados ${payload.retrieved_count} fragmentos.`;
    speakButton.disabled = !lastAnswer || !("speechSynthesis" in window);
  } catch (error) {
    lastAnswer = "";
    answerOutput.textContent = "No se pudo generar la respuesta.";
    contextOutput.textContent = "No se pudo completar la consulta.";
    resultsOutput.innerHTML = '<p class="placeholder">Revisa el error e intentalo de nuevo.</p>';
    statusOutput.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

renderCart();
filterProducts(activeFilter, "");
