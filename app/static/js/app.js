const form = document.getElementById("query-form");
const questionInput = document.getElementById("question");
const topKInput = document.getElementById("top-k");
const submitButton = document.getElementById("submit-button");
const statusOutput = document.getElementById("status");
const answerOutput = document.getElementById("answer-output");
const contextOutput = document.getElementById("context-output");
const resultsOutput = document.getElementById("results-output");

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  const topK = Number.parseInt(topKInput.value, 10);

  if (!question) {
    statusOutput.textContent = "Debes escribir una pregunta.";
    return;
  }

  submitButton.disabled = true;
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

    answerOutput.textContent = payload.answer || "No se genero respuesta.";
    contextOutput.textContent = payload.context || "No se genero contexto.";
    renderResults(payload.results || []);
    statusOutput.textContent = `Recuperados ${payload.retrieved_count} fragmentos.`;
  } catch (error) {
    answerOutput.textContent = "No se pudo generar la respuesta.";
    contextOutput.textContent = "No se pudo completar la consulta.";
    resultsOutput.innerHTML = '<p class="placeholder">Revisa el error e intentalo de nuevo.</p>';
    statusOutput.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});
