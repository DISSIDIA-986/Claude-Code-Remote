const Notifier = require('./src/core/notifier');
const ConfigManager = require('./src/core/config');

async function runTest() {
  const configManager = new ConfigManager();
  await configManager.load(); // Load configurations
  const notifier = new Notifier(configManager);
  await notifier.initializeChannels();
  console.log('Running Notifier test...');
  const results = await notifier.test();
  console.log('Notifier test results:', results);
}

runTest().catch(console.error);
