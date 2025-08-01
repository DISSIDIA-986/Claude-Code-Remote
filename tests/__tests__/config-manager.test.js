const fs = require('fs');
const path = require('path');
const ConfigManager = require('../../src/config-manager');

// Mock fs methods
jest.mock('fs');

describe('ConfigManager', () => {
  let configManager;
  const mockConfigPath = path.join(
    __dirname,
    '../../src/../config/channels.json'
  );

  beforeEach(() => {
    configManager = new ConfigManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (configManager.rl) {
      configManager.close();
    }
  });

  describe('loadConfig', () => {
    it('should load and parse config file successfully', async () => {
      const mockConfig = { email: { enabled: true } };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = await configManager.loadConfig();

      expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf8');
      expect(result).toEqual(mockConfig);
    });

    it('should throw error when config file cannot be read', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(configManager.loadConfig()).rejects.toThrow();
    });

    it('should throw error when config file contains invalid JSON', async () => {
      fs.readFileSync.mockReturnValue('invalid json');

      await expect(configManager.loadConfig()).rejects.toThrow();
    });
  });

  describe('saveConfig', () => {
    it('should save config file successfully', async () => {
      const config = { email: { enabled: true } };
      fs.writeFileSync.mockImplementation(() => {});

      await configManager.saveConfig(config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(config, null, 2)
      );
    });

    it('should throw error when config file cannot be written', async () => {
      const config = { email: { enabled: true } };
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(configManager.saveConfig(config)).rejects.toThrow();
    });
  });

  describe('toggleChannel', () => {
    it('should toggle channel enable/disable status', async () => {
      const mockConfig = {
        email: { enabled: true },
        slack: { enabled: false },
      };

      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
      fs.writeFileSync.mockImplementation(() => {});

      await configManager.toggleChannel('email');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(
          {
            email: { enabled: false },
            slack: { enabled: false },
          },
          null,
          2
        )
      );
    });

    it('should handle non-existent channel gracefully', async () => {
      const mockConfig = { email: { enabled: true } };
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await configManager.toggleChannel('nonexistent');

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Channel "nonexistent" not found'
      );
      consoleSpy.mockRestore();
    });
  });
});
