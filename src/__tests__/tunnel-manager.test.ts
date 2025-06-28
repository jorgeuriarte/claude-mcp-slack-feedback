import { TunnelManager } from '../tunnel-manager';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

describe('TunnelManager', () => {
  let tunnelManager: TunnelManager;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
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
      const startPromise = tunnelManager.start();
      mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
      await startPromise;
      
      await expect(tunnelManager.start()).rejects.toThrow('Tunnel already running');
    });

    it('should handle cloudflared errors', async () => {
      const startPromise = tunnelManager.start();
      
      mockProcess.emit('error', new Error('spawn error'));
      
      await expect(startPromise).rejects.toThrow('Failed to start cloudflared');
    });

    it('should timeout if no URL received', async () => {
      jest.useFakeTimers();
      
      const startPromise = tunnelManager.start();
      
      jest.advanceTimersByTime(31000);
      
      await expect(startPromise).rejects.toThrow('Timeout waiting for tunnel URL');
      
      jest.useRealTimers();
    });
  });

  describe('stop', () => {
    it('should stop running tunnel', async () => {
      const startPromise = tunnelManager.start();
      mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
      await startPromise;
      
      const stopPromise = tunnelManager.stop();
      mockProcess.emit('exit', 0);
      
      await stopPromise;
      
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(tunnelManager.isRunning()).toBe(false);
    });

    it('should force kill if graceful shutdown fails', async () => {
      jest.useFakeTimers();
      
      const startPromise = tunnelManager.start();
      mockProcess.stdout.emit('data', 'https://test.trycloudflare.com');
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
      const checkProcess = new EventEmitter();
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const checkPromise = tunnelManager.checkCloudflaredInstalled();
      
      process.nextTick(() => {
        checkProcess.emit('exit', 0);
      });
      
      const result = await checkPromise;
      expect(result).toBe(true);
    });

    it('should return false if cloudflared is not installed', async () => {
      const checkProcess = new EventEmitter();
      (spawn as jest.Mock).mockReturnValueOnce(checkProcess);
      
      const checkPromise = tunnelManager.checkCloudflaredInstalled();
      
      process.nextTick(() => {
        checkProcess.emit('error', new Error('not found'));
      });
      
      const result = await checkPromise;
      expect(result).toBe(false);
    });
  });
});