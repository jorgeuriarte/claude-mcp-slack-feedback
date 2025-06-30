import { TunnelManager } from '../tunnel-manager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

// Increase timeout for all tests in this file
jest.setTimeout(10000);

describe('TunnelManager', () => {
  let tunnelManager: TunnelManager;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    tunnelManager = new TunnelManager(3000);
    
    mockProcess = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      kill: jest.fn(),
      killed: false
    });
    
    (spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  describe('start', () => {
    it('should start tunnel and return URL', async () => {
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      // Simulate cloudflared output with tunnel URL
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from(
          'INFO[0000] Tunnel created https://test-tunnel.trycloudflare.com\n'
        ));
      }, 100);
      
      const url = await startPromise;
      
      expect(url).toBe('https://test-tunnel.trycloudflare.com');
      expect(spawn).toHaveBeenCalledWith('cloudflared', [
        'tunnel',
        '--url',
        'http://localhost:3000'
      ], expect.any(Object));
    });

    it('should reject if tunnel already running', async () => {
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      // Emit URL immediately
      setImmediate(() => {
        mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
      });
      
      await startPromise;
      
      await expect(tunnelManager.start()).rejects.toThrow('Tunnel already running');
    });

    it('should reject if cloudflared not installed', async () => {
      // Mock checkCloudflaredInstalled to return false
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(false);
      
      await expect(tunnelManager.start()).rejects.toThrow('cloudflared is not installed');
    });

    it('should handle cloudflared errors', async () => {
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      // Emit error immediately
      setImmediate(() => {
        mockProcess.emit('error', new Error('spawn error'));
      });
      
      await expect(startPromise).rejects.toThrow('Failed to start cloudflared');
    });

    it.skip('should timeout if no URL received', async () => {
      jest.useFakeTimers();
      
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      jest.advanceTimersByTime(31000);
      
      await expect(startPromise).rejects.toThrow('Timeout waiting for tunnel URL');
      
      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    it.skip('should stop running tunnel', async () => {
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      // Emit URL immediately
      setImmediate(() => {
        mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
      });
      
      await startPromise;
      
      const stopPromise = tunnelManager.stop();
      
      // Emit exit immediately
      setImmediate(() => {
        mockProcess.emit('exit', 0);
      });
      
      await stopPromise;
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(tunnelManager.isRunning()).toBe(false);
    });

    it.skip('should force kill if graceful shutdown fails', async () => {
      jest.useFakeTimers();
      
      // Mock checkCloudflaredInstalled to return true
      jest.spyOn(tunnelManager, 'checkCloudflaredInstalled').mockResolvedValue(true);
      
      const startPromise = tunnelManager.start();
      
      // Emit URL immediately using real timer
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
      }, 0);
      
      jest.runAllTimers();
      await startPromise;
      
      const stopPromise = tunnelManager.stop();
      
      jest.advanceTimersByTime(6000);
      
      await stopPromise;
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      
      jest.useRealTimers();
    });
  });

  describe('checkCloudflaredInstalled', () => {
    it('should return true if cloudflared is installed', async () => {
      const checkProcess: any = Object.assign(new EventEmitter(), {
        on: jest.fn((event: string, handler: Function): any => {
          if (event === 'exit') {
            setImmediate(() => handler(0));
          }
          return checkProcess;
        })
      });
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const result = await tunnelManager.checkCloudflaredInstalled();
      expect(result).toBe(true);
    });

    it('should return false if cloudflared is not installed', async () => {
      const checkProcess: any = Object.assign(new EventEmitter(), {
        on: jest.fn((event: string, handler: Function): any => {
          if (event === 'error') {
            setImmediate(() => handler(new Error('not found')));
          }
          return checkProcess;
        })
      });
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const result = await tunnelManager.checkCloudflaredInstalled();
      expect(result).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true if cloudflared is installed', async () => {
      const checkProcess: any = Object.assign(new EventEmitter(), {
        on: jest.fn((event: string, handler: Function): any => {
          if (event === 'exit') {
            setImmediate(() => handler(0));
          }
          return checkProcess;
        })
      });
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const result = await TunnelManager.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false if cloudflared is not installed', async () => {
      const checkProcess: any = Object.assign(new EventEmitter(), {
        on: jest.fn((event: string, handler: Function): any => {
          if (event === 'error') {
            setImmediate(() => handler(new Error('not found')));
          }
          return checkProcess;
        })
      });
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const result = await TunnelManager.isAvailable();
      expect(result).toBe(false);
    });
  });
});