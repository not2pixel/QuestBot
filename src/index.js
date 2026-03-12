'use strict';

require('dotenv').config();

const path = require('node:path');
const fs   = require('node:fs');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

// ─── Validate environment ────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('[QuestBot] Missing BOT_TOKEN in environment. Set it in .env and try again.');
  process.exit(1);
}

// ─── Create client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// ─── Load commands ─────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if ('data' in cmd && 'execute' in cmd) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`[QuestBot] Loaded command: ${cmd.data.name}`);
  }
}

// ─── Load events ──────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
  const event = require(path.join(eventsPath, file));
  const method = event.once ? 'once' : 'on';
  client[method](event.name, (...args) => event.execute(...args));
  console.log(`[QuestBot] Registered event: ${event.name}`);
}

// ─── Connect ──────────────────────────────────────────────────────────────────
client.login(BOT_TOKEN).catch((err) => {
  console.error('[QuestBot] Failed to connect:', err.message);
  process.exit(1);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT',  () => { console.log('\n[QuestBot] Shutting down.'); client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { console.log('[QuestBot] Shutting down.');  client.destroy(); process.exit(0); });
