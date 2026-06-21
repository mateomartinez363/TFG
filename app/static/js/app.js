const CART_STORAGE_KEY = "el_naranjo_cart";
const FREE_SHIPPING_THRESHOLD = 49;
const STANDARD_SHIPPING_COST = 4.9;

const form = document.getElementById("query-form");
const questionInput = document.getElementById("question");
const topKInput = document.getElementById("top-k");
const submitButton = document.getElementById("submit-button");
const statusOutput = document.getElementById("status");
const answerOutput = document.getElementById("answer-output");
const contextOutput = document.getElementById("context-output");
const resultsOutput = document.getElementById("results-output");
const speakButton = document.getElementById("speak-button");
const listenButton = document.getElementById("listen-button");
const promptChips = document.querySelectorAll(".prompt-chip");
const filterButtons = document.querySelectorAll(".nav-filter, .catalog-summary[data-filter], .category-pill");
const productCards = document.querySelectorAll(".product-card");
const addToCartButtons = document.querySelectorAll(".add-to-cart");
const cartCountOutput = document.getElementById("cart-count");
const cartPageItemsOutput = document.getElementById("cart-page-items");
const cartTotalOutput = document.getElementById("cart-total");
const subtotalOutput = document.getElementById("summary-subtotal");
const shippingOutput = document.getElementById("summary-shipping");
const shippingProgressFill = document.getElementById("shipping-progress-fill");
const shippingProgressText = document.getElementById("shipping-progress-text");
const searchInput = document.getElementById("catalog-search");
const checkoutButtons = document.querySelectorAll(".cart-checkout-button");

let lastAnswer = "";
let activeUtterance = null;
let availableVoices = [];
let activeRecognition = null;
let activeMediaRecorder = null;
let activeMediaStream = null;
let recordedChunks = [];
let isListening = false;
const cart = loadCart();
let activeFilter = "all";
const DEFAULT_VOICE_RATE = 1;
const TRANSCRIPTION_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function loadCart() {
  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) {
      return new Map();
    }

    const parsed = JSON.parse(rawCart);
    if (!Array.isArray(parsed)) {
      return new Map();
    }

    return new Map(
      parsed
        .filter((item) => item && item.id)
        .map((item) => [
          String(item.id),
          {
            id: String(item.id),
            name: item.name || "Producto",
            price: Number.parseFloat(item.price || "0"),
            quantity: Math.max(1, Number.parseInt(item.quantity || "1", 10)),
          },
        ]),
    );
  } catch {
    return new Map();
  }
}

function saveCart() {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(Array.from(cart.values())));
}

function getCartItems() {
  return Array.from(cart.values());
}

function getCartSummary() {
  const items = getCartItems();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = !items.length || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;
  const total = subtotal + shipping;

  return { items, subtotal, count, shipping, total };
}

