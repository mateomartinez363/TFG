## Cambios guardados

- Rediseño de la home hacia una estructura de ecommerce inspirada en themes tipo Shopify/Dawn.
- Integración de catálogo visible con productos destacados, colecciones, búsqueda local, filtros y carrito en cliente.
- Reubicación del asistente RAG como bloque secundario de compra asistida.
- Añadido el campo `image_url` a `Product` y migración para soportar una imagen principal por producto.
- Actualizado el seed para rellenar `image_url` por `slug`.
- Integrada la carga de imágenes reales desde `app/static/images/products/`.
- Añadida resolución automática de imágenes por `slug` y por extensión (`jpeg`, `jpg`, `png`, `webp`).
- Renombradas las imágenes cargadas para que coincidan con los productos del seed.
