const { exec } = require('child_process');
const os = require('os');

class VolumeController {
  constructor() {
    this.platform = os.platform();
  }

  setVolume(level) {
    const vol = Math.min(Math.max(level, 0), 100);
    switch (this.platform) {
      case 'win32':
        if (require('fs').existsSync(require('path').join('node_modules', 'loudness'))) {
          require('loudness').setVolume(vol);
        } else {
          // Fallback to PowerShell
          exec(`powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys('${'%'.repeat(vol / 2)}')"`); // Simplified version
        }
        break;
      case 'darwin':
        const macLevel = Math.round(vol / 6.25); // 0-100 → 0-16
        exec(`osascript -e "set volume output volume ${macLevel}"`);
        break;
      case 'linux':
        exec(`pactl set-sink-volume @DEFAULT_SINK@ ${vol}%`);
        break;
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  toggleMute() {
    switch (this.platform) {
      case 'win32':
        exec('powershell -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"');
        break;
      case 'darwin':
        exec('osascript -e "set volume output muted true"');
        break;
      case 'linux':
        exec('pactl set-sink-mute @DEFAULT_SINK@ toggle');
        break;
    }
  }
}

module.exports = VolumeController;