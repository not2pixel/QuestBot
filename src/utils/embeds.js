'use strict';

const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary:  0x5865F2,
  success:  0x57F287,
  warning:  0xFEE75C,
  error:    0xED4245,
  neutral:  0x2B2D31,
  info:     0x00B0F4,
};

function base(color = COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp();
}

function success(title, description) {
  return base(COLORS.success).setTitle(title).setDescription(description ?? null);
}

function error(title, description) {
  return base(COLORS.error).setTitle(title).setDescription(description ?? null);
}

function info(title, description) {
  return base(COLORS.info).setTitle(title).setDescription(description ?? null);
}

function warning(title, description) {
  return base(COLORS.warning).setTitle(title).setDescription(description ?? null);
}

function neutral(title, description) {
  return base(COLORS.neutral).setTitle(title).setDescription(description ?? null);
}

function questListEmbed(quests, user) {
  const embed = base(COLORS.primary)
    .setTitle('Quest Overview')
    .setFooter({ text: `Account: ${user}` });

  if (!quests.length) {
    embed.setDescription('No quests found for this account.');
    return embed;
  }

  const lines = quests.map((q, i) => {
    let status;
    if (q.claimed)   status = 'CLAIMED';
    else if (q.completed) status = 'COMPLETED';
    else if (q.expired)   status = 'EXPIRED';
    else if (q.enrolled)  status = `ACTIVE  ${q.progress}/${q.target}`;
    else                   status = 'NOT ENROLLED';

    const taskLabel = q.taskType.replace(/_/g, ' ');
    return `\`${String(i + 1).padStart(2, '0')}\` **${truncate(q.name, 32)}**\n` +
           `     Reward: \`${q.reward}\`  |  Type: \`${taskLabel}\`  |  Status: \`${status}\``;
  });

  embed.setDescription(lines.join('\n\n'));
  return embed;
}

function questRunEmbed(results, orbsBefore, orbsAfter, user) {
  const embed = base(COLORS.success)
    .setTitle('Run Complete')
    .setFooter({ text: `Account: ${user}` });

  const lines = results.map((r, i) => {
    const mark = r.ok ? 'SUCCESS' : 'FAILED ';
    const detail = r.ok ? '' : `  [${truncate(r.error ?? '', 40)}]`;
    return `\`${String(i + 1).padStart(2, '0')}\` \`${mark}\`  ${truncate(r.name, 30)}${detail}`;
  });

  if (lines.length) embed.setDescription(lines.join('\n'));

  const gained = orbsAfter !== null && orbsBefore !== null ? orbsAfter - orbsBefore : null;
  embed.addFields(
    { name: 'Orbs Before', value: orbsBefore !== null ? `${orbsBefore}` : 'N/A', inline: true },
    { name: 'Orbs After',  value: orbsAfter  !== null ? `${orbsAfter}`  : 'N/A', inline: true },
    { name: 'Gained',      value: gained !== null      ? `+${gained}`   : 'N/A', inline: true },
  );

  return embed;
}

function balanceEmbed(username, userId, orbs) {
  return base(COLORS.info)
    .setTitle('Account Balance')
    .addFields(
      { name: 'Username', value: username, inline: true },
      { name: 'User ID',  value: userId,   inline: true },
      { name: 'Orbs',     value: `${orbs}`, inline: true },
    );
}

function progressEmbed(quest, done, target) {
  const pct  = Math.min(100, Math.round((done / target) * 100));
  const bar  = buildBar(pct, 20);
  return base(COLORS.info)
    .setTitle(`Running: ${truncate(quest.name, 40)}`)
    .addFields(
      { name: 'Progress', value: `${bar}  ${pct}%`, inline: false },
      { name: 'Seconds',  value: `${done} / ${target}`, inline: true },
      { name: 'Reward',   value: quest.getRewardLabel(), inline: true },
    );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 2) + '..' : str;
}

function buildBar(pct, width) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
}

module.exports = {
  success, error, info, warning, neutral,
  questListEmbed, questRunEmbed, balanceEmbed, progressEmbed,
  COLORS,
};
