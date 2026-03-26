import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

BASE_URL = "http://localhost:4200"
TEST_EMAIL = "ignatovyw@gmail.com"
TEST_PASSWORD = "admin1234"


@pytest.fixture()
def driver():
    opts = Options()
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1280,900")

    svc = Service(ChromeDriverManager().install())
    drv = webdriver.Chrome(service=svc, options=opts)
    drv.implicitly_wait(10)

    yield drv

    drv.quit()
