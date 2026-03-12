'use strict';

const embeds = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[QuestBot] Command error (${interaction.commandName}):`, err);
      const embed = embeds.error('Command Error', err.message?.slice(0, 200) ?? 'An unexpected error occurred.');
      const method = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
      await interaction[method]({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  },
};
