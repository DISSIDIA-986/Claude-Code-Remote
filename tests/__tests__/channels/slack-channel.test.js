/**
 * Tests for Slack Channel
 */

const SlackChannel = require('../../../src/channels/slack/slack');
const fs = require('fs');
const path = require('path');

// Mock axios
jest.mock('axios');
const axios = require('axios');

// Mock file system for session management
jest.mock('fs');

describe('SlackChannel', () => {
  let slackChannel;
  let mockConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock fs.existsSync to return false by default
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue('{}');

    mockConfig = {
      enabled: true,
      webhook: 'https://hooks.slack.com/services/TEST/WEBHOOK/URL',
      token: '',
      channel: '#general',
      username: 'Claude-Code-Remote',
      iconEmoji: ':robot_face:',
    };

    slackChannel = new SlackChannel(mockConfig);
  });

  describe('Constructor', () => {
    test('should initialize with webhook configuration', () => {
      expect(slackChannel.name).toBe('slack');
      expect(slackChannel.webhook).toBe(mockConfig.webhook);
      expect(slackChannel.channel).toBe('#general');
      expect(slackChannel.username).toBe('Claude-Code-Remote');
      expect(slackChannel.iconEmoji).toBe(':robot_face:');
    });

    test('should initialize with bot token configuration', () => {
      const tokenConfig = {
        enabled: true,
        webhook: '',
        token: 'xoxb-test-token',
        channel: '#general',
      };

      const tokenChannel = new SlackChannel(tokenConfig);
      expect(tokenChannel.token).toBe('xoxb-test-token');
      expect(tokenChannel.webhook).toBe('');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate webhook configuration', () => {
      const result = slackChannel.validateConfig();
      expect(result.valid).toBe(true);
    });

    test('should validate bot token configuration', () => {
      const tokenConfig = {
        webhook: '',
        token: 'xoxb-test-token',
        channel: '#general',
      };

      const tokenChannel = new SlackChannel(tokenConfig);
      const result = tokenChannel.validateConfig();
      expect(result.valid).toBe(true);
    });

    test('should fail validation without webhook or token', () => {
      const invalidConfig = {
        webhook: '',
        token: '',
      };

      const invalidChannel = new SlackChannel(invalidConfig);
      const result = invalidChannel.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        'Either Slack webhook URL or bot token is required'
      );
    });

    test('should fail validation with token but no channel', () => {
      const invalidConfig = {
        webhook: '',
        token: 'xoxb-test-token',
        channel: '',
      };

      const invalidChannel = new SlackChannel(invalidConfig);
      const result = invalidChannel.validateConfig();
      expect(result.valid).toBe(false);
      expect(result.error).toContain(
        'Slack channel is required when using bot token'
      );
    });
  });

  describe('Relay Support', () => {
    test('should support relay when bot token is configured', () => {
      const tokenConfig = {
        webhook: '',
        token: 'xoxb-test-token',
        channel: '#general',
      };

      const tokenChannel = new SlackChannel(tokenConfig);
      expect(tokenChannel.supportsRelay()).toBe(true);
    });

    test('should not support relay when only webhook is configured', () => {
      expect(slackChannel.supportsRelay()).toBe(false);
    });
  });

  describe('Send Implementation', () => {
    test('should send notification via webhook successfully', async () => {
      // Mock successful axios response
      axios.post.mockResolvedValue({ status: 200 });

      const notification = {
        type: 'completed',
        title: 'Task Completed',
        message: 'Test task completed successfully',
        project: 'test-project',
        metadata: {
          userQuestion: 'Test question',
          claudeResponse: 'Test response',
        },
      };

      const result = await slackChannel._sendImpl(notification);

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          username: 'Claude-Code-Remote',
          icon_emoji: ':robot_face:',
          text: expect.stringContaining('Task Completed'),
          blocks: expect.any(Array),
        }),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        })
      );
    });

    test('should send notification via API when bot token is configured', async () => {
      const tokenConfig = {
        webhook: '',
        token: 'xoxb-test-token',
        channel: '#general',
        username: 'Claude-Code-Remote',
        iconEmoji: ':robot_face:',
      };

      const tokenChannel = new SlackChannel(tokenConfig);

      // Mock successful API response
      axios.post.mockResolvedValue({ data: { ok: true } });

      const notification = {
        type: 'waiting',
        title: 'Waiting for Input',
        message: 'Claude needs guidance',
        project: 'test-project',
      };

      const result = await tokenChannel._sendImpl(notification);

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://slack.com/api/chat.postMessage',
        expect.objectContaining({
          channel: '#general',
          username: 'Claude-Code-Remote',
          icon_emoji: ':robot_face:',
        }),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer xoxb-test-token',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        })
      );
    });

    test('should handle webhook sending failure', async () => {
      // Mock failed axios response
      axios.post.mockRejectedValue(new Error('Network error'));

      const notification = {
        type: 'completed',
        title: 'Task Completed',
        message: 'Test message',
        project: 'test-project',
      };

      await expect(slackChannel._sendImpl(notification)).rejects.toThrow(
        'Network error'
      );
    });

    test('should throw error when no webhook or token configured', async () => {
      const invalidChannel = new SlackChannel({
        webhook: '',
        token: '',
      });

      const notification = {
        type: 'completed',
        title: 'Test',
        message: 'Test message',
        project: 'test-project',
      };

      await expect(invalidChannel._sendImpl(notification)).rejects.toThrow(
        'Slack webhook URL or bot token not configured'
      );
    });
  });

  describe('Message Generation', () => {
    test('should generate proper Slack message blocks', () => {
      const notification = {
        type: 'completed',
        title: 'Task Completed',
        message: 'Test task completed',
        project: 'test-project',
        metadata: {
          userQuestion: 'Test question',
          claudeResponse: 'Test response',
        },
      };

      const message = slackChannel._generateSlackMessage(
        notification,
        'test-session-id',
        'TEST1234'
      );

      expect(message).toHaveProperty('username', 'Claude-Code-Remote');
      expect(message).toHaveProperty('icon_emoji', ':robot_face:');
      expect(message).toHaveProperty('blocks');
      expect(message.blocks).toBeInstanceOf(Array);
      expect(message.blocks.length).toBeGreaterThan(0);

      // Check for header block
      const headerBlock = message.blocks.find(block => block.type === 'header');
      expect(headerBlock).toBeDefined();
      expect(headerBlock.text.text).toContain('Task Completed');
    });

    test('should include session information in message', () => {
      const notification = {
        type: 'waiting',
        title: 'Waiting',
        message: 'Test message',
        project: 'test-project',
      };

      const sessionId = 'test-session-123';
      const token = 'ABC12345';
      const message = slackChannel._generateSlackMessage(
        notification,
        sessionId,
        token
      );

      // Check for context block with session info
      const contextBlock = message.blocks.find(
        block => block.type === 'context'
      );
      expect(contextBlock).toBeDefined();
      expect(contextBlock.elements[0].text).toContain(sessionId);
    });
  });

  describe('Session Management', () => {
    test('should create session file', async () => {
      const notification = {
        type: 'completed',
        project: 'test-project',
        message: 'test message',
      };

      await slackChannel._createSession(
        'test-session-id',
        notification,
        'TEST1234'
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('test-session-id.json'),
        expect.stringContaining('"token": "TEST1234"')
      );
    });

    test('should remove session file', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockReturnValue(undefined);

      await slackChannel._removeSession('test-session-id');

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        expect.stringContaining('test-session-id.json')
      );
    });
  });

  describe('Test Method', () => {
    test('should send test notification successfully', async () => {
      // Mock successful webhook response
      axios.post.mockResolvedValue({ status: 200 });

      const result = await slackChannel.test();

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        mockConfig.webhook,
        expect.objectContaining({
          text: expect.stringContaining('Task Completed'),
          blocks: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    test('should handle test failure gracefully', async () => {
      // Mock failed response
      axios.post.mockRejectedValue(new Error('Test error'));

      const result = await slackChannel.test();

      expect(result).toBe(false);
    });
  });

  describe('Status Method', () => {
    test('should return correct status information', () => {
      const status = slackChannel.getStatus();

      expect(status).toHaveProperty('name', 'slack');
      expect(status).toHaveProperty('enabled', true);
      expect(status).toHaveProperty('configured', true);
      expect(status).toHaveProperty('supportsRelay', false);
      expect(status).toHaveProperty('webhook', 'configured');
      expect(status).toHaveProperty('token', 'not configured');
      expect(status).toHaveProperty('channel', '#general');
    });

    test('should show configuration error in status', () => {
      const invalidChannel = new SlackChannel({
        webhook: '',
        token: '',
      });

      const status = invalidChannel.getStatus();

      expect(status.configured).toBe(false);
      expect(status.error).toContain(
        'Either Slack webhook URL or bot token is required'
      );
    });
  });
});
