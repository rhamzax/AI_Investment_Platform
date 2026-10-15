"""
Test case 3: Generating a thesis and confirming a thesis is generated.

Precondition: TICKER is on the holdings page and has no thesis yet.
"""

import re

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

TICKER = "C"
COMPANY = "Citigroup"

# Ingestion + 3 LLM calls; the frontend itself gives up after 3 minutes.
GENERATION_TIMEOUT_S = 180
MIN_WORDS = 15

TICKER_LINK = (By.CSS_SELECTOR, f"a[href='/ticker/{TICKER}']")
GENERATE_BUTTON = (By.XPATH, "//button[normalize-space()='Generate Thesis']")
REGENERATE_BUTTON = (By.XPATH, "//button[normalize-space()='Regenerate Thesis']")
NO_THESIS = (By.XPATH, "//*[normalize-space()='No thesis generated yet.']")
CONFIDENCE = (By.XPATH, "//span[contains(., '% confidence')]")
SUMMARY = (By.XPATH, "//button[normalize-space()='Regenerate Thesis']/ancestor::div[contains(@class, 'rounded-2xl')][1]/p[contains(@class, 'leading-6')]")
BULL_CASE = (By.XPATH, "//h3[normalize-space()='Bull Case']/ancestor::div[contains(@class, 'rounded-2xl')][1]//p")
BEAR_CASE = (By.XPATH, "//h3[normalize-space()='Bear Case']/ancestor::div[contains(@class, 'rounded-2xl')][1]//p")


def test_generate_thesis(driver, wait, base_url):

    # Click on the name of the ticker in the holdings table.
    driver.get(base_url)
    wait.until(EC.element_to_be_clickable(TICKER_LINK)).click()

    # Verify it opened the ticker page (.../ticker/<ticker>).
    wait.until(lambda d: d.current_url.rstrip("/").endswith(f"/ticker/{TICKER}"))
    wait.until(EC.visibility_of_element_located(NO_THESIS))

    # Click "Generate Thesis" and wait for the thesis to arrive.
    wait.until(EC.element_to_be_clickable(GENERATE_BUTTON)).click()
    WebDriverWait(driver, GENERATION_TIMEOUT_S).until(
        EC.visibility_of_element_located(REGENERATE_BUTTON)
    )

    # Confidence percentage is filled in.
    confidence = wait.until(EC.visibility_of_element_located(CONFIDENCE)).text
    match = re.search(r"(\d+)% confidence", confidence)
    assert match, f"Unexpected confidence text: {confidence!r}"
    assert 0 < int(match.group(1)) <= 100

    # Summary, bull case and bear case contain real, legible text.
    sections = {
        "summary": wait.until(EC.visibility_of_element_located(SUMMARY)).text,
        "bull case": wait.until(EC.visibility_of_element_located(BULL_CASE)).text,
        "bear case": wait.until(EC.visibility_of_element_located(BEAR_CASE)).text,
    }
    for name, text in sections.items():
        words = re.findall(r"[A-Za-z]+", text)
        assert len(words) >= MIN_WORDS, f"{name} is too short: {text!r}"

    # The generated text is about this ticker.
    all_text = " ".join(sections.values())
    assert COMPANY.lower() in all_text.lower(), f"Thesis never mentions {COMPANY}"
