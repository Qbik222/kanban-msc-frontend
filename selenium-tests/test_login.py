"""E2E tests for the Kanban Board login flow."""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from conftest import BASE_URL, TEST_EMAIL, TEST_PASSWORD


def _login(driver, email: str, password: str) -> None:
    """Fill in the login form and submit."""
    driver.get(f"{BASE_URL}/login")

    email_input = driver.find_element(By.CSS_SELECTOR, 'input[name="email"]')
    password_input = driver.find_element(By.CSS_SELECTOR, 'input[name="password"]')
    submit_btn = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')

    email_input.clear()
    email_input.send_keys(email)
    password_input.clear()
    password_input.send_keys(password)
    submit_btn.click()


def test_successful_login(driver):
    """Valid credentials should redirect to /teams and show the teams heading."""
    _login(driver, TEST_EMAIL, TEST_PASSWORD)

    WebDriverWait(driver, 10).until(EC.url_contains("/teams"))

    assert "/teams" in driver.current_url
    heading = driver.find_element(By.TAG_NAME, "h1")
    assert "Мої команди" in heading.text


def test_failed_login_wrong_password(driver):
    """Invalid password should keep the user on /login."""
    _login(driver, TEST_EMAIL, "wrong_password_123")

    WebDriverWait(driver, 5).until(
        lambda d: "Sign in" in d.find_element(By.CSS_SELECTOR, 'button[type="submit"]').text
    )

    assert "/login" in driver.current_url
    btn = driver.find_element(By.CSS_SELECTOR, 'button[type="submit"]')
    assert "Sign in" in btn.text


def test_navigate_to_boards_after_login(driver):
    """After login, navigating to /boards should show the boards page."""
    _login(driver, TEST_EMAIL, TEST_PASSWORD)

    WebDriverWait(driver, 10).until(EC.url_contains("/teams"))

    driver.get(f"{BASE_URL}/boards")

    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "h1"))
    )

    assert "/boards" in driver.current_url
    heading = driver.find_element(By.TAG_NAME, "h1")
    assert "Дошки" in heading.text
