# QuestBot

A Discord bot that auto-farms Discord Quests using the official Discord API.
Built with **discord.js v14** and slash commands.

---

## Features

- `/dash login <token>`  — register your Discord user token (memory only, never saved to disk)
- `/dash logout`         — clear your token from memory
- `/dash quests`         — list all quests and their current status
- `/dash balance`        — show your current Orb balance
- `/dash run`            — execute all pending quests and auto-claim rewards
- `/dash claim`          — claim rewards for completed quests
- `/dash status`         — show session and bot status

All responses are ephemeral (visible only to you).

---

## Setup

### 1. Install dependencies

```
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```
BOT_TOKEN=   # Your bot token from Discord Developer Portal
CLIENT_ID=   # Your application ID
GUILD_ID=    # (Optional) A guild ID for faster dev-time command registration
```

### 3. Register slash commands

```
npm run deploy
```

### 4. Start the bot

```
npm start
```

---

## Token Security

User tokens are:
- Stored **in memory only** for the duration of the session
- **Never written** to disk, logs, or any database
- **Cleared** when the bot process restarts or when you run `/dash logout`

Use `/dash status` to verify whether a session is active.

---

## Requirements

- Node.js >= 18
- A Discord bot account with the `applications.commands` scope and `bot` scope authorized in your server
