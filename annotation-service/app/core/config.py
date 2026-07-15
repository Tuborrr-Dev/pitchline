from pydantic_settings import BaseSettings, SettingsConfigDict


# to get the settings from the .env file, we use pydantic's BaseSettings class.
# This allows us to define our settings as class attributes and automatically load them from the .env file. The SettingsConfigDict is used to configure the settings class, specifying the env_file and env_file_encoding.
class Settings(BaseSettings):
    TXLINE_BASE_URL: str
    TXLINE_API_KEY: str
    TXLINE_JWT_TOKEN: str
    GEMINI_API_KEY: str
    GROQ_API_KEY: str
    DATABASE_URL: str
    MAIN_APP_URL: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
