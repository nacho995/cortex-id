/**
 * @file __mocks__/keytar.ts
 * @description Jest mock for keytar (OS keychain access).
 */

const mockStore = new Map<string, string>();

export const setPassword = jest.fn().mockImplementation(
  async (_service: string, account: string, password: string) => {
    mockStore.set(account, password);
  }
);

export const getPassword = jest.fn().mockImplementation(
  async (_service: string, account: string) => {
    return mockStore.get(account) ?? null;
  }
);

export const deletePassword = jest.fn().mockImplementation(
  async (_service: string, account: string) => {
    return mockStore.delete(account);
  }
);

export const findCredentials = jest.fn().mockResolvedValue([]);

module.exports = { setPassword, getPassword, deletePassword, findCredentials };
