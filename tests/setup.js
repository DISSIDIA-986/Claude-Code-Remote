// Jest setup file
const path = require('path');
const fs = require('fs');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SMTP_TIMEOUT = '5000';
process.env.NOTIFICATION_TIMEOUT = '3000';

// Create test data directory if it doesn't exist
const testDataDir = path.join(__dirname, '..', 'src', 'data', 'test');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Global test utilities
global.testUtils = {
  createMockConfig: () => ({
    email: {
      enabled: true,
      config: {
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@test.com',
            pass: 'testpass',
          },
        },
        imap: {
          host: 'imap.test.com',
          port: 993,
          secure: true,
          auth: {
            user: 'test@test.com',
            pass: 'testpass',
          },
        },
        from: 'Claude Code Remote <test@test.com>',
        to: 'test@test.com',
      },
    },
    slack: {
      enabled: false,
      config: {
        webhook: 'https://hooks.slack.com/test',
        token: 'test-token',
        channel: '#test',
      },
    },
  }),
};
