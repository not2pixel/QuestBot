'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { QuestEngine }    = require('../engine/QuestEngine');
const { sessions }       = require('../engine/SessionManager');
const embeds             = require('../utils/embeds');

// ─── Active run tracker (in-memory only) ────────────────────────────────────
const activeRuns = new Map(); // userId -> true

// ─── Command definition ───────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dash')
    .setDescription('QuestBot control panel')

    // ── login ────────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('login')
        .setDescription('Register your Discord user token for this session (never stored on disk)')
        .addStringOption((opt) =>
          opt
            .setName('token')
            .setDescription('Your Discord user token')
            .setRequired(true),
        ),
    )

    // ── logout ───────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('logout')
        .setDescription('Remove your token from memory'),
    )

    // ── quests ───────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('quests')
        .setDescription('List all quests on the registered account'),
    )

    // ── balance ──────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('balance')
        .setDescription('Show current orb balance'),
    )

    // ── run ──────────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('run')
        .setDescription('Execute all pending quests and auto-claim rewards'),
    )

    // ── claim ────────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('Claim rewards for all completed-but-unclaimed quests'),
    )

    // ── status ───────────────────────────────────────────────────────────────
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Show current session and bot status'),
    ),

  // ─── Execute ──────────────────────────────────────────────────────────────
  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (sub) {
      case 'login':    return handleLogin(interaction, userId);
      case 'logout':   return handleLogout(interaction, userId);
      case 'quests':   return handleQuests(interaction, userId);
      case 'balance':  return handleBalance(interaction, userId);
      case 'run':      return handleRun(interaction, userId);
      case 'claim':    return handleClaim(interaction, userId);
      case 'status':   return handleStatus(interaction, userId);
      default:
        return interaction.reply({ embeds: [embeds.error('Unknown subcommand', sub)], ephemeral: true });
    }
  },
};

// ─── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleLogin(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });

  const rawToken = interaction.options.getString('token', true).trim();

  // Validate token by calling /users/@me
  const engine = new QuestEngine(rawToken);
  let self;
  try {
    self = await engine.fetchSelf();
  } catch {
    return interaction.editReply({
      embeds: [embeds.error('Login Failed', 'Could not authenticate with the provided token. Verify it is correct and try again.')],
    });
  }

  sessions.set(userId, rawToken, self.username);

  return interaction.editReply({
    embeds: [
      embeds.success(
        'Session Registered',
        `Authenticated as **${self.username}** (\`${self.id}\`).\n\n` +
        `Your token is stored in memory only and will be cleared when the bot restarts. ` +
        `Use \`/dash logout\` to remove it immediately.`,
      ),
    ],
  });
}

async function handleLogout(interaction, userId) {
  if (!sessions.has(userId)) {
    return interaction.reply({
      embeds: [embeds.warning('No Session', 'You do not have an active session.')],
      ephemeral: true,
    });
  }
  sessions.remove(userId);
  return interaction.reply({
    embeds: [embeds.success('Session Cleared', 'Your token has been removed from memory.')],
    ephemeral: true,
  });
}

async function handleQuests(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });
  const session = requireSession(interaction, userId);
  if (!session) return;

  const engine = new QuestEngine(session.token);
  let quests;
  try {
    quests = await engine.fetchQuests();
  } catch (e) {
    return interaction.editReply({ embeds: [embeds.error('Fetch Failed', e.message)] });
  }

  const summaries = quests.map((q) => q.toSummary());
  const embed = embeds.questListEmbed(summaries, session.username ?? userId);
  return interaction.editReply({ embeds: [embed] });
}

async function handleBalance(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });
  const session = requireSession(interaction, userId);
  if (!session) return;

  const engine = new QuestEngine(session.token);
  let orbs, self;
  try {
    [self, orbs] = await Promise.all([engine.fetchSelf(), engine.fetchBalance()]);
  } catch (e) {
    return interaction.editReply({ embeds: [embeds.error('Fetch Failed', e.message)] });
  }

  return interaction.editReply({
    embeds: [embeds.balanceEmbed(self.username, self.id, orbs)],
  });
}

