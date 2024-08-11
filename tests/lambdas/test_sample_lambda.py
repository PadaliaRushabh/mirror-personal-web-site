# tests/test_your_module.py

from resources.lambdas.sample_lambda.index import unit_test_function


def test_unit_test_function():
    assert unit_test_function() == "unit test working"
