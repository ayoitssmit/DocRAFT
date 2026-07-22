import os
import logging
from phoenix.otel import register
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from openinference.instrumentation.langchain import LangChainInstrumentor

logger = logging.getLogger("docraft.observability")

_observability_initialized = False
_tracer_provider = None

def setup_observability(app=None):
    """
    Sets up OpenTelemetry tracing and exports it to Arize Phoenix.
    Reads configuration from environment variables:
      - ENABLE_TRACING (default: true)
      - PHOENIX_PROJECT_NAME (default: DocRAFT)
      - PHOENIX_COLLECTOR_ENDPOINT (default: http://127.0.0.1:6006/v1/traces)
    """
    global _observability_initialized, _tracer_provider
    enable_tracing = os.getenv("ENABLE_TRACING", "true").lower() == "true"
    if not enable_tracing:
        return

    if not _observability_initialized:
        project_name = os.getenv("PHOENIX_PROJECT_NAME", "DocRAFT")
        collector_endpoint = os.getenv("PHOENIX_COLLECTOR_ENDPOINT", "http://127.0.0.1:6006/v1/traces")

        logger.info(f"Initializing Arize Phoenix tracing for project '{project_name}' pointing to '{collector_endpoint}'")
        try:
            # Register the Phoenix tracer provider
            _tracer_provider = register(
                project_name=project_name,
                endpoint=collector_endpoint,
                auto_instrument=True  # Automatically instruments packages like langchain/openai if installed
            )
            
            # Instrument LangGraph via LangChain instrumentor
            LangChainInstrumentor().instrument(tracer_provider=_tracer_provider)
            logger.info("✓ LangGraph (LangChain) instrumentation enabled.")
            _observability_initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize Arize Phoenix tracing: {e}", exc_info=True)

    if app is not None and _tracer_provider is not None:
        try:
            # Instrument FastAPI app if provided
            FastAPIInstrumentor.instrument_app(app, tracer_provider=_tracer_provider)
            logger.info("✓ FastAPI instrumentation enabled.")
        except Exception as e:
            logger.error(f"Failed to instrument FastAPI app: {e}", exc_info=True)