async function handleRun(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });
  const session = requireSession(interaction, userId);
  if (!session) return;

  if (activeRuns.has(userId)) {
    return interaction.editReply({
      embeds: [embeds.warning('Already Running', 'A run is already in progress for your account.')],
    });
  }

  const engine = new QuestEngine(session.token);

  let orbsBefore = null;
  try {
    await engine.fetchQuests();
    orbsBefore = await engine.fetchBalance();
  } catch (e) {
    return interaction.editReply({ embeds: [embeds.error('Initialization Failed', e.message)] });
  }

  const pending = engine.pending();
  if (!pending.length) {
    return interaction.editReply({
      embeds: [embeds.info('No Pending Quests', 'All quests are either completed, claimed, or expired.')],
    });
  }

  // Claim any already-completed quests first
  await engine.claimAllRewards().catch(() => {});

  await interaction.editReply({
    embeds: [
      embeds.info(
        'Run Started',
        `Processing **${pending.length}** pending quest(s).\nThis may take several minutes. You will receive a follow-up message when complete.`,
      ),
    ],
  });

  activeRuns.set(userId, true);

  // Run asynchronously, send follow-up when done
  engine.runAll().then(async (results) => {
    activeRuns.delete(userId);
    let orbsAfter = null;
    try { orbsAfter = await engine.fetchBalance(); } catch (_) {}

    const embed = embeds.questRunEmbed(results, orbsBefore, orbsAfter, session.username ?? userId);
    await interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => {});
  }).catch(async (err) => {
    activeRuns.delete(userId);
    await interaction.followUp({
      embeds: [embeds.error('Run Failed', err.message)],
      ephemeral: true,
    }).catch(() => {});
  });
}

async function handleClaim(interaction, userId) {
  await interaction.deferReply({ ephemeral: true });
  const session = requireSession(interaction, userId);
  if (!session) return;

  const engine = new QuestEngine(session.token);
  try {
    await engine.fetchQuests();
  } catch (e) {
    return interaction.editReply({ embeds: [embeds.error('Fetch Failed', e.message)] });
  }

  const claimable = engine.claimable();
  if (!claimable.length) {
    return interaction.editReply({
      embeds: [embeds.info('Nothing to Claim', 'No completed quests with unclaimed rewards.')],
    });
  }

  const results = await engine.claimAllRewards();
  const lines = results.map((r) => {
    const mark = r.ok ? 'SUCCESS' : 'FAILED ';
    return `\`${mark}\`  ${r.name}${r.error ? `  [${r.error.slice(0, 40)}]` : ''}`;
  });

  return interaction.editReply({
    embeds: [
      embeds.success(
        `Claimed ${results.filter((r) => r.ok).length}/${results.length} Rewards`,
        lines.join('\n'),
      ),
    ],
  });
}

async function handleStatus(interaction, userId) {
  const session = sessions.get(userId);

  const fields = [
    {
      name: 'Session',
      value: session
        ? `Active  |  Account: ${session.username ?? 'Unknown'}  |  Added: <t:${Math.floor(session.addedAt / 1000)}:R>`
        : 'No active session  -  use `/dash login` to register a token',
      inline: false,
    },
    {
      name: 'Active Run',
      value: activeRuns.has(userId) ? 'In progress' : 'None',
      inline: true,
    },
    {
      name: 'Total Sessions',
      value: `${sessions.size}`,
      inline: true,
    },
  ];

  const embed = embeds.neutral('QuestBot Status', null).addFields(fields);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── Guard helper ─────────────────────────────────────────────────────────────

function requireSession(interaction, userId) {
  const session = sessions.get(userId);
  if (!session) {
    interaction.editReply({
      embeds: [embeds.warning('No Session', 'You must first register your token with `/dash login <token>`.')],
    });
    return null;
  }
  return session;
}
