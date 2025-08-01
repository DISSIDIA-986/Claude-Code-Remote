/**
 * Tests for tmux-only reliability architecture
 * Verifies that remote command injection uses only tmux without UI fallback
 */

// Removed unused path import

// Mock the relay-pty module
jest.mock('../../../src/relay/tmux-injector');
jest.mock('../../../src/relay/smart-injector');
jest.mock('nodemailer');

describe('Tmux-Only Reliability Architecture', () => {
  let mockLog;
  let mockTmuxInjector;
  let mockNodemailer;

  beforeEach(() => {
    // Mock logger
    mockLog = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock TmuxInjector
    mockTmuxInjector = {
      injectCommandFull: jest.fn(),
    };
    const TmuxInjector = require('../../../src/relay/tmux-injector');
    TmuxInjector.mockImplementation(() => mockTmuxInjector);

    // Mock nodemailer
    mockNodemailer = require('nodemailer');
    mockNodemailer.createTransporter = jest.fn().mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-123' }),
    });

    // Mock fs for config loading
    jest.doMock('fs', () => ({
      existsSync: jest.fn().mockReturnValue(true),
      readFileSync: jest.fn().mockReturnValue(
        JSON.stringify({
          email: {
            enabled: true,
            config: {
              smtp: {
                host: 'smtp.test.com',
                port: 587,
                secure: false,
                auth: { user: 'test@test.com', pass: 'password' },
              },
              from: 'test@test.com',
              to: 'user@test.com',
            },
          },
        })
      ),
      writeFileSync: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('should use tmux-only injection without UI fallback when tmux succeeds', async () => {
    // Mock successful tmux injection
    mockTmuxInjector.injectCommandFull.mockResolvedValue({
      success: true,
      session: 'test-session',
    });

    // Import after mocking
    const { injectCommandRemote } = require('../../../src/relay/relay-pty');

    const mockSession = {
      tmuxSession: 'claude-taskping',
      cwd: '/test/path',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    // Mock loadSessions
    jest.doMock('../../../src/relay/relay-pty', () => ({
      ...jest.requireActual('../../../src/relay/relay-pty'),
      loadSessions: () => ({
        TEST123: mockSession,
      }),
    }));

    const result = await injectCommandRemote('TEST123', 'echo "test command"');

    expect(result).toBe(true);
    expect(mockTmuxInjector.injectCommandFull).toHaveBeenCalledWith(
      'TEST123',
      'echo "test command"'
    );
    expect(mockLog.info).toHaveBeenCalledWith(
      { token: 'TEST123', session: 'test-session' },
      'Tmux remote injection successful'
    );
  });

  test('should NOT fall back to smart injector when tmux fails', async () => {
    // Mock failed tmux injection
    mockTmuxInjector.injectCommandFull.mockResolvedValue({
      success: false,
      error: 'tmux session not found',
    });

    const mockSession = {
      tmuxSession: 'claude-taskping',
      cwd: '/test/path',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    jest.doMock('../../../src/relay/relay-pty', () => ({
      ...jest.requireActual('../../../src/relay/relay-pty'),
      loadSessions: () => ({
        TEST123: mockSession,
      }),
    }));

    const { injectCommandRemote } = require('../../../src/relay/relay-pty');
    const result = await injectCommandRemote('TEST123', 'echo "test command"');

    expect(result).toBe(false);
    expect(mockTmuxInjector.injectCommandFull).toHaveBeenCalled();

    // Verify SmartInjector is NOT used
    const SmartInjector = require('../../../src/relay/smart-injector');
    expect(SmartInjector).not.toHaveBeenCalled();

    expect(mockLog.error).toHaveBeenCalledWith(
      { token: 'TEST123', error: 'tmux session not found' },
      'Tmux injection failed - tmux is the only reliable method for unattended automation'
    );
  });

  test('should send failure notification when tmux injection fails', async () => {
    // Mock failed tmux injection
    mockTmuxInjector.injectCommandFull.mockResolvedValue({
      success: false,
      error: 'connection refused',
    });

    const mockSession = {
      tmuxSession: 'claude-taskping',
      cwd: '/test/project',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    jest.doMock('../../../src/relay/relay-pty', () => ({
      ...jest.requireActual('../../../src/relay/relay-pty'),
      loadSessions: () => ({
        FAIL123: mockSession,
      }),
    }));

    const { injectCommandRemote } = require('../../../src/relay/relay-pty');
    await injectCommandRemote('FAIL123', 'npm test');

    // Verify failure notification email was sent
    expect(mockNodemailer.createTransporter).toHaveBeenCalled();
    const mockTransporter =
      mockNodemailer.createTransporter.mock.results[0].value;
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Command Execution Failed'),
        html: expect.stringMatching(/npm test.*connection refused/s),
      })
    );
  });

  test('should include helpful troubleshooting info in failure notification', async () => {
    mockTmuxInjector.injectCommandFull.mockResolvedValue({
      success: false,
      error: 'session not found',
    });

    const mockSession = {
      tmuxSession: 'my-custom-session',
      cwd: '/Users/test/my-project',
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };

    jest.doMock('../../../src/relay/relay-pty', () => ({
      ...jest.requireActual('../../../src/relay/relay-pty'),
      loadSessions: () => ({
        HELP123: mockSession,
      }),
    }));

    const { injectCommandRemote } = require('../../../src/relay/relay-pty');
    await injectCommandRemote('HELP123', 'make build');

    const mockTransporter =
      mockNodemailer.createTransporter.mock.results[0].value;
    const emailCall = mockTransporter.sendMail.mock.calls[0][0];

    // Verify troubleshooting info is included
    expect(emailCall.html).toContain('my-custom-session');
    expect(emailCall.html).toContain('/Users/test/my-project');
    expect(emailCall.html).toContain('make build');
    expect(emailCall.html).toContain(
      'tmux-only execution for maximum reliability'
    );
  });
});
