"""
Shared pytest fixtures for the Selenium test scripts.

Both the backend (http://localhost:8000) and the frontend
(http://localhost:3000) must already be running before the tests start.
Set BASE_URL to point at a different frontend, and HEADLESS=1 to run
Chrome without opening a window.
"""

import os

import pytest
from selenium import webdriver
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")


@pytest.fixture
def base_url() -> str:
    return BASE_URL


@pytest.fixture
def driver():

    """
    A fresh Chrome session per test. Selenium Manager downloads the
    matching chromedriver automatically, so no manual driver setup.
    """

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS") == "1":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,1000")

    drv = webdriver.Chrome(options=options)
    yield drv
    drv.quit()


@pytest.fixture
def wait(driver) -> WebDriverWait:

    # Default 15s wait for normal page interactions.
    return WebDriverWait(driver, 15)
