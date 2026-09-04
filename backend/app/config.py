from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO = Path(__file__).resolve().parents[2]  # chat-agent/


class Settings(BaseSettings):
    # Vertex AI (matches the region my-peptides runs Gemini in)
    GCP_PROJECT_ID: str = "doctor-chatbot-507406"
    GCP_REGION: str = "europe-west4"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    # Live native-audio model for the "Talk to the Prof" voice call (europe-west4).
    GEMINI_LIVE_MODEL: str = "gemini-live-2.5-flash-native-audio"
    LIVE_VOICE: str = "Charon"        # matches the read-aloud Chirp voice family
    LIVE_MAX_CALL_SEC: int = 600      # bound a single call (Live caps ~10-15 min anyway)

    # Auth: "adc" = Application Default Credentials (service account on Cloud Run, or
    # `gcloud auth application-default login` locally) — the production path.
    # "gcloud" = use the ACTIVE gcloud account's token via the CLI — a local-dev
    # convenience that needs no ADC / no fresh 2FA.
    GEMINI_AUTH: str = "adc"
    # Optional, gcloud mode only: pin the token to one signed-in account so local
    # dev keeps working whichever gcloud configuration happens to be active.
    GCLOUD_ACCOUNT: str = ""

    # Generation (snappy answers; headroom for gemini-2.5-flash's thinking tokens)
    TEMPERATURE: float = 0.3
    MAX_OUTPUT_TOKENS: int = 2048

    # Text-to-Speech (Google Cloud TTS). Studio = premium "voiceover" voices;
    # Chirp3-HD = newest generative voices. Swap TTS_VOICE to any en-GB voice name.
    TTS_LANGUAGE_CODE: str = "en-GB"
    TTS_VOICE: str = "en-GB-Studio-B"
    TTS_AUDIO_ENCODING: str = "MP3"
    TTS_SPEAKING_RATE: float = 1.0

    # Abuse / cost guards (bound per-call cost and request frequency)
    MAX_MESSAGE_CHARS: int = 2000       # reject longer user messages
    MAX_HISTORY_TURNS: int = 16         # trim client-sent history to the last N turns
    MAX_TURN_CHARS: int = 4000          # cap each history turn's text
    RATE_LIMIT_MAX: int = 20            # max requests per window, per client IP
    RATE_LIMIT_WINDOW_SEC: int = 60

    # Where the brain lives
    PROMPT_PATH: str = str(REPO / "prompts" / "system-instructions.md")
    CATALOGUE_DIR: str = str(REPO / "catalogue")

    # Speech-to-Text for the hold-to-talk button (server-side, any browser).
    STT_LANGUAGE_CODE: str = "en-GB"
    STT_MODEL: str = "latest_short"   # tuned for short utterances, punctuation on

    model_config = SettingsConfigDict(env_file=str(REPO / ".env"), extra="ignore")


settings = Settings()
