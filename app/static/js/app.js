const CART_STORAGE_KEY = "el_naranjo_cart";
const FREE_SHIPPING_THRESHOLD = 49;
const STANDARD_SHIPPING_COST = 4.9;

const form = document.getElementById("query-form");
const questionInput = document.getElementById("question");
const topKInput = document.getElementById("top-k");
const submitButton = document.getElementById("submit-button");
const statusOutput = document.getElementById("status");
const answerPreviewOutput = document.getElementById("voice-answer-preview");
const replayButton = document.getElementById("replay-button");
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
let activeAudioPlayback = null;
let audioContext = null;
let activeAudioSource = null;
let availableVoices = [];
let activeRecognition = null;
let activeMediaRecorder = null;
let activeMediaStream = null;
let recordedChunks = [];
let isListening = false;
let isProcessingAssistant = false;
let latestAssistantRunId = 0;
let latestPlaybackToken = 0;
let lastAutoplayRunId = 0;
let pendingNavigationPath = "";
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

function normalizeText(value) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildProductCatalog() {
  const items = new Map();

  addToCartButtons.forEach((button) => {
    const id = String(button.dataset.productId || "");
    if (!id || items.has(id)) {
      return;
    }

    const name = button.dataset.productName || "Producto";
    items.set(id, {
      id,
      name,
      normalizedName: normalizeText(name),
      price: Number.parseFloat(button.dataset.productPrice || "0"),
    });
  });

  return Array.from(items.values());
}

function extractRequestedQuantity(question) {
  const normalizedQuestion = normalizeText(question);
  const numericMatch = normalizedQuestion.match(/\b(\d+)\b/);
  if (numericMatch) {
    return Math.max(1, Number.parseInt(numericMatch[1], 10));
  }

  const quantityMap = new Map([
    ["un", 1],
    ["uno", 1],
    ["una", 1],
    ["dos", 2],
    ["tres", 3],
    ["cuatro", 4],
    ["cinco", 5],
    ["seis", 6],
  ]);

  for (const [word, quantity] of quantityMap.entries()) {
    if (normalizedQuestion.includes(` ${word} `) || normalizedQuestion.startsWith(`${word} `) || normalizedQuestion.endsWith(` ${word}`)) {
      return quantity;
    }
  }

  return 1;
}

function findRequestedProduct(question) {
  const normalizedQuestion = normalizeText(question);
  const catalog = buildProductCatalog();

  return catalog
    .filter((product) => normalizedQuestion.includes(product.normalizedName))
    .sort((left, right) => right.normalizedName.length - left.normalizedName.length)[0] || null;
}

