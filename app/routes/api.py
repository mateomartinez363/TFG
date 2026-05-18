from flask import Blueprint, jsonify, request

from app.services.llm_service import build_answer
from app.services.rag_service import build_context_block, search_semantic_chunks

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.route("/health")
def health():
    return jsonify({"status": "ok", "service": "el-naranjo"})


@api_bp.route("/query", methods=["POST"])
def query():
    payload = request.get_json(silent=True) or {}
    question = (payload.get("question") or "").strip()
    top_k = payload.get("top_k", 5)

    if not question:
        return jsonify({"error": "El campo 'question' es obligatorio."}), 400

    if not isinstance(top_k, int) or not 1 <= top_k <= 10:
        return jsonify({"error": "El campo 'top_k' debe ser un entero entre 1 y 10."}), 400

    try:
        retrieved_chunks = search_semantic_chunks(question=question, top_k=top_k)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    context = build_context_block(retrieved_chunks)
    try:
        answer = build_answer(question=question, context=context)
    except (ValueError, RuntimeError) as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify(
        {
            "question": question,
            "top_k": top_k,
            "retrieved_count": len(retrieved_chunks),
            "context": context,
            "answer": answer,
            "results": [
                {
                    "id": chunk.id,
                    "source_type": chunk.source_type,
                    "source_id": chunk.source_id,
                    "source_label": chunk.source_label,
                    "chunk_key": chunk.chunk_key,
                    "content": chunk.content,
                    "metadata": chunk.chunk_metadata,
                    "distance": chunk.distance,
                }
                for chunk in retrieved_chunks
            ],
        }
    )
