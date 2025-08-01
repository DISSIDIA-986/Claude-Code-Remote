/**
 * Slack Notification Channel
 * Sends notifications via Slack with interactive reply support
 */

const NotificationChannel = require('../base/channel');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class SlackChannel extends NotificationChannel {
  constructor(config = {}) {
    super('slack', config);
        this.webhook = process.env.SLACK_WEBHOOK_URL || config.webhook;
    this.token = config.token;
    this.channel = config.channel;
    this.username = config.username || 'Claude-Code-Remote';
    this.iconEmoji = config.iconEmoji || ':robot_face:';
    this.sessionsDir = path.join(__dirname, '../../data/sessions');

    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  _generateToken() {
    // Generate short Token (uppercase letters + numbers, 8 digits)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  async _sendImpl(notification) {
    if (!this.webhook && !this.token) {
      throw new Error('Slack webhook URL or bot token not configured');
    }

    // Generate session ID and token for interactive features
    const sessionId = uuidv4();
    const token = this._generateToken();

    // Create session record for command relay
    await this._createSession(sessionId, notification, token);

    // Generate Slack message content
    const messageContent = this._generateSlackMessage(
      notification,
      sessionId,
      token
    );

    try {
      let result;

      if (this.webhook) {
        // Use webhook for simple notifications
        result = await this._sendViaWebhook(messageContent);
      } else {
        // Use bot token for more interactive features
        result = await this._sendViaAPI(messageContent);
      }

      if (result) {
        this.logger.info(
          `Slack notification sent successfully, Session: ${sessionId}, Token: ${token}`
        );
        return true;
      } else {
        // Clean up failed session
        await this._removeSession(sessionId);
        throw new Error('Slack API returned unsuccessful response');
      }
    } catch (error) {
      this.logger.error('Failed to send Slack notification:', error.message);
      await this._removeSession(sessionId);
      throw error; // Re-throw to let base class handle it
    }
  }

  async _sendViaWebhook(messageContent) {
    const response = await axios.post(this.webhook, messageContent, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    return response.status === 200;
  }

  async _sendViaAPI(messageContent) {
    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: this.channel || '#general',
        ...messageContent,
      },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return response.data.ok;
  }

  _generateSlackMessage(notification, sessionId, token) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const projectDir = path.basename(process.cwd());

    // Extract user question and Claude response from metadata
    let userQuestion = '';
    let claudeResponse = '';

    if (notification.metadata) {
      userQuestion = notification.metadata.userQuestion || '';
      claudeResponse = notification.metadata.claudeResponse || '';
    }

    // Create emoji and color based on notification type
    const typeConfig = this._getTypeConfig(notification.type);

    // Build Slack blocks for rich formatting
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${typeConfig.emoji} ${typeConfig.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${projectDir}`,
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${timestamp}`,
          },
          {
            type: 'mrkdwn',
            text: `*Session:*\n#${token}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${typeConfig.status}`,
          },
        ],
      },
    ];

    // Add user question section if available
    if (userQuestion) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 Your Question:*\n${userQuestion}`,
        },
      });
    }

    // Add Claude response section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🤖 Claude's Response:*\n${
          claudeResponse || notification.message
        }`,
      },
    });

    // Add interactive guidance section
    if (this.supportsRelay()) {
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*💡 Continue Conversation:*\nReply in thread to send commands to Claude Code',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Example commands:*\n• "Please continue optimizing"\n• "Generate unit tests"\n• "Explain this function"',
          },
        }
      );
    }

    // Add footer with session info
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `🔒 Session ID: \`${sessionId}\` | 📧 Auto-expires in 24h | 🤖 Claude-Code-Remote`,
        },
      ],
    });

    return {
      username: this.username,
      icon_emoji: this.iconEmoji,
      text: `${typeConfig.emoji} ${typeConfig.title} - ${projectDir}`,
      blocks: blocks,
      thread_ts: undefined, // Will be set for replies
    };
  }

  _getTypeConfig(type) {
    const configs = {
      completed: {
        emoji: '🎉',
        title: 'Claude Code Task Completed',
        status: 'Task Completed',
        color: '#28a745',
      },
      waiting: {
        emoji: '⏳',
        title: 'Claude Code Waiting for Input',
        status: 'Waiting for Input',
        color: '#ffc107',
      },
    };
    return configs[type] || configs.completed;
  }

  async _createSession(sessionId, notification, token) {
    const session = {
      id: sessionId,
      token: token,
      type: 'slack',
      created: new Date().toISOString(),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
      cwd: process.cwd(),
      notification: {
        type: notification.type,
        project: notification.project,
        message: notification.message,
      },
      status: 'waiting',
      commandCount: 0,
      maxCommands: 10,
    };

    const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));

    // Also save in session mapping format for command relay
    const sessionMapPath =
      process.env.SESSION_MAP_PATH ||
      path.join(__dirname, '../../data/session-map.json');
    let sessionMap = {};

    if (fs.existsSync(sessionMapPath)) {
      try {
        sessionMap = JSON.parse(fs.readFileSync(sessionMapPath, 'utf8'));
      } catch (e) {
        sessionMap = {};
      }
    }

    sessionMap[token] = {
      type: 'slack',
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
      cwd: process.cwd(),
      sessionId: sessionId,
      slackChannel: this.channel,
      description: `${notification.type} - ${notification.project}`,
    };

    // Ensure directory exists
    const mapDir = path.dirname(sessionMapPath);
    if (!fs.existsSync(mapDir)) {
      fs.mkdirSync(mapDir, { recursive: true });
    }

    fs.writeFileSync(sessionMapPath, JSON.stringify(sessionMap, null, 2));
    this.logger.debug(`Slack session created: ${sessionId}, Token: ${token}`);
  }

  async _removeSession(sessionId) {
    const sessionFile = path.join(this.sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      this.logger.debug(`Slack session removed: ${sessionId}`);
    }
  }

  supportsRelay() {
    // Slack supports command relay if bot token is configured
    return !!this.token;
  }

  async handleCommand(command, _context = {}) {
    if (!this.supportsRelay()) {
      this.logger.warn('Slack command relay requires bot token configuration');
      return false;
    }

    this.logger.info('Received Slack command:', command);

    // Process the command through the relay system
    // This would integrate with the existing command relay infrastructure
    return true;
  }

  validateConfig() {
    if (!this.webhook && !this.token) {
      return {
        valid: false,
        error: 'Either Slack webhook URL or bot token is required',
      };
    }

    if (this.token && (!this.channel || this.channel === '')) {
      return {
        valid: false,
        error: 'Slack channel is required when using bot token',
      };
    }

    return { valid: true };
  }

  async test() {
    try {
      const testNotification = {
        type: 'completed',
        title: 'Claude-Code-Remote Test',
        message:
          'This is a test notification to verify Slack integration is working properly.',
        project: 'Claude-Code-Remote-Test',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          userQuestion: 'Test Slack integration',
          claudeResponse: 'Slack integration test successful!',
        },
      };

      const result = await this._sendImpl(testNotification);
      return result;
    } catch (error) {
      this.logger.error('Slack test failed:', error.message);
      return false;
    }
  }

  getStatus() {
    const baseStatus = super.getStatus();
    const validation = this.validateConfig();

    return {
      ...baseStatus,
      configured: validation.valid,
      supportsRelay: this.supportsRelay(),
      webhook: this.webhook ? 'configured' : 'not configured',
      token: this.token ? 'configured' : 'not configured',
      channel: this.channel || 'not configured',
      error: validation.error || null,
    };
  }
}

module.exports = SlackChannel;
