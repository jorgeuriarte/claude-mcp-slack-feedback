import { spawn, ChildProcess } from 'child_process';

export class TunnelManager {
  private tunnelProcess?: ChildProcess;
  private tunnelUrl?: string;
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  async start(): Promise<string> {
    if (this.tunnelProcess) {
      throw new Error('Tunnel already running');
    }

    // Check if cloudflared is available before trying to start
    const isInstalled = await this.checkCloudflaredInstalled();
    if (!isInstalled) {
      throw new Error('cloudflared is not installed. Please install it to use webhook mode, or use polling mode instead.');
    }

    return new Promise((resolve, reject) => {
      const args = ['tunnel', '--url', `http://localhost:${this.port}`];
      
      this.tunnelProcess = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';
      
      this.tunnelProcess.stdout?.on('data', (data) => {
        output += data.toString();
        
        // Look for the tunnel URL in the output
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !this.tunnelUrl) {
          this.tunnelUrl = urlMatch[0];
          resolve(this.tunnelUrl);
        }
      });

      this.tunnelProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Cloudflared stderr:', data.toString());
        
        // Cloudflared outputs the URL to stderr, not stdout
        const urlMatch = errorOutput.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (urlMatch && !this.tunnelUrl) {
          this.tunnelUrl = urlMatch[0];
          resolve(this.tunnelUrl);
        }
      });

      this.tunnelProcess.on('error', (error) => {
        reject(new Error(`Failed to start cloudflared: ${error.message}`));
      });

      this.tunnelProcess.on('exit', (code) => {
        if (code !== 0 && !this.tunnelUrl) {
          reject(new Error(`Cloudflared exited with code ${code}: ${errorOutput}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.tunnelUrl) {
          this.stop();
          reject(new Error('Timeout waiting for tunnel URL'));
        }
      }, 30000);
    });
  }

  async stop(): Promise<void> {
    if (this.tunnelProcess) {
      this.tunnelProcess.kill('SIGTERM');
      
      // Give it time to shut down gracefully
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.tunnelProcess) {
            this.tunnelProcess.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.tunnelProcess!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.tunnelProcess = undefined;
      this.tunnelUrl = undefined;
    }
  }

  getTunnelUrl(): string | undefined {
    return this.tunnelUrl;
  }

  isRunning(): boolean {
    return !!this.tunnelProcess && !this.tunnelProcess.killed;
  }

  async checkCloudflaredInstalled(): Promise<boolean> {
    try {
      const checkProcess = spawn('cloudflared', ['--version'], {
        stdio: 'ignore'
      });
      
      return new Promise((resolve) => {
        checkProcess.on('error', () => resolve(false));
        checkProcess.on('exit', (code) => resolve(code === 0));
      });
    } catch {
      return false;
    }
  }

  static async isAvailable(): Promise<boolean> {
    try {
      const checkProcess = spawn('cloudflared', ['--version'], {
        stdio: 'ignore'
      });
      
      return new Promise((resolve) => {
        checkProcess.on('error', () => resolve(false));
        checkProcess.on('exit', (code) => resolve(code === 0));
      });
    } catch {
      return false;
    }
  }

  async installCloudflared(): Promise<void> {
    // This method is deprecated as cloudflared is now optional
    throw new Error(
      'cloudflared is optional. To use webhook mode, please install it manually:\n' +
      '- macOS: brew install cloudflare/cloudflare/cloudflared\n' +
      '- Linux: Download from https://github.com/cloudflare/cloudflared/releases\n' +
      '\nOr use polling mode which doesn\'t require cloudflared.'
    );
  }
}