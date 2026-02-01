const { exec } = require('child_process');
const os = require('os');

class BrightnessController {
  constructor() {
    this.platform = os.platform();
  }

  setBrightness(level) {
    const brightness = Math.min(Math.max(level, 0), 100);
    switch (this.platform) {
      case 'win32':
        exec(`powershell -Command "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, ${brightness})"`, (error) => {
          if (error) {
            console.error('Failed to set brightness:', error.message);
          }
        });
        break;
      case 'darwin':
        exec(`brightness ${brightness / 100}`);
        break;
      case 'linux':
        exec(`brightnessctl set ${brightness}%`).on('error', () => {
          exec(`xbacklight -set ${brightness}`);
        });
        break;
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  getBrightness(callback) {
    switch (this.platform) {
      case 'win32':
        exec('powershell -Command "(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness"', (error, stdout) => {
          if (error) {
            callback(error, null);
          } else {
            callback(null, parseInt(stdout.trim()));
          }
        });
        break;
      case 'darwin':
        exec('brightness -l', (error, stdout) => {
          if (error) {
            callback(error, null);
          } else {
            const match = stdout.match(/display 0: brightness ([\d.]+)/);
            const brightness = match ? Math.round(parseFloat(match[1]) * 100) : null;
            callback(null, brightness);
          }
        });
        break;
      case 'linux':
        exec('brightnessctl get', (error, stdout) => {
          if (error) {
            callback(error, null);
          } else {
            const match = stdout.match(/\((\d+)%\)/);
            const brightness = match ? parseInt(match[1]) : null;
            callback(null, brightness);
          }
        });
        break;
      default:
        callback(new Error(`Unsupported platform: ${this.platform}`), null);
    }
  }
}

module.exports = BrightnessController;
