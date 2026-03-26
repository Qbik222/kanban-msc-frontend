# Selenium E2E Tests — Kanban Board

Автоматизовані тести для веб-застосунку Kanban Board за допомогою **Selenium WebDriver** та **Python (pytest)**.

## Передумови

- Python 3.10+
- Google Chrome
- Backend запущений на `http://localhost:3500`
- Frontend запущений на `http://localhost:4200`
- В базі існує тестовий користувач (email/пароль вказані в `conftest.py`)

## Встановлення

```bash
cd selenium-tests
pip install -r requirements.txt
```

## Запуск тестів

1. Запустіть backend (очікується на `http://localhost:3500`).
2. Запустіть frontend (очікується на `http://localhost:4200`).
3. У новому терміналі перейдіть у папку тестів:

```bash
cd selenium-tests
```

4. Запустіть тести:

```bash
python -m pytest -v
```

Альтернатива: запуск із кореня `frontend` без переходу в директорію тестів:

```bash
python -m pytest -v selenium-tests
```

### Якщо `pytest` не знайдено (Windows / PowerShell)

Запускайте через Python-модуль:

```bash
python -m pytest -v
```

Якщо пакет ще не встановлений:

```bash
python -m pip install -r selenium-tests\requirements.txt
```

## Опис тестів

| Тест | Опис |
|------|------|
| `test_successful_login` | Перевірка успішного входу з валідними credentials — redirect на `/teams`, заголовок "Мої команди" |
| `test_failed_login_wrong_password` | Перевірка помилкового входу з неправильним паролем — залишаємось на `/login`, кнопка "Sign in" активна |
| `test_navigate_to_boards_after_login` | Перевірка переходу на захищену сторінку `/boards` після успішного логіну — заголовок "Дошки" |
