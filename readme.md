# 💧 Water Outage Nhà Bè — Telegram Notifier

A lightweight automation bot that monitors the **Nhà Bè Water Supply website** and sends **Telegram notifications** whenever a new water outage announcement is detected.

If u around # LE VAN LUONG street or Phuoc Kien (old ward), join now for noti
https://t.me/baocupnuocnhabe

---

## How It Works

1. GitHub Actions triggers the script on a schedule (every hour).
2. The script fetches the latest posts from the water supply website's API.
3. Each post is scanned for configured keywords (e.g., "cúp nước", "Nhà Bè").
4. If a match is found within the configured time window, a Telegram message is sent.
5. Sent post IDs are cached to `cache/sent.json` to avoid duplicate notifications.

---

## Setup

### 1. Fork or clone this repository

### 2. Create a Telegram Bot

- Message [@BotFather](https://t.me/BotFather) on Telegram to create a new bot and get your `BOT_TOKEN`.
- Get your `CHAT_ID` by messaging [@userinfobot](https://t.me/userinfobot).

### 3. Configure GitHub Secrets & Variables

Go to **Settings → Secrets and variables → Actions** in your repository and add:

| Name | Type | Description |
|---|---|---|
| `BOT_TOKEN` | Secret | Your Telegram bot token |
| `CHAT_ID` | Secret | Your Telegram chat/group ID |
| `URL` | Secret | The WordPress REST API URL of the water supply site |
| `KEYWORDS` | Secret | Comma-separated keywords to watch for (e.g., `nhà bè,cúp nước`) |
| `CHECK_WINDOW_HOURS` | Variable | How many hours back to check for posts (e.g., `2`) |

### 4. Enable GitHub Actions

The workflow runs automatically. You can also trigger it manually from the **Actions** tab.

---

## Project Structure

```
├── notify.js                          # Main script
├── package.json                       # Node.js dependencies
├── cache/
│   └── sent.json                      # Cache of already-notified post IDs
└── .github/
    └── workflows/
        └── github-actions-demo.yml    # GitHub Actions workflow
```

---

## Dependencies

- [axios](https://github.com/axios/axios) — HTTP requests
- [dotenv](https://github.com/motdotla/dotenv) — Local environment variables

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
cp .env.example .env
# Fill in BOT_TOKEN, CHAT_ID, URL, KEYWORDS, CHECK_WINDOW_HOURS

# 3. Run the script
npm start
```

---

## License

MIT
