from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.models import Order, Product, Shipment


@dataclass(slots=True)
class SemanticChunkPayload:
    source_type: str
    source_id: int
    source_label: str
    chunk_key: str
    content: str
    chunk_metadata: dict[str, Any] = field(default_factory=dict)


def build_product_chunks(product: Product) -> list[SemanticChunkPayload]:
    tags = [
        "ecologico" if product.is_organic else None,
        "vegano" if product.is_vegan else None,
        "sin gluten" if product.is_gluten_free else None,
    ]
    tag_text = ", ".join(tag for tag in tags if tag) or "sin etiquetas destacadas"

    return [
        SemanticChunkPayload(
            source_type="product",
            source_id=product.id,
            source_label=product.name,
            chunk_key="catalog_summary",
            content=(
                f"Producto {product.name} de la marca {product.brand}. "
                f"Pertenece a la categoria {product.category.name}. "
                f"Formato {product.unit_size}. Precio {product.price} {product.currency}. "
                f"Etiquetas: {tag_text}. "
                f"Descripcion: {product.description or 'Sin descripcion disponible.'} "
                f"Ingredientes: {product.ingredients or 'No especificados.'}"
            ),
            chunk_metadata={
                "sku": product.sku,
                "category": product.category.name,
                "unit_size": product.unit_size,
                "price": str(product.price),
                "currency": product.currency,
                "is_organic": product.is_organic,
                "is_vegan": product.is_vegan,
                "is_gluten_free": product.is_gluten_free,
            },
        )
    ]


def build_order_chunks(order: Order) -> list[SemanticChunkPayload]:
    item_descriptions = [
        f"{item.quantity} x {item.product.name} ({item.line_total} {order.currency})"
        for item in order.items
    ]
    shipment_status = order.shipments[0].status if order.shipments else "sin envio"

    return [
        SemanticChunkPayload(
            source_type="order",
            source_id=order.id,
            source_label=order.order_number,
            chunk_key="order_summary",
            content=(
                f"Pedido {order.order_number} del cliente "
                f"{order.customer.first_name} {order.customer.last_name}. "
                f"Estado del pedido: {order.status}. "
                f"Estado del envio: {shipment_status}. "
                f"Importe total: {order.total_amount} {order.currency}. "
                f"Productos: {'; '.join(item_descriptions)}."
            ),
            chunk_metadata={
                "order_number": order.order_number,
                "customer_email": order.customer.email,
                "order_status": order.status,
                "shipment_status": shipment_status,
                "total_amount": str(order.total_amount),
                "currency": order.currency,
                "item_count": len(order.items),
            },
        )
    ]


def build_shipment_chunks(shipment: Shipment) -> list[SemanticChunkPayload]:
    return [
        SemanticChunkPayload(
            source_type="shipment",
            source_id=shipment.id,
            source_label=shipment.tracking_code or f"shipment-{shipment.id}",
            chunk_key="shipment_tracking",
            content=(
                f"Envio del pedido {shipment.order.order_number}. "
                f"Estado: {shipment.status}. "
                f"Transportista: {shipment.carrier or 'pendiente de asignacion'}. "
                f"Codigo de seguimiento: {shipment.tracking_code or 'no disponible'}. "
                f"Destino: {shipment.shipping_city}, {shipment.shipping_postal_code}."
            ),
            chunk_metadata={
                "order_number": shipment.order.order_number,
                "shipment_status": shipment.status,
                "carrier": shipment.carrier,
                "tracking_code": shipment.tracking_code,
                "shipping_city": shipment.shipping_city,
                "shipping_postal_code": shipment.shipping_postal_code,
            },
        )
    ]
