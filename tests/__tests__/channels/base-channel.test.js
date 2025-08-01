const NotificationChannel = require('../../../src/channels/base/channel');

describe('NotificationChannel', () => {
  let channel;

  beforeEach(() => {
    channel = new NotificationChannel('test', { enabled: true });
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(channel.name).toBe('test');
      expect(channel.enabled).toBe(true);
      expect(channel.config).toEqual({ enabled: true });
    });

    it('should default to enabled when not specified', () => {
      const defaultChannel = new NotificationChannel('default');
      expect(defaultChannel.enabled).toBe(true);
    });

    it('should respect enabled: false config', () => {
      const disabledChannel = new NotificationChannel('disabled', {
        enabled: false,
      });
      expect(disabledChannel.enabled).toBe(false);
    });
  });

  describe('send', () => {
    it('should return false when channel is disabled', async () => {
      channel.enabled = false;
      const notification = {
        type: 'completed',
        title: 'Test',
        message: 'Test message',
      };

      const result = await channel.send(notification);
      expect(result).toBe(false);
    });

    it('should return false when _sendImpl is not implemented', async () => {
      const notification = {
        type: 'completed',
        title: 'Test',
        message: 'Test message',
      };

      const result = await channel.send(notification);
      expect(result).toBe(false);
    });
  });

  describe('supportsRelay', () => {
    it('should return false by default', () => {
      expect(channel.supportsRelay()).toBe(false);
    });
  });

  describe('handleCommand', () => {
    it('should return false when relay is not supported', async () => {
      const result = await channel.handleCommand('test command');
      expect(result).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should return true by default', () => {
      expect(channel.validateConfig()).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return correct status information', () => {
      const status = channel.getStatus();
      expect(status).toEqual({
        name: 'test',
        enabled: true,
        configured: true,
        supportsRelay: false,
      });
    });
  });
});
