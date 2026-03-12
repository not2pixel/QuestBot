'use strict';

const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[QuestBot] Online as ${client.user.tag}`);
    console.log(`[QuestBot] Serving ${client.guilds.cache.size} guild(s)`);
    client.user.setPresence({
      activities: [{ name: '/dash', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