function updateNavState(filter) {
  document.querySelectorAll(".nav-filter, .category-pill, .catalog-summary[data-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });
}

function formatPrice(value) {
  return `${value.toFixed(2)} EUR`;
}

function renderCartCount() {
  if (!cartCountOutput) {
    return;
  }

  const { count } = getCartSummary();
  cartCountOutput.textContent = String(count);
}

function renderCartPage() {
  if (!cartPageItemsOutput) {
    return;
  }

  const { items, subtotal, shipping, total } = getCartSummary();

  if (subtotalOutput) {
    subtotalOutput.textContent = formatPrice(subtotal);
  }

  if (shippingOutput) {
    shippingOutput.textContent = shipping === 0 ? "Gratis" : formatPrice(shipping);
  }

  if (cartTotalOutput) {
    cartTotalOutput.textContent = formatPrice(total);
  }

  if (shippingProgressFill) {
    const progress = Math.min(subtotal / FREE_SHIPPING_THRESHOLD, 1);
    shippingProgressFill.style.width = `${progress * 100}%`;
  }

  if (shippingProgressText) {
    if (!items.length) {
      shippingProgressText.textContent = "Añade productos para calcular tu envío.";
    } else if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      shippingProgressText.textContent = "Ya tienes envío gratis en este pedido.";
    } else {
      shippingProgressText.textContent = `Te faltan ${formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} para conseguir envío gratis.`;
    }
  }

  if (!items.length) {
    cartPageItemsOutput.innerHTML = `
      <div class="empty-state">
        <h3>Tu carrito está vacío</h3>
        <p>Añade productos desde el catálogo para verlos aquí.</p>
      </div>
    `;
    return;
  }

  cartPageItemsOutput.innerHTML = items
    .map(
      (item) => `
        <article class="cart-line-item">
          <div class="cart-line-main">
            <p class="eyebrow">Producto</p>
            <h3>${item.name}</h3>
            <p class="cart-line-price">${formatPrice(item.price)} por unidad</p>
          </div>
          <div class="cart-line-controls">
            <div class="quantity-stepper" aria-label="Cantidad de ${item.name}">
              <button type="button" data-cart-action="decrease" data-product-id="${item.id}">-</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-action="increase" data-product-id="${item.id}">+</button>
            </div>
            <strong>${formatPrice(item.price * item.quantity)}</strong>
            <button type="button" class="cart-remove" data-cart-action="remove" data-product-id="${item.id}">
              Quitar
            </button>
          </div>
        </article>
      `,
    )
    .join("");

  cartPageItemsOutput.querySelectorAll("[data-cart-action]").forEach((button) => {
    button.addEventListener("click", () => {
      updateCartItem(button.dataset.productId, button.dataset.cartAction);
    });
  });
}

function renderCart() {
  saveCart();
  renderCartCount();
  renderCartPage();
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
}

function updateCartItem(id, action) {
  const existing = cart.get(id);
  if (!existing) {
    return;
  }

  if (action === "increase") {
    existing.quantity += 1;
  } else if (action === "decrease") {
    if (existing.quantity <= 1) {
      cart.delete(id);
    } else {
      existing.quantity -= 1;
    }
  } else if (action === "remove") {
    cart.delete(id);
  }

  renderCart();
}

function filterProducts(filter, searchTerm = "") {
  productCards.forEach((card) => {
    const matchesFilter = filter === "all" || card.dataset.category === filter;
    const matchesSearch = !searchTerm || card.dataset.name.includes(searchTerm);
    card.hidden = !(matchesFilter && matchesSearch);
  });
}

function renderResults(results) {
  if (!resultsOutput) {
    return;
  }

  if (!results.length) {
    resultsOutput.innerHTML = '<p class="placeholder">No se han encontrado resultados para esta consulta.</p>';
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

function getSpeechRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function browserSupportsAudioRecording() {
  return Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

function browserSupportsSpeech() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function browserSupportsRecognition() {
  return Boolean(getSpeechRecognitionClass());
}

function fillVoiceOptions() {
  if (!browserSupportsSpeech()) {
    return;
  }
  const synthVoices = window.speechSynthesis.getVoices();
  const filteredVoices = synthVoices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  availableVoices = filteredVoices.length ? filteredVoices : synthVoices;
}

function stopListening() {
  if (activeRecognition) {
    activeRecognition.onend = null;
    activeRecognition.onerror = null;
    activeRecognition.onresult = null;
    activeRecognition.stop();
    activeRecognition = null;
  }

  if (activeMediaRecorder) {
    activeMediaRecorder.ondataavailable = null;
    activeMediaRecorder.onstop = null;
    activeMediaRecorder.onerror = null;
    if (activeMediaRecorder.state !== "inactive") {
      activeMediaRecorder.stop();
    }
    activeMediaRecorder = null;
  }

  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach((track) => track.stop());
    activeMediaStream = null;
  }

  recordedChunks = [];

  isListening = false;
  if (listenButton) {
    listenButton.innerHTML = '<span aria-hidden="true">🎤</span>';
    listenButton.setAttribute("aria-label", "Hablar pregunta");
    listenButton.setAttribute("title", browserSupportsAudioRecording() ? "Iniciar grabacion" : "Hablar pregunta");
  }
}

function getSupportedRecordingMimeType() {
  if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return TRANSCRIPTION_MIME_TYPES.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || "";
}

async function transcribeRecordedAudio(audioBlob) {
  const extension = audioBlob.type.includes("ogg")
    ? "ogg"
    : audioBlob.type.includes("mp4")
      ? "mp4"
      : "webm";
  const formData = new FormData();
  formData.append("audio", audioBlob, `consulta.${extension}`);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "No se ha podido transcribir el audio.");
  }

  return payload.text || "";
}

