from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app import create_app
from app.extensions import db
from app.models import Category, Customer, Order, OrderItem, Product, Shipment, Stock


CATEGORY_DATA = [
    {
        "name": "Frutos secos y semillas",
        "description": "Alimentos ricos en grasas saludables, proteina vegetal y fibra.",
    },
    {
        "name": "Cereales y legumbres",
        "description": "Bases alimentarias integrales para desayunos, platos principales y recetas saludables.",
    },
    {
        "name": "Infusiones y bebidas",
        "description": "Bebidas naturales, tes funcionales y alternativas vegetales.",
    },
    {
        "name": "Snacks saludables",
        "description": "Picoteo natural con ingredientes sencillos y perfiles nutricionales equilibrados.",
    },
    {
        "name": "Superalimentos",
        "description": "Productos con alto valor nutricional para complementar la dieta diaria.",
    },
    {
        "name": "Dietetica y suplementacion",
        "description": "Complementos naturales orientados a energia, digestion y bienestar general.",
    },
]


PRODUCT_DATA = [
    {
        "category": "Frutos secos y semillas",
        "sku": "NAR-ALM-250",
        "name": "Almendra cruda pelada",
        "brand": "El Naranjo",
        "description": "Almendra nacional cruda, sin sal y lista para consumir o usar en reposteria saludable.",
        "ingredients": "Almendra cruda pelada.",
        "unit_size": "250 g",
        "price": Decimal("4.80"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 42, "reserved": 4, "reorder_level": 10},
    },
    {
        "category": "Frutos secos y semillas",
        "sku": "NAR-CHIA-300",
        "name": "Semillas de chia bio",
        "brand": "NaturGreen",
        "description": "Semillas de chia ricas en fibra y omega 3 para desayunos, yogures y panes caseros.",
        "ingredients": "Semillas de chia ecologicas.",
        "unit_size": "300 g",
        "price": Decimal("3.95"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 35, "reserved": 3, "reorder_level": 8},
    },
    {
        "category": "Frutos secos y semillas",
        "sku": "NAR-CAL-200",
        "name": "Anacardos tostados sin sal",
        "brand": "El Naranjo",
        "description": "Anacardos tostados sin aceites refinados ni sal anadida, pensados para snack o topping.",
        "ingredients": "Anacardos tostados.",
        "unit_size": "200 g",
        "price": Decimal("5.20"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 28, "reserved": 2, "reorder_level": 8},
    },
    {
        "category": "Cereales y legumbres",
        "sku": "NAR-AVN-500",
        "name": "Copos de avena integral",
        "brand": "El Granero",
        "description": "Copos de avena integral finos para porridge, granola casera y galletas.",
        "ingredients": "Copos de avena integral.",
        "unit_size": "500 g",
        "price": Decimal("2.60"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": False,
        "stock": {"available": 50, "reserved": 6, "reorder_level": 12},
    },
    {
        "category": "Cereales y legumbres",
        "sku": "NAR-QNO-500",
        "name": "Quinoa real ecologica",
        "brand": "BioAndes",
        "description": "Quinoa blanca ecologica con alto aporte proteico y coccion rapida.",
        "ingredients": "Quinoa real ecologica.",
        "unit_size": "500 g",
        "price": Decimal("4.40"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 24, "reserved": 1, "reorder_level": 6},
    },
    {
        "category": "Cereales y legumbres",
        "sku": "NAR-LRJ-500",
        "name": "Lenteja roja pelada",
        "brand": "El Naranjo",
        "description": "Legumbre de coccion rapida, ideal para cremas, dhal y hamburguesas vegetales.",
        "ingredients": "Lenteja roja pelada.",
        "unit_size": "500 g",
        "price": Decimal("3.10"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 31, "reserved": 2, "reorder_level": 7},
    },
    {
        "category": "Infusiones y bebidas",
        "sku": "NAR-MAT-100",
        "name": "Te matcha ceremonial",
        "brand": "Matcha Zen",
        "description": "Matcha japones de grado ceremonial para infusion o latte vegetal.",
        "ingredients": "Te verde matcha en polvo.",
        "unit_size": "100 g",
        "price": Decimal("12.90"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 18, "reserved": 2, "reorder_level": 5},
    },
    {
        "category": "Infusiones y bebidas",
        "sku": "NAR-KOM-750",
        "name": "Kombucha de jengibre y limon",
        "brand": "Viva Kombucha",
        "description": "Bebida fermentada ligeramente gasificada con notas citricas y especiadas.",
        "ingredients": "Agua filtrada, te verde, azucar de cana, cultivo kombucha, jengibre, limon.",
        "unit_size": "750 ml",
        "price": Decimal("3.85"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 22, "reserved": 1, "reorder_level": 6},
    },
    {
        "category": "Infusiones y bebidas",
        "sku": "NAR-ALM-BEB-1L",
        "name": "Bebida de almendra sin azucar",
        "brand": "Natumi",
        "description": "Bebida vegetal de almendra sin azucares anadidos para cafe, cereal o cocina.",
        "ingredients": "Agua, almendra, sal marina.",
        "unit_size": "1 L",
        "price": Decimal("2.95"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 27, "reserved": 3, "reorder_level": 8},
    },
    {
        "category": "Snacks saludables",
        "sku": "NAR-BAR-DAT-3",
        "name": "Barritas de datil y cacao",
        "brand": "El Naranjo",
        "description": "Pack de tres barritas con datil, cacao puro y frutos secos, sin azucar refinado.",
        "ingredients": "Datil, almendra, cacao puro, avellana.",
        "unit_size": "3 x 35 g",
        "price": Decimal("2.75"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 46, "reserved": 5, "reorder_level": 10},
    },
    {
        "category": "Snacks saludables",
        "sku": "NAR-CRK-ROM-150",
        "name": "Crackers de romero y espelta",
        "brand": "Soria Natural",
        "description": "Crackers horneados con harina de espelta y romero, ideales para aperitivos.",
        "ingredients": "Harina de espelta, aceite de oliva, romero, sal marina.",
        "unit_size": "150 g",
        "price": Decimal("2.45"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": False,
        "stock": {"available": 20, "reserved": 0, "reorder_level": 6},
    },
    {
        "category": "Snacks saludables",
        "sku": "NAR-CHOC-85-90",
        "name": "Chocolate negro 85%",
        "brand": "Santiveri",
        "description": "Tableta de chocolate negro intenso con bajo contenido en azucar.",
        "ingredients": "Pasta de cacao, manteca de cacao, azucar de cana.",
        "unit_size": "90 g",
        "price": Decimal("2.90"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 33, "reserved": 4, "reorder_level": 8},
    },
    {
        "category": "Superalimentos",
        "sku": "NAR-MAC-250",
        "name": "Maca andina en polvo",
        "brand": "Energy Feelings",
        "description": "Maca peruana en polvo para smoothies, yogures o recetas energeticas.",
        "ingredients": "Maca andina en polvo.",
        "unit_size": "250 g",
        "price": Decimal("6.50"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 15, "reserved": 1, "reorder_level": 5},
    },
    {
        "category": "Superalimentos",
        "sku": "NAR-CAC-200",
        "name": "Cacao puro en polvo",
        "brand": "El Naranjo",
        "description": "Cacao desgrasado sin azucar para reposteria y bebidas calientes.",
        "ingredients": "Cacao puro en polvo.",
        "unit_size": "200 g",
        "price": Decimal("4.15"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 29, "reserved": 2, "reorder_level": 7},
    },
    {
        "category": "Superalimentos",
        "sku": "NAR-SPI-150",
        "name": "Spirulina ecologica",
        "brand": "Iswari",
        "description": "Spirulina en polvo de cultivo ecologico, concentrada en micronutrientes.",
        "ingredients": "Spirulina ecologica en polvo.",
        "unit_size": "150 g",
        "price": Decimal("8.90"),
        "is_organic": True,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 12, "reserved": 1, "reorder_level": 4},
    },
    {
        "category": "Dietetica y suplementacion",
        "sku": "NAR-PRO-VEG-500",
        "name": "Proteina vegetal vainilla",
        "brand": "NutriSport",
        "description": "Preparado proteico vegetal con guisante y arroz, sabor vainilla natural.",
        "ingredients": "Proteina de guisante, proteina de arroz, aroma natural de vainilla.",
        "unit_size": "500 g",
        "price": Decimal("18.50"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 14, "reserved": 2, "reorder_level": 4},
    },
    {
        "category": "Dietetica y suplementacion",
        "sku": "NAR-COL-200",
        "name": "Colageno marino hidrolizado",
        "brand": "Ana Maria Lajusticia",
        "description": "Complemento de colageno marino hidrolizado en polvo para mezclar con bebidas.",
        "ingredients": "Colageno marino hidrolizado.",
        "unit_size": "200 g",
        "price": Decimal("16.95"),
        "is_organic": False,
        "is_vegan": False,
        "is_gluten_free": True,
        "stock": {"available": 11, "reserved": 1, "reorder_level": 4},
    },
    {
        "category": "Dietetica y suplementacion",
        "sku": "NAR-MAG-120",
        "name": "Magnesio citrato capsulas",
        "brand": "Solaray",
        "description": "Suplemento de magnesio en capsulas para apoyo muscular y nervioso.",
        "ingredients": "Citrato de magnesio, capsula vegetal.",
        "unit_size": "120 capsulas",
        "price": Decimal("13.20"),
        "is_organic": False,
        "is_vegan": True,
        "is_gluten_free": True,
        "stock": {"available": 19, "reserved": 2, "reorder_level": 5},
    },
]


CUSTOMER_DATA = [
    {"first_name": "Lucia", "last_name": "Martinez", "email": "lucia.martinez@example.com", "phone": "600111222", "city": "Sevilla"},
    {"first_name": "Carlos", "last_name": "Ruiz", "email": "carlos.ruiz@example.com", "phone": "600111223", "city": "Granada"},
    {"first_name": "Ana", "last_name": "Lopez", "email": "ana.lopez@example.com", "phone": "600111224", "city": "Malaga"},
    {"first_name": "Javier", "last_name": "Santos", "email": "javier.santos@example.com", "phone": "600111225", "city": "Cadiz"},
    {"first_name": "Elena", "last_name": "Navarro", "email": "elena.navarro@example.com", "phone": "600111226", "city": "Cordoba"},
    {"first_name": "Marta", "last_name": "Gil", "email": "marta.gil@example.com", "phone": "600111227", "city": "Huelva"},
]


ORDER_DATA = [
    {
        "customer_email": "lucia.martinez@example.com",
        "order_number": "EN-2026-0001",
        "status": "delivered",
        "created_at": datetime(2026, 4, 2, 10, 15, tzinfo=UTC),
        "items": [("NAR-QNO-500", 2), ("NAR-CHIA-300", 1), ("NAR-ALM-BEB-1L", 2)],
        "shipment": {
            "status": "delivered",
            "carrier": "Correos Express",
            "tracking_code": "CEX0001001",
            "shipping_address": "Calle Feria 12",
            "shipping_city": "Sevilla",
            "shipping_postal_code": "41003",
            "shipped_at": datetime(2026, 4, 3, 9, 0, tzinfo=UTC),
            "delivered_at": datetime(2026, 4, 4, 12, 30, tzinfo=UTC),
        },
    },
    {
        "customer_email": "carlos.ruiz@example.com",
        "order_number": "EN-2026-0002",
        "status": "delivered",
        "created_at": datetime(2026, 4, 5, 16, 40, tzinfo=UTC),
        "items": [("NAR-AVN-500", 2), ("NAR-CAC-200", 1), ("NAR-CHOC-85-90", 3)],
        "shipment": {
            "status": "delivered",
            "carrier": "SEUR",
            "tracking_code": "SEU0002002",
            "shipping_address": "Avenida Constitucion 88",
            "shipping_city": "Granada",
            "shipping_postal_code": "18012",
            "shipped_at": datetime(2026, 4, 6, 8, 45, tzinfo=UTC),
            "delivered_at": datetime(2026, 4, 7, 13, 10, tzinfo=UTC),
        },
    },
    {
        "customer_email": "ana.lopez@example.com",
        "order_number": "EN-2026-0003",
        "status": "shipped",
        "created_at": datetime(2026, 4, 9, 11, 10, tzinfo=UTC),
        "items": [("NAR-MAT-100", 1), ("NAR-MAC-250", 1), ("NAR-BAR-DAT-3", 2)],
        "shipment": {
            "status": "in_transit",
            "carrier": "MRW",
            "tracking_code": "MRW0003003",
            "shipping_address": "Paseo Maritimo 44",
            "shipping_city": "Malaga",
            "shipping_postal_code": "29016",
            "shipped_at": datetime(2026, 4, 10, 10, 20, tzinfo=UTC),
            "delivered_at": None,
        },
    },
    {
        "customer_email": "javier.santos@example.com",
        "order_number": "EN-2026-0004",
        "status": "preparing",
        "created_at": datetime(2026, 4, 11, 18, 5, tzinfo=UTC),
        "items": [("NAR-LRJ-500", 3), ("NAR-CRK-ROM-150", 2)],
        "shipment": {
            "status": "preparing",
            "carrier": None,
            "tracking_code": None,
            "shipping_address": "Calle Ancha 5",
            "shipping_city": "Cadiz",
            "shipping_postal_code": "11001",
            "shipped_at": None,
            "delivered_at": None,
        },
    },
    {
        "customer_email": "elena.navarro@example.com",
        "order_number": "EN-2026-0005",
        "status": "delivered",
        "created_at": datetime(2026, 4, 14, 9, 30, tzinfo=UTC),
        "items": [("NAR-PRO-VEG-500", 1), ("NAR-CHIA-300", 1), ("NAR-ALM-250", 1)],
        "shipment": {
            "status": "delivered",
            "carrier": "Correos Express",
            "tracking_code": "CEX0005005",
            "shipping_address": "Avenida Republica Argentina 31",
            "shipping_city": "Cordoba",
            "shipping_postal_code": "14004",
            "shipped_at": datetime(2026, 4, 15, 8, 10, tzinfo=UTC),
            "delivered_at": datetime(2026, 4, 16, 11, 55, tzinfo=UTC),
        },
    },
    {
        "customer_email": "marta.gil@example.com",
        "order_number": "EN-2026-0006",
        "status": "cancelled",
        "created_at": datetime(2026, 4, 18, 12, 0, tzinfo=UTC),
        "items": [("NAR-KOM-750", 4), ("NAR-SPI-150", 1)],
        "shipment": {
            "status": "cancelled",
            "carrier": None,
            "tracking_code": None,
            "shipping_address": "Plaza de las Monjas 9",
            "shipping_city": "Huelva",
            "shipping_postal_code": "21001",
            "shipped_at": None,
            "delivered_at": None,
        },
    },
]


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def clear_database() -> None:
    for model in (Shipment, OrderItem, Order, Stock, Product, Category, Customer):
        db.session.query(model).delete()
    db.session.commit()


def seed_categories() -> dict[str, Category]:
    categories: dict[str, Category] = {}

    for item in CATEGORY_DATA:
        category = Category(
            name=item["name"],
            slug=slugify(item["name"]),
            description=item["description"],
            is_active=True,
        )
        db.session.add(category)
        categories[category.name] = category

    db.session.flush()
    return categories


def seed_products(categories: dict[str, Category]) -> dict[str, Product]:
    products: dict[str, Product] = {}

    for item in PRODUCT_DATA:
        slug = slugify(item["name"])
        product = Product(
            category=categories[item["category"]],
            sku=item["sku"],
            name=item["name"],
            slug=slug,
            brand=item["brand"],
            image_url=f"images/products/{slug}.jpeg",
            description=item["description"],
            ingredients=item["ingredients"],
            unit_size=item["unit_size"],
            price=item["price"],
            currency="EUR",
            is_organic=item["is_organic"],
            is_vegan=item["is_vegan"],
            is_gluten_free=item["is_gluten_free"],
            is_active=True,
        )
        db.session.add(product)
        db.session.flush()

        stock_item = item["stock"]
        db.session.add(
            Stock(
                product=product,
                quantity_available=stock_item["available"],
                quantity_reserved=stock_item["reserved"],
                reorder_level=stock_item["reorder_level"],
            )
        )
        products[product.sku] = product

    db.session.flush()
    return products


def seed_customers() -> dict[str, Customer]:
    customers: dict[str, Customer] = {}

    for item in CUSTOMER_DATA:
        customer = Customer(**item)
        db.session.add(customer)
        customers[customer.email] = customer

    db.session.flush()
    return customers


def build_order_items(order: Order, products: dict[str, Product], items: list[tuple[str, int]]) -> Decimal:
    total = Decimal("0.00")

    for sku, quantity in items:
        product = products[sku]
        unit_price = Decimal(product.price)
        line_total = unit_price * quantity
        total += line_total

        db.session.add(
            OrderItem(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                line_total=line_total,
            )
        )

    return total


def seed_orders(customers: dict[str, Customer], products: dict[str, Product]) -> None:
    for item in ORDER_DATA:
        order = Order(
            customer=customers[item["customer_email"]],
            order_number=item["order_number"],
            status=item["status"],
            total_amount=Decimal("0.00"),
            currency="EUR",
            created_at=item["created_at"],
        )
        db.session.add(order)
        db.session.flush()

        total = build_order_items(order, products, item["items"])
        order.total_amount = total

        shipment_data = item["shipment"]
        db.session.add(
            Shipment(
                order=order,
                status=shipment_data["status"],
                carrier=shipment_data["carrier"],
                tracking_code=shipment_data["tracking_code"],
                shipping_address=shipment_data["shipping_address"],
                shipping_city=shipment_data["shipping_city"],
                shipping_postal_code=shipment_data["shipping_postal_code"],
                shipped_at=shipment_data["shipped_at"],
                delivered_at=shipment_data["delivered_at"],
                created_at=item["created_at"] + timedelta(hours=2),
            )
        )


def print_summary() -> None:
    print("Seed completado:")
    print(f"- categorias: {Category.query.count()}")
    print(f"- productos: {Product.query.count()}")
    print(f"- clientes: {Customer.query.count()}")
    print(f"- pedidos: {Order.query.count()}")
    print(f"- lineas de pedido: {OrderItem.query.count()}")
    print(f"- envios: {Shipment.query.count()}")
    print(f"- stock: {Stock.query.count()}")


def seed_database() -> None:
    clear_database()
    categories = seed_categories()
    products = seed_products(categories)
    customers = seed_customers()
    seed_orders(customers, products)
    db.session.commit()
    print_summary()


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        seed_database()
