"""
Test case 1: Adding a new position to the watchlist and confirming its price
is fetched immediately and it's ready to have a thesis generated.

Precondition: TICKER is not already on the holdings page. The test removes
the position again afterwards, so it can be re-run.
"""

import re

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC

TICKER = "C"
COMPANY = "Citigroup"
SHARES = "10"
COST_BASIS = "415.25"

OPEN_FORM_BUTTON = (By.XPATH, "//button[normalize-space()='+ Add Position']")
TICKER_INPUT = (By.CSS_SELECTOR, "input[placeholder='Search company or ticker…']")
TICKER_OPTION = (By.XPATH, f"//button[.//span[normalize-space()='{TICKER}']]")
SELECTED_TICKER = (By.XPATH, f"//form//span[normalize-space()='{TICKER}']")
SHARES_INPUT = (By.ID, "shares")
COST_BASIS_INPUT = (By.ID, "cost_basis")
SUBMIT_BUTTON = (By.XPATH, "//button[@type='submit' and normalize-space()='Add position']")
FORM_HEADING = (By.XPATH, "//h2[normalize-space()='Add position']")
TICKER_LINK = (By.CSS_SELECTOR, f"a[href='/ticker/{TICKER}']")
TICKER_ROW = (By.XPATH, f"//a[@href='/ticker/{TICKER}']/parent::div")
REMOVE_BUTTON = (By.CSS_SELECTOR, f"button[aria-label='Remove {TICKER}']")
GENERATE_BUTTON = (By.XPATH, ".//button[normalize-space()='Generate Thesis']")


def remove_position(driver, wait):
    # Cleanup: remove the test position so the next run starts clean.
    for button in driver.find_elements(*REMOVE_BUTTON):
        button.click()
        wait.until(EC.alert_is_present()).accept()
    wait.until(EC.invisibility_of_element_located(TICKER_LINK))


def test_add_position(driver, wait, base_url):

    # Precondition check: the ticker isn't already held.
    driver.get(base_url)
    wait.until(EC.element_to_be_clickable(OPEN_FORM_BUTTON))
    assert not driver.find_elements(*TICKER_LINK), f"{TICKER} is already on the holdings page"

    try:
        add_position(driver, wait)
    finally:
        remove_position(driver, wait)


def add_position(driver, wait):

    # Click "Add Position" in the top right to open the form.
    driver.find_element(*OPEN_FORM_BUTTON).click()
    wait.until(EC.visibility_of_element_located(FORM_HEADING))

    # Type in a valid ticker and select it from the dropdown.
    wait.until(EC.element_to_be_clickable(TICKER_INPUT)).send_keys(TICKER)
    wait.until(EC.element_to_be_clickable(TICKER_OPTION)).click()
    wait.until(EC.visibility_of_element_located(SELECTED_TICKER))

    # Fill in "Shares" and "Cost basis (per share)".
    driver.find_element(*SHARES_INPUT).send_keys(SHARES)
    driver.find_element(*COST_BASIS_INPUT).send_keys(COST_BASIS)

    # Click "Add position" and wait for the form to close.
    wait.until(EC.element_to_be_clickable(SUBMIT_BUTTON)).click()
    wait.until(EC.invisibility_of_element_located(FORM_HEADING))

    # The new ticker shows up on the holdings page.
    row = wait.until(EC.visibility_of_element_located(TICKER_ROW))
    assert COMPANY.lower() in row.text.lower(), f"Row doesn't name {COMPANY}: {row.text!r}"
    assert f"{SHARES} sh" in row.text, f"Row doesn't show {SHARES} shares: {row.text!r}"

    # Its price is fetched on add, so it shows a market value and gain/loss
    # straight away — no "Refresh Prices" needed.
    assert "No price yet" not in row.text, f"Price wasn't fetched on add: {row.text!r}"
    assert re.search(r"\$[\d,]+\n[+-]?\d+\.\d%", row.text), f"No market value shown: {row.text!r}"

    # It's ready to have a thesis generated.
    assert row.find_elements(*GENERATE_BUTTON), f"No 'Generate Thesis' button: {row.text!r}"
