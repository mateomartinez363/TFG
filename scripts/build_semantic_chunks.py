from app import create_app
from app.extensions import db
from app.models import Order, Product, SemanticChunk, Shipment
from app.services.semantic_text_service import (
    build_order_chunks,
    build_product_chunks,
    build_shipment_chunks,
)


def replace_semantic_chunks() -> None:
    db.session.query(SemanticChunk).delete()
    db.session.flush()

    for product in Product.query.order_by(Product.id).all():
        for chunk in build_product_chunks(product):
            db.session.add(
                SemanticChunk(
                    source_type=chunk.source_type,
                    source_id=chunk.source_id,
                    source_label=chunk.source_label,
                    chunk_key=chunk.chunk_key,
                    content=chunk.content,
                    chunk_metadata=chunk.chunk_metadata,
                )
            )

    for order in Order.query.order_by(Order.id).all():
        for chunk in build_order_chunks(order):
            db.session.add(
                SemanticChunk(
                    source_type=chunk.source_type,
                    source_id=chunk.source_id,
                    source_label=chunk.source_label,
                    chunk_key=chunk.chunk_key,
                    content=chunk.content,
                    chunk_metadata=chunk.chunk_metadata,
                )
            )

    for shipment in Shipment.query.order_by(Shipment.id).all():
        for chunk in build_shipment_chunks(shipment):
            db.session.add(
                SemanticChunk(
                    source_type=chunk.source_type,
                    source_id=chunk.source_id,
                    source_label=chunk.source_label,
                    chunk_key=chunk.chunk_key,
                    content=chunk.content,
                    chunk_metadata=chunk.chunk_metadata,
                )
            )

    db.session.commit()


def print_summary() -> None:
    print("Fragmentos semanticos generados:")
    print(f"- total: {SemanticChunk.query.count()}")
    print(f"- product: {SemanticChunk.query.filter_by(source_type='product').count()}")
    print(f"- order: {SemanticChunk.query.filter_by(source_type='order').count()}")
    print(f"- shipment: {SemanticChunk.query.filter_by(source_type='shipment').count()}")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        replace_semantic_chunks()
        print_summary()
