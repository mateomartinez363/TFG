from app.extensions import db


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("categories.id"),
        nullable=False,
    )
    sku = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(160), nullable=False)
    slug = db.Column(db.String(180), unique=True, nullable=False)
    brand = db.Column(db.String(120), nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    ingredients = db.Column(db.Text, nullable=True)
    unit_size = db.Column(db.String(60), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="EUR")
    is_organic = db.Column(db.Boolean, nullable=False, default=False)
    is_vegan = db.Column(db.Boolean, nullable=False, default=False)
    is_gluten_free = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )

    category = db.relationship("Category", back_populates="products", lazy=True)
    stock = db.relationship("Stock", back_populates="product", uselist=False)
    order_items = db.relationship("OrderItem", back_populates="product", lazy=True)