function addProductToCartByIntent(product, quantity) {
  const existing = cart.get(product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.set(product.id, {
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
  }

  renderCart();
}

function resolveAssistantIntent(question) {
  const normalizedQuestion = ` ${normalizeText(question)} `;
  const wantsAddToCart =
    /\b(agrega|agregar|anade|añade|mete|meter|pon|poner|quiero)\b/.test(normalizedQuestion)
    && /\b(carrito|cesta)\b/.test(normalizedQuestion);
  const wantsCartPage =
    /\b(carrito|cesta)\b/.test(normalizedQuestion)
    && /\b(ir|vamos|lleva|llevame|abrir|abre|ver|mostrar|ensena|enseña)\b/.test(normalizedQuestion);
  const wantsCheckout =
    /\b(finalizar compra|tramitar pedido|checkout|pagar)\b/.test(normalizedQuestion);

  if (wantsAddToCart) {
    const product = findRequestedProduct(question);
    if (!product) {
      return {
        handled: true,
        answer: "No he encontrado ese producto en el catálogo visible. Pídemelo con el nombre exacto y lo añado al carrito.",
      };
    }

    const quantity = extractRequestedQuantity(question);
    addProductToCartByIntent(product, quantity);

    return {
      handled: true,
      answer: `${quantity === 1 ? "He añadido" : `He añadido ${quantity} unidades de`} ${quantity === 1 ? product.name : product.name} al carrito.`,
    };
  }

  if (wantsCheckout) {
    return {
      handled: true,
      answer: "Te llevo al resumen del pedido para finalizar la compra.",
      navigateTo: "/carrito#cart-summary",
    };
  }

  if (wantsCartPage) {
    return {
      handled: true,
      answer: "Te llevo a la página del carrito.",
      navigateTo: "/carrito",
    };
  }

  return { handled: false };
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

function browserSupportsAudioContext() {
  return Boolean(window.AudioContext || window.webkitAudioContext);
}

async function primeAudioPlayback() {
  if (!browserSupportsAudioContext()) {
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
}

function browserSupportsRecognition() {
  return Boolean(getSpeechRecognitionClass());
}

function setStatus(message) {
  if (statusOutput) {
    statusOutput.textContent = message;
  }
}

function setAnswerPreview(message) {
  if (answerPreviewOutput) {
    answerPreviewOutput.textContent = message;
  }
}

function setReplayVisibility(visible) {
  if (!replayButton) {
    return;
  }

  replayButton.hidden = !visible;
  replayButton.disabled = !visible || !lastAnswer;
}

function setMicrophoneState(state) {
  if (!listenButton) {
    return;
  }

  listenButton.classList.remove("is-listening", "is-processing", "is-speaking");

  if (state === "listening" || state === "processing" || state === "speaking") {
    listenButton.classList.add(`is-${state}`);
  }

  const labels = {
    idle: "Toca para hablar con el asistente",
    listening: "El asistente está escuchando tu consulta",
    processing: "El asistente está preparando la respuesta",
    speaking: "El asistente está respondiendo en voz alta",
  };

  const titles = {
    idle: "Toca para hablar",
    listening: "Escuchando",
    processing: "Procesando consulta",
    speaking: "Respondiendo",
  };

  listenButton.setAttribute("aria-label", labels[state] || labels.idle);
  listenButton.setAttribute("title", titles[state] || titles.idle);
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
  if (!isProcessingAssistant && !activeUtterance) {
    setMicrophoneState("idle");
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

  setStatus("Procesando audio...");

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
    if (!audioBlob.size) {
      throw new Error("No se ha podido capturar audio. Mantén pulsado el micrófono un poco más.");
    }

    const transcript = await transcribeRecordedAudio(audioBlob);
    if (questionInput) {
      questionInput.value = transcript;
    }

    if (!transcript.trim()) {
      setStatus("No se ha transcrito ningún texto.");
      setMicrophoneState("idle");
      return;
    }

    await runAssistantQuery(transcript);
  } catch (error) {
    setStatus(error.message);
  } finally {
    recordedChunks = [];
    isListening = false;
    if (!isProcessingAssistant && !activeUtterance) {
      setMicrophoneState("idle");
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

    recorder.start(250);
    setMicrophoneState("listening");
    setStatus("Escuchando tu consulta...");
  } catch (error) {
    stopListening();
    setStatus("No se ha podido acceder al micrófono.");
  }
}

function startListening() {
  const RecognitionClass = getSpeechRecognitionClass();

  if (!listenButton || isProcessingAssistant) {
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

  if (RecognitionClass) {
    const recognition = new RecognitionClass();
    activeRecognition = recognition;
    isListening = true;

    const originalQuestion = questionInput.value.trim();

    recognition.lang = "es-ES";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setMicrophoneState("listening");
      setStatus("Escuchando tu consulta...");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }

      questionInput.value = transcript.trim();
      setStatus("Transcribiendo consulta...");

      const latestResult = event.results[event.results.length - 1];
      if (latestResult?.isFinal) {
        recognition.stop();
      }
    };

    recognition.onspeechend = () => {
      setStatus("Procesando audio...");
      recognition.stop();
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setStatus("No se ha concedido acceso al micrófono.");
      } else if (event.error === "no-speech") {
        questionInput.value = originalQuestion;
        setStatus("No se ha detectado voz.");
      } else {
        setStatus("No se ha podido procesar el dictado.");
      }

      stopListening();
    };

    recognition.onend = async () => {
      activeRecognition = null;
      isListening = false;

      if (questionInput.value.trim()) {
        await runAssistantQuery(questionInput.value.trim());
      } else {
        setStatus("No se ha transcrito ningún texto.");
        setMicrophoneState("idle");
      }
    };

    recognition.start();
    return;
  }

  if (!browserSupportsAudioRecording()) {
    statusOutput.textContent = "Tu navegador no permite grabar audio desde esta pagina.";
    return;
  }
  startAudioRecording();
}

function stopSpeech() {
  latestPlaybackToken += 1;
  pendingNavigationPath = "";

  if (activeAudioSource) {
    activeAudioSource.onended = null;
    activeAudioSource.stop();
    activeAudioSource.disconnect();
    activeAudioSource = null;
  }

  if (activeAudioPlayback) {
    activeAudioPlayback.pause();
    activeAudioPlayback.src = "";
    activeAudioPlayback = null;
  }

  if (browserSupportsSpeech()) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (!isListening && !isProcessingAssistant) {
    setMicrophoneState("idle");
  }
}

async function playServerAudio(text, playbackToken) {
  const response = await fetch("/api/speak", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "No se ha podido generar el audio.");
  }

  if (audioContext && audioContext.state !== "closed") {
    const audioBuffer = await response.arrayBuffer();
    if (playbackToken !== latestPlaybackToken) {
      return;
    }
    const decodedBuffer = await audioContext.decodeAudioData(audioBuffer.slice(0));
    if (playbackToken !== latestPlaybackToken) {
      return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (playbackToken !== latestPlaybackToken) {
        return;
      }
      activeAudioSource = null;
      const navigationPath = pendingNavigationPath;
      pendingNavigationPath = "";
      if (!isProcessingAssistant && !isListening) {
        setMicrophoneState("idle");
        setStatus("Toca el micrófono para hablar.");
      }
      if (navigationPath) {
        window.location.assign(navigationPath);
      }
    };
    activeAudioSource = source;
    setMicrophoneState("speaking");
    setStatus("El asistente te está respondiendo...");
    source.start(0);
    return;
  }

  const audioBlob = await response.blob();
  if (playbackToken !== latestPlaybackToken) {
    return;
  }
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  audio.onplay = () => {
    if (playbackToken !== latestPlaybackToken) {
      return;
    }
    setMicrophoneState("speaking");
    setStatus("El asistente te está respondiendo...");
  };
  audio.onended = () => {
    if (playbackToken !== latestPlaybackToken) {
      URL.revokeObjectURL(audioUrl);
      return;
    }
    URL.revokeObjectURL(audioUrl);
    activeAudioPlayback = null;
    const navigationPath = pendingNavigationPath;
    pendingNavigationPath = "";
    if (!isProcessingAssistant && !isListening) {
      setMicrophoneState("idle");
      setStatus("Toca el micrófono para hablar.");
    }
    if (navigationPath) {
      window.location.assign(navigationPath);
    }
  };
  audio.onerror = () => {
    URL.revokeObjectURL(audioUrl);
    activeAudioPlayback = null;
    throw new Error("No se ha podido reproducir el audio generado.");
  };

  activeAudioPlayback = audio;
  await audio.play();
}

async function speakLastAnswer({ force = false, runId = latestAssistantRunId } = {}) {
  if (!lastAnswer) {
    return;
  }

  if (!force && runId === lastAutoplayRunId) {
    return;
  }

  if (activeUtterance || activeAudioPlayback || activeAudioSource) {
    stopSpeech();
    return;
  }

  if (!force) {
    lastAutoplayRunId = runId;
  }

  latestPlaybackToken += 1;
  const playbackToken = latestPlaybackToken;
  await playServerAudio(lastAnswer, playbackToken);
}

async function presentAssistantResponse(answer, options = {}) {
  lastAnswer = answer || "";
  answerOutput.textContent = lastAnswer || "No hay una respuesta disponible para esta consulta.";
  setAnswerPreview(lastAnswer || "No hay una respuesta disponible para esta consulta.");
  if (replayButton) {
    replayButton.disabled = !lastAnswer;
  }
  setReplayVisibility(false);
  pendingNavigationPath = options.navigateTo || "";

  if (!lastAnswer) {
    setMicrophoneState("idle");
    return;
  }

  setStatus("Respuesta lista. Te la leo ahora.");

  try {
    await speakLastAnswer({ runId: options.runId ?? latestAssistantRunId });
  } catch (error) {
    setStatus(`${error.message} Pulsa "Reproducir respuesta".`);
    setReplayVisibility(true);
    setMicrophoneState("idle");
    if (pendingNavigationPath) {
      window.location.assign(pendingNavigationPath);
    }
  }
}

async function runAssistantQuery(question) {
  if (!question || !answerOutput || !contextOutput || !resultsOutput) {
    return;
  }

  const localIntent = resolveAssistantIntent(question);
  if (localIntent.handled) {
    latestAssistantRunId += 1;
    const assistantRunId = latestAssistantRunId;
    setStatus("Ejecutando acción...");
    contextOutput.textContent = "Acción resuelta desde la interfaz de compra.";
    resultsOutput.innerHTML = "";
    await presentAssistantResponse(localIntent.answer, {
      navigateTo: localIntent.navigateTo,
      runId: assistantRunId,
    });
    return;
  }

  const topK = Number.parseInt(topKInput?.value || "5", 10);
  latestAssistantRunId += 1;
  const assistantRunId = latestAssistantRunId;
  isProcessingAssistant = true;
  stopSpeech();
  stopListening();
  setMicrophoneState("processing");
  setStatus("Buscando productos e información relacionada...");
  setAnswerPreview("Preparando respuesta...");
  setReplayVisibility(false);
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

    if (assistantRunId !== latestAssistantRunId) {
      return;
    }
    contextOutput.textContent = payload.context || "No hay información adicional disponible.";
    renderResults(payload.results || []);
    setStatus(
      (payload.answer || "")
        ? "Respuesta lista. Te la leo ahora."
        : `${payload.retrieved_count} resultados utilizados para responder.`,
    );

    await presentAssistantResponse(payload.answer || "", { runId: assistantRunId });
  } catch (error) {
    lastAnswer = "";
    answerOutput.textContent = "No se ha podido generar una respuesta.";
    setAnswerPreview("No se ha podido generar una respuesta.");
    contextOutput.textContent = "No se ha podido completar la consulta.";
    resultsOutput.innerHTML = '<p class="placeholder">Inténtalo de nuevo en unos segundos.</p>';
    setStatus(error.message);
    setMicrophoneState("idle");
    setReplayVisibility(false);
  } finally {
    isProcessingAssistant = false;
  }
}

async function handleMicrophoneClick(event) {
  event.preventDefault();

  if (isProcessingAssistant) {
    return;
  }

  await primeAudioPlayback();

  if (activeUtterance) {
    stopSpeech();
    return;
  }

  if (isListening) {
    if (activeMediaRecorder) {
      stopAudioRecording();
    } else if (activeRecognition) {
      activeRecognition.stop();
    } else {
      stopListening();
    }
    return;
  }

  startListening();
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

if (browserSupportsSpeech()) {
  fillVoiceOptions();
  if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = fillVoiceOptions;
  }
}

if (!browserSupportsRecognition() && listenButton) {
  if (!browserSupportsAudioRecording()) {
    listenButton.disabled = true;
    listenButton.setAttribute("title", "Tu navegador no permite dictado por voz.");
  }
}

if (listenButton) {
  listenButton.addEventListener("click", handleMicrophoneClick);
}

replayButton?.addEventListener("click", async () => {
  if (!lastAnswer) {
    return;
  }

  try {
    await primeAudioPlayback();
    setReplayVisibility(true);
    await speakLastAnswer({ force: true });
  } catch (error) {
    setStatus(error.message);
  }
});

if (form && questionInput && topKInput && submitButton && statusOutput && answerOutput && contextOutput && resultsOutput) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();

    if (!question) {
      setStatus("Escribe o dicta una consulta para continuar.");
      return;
    }

    try {
      submitButton.disabled = true;
      await runAssistantQuery(question);
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
