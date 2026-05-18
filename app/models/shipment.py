from app.extensions import db


class Shipment(db.Model):
    __tablename__ = "shipments"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(
        db.Integer,
        db.ForeignKey("orders.id"),
        nullable=False,
    )
    status = db.Column(db.String(40), nullable=False, default="preparing")
    carrier = db.Column(db.String(80), nullable=True)
    tracking_code = db.Column(db.String(100), unique=True, nullable=True)
    shipping_address = db.Column(db.String(255), nullable=False)
    shipping_city = db.Column(db.String(120), nullable=False)
    shipping_postal_code = db.Column(db.String(20), nullable=False)
    shipped_at = db.Column(db.DateTime(timezone=True), nullable=True)
    delivered_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        server_default=db.func.now(),
    )

    order = db.relationship("Order", back_populates="shipments", lazy=True)
