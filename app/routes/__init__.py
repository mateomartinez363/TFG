from flask import Flask

from app.routes.api import api_bp
from app.routes.web import web_bp


def register_blueprints(app: Flask) -> None:
    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)