async function stopAudioRecording() {
  const recorder = activeMediaRecorder;
  if (!recorder) {
    stopListening();
    return;
  }

  statusOutput.textContent = "Procesando audio...";

  const audioBlob = await new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: recorder.mimeType || "audio/webm" });
      resolve(blob);
    };
    recorder.onerror = () => {
      reject(new Error("No se ha podido capturar el audio."));
    };
    recorder.stop();
  });

  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach((track) => track.stop());
    activeMediaStream = null;
  }
  activeMediaRecorder = null;

  try {
    const transcript = await transcribeRecordedAudio(audioBlob);
    questionInput.value = transcript;
    statusOutput.textContent = "Consulta transcrita. Pulsa buscar.";
    questionInput.focus();
  } catch (error) {
    statusOutput.textContent = error.message;
  } finally {
    recordedChunks = [];
    isListening = false;
    if (listenButton) {
      listenButton.innerHTML = '<span aria-hidden="true">🎤</span>';
      listenButton.setAttribute("aria-label", "Hablar pregunta");
      listenButton.setAttribute("title", browserSupportsAudioRecording() ? "Iniciar grabacion" : "Hablar pregunta");
    }
  }
}

async function startAudioRecording() {
  if (!statusOutput || !questionInput || !browserSupportsAudioRecording()) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    activeMediaStream = stream;
    activeMediaRecorder = recorder;
    recordedChunks = [];
    isListening = true;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    recorder.start();
    if (listenButton) {
      listenButton.innerHTML = '<span aria-hidden="true">■</span>';
      listenButton.setAttribute("aria-label", "Detener grabacion");
      listenButton.setAttribute("title", "Detener grabacion");
    }
    statusOutput.textContent = "Grabando tu consulta. Pulsa otra vez para detener.";
  } catch (error) {
    stopListening();
    statusOutput.textContent = "No se ha podido acceder al micrófono.";
  }
}

function startListening() {
  const RecognitionClass = getSpeechRecognitionClass();

  if (!statusOutput || !questionInput) {
    return;
  }

  if (isListening) {
    if (activeMediaRecorder) {
      stopAudioRecording();
    } else {
      stopListening();
    }
    return;
  }

  if (browserSupportsAudioRecording()) {
    startAudioRecording();
    return;
  }

  if (!RecognitionClass) {
    statusOutput.textContent = "Tu navegador no permite grabar audio desde esta pagina.";
    return;
  }

  const recognition = new RecognitionClass();
  activeRecognition = recognition;
  isListening = true;

  recognition.lang = "es-ES";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  const originalQuestion = questionInput.value.trim();

  recognition.onstart = () => {
    if (listenButton) {
      listenButton.innerHTML = '<span aria-hidden="true">■</span>';
      listenButton.setAttribute("aria-label", "Detener dictado");
      listenButton.setAttribute("title", "Detener dictado");
    }
    statusOutput.textContent = "Escuchando tu consulta...";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      transcript += event.results[index][0].transcript;
    }

    questionInput.value = transcript.trim();
    statusOutput.textContent = "Transcribiendo consulta...";

    const latestResult = event.results[event.results.length - 1];
    if (latestResult?.isFinal) {
      recognition.stop();
    }
  };

  recognition.onspeechend = () => {
    statusOutput.textContent = "Procesando audio...";
    recognition.stop();
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      statusOutput.textContent = "No se ha concedido acceso al micrófono.";
    } else if (event.error === "no-speech") {
      questionInput.value = originalQuestion;
      statusOutput.textContent = "No se ha detectado voz.";
    } else {
      statusOutput.textContent = "No se ha podido procesar el dictado.";
    }

    stopListening();
  };

  recognition.onend = () => {
    activeRecognition = null;
    isListening = false;
    if (listenButton) {
      listenButton.innerHTML = '<span aria-hidden="true">🎤</span>';
      listenButton.setAttribute("aria-label", "Hablar pregunta");
      listenButton.setAttribute("title", "Hablar pregunta");
    }

    if (questionInput.value.trim()) {
      statusOutput.textContent = "Consulta transcrita. Pulsa buscar.";
      questionInput.focus();
    } else {
      statusOutput.textContent = "No se ha transcrito ningún texto.";
    }
  };

  recognition.start();
}

