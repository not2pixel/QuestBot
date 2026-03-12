'use strict';

const { randomUUID } = require('node:crypto');
const { fetch: undiciFetch, Headers } = require('undici');

// ─── Constants ───────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 ' +
  'Electron/37.6.0 Safari/537.36';

const CLIENT_PROPS = {
  os: 'Windows',
  browser: 'Discord Client',
  release_channel: 'stable',
  client_version: '1.0.9215',
  os_version: '10.0.19045',
  os_arch: 'x64',
  app_arch: 'x64',
  system_locale: 'en-US',
  has_client_mods: false,
  client_launch_id: randomUUID(),
  browser_user_agent: USER_AGENT,
  browser_version: '37.6.0',
  os_sdk_version: '19045',
  client_build_number: 471091,
  native_build_number: 72186,
  client_event_source: null,
  launch_signature: randomUUID(),
  client_heartbeat_session_id: randomUUID(),
  client_app_state: 'focused',
};

const DISCORD_API = 'https://discord.com/api/v10';

const TaskType = Object.freeze({
  WATCH_VIDEO: 'WATCH_VIDEO',
  PLAY_ON_DESKTOP: 'PLAY_ON_DESKTOP',
  STREAM_ON_DESKTOP: 'STREAM_ON_DESKTOP',
  PLAY_ACTIVITY: 'PLAY_ACTIVITY',
  WATCH_VIDEO_ON_MOBILE: 'WATCH_VIDEO_ON_MOBILE',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHeaders(token) {
  const h = new Headers();
  h.set('Authorization', token);
  h.set('Content-Type', 'application/json');
  h.set('User-Agent', USER_AGENT);
  h.set('Accept', '*/*');
  h.set('accept-language', 'vi');
  h.set('origin', 'https://discord.com');
  h.set('referer', 'https://discord.com/channels/@me');
  h.set('sec-ch-ua', '"Not)A;Brand";v="8", "Chromium";v="138"');
  h.set('sec-ch-ua-mobile', '?0');
  h.set('sec-ch-ua-platform', '"Windows"');
  h.set('sec-fetch-dest', 'empty');
  h.set('sec-fetch-mode', 'cors');
  h.set('sec-fetch-site', 'same-origin');
  h.set('x-debug-options', 'bugReporterEnabled');
  h.set('x-discord-locale', 'en-US');
  h.set('x-discord-timezone', 'Asia/Saigon');
  h.set('x-super-properties', Buffer.from(JSON.stringify(CLIENT_PROPS)).toString('base64'));
  return h;
}

async function apiRequest(token, method, path, body = null) {
  const opts = {
    method,
    headers: buildHeaders(token),
  };
  if (body !== null) {
    opts.body = JSON.stringify(body);
  }
  const res = await undiciFetch(`${DISCORD_API}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord API ${method} ${path} -> ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Quest Model ─────────────────────────────────────────────────────────────

class Quest {
  constructor(raw) {
    this._raw = raw;
  }

  get id() { return this._raw.id; }
  get config() { return this._raw.config; }
  get userStatus() { return this._raw.user_status; }
  get preview() { return this._raw.preview; }

  get name() {
    return this._raw.config?.messages?.quest_name?.trim() || this._raw.id;
  }

  isExpired(now = new Date()) {
    return now.getTime() > new Date(this._raw.config.expires_at).getTime();
  }

  isCompleted() { return Boolean(this.userStatus?.completed_at); }
  isEnrolled()  { return Boolean(this.userStatus?.enrolled_at); }
  isClaimed()   { return Boolean(this.userStatus?.claimed_at); }

  refreshStatus(status) {
    this._raw.user_status = status;
  }

  detectTaskType() {
    const tasks = this.config?.task_config?.tasks;
    if (!tasks) return null;
    return Object.values(TaskType).find((t) => tasks[t] != null) ?? null;
  }

  getTarget() {
    const type = this.detectTaskType();
    if (!type) return 900;
    return this.config.task_config.tasks[type]?.target ?? 900;
  }

  getProgress() {
    const type = this.detectTaskType();
    if (!type) return 0;
    return this.userStatus?.progress?.[type]?.value ?? 0;
  }

  getRemaining() {
    return Math.max(0, this.getTarget() - this.getProgress());
  }

  getRewardLabel() {
    const rewards = this.config?.rewards_config?.rewards;
    if (!rewards?.length) return 'Unknown';
    if (rewards[0].orb_quantity) return `${rewards[0].orb_quantity} Orbs`;
    return rewards[0].messages?.name ?? 'Unknown';
  }

  toSummary() {
    return {
      id: this.id,
      name: this.name,
      reward: this.getRewardLabel(),
      taskType: this.detectTaskType() ?? 'UNKNOWN',
      target: this.getTarget(),
      progress: this.getProgress(),
      remaining: this.getRemaining(),
      enrolled: this.isEnrolled(),
      completed: this.isCompleted(),
      claimed: this.isClaimed(),
      expired: this.isExpired(),
      expiresAt: this._raw.config?.expires_at,
    };
  }
}

// ─── QuestEngine ─────────────────────────────────────────────────────────────

class QuestEngine {
  constructor(token) {
    this._token = token;
    this._quests = [];
  }

  async fetchSelf() {
    return apiRequest(this._token, 'GET', '/users/@me');
  }

  async fetchBalance() {
    const data = await apiRequest(this._token, 'GET', '/users/@me/virtual-currency/balance');
    return data.balance ?? 0;
  }

  async fetchQuests() {
    const data = await apiRequest(this._token, 'GET', '/quests/@me');
    this._quests = (data.quests ?? []).map((q) => new Quest(q));
    return this._quests;
  }

  pending() {
    return this._quests.filter(
      (q) => q.id !== '1412491570820812933' && !q.isCompleted() && !q.isExpired()
    );
  }

  claimable() {
    return this._quests.filter((q) => q.isCompleted() && !q.isClaimed());
  }

  all() {
    return [...this._quests];
  }

  async enrollQuest(questId) {
    const res = await apiRequest(this._token, 'POST', `/quests/${questId}/enroll`, {
      location: 11,
      is_targeted: false,
      metadata_raw: null,
    });
    const q = this._quests.find((x) => x.id === questId);
    q?.refreshStatus(res);
    return res;
  }

  async claimReward(questId) {
    return apiRequest(this._token, 'POST', `/quests/${questId}/claim-reward`, {});
  }

  async claimAllRewards() {
    const results = [];
    for (const q of this.claimable()) {
      try {
        await this.claimReward(q.id);
        results.push({ id: q.id, name: q.name, ok: true });
      } catch (e) {
        results.push({ id: q.id, name: q.name, ok: false, error: e.message });
      }
    }
    return results;
  }

  async executeQuest(quest, onProgress) {
    const taskType = quest.detectTaskType();
    if (!taskType) throw new Error('Unknown task type');

    if (!quest.isEnrolled()) {
      await this.enrollQuest(quest.id);
    }

    const target  = quest.getTarget();
    let done      = quest.getProgress();

    if (taskType === TaskType.WATCH_VIDEO || taskType === TaskType.WATCH_VIDEO_ON_MOBILE) {
      const enrolledAt = new Date(quest.userStatus?.enrolled_at).getTime();

      while (true) {
        const maxAllowed = Math.floor((Date.now() - enrolledAt) / 1000) + 10;
        const diff = maxAllowed - done;
        const next = done + 7;

        if (diff >= 7) {
          const res = await apiRequest(this._token, 'POST', `/quests/${quest.id}/video-progress`, {
            timestamp: Math.min(target, next + Math.random()),
          });
          done = Math.min(target, next);
          onProgress?.({ done, target, finished: res.completed_at != null });
          if (res.completed_at) break;
        }

        if (next >= target) break;
        await sleep(1000);
      }

      // Final stamp
      await apiRequest(this._token, 'POST', `/quests/${quest.id}/video-progress`, {
        timestamp: target,
      }).catch(() => {});

    } else if (taskType === TaskType.PLAY_ON_DESKTOP) {
      while (!quest.isCompleted()) {
        const res = await apiRequest(this._token, 'POST', `/quests/${quest.id}/heartbeat`, {
          application_id: quest.config.application.id,
          terminal: false,
        });
        quest.refreshStatus(res);
        onProgress?.({ done: quest.getProgress(), target, finished: quest.isCompleted() });
        if (!quest.isCompleted()) await sleep(60_000);
      }
      await apiRequest(this._token, 'POST', `/quests/${quest.id}/heartbeat`, {
        application_id: quest.config.application.id,
        terminal: true,
      }).catch(() => {});
    } else {
      throw new Error(`Task type ${taskType} is not auto-farmable`);
    }

    // Claim after completion
    try {
      await this.claimReward(quest.id);
    } catch (_) { /* already claimed or unavailable */ }
  }

  async runAll(onQuestProgress) {
    const quests = this.pending();
    const results = [];

    for (const q of quests) {
      try {
        await this.executeQuest(q, (p) => onQuestProgress?.(q, p));
        results.push({ id: q.id, name: q.name, ok: true });
      } catch (e) {
        results.push({ id: q.id, name: q.name, ok: false, error: e.message });
      }
    }

    return results;
  }
}

module.exports = { QuestEngine, Quest, TaskType };
