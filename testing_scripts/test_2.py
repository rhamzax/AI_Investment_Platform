"""
Test case 2: Refreshing prices and confirming the price data is updated to
the current date.

Precondition: the holdings page has at least one position, and it's a
trading day after the market has opened (otherwise the latest close yfinance
returns is from an earlier date).
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# The backend syncs every held ticker from yfinance one at a time.
SYNC_TIMEOUT_S = 120

REFRESH_BUTTON = (By.XPATH, "//button[normalize-space()='Refresh Prices']")
SYNCING_BUTTON = (By.XPATH, "//button[starts-with(normalize-space(), 'Syncing')]")
SUBTITLE = (By.XPATH, "//button[normalize-space()='Refresh Prices']/following-sibling::p")
CHART_END_DATE = (By.XPATH, "//p[normalize-space()='Portfolio value']/ancestor::div[contains(@class, 'rounded-2xl')][1]/div[last()]/span[last()]")


def test_refresh_prices(driver, wait, base_url):

    driver.get(base_url)

    # Today's date, formatted the same way the browser formats it in the UI.
    today_subtitle = driver.execute_script("return new Date().toLocaleDateString()")
    today_chart = driver.execute_script(
        "return new Date().toLocaleDateString(undefined, {month: 'short', day: 'numeric'})"
    )

    # Click "Refresh Prices" and verify it changes to "Syncing…".
    wait.until(EC.element_to_be_clickable(REFRESH_BUTTON)).click()
    wait.until(EC.visibility_of_element_located(SYNCING_BUTTON))

    # Wait for the sync to finish and the button to return.
    WebDriverWait(driver, SYNC_TIMEOUT_S).until(EC.element_to_be_clickable(REFRESH_BUTTON))

    # The subtitle reads "Prices as of <today>".
    expected = f"Prices as of {today_subtitle}"
    try:
        wait.until(EC.text_to_be_present_in_element(SUBTITLE, expected))
    except Exception:
        actual = driver.find_element(*SUBTITLE).text
        raise AssertionError(f"Expected subtitle {expected!r}, got {actual!r}")

    # The graph's last data point is today.
    try:
        wait.until(EC.text_to_be_present_in_element(CHART_END_DATE, today_chart))
    except Exception:
        actual = driver.find_element(*CHART_END_DATE).text
        raise AssertionError(f"Expected graph to end on {today_chart!r}, got {actual!r}")
