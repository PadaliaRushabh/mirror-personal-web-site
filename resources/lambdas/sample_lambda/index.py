"""
sample lambda
"""

import logging
import os

logger = logging.getLogger("MyTestLambda")
logger.setLevel(os.getenv("LOG_LEVEL", "INFO"))

def unit_test_function() -> str:
    """sample function for unit test

    Returns:
        string: sample return for unit test
    """
    return "unit test working"


def handler(event: dict, context: any) -> dict:
    """lambda handler

    Args:
        event (dict): payload
        context (dict): context param

    Returns:
        dict: sample return
    """
    logging.info(f"Starting lambda with event: {event}")

    return {
        "result": "Yay, we deployed a lambda!"
    }
    