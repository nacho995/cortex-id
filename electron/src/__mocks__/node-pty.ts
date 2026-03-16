/**
 * @file __mocks__/node-pty.ts
 * @description Jest mock for node-pty.
 */

const mockPtyProcess = {
  pid: 12345,
  write: jest.fn(),
  resize: jest.fn(),
  kill: jest.fn(),
  onData: jest.fn(),
  onExit: jest.fn(),
};

export const spawn = jest.fn().mockReturnValue(mockPtyProcess);

module.exports = { spawn };
