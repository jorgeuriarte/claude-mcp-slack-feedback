import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../config-manager', () => ({
  ConfigManager: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined)
  }))
}));
jest.mock('../session-manager', () => ({
  SessionManager: jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(undefined),
    getAllActiveSessions: jest.fn().mockResolvedValue([])
  }))
}));

describe('SlackFeedbackMCPServer', () => {
  let mockServer: jest.Mocked<Server>;
  let listToolsHandler: any;
  let callToolHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockServer = {
      setRequestHandler: jest.fn((schema, handler) => {
        if (schema === ListToolsRequestSchema) {
          listToolsHandler = handler;
        } else if (schema === CallToolRequestSchema) {
          callToolHandler = handler;
        }
      }),
      connect: jest.fn(),
    } as any;

    (Server as jest.MockedClass<typeof Server>).mockImplementation(() => mockServer);
  });

  it('should register all MCP tools', async () => {
    // Import after mocks are set up
    jest.isolateModules(() => {
      require('../index');
    });
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      expect.any(Function)
    );

    const response = await listToolsHandler();
    const toolNames = response.tools.map((t: any) => t.name);
    
    expect(toolNames).toContain('setup_slack_config');
    expect(toolNames).toContain('ask_feedback');
    expect(toolNames).toContain('update_progress');
    expect(toolNames).toContain('get_responses');
    expect(toolNames).toContain('list_sessions');
  });

  it('should handle list_sessions tool call', async () => {
    jest.isolateModules(() => {
      require('../index');
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await callToolHandler({
      params: {
        name: 'list_sessions',
        arguments: {}
      }
    });

    expect(response.content[0].text).toContain('No active sessions');
  });

  it('should handle unknown tool error', async () => {
    jest.isolateModules(() => {
      require('../index');
    });
    await new Promise(resolve => setTimeout(resolve, 100));

    await expect(callToolHandler({
      params: {
        name: 'unknown_tool',
        arguments: {}
      }
    })).rejects.toThrow('Unknown tool');
  });
});