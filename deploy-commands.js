'use strict';

require('dotenv').config();

const { REST, Routes } = require('@discordjs/rest');
const path = require('node:path');
const fs   = require('node:fs');

const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID) {
  console.error('[Deploy] Missing BOT_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsPath, file));
  if ('data' in cmd) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} command(s)...`);

    let data;
    if (GUILD_ID) {
      // Guild-scoped (instant, good for dev)
      data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`[Deploy] Registered ${data.length} command(s) to guild ${GUILD_ID}`);
    } else {
      // Global (takes up to 1 hour to propagate)
      data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`[Deploy] Registered ${data.length} command(s) globally`);
    }
  } catch (err) {
    console.error('[Deploy] Failed:', err);
    process.exit(1);
  }
})();
