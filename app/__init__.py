from flask import Flask

from app.config import Config
from app.extensions import init_extensions
from app.routes import register_blueprints


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    init_extensions(app)
    from app import models  # noqa: F401

    register_blueprints(app)

    return app
