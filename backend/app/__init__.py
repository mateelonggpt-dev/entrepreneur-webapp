from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .config.settings import get_settings
from .extensions import db, login_manager, migrate
from .models import User
from .routes.api import api_blueprint
from .services.user_service import ensure_default_user


def create_app() -> Flask:
    app = Flask(__name__)
    settings = get_settings()

    app.config["JSON_SORT_KEYS"] = False
    app.config["JSON_AS_ASCII"] = False
    app.config["SECRET_KEY"] = settings.secret_key
    app.config["SQLALCHEMY_DATABASE_URI"] = settings.database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SESSION_COOKIE_NAME"] = "matteracc_session"
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    app.json.ensure_ascii = False

    @login_manager.user_loader
    def load_user(user_id: str):
        try:
            return db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            return None

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": list(settings.frontend_origins),
            }
        },
        supports_credentials=True,
    )

    app.register_blueprint(api_blueprint, url_prefix="/api")

    with app.app_context():
        db.create_all()
        ensure_default_user()

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException):
        response = {
            "ok": False,
            "error": {
                "status": error.code or 500,
                "type": error.name,
                "message": error.description,
                "path": request.path,
            },
        }
        return jsonify(response), error.code or 500

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error: Exception):
        app.logger.exception("Unhandled application error", exc_info=error)
        response = {
            "ok": False,
            "error": {
                "status": 500,
                "type": "InternalServerError",
                "message": "Internal server error. Check the backend logs for details.",
                "path": request.path,
            },
        }
        return jsonify(response), 500

    return app
