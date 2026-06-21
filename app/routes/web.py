from flask import Blueprint, render_template
from pathlib import Path
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.models import Category, Product

web_bp = Blueprint("web", __name__)
PRODUCT_IMAGE_DIR = Path(__file__).resolve().parent.parent / "static" / "images" / "products"


def resolve_product_image(product: Product) -> str | None:
    candidate_stems = [product.slug]
    if product.image_url:
        candidate_stems.append(Path(product.image_url).stem)

    for stem in dict.fromkeys(candidate_stems):
        for extension in ("jpeg", "jpg", "png", "webp"):
            relative_path = f"images/products/{stem}.{extension}"
            if (PRODUCT_IMAGE_DIR / f"{stem}.{extension}").exists():
                return relative_path

    return None


def truncate_text(text: str | None, max_length: int) -> str:
    if not text:
        return ""

    cleaned = " ".join(text.split())
    if len(cleaned) <= max_length:
        return cleaned

    return f"{cleaned[: max_length - 3].rstrip(' ,.;:-')}..."


def shorten_product_name(name: str, brand: str | None) -> str:
    cleaned = " ".join(name.split())
    if brand:
        brand_lower = brand.casefold()
        cleaned = cleaned.removeprefix(f"{brand} ").strip()
        if cleaned.casefold().startswith(brand_lower):
            cleaned = cleaned[len(brand):].strip(" ,-")

    return truncate_text(cleaned or name, 42)


def build_storefront_context() -> dict:
    categories: list[dict] = []
    products: list[dict] = []
    featured_products: list[dict] = []

    try:
        product_rows = (
            Product.query.options(
                selectinload(Product.category),
                selectinload(Product.stock),
            )
            .filter(Product.is_active.is_(True))
            .order_by(Product.id)
            .limit(8)
            .all()
        )

        category_rows = (
            Category.query.outerjoin(Product, Product.category_id == Category.id)
            .filter(Category.is_active.is_(True))
            .group_by(Category.id)
            .with_entities(
                Category.id,
                Category.name,
                Category.slug,
                Category.description,
                func.count(Product.id).label("product_count"),
            )
            .order_by(Category.name)
            .all()
        )
    except Exception:
        product_rows = []
        category_rows = []

    image_themes = [
        "almond",
        "oat",
        "tea",
        "berry",
        "cocoa",
        "leaf",
    ]

    for index, product in enumerate(product_rows):
        stock = product.stock.quantity_available if product.stock else 0
        badges = []
        if product.is_organic:
            badges.append("Bio")
        if product.is_vegan:
            badges.append("Vegano")
        if product.is_gluten_free:
            badges.append("Sin gluten")

        if stock <= 0:
            stock_label = "Sin stock"
        elif stock <= 5:
            stock_label = "Ultimas unidades"
        else:
            stock_label = "Disponible"

        item = (
            {
                "id": product.id,
                "name": product.name,
                "display_name": shorten_product_name(product.name, product.brand),
                "brand": product.brand,
                "description": product.description,
                "short_description": truncate_text(product.description, 96),
                "unit_size": product.unit_size,
                "price": float(product.price),
                "price_label": f"{float(product.price):.2f} EUR",
                "category_name": product.category.name if product.category else "Catalogo",
                "category_slug": product.category.slug if product.category else "catalogo",
                "stock_label": stock_label,
                "badges": badges,
                "image_url": resolve_product_image(product),
                "image_theme": image_themes[index % len(image_themes)],
            }
        )
        products.append(item)
        if index < 4:
            featured_products.append(item)

    for category in category_rows:
        categories.append(
            {
                "name": category.name,
                "slug": category.slug,
                "description": truncate_text(category.description, 72),
                "count": category.product_count,
            }
        )

    return {
        "categories": categories,
        "products": products,
        "featured_products": featured_products,
        "stats": {
            "product_count": len(products),
            "category_count": len(categories),
        },
    }


@web_bp.route("/")
def home():
    return render_template("index.html", **build_storefront_context())


@web_bp.route("/carrito")
def cart():
    return render_template("cart.html", **build_storefront_context())
