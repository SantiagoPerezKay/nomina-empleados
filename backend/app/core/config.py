from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Webhook n8n — opcional, si no está configurado no se envía nada
    WEBHOOK_N8N_EVENTOS_URL: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
