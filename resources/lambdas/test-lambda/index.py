import logging
import os

logger = logging.getLogger("MyTestLambda")
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

def handler(event, context):
    logging.info(f"Starting lambda with event: {event}")

    return {
        "result": "Yay, we deployed a lambda!"
    }
    