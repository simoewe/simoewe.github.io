"""WSGI entrypoint for Render deployments."""

from backend.app import app

__all__ = ("app",)