function stopSpeech() {
  if (browserSupportsSpeech()) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (speakButton) {
    speakButton.innerHTML = '<span aria-hidden="true">🔊</span>';
    speakButton.setAttribute("aria-label", "Reproducir respuesta");
    speakButton.setAttribute("title", "Reproducir respuesta");
  }
}

function speakLastAnswer() {
  if (!lastAnswer || !browserSupportsSpeech() || !speakButton) {
    return;
  }

  if (activeUtterance) {
    stopSpeech();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(lastAnswer);
  const selectedVoice = availableVoices.find((voice) => voice.default)
    || availableVoices.find((voice) => voice.lang.toLowerCase().startsWith("es"))
    || availableVoices[0];
  utterance.lang = selectedVoice?.lang || "es-ES";
  utterance.rate = DEFAULT_VOICE_RATE;
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.onend = stopSpeech;
  utterance.onerror = stopSpeech;
  activeUtterance = utterance;
  speakButton.innerHTML = '<span aria-hidden="true">■</span>';
  speakButton.setAttribute("aria-label", "Detener audio");
  speakButton.setAttribute("title", "Detener audio");
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

searchInput?.addEventListener("input", () => {
  filterProducts(activeFilter, searchInput.value.trim().toLowerCase());
});

addToCartButtons.forEach((button) => {
  button.addEventListener("click", () => addToCart(button));
});

promptChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    if (!questionInput) {
      return;
    }
    questionInput.value = chip.dataset.question || "";
    questionInput.focus();
  });
});

speakButton?.addEventListener("click", speakLastAnswer);
listenButton?.addEventListener("click", startListening);

if (browserSupportsSpeech()) {
  fillVoiceOptions();
  if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = fillVoiceOptions;
  }
} else if (speakButton) {
  speakButton.disabled = true;
}

if (!browserSupportsRecognition() && listenButton) {
  if (!browserSupportsAudioRecording()) {
    listenButton.disabled = true;
    listenButton.setAttribute("title", "Tu navegador no permite dictado por voz.");
  }
}

if (form && questionInput && topKInput && submitButton && statusOutput && answerOutput && contextOutput && resultsOutput) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();
    const topK = Number.parseInt(topKInput.value, 10);

    if (!question) {
      statusOutput.textContent = "Escribe o dicta una consulta para continuar.";
      return;
    }

    stopSpeech();
    stopListening();
    submitButton.disabled = true;
    if (speakButton) {
      speakButton.disabled = true;
    }
    statusOutput.textContent = "Buscando productos e información relacionada...";
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
      answerOutput.textContent = lastAnswer || "No hay una respuesta disponible para esta consulta.";
      contextOutput.textContent = payload.context || "No hay información adicional disponible.";
      renderResults(payload.results || []);
      statusOutput.textContent = `${payload.retrieved_count} resultados utilizados para responder.`;
      if (speakButton) {
        speakButton.disabled = !lastAnswer || !browserSupportsSpeech();
      }
    } catch (error) {
      lastAnswer = "";
      answerOutput.textContent = "No se ha podido generar una respuesta.";
      contextOutput.textContent = "No se ha podido completar la consulta.";
      resultsOutput.innerHTML = '<p class="placeholder">Inténtalo de nuevo en unos segundos.</p>';
      statusOutput.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}

checkoutButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { items } = getCartSummary();
    if (!items.length) {
      return;
    }
    window.alert("Checkout no disponible todavía. El carrito ya está listo para integrarlo.");
  });
});

renderCart();
filterProducts(activeFilter, "");
