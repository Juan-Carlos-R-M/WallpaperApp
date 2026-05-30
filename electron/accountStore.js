const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const DEFAULT_STEAM_USERNAME = 'adgjl1182';

class AccountStore {
  constructor({ userDataPath, logger = () => {} }) {
    this.filePath = path.join(userDataPath, 'steam-accounts.json');
    this.logger = logger;
  }

  listAccounts() {
    const data = this.read();
    return {
      selectedUsername: data.selectedUsername || DEFAULT_STEAM_USERNAME,
      accounts: data.accounts.map(account => ({
        username: account.username,
        displayName: account.displayName || account.username,
        hasPassword: Boolean(account.encryptedPassword),
        createdAt: account.createdAt,
        updatedAt: account.updatedAt
      }))
    };
  }

  saveAccount({ username, displayName = '', password = '' }) {
    const normalizedUsername = this.normalizeUsername(username);
    const data = this.read();
    const now = new Date().toISOString();
    const existing = data.accounts.find(account => account.username === normalizedUsername);
    const nextAccount = existing || {
      username: normalizedUsername,
      createdAt: now
    };

    nextAccount.displayName = displayName.trim() || normalizedUsername;
    nextAccount.updatedAt = now;

    if (password) {
      nextAccount.encryptedPassword = this.encryptPassword(password);
    }

    if (!existing) {
      data.accounts.unshift(nextAccount);
    }

    data.selectedUsername = normalizedUsername;
    this.write(data);
    this.logger(`Saved Steam account ${normalizedUsername} hasPassword=${Boolean(nextAccount.encryptedPassword)}`);
    return this.listAccounts();
  }

  removeAccount(username) {
    const normalizedUsername = this.normalizeUsername(username);
    const data = this.read();
    data.accounts = data.accounts.filter(account => account.username !== normalizedUsername);

    if (data.accounts.length === 0) {
      data.accounts = [this.defaultAccount()];
    }

    if (data.selectedUsername === normalizedUsername) {
      data.selectedUsername = data.accounts[0].username;
    }

    this.write(data);
    this.logger(`Removed Steam account ${normalizedUsername}`);
    return this.listAccounts();
  }

  selectAccount(username) {
    const normalizedUsername = this.normalizeUsername(username);
    const data = this.read();

    if (!data.accounts.some(account => account.username === normalizedUsername)) {
      data.accounts.unshift({
        username: normalizedUsername,
        displayName: normalizedUsername,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    data.selectedUsername = normalizedUsername;
    this.write(data);
    return this.listAccounts();
  }

  getPassword(username) {
    const normalizedUsername = this.normalizeUsername(username);
    const account = this.read().accounts.find(item => item.username === normalizedUsername);

    if (!account?.encryptedPassword) {
      return '';
    }

    return this.decryptPassword(account.encryptedPassword);
  }

  read() {
    try {
      if (!fs.existsSync(this.filePath)) {
        const data = {
          selectedUsername: DEFAULT_STEAM_USERNAME,
          accounts: [this.defaultAccount()]
        };
        this.write(data);
        return data;
      }

      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const accounts = Array.isArray(data.accounts) ? data.accounts : [];

      if (!accounts.some(account => account.username === DEFAULT_STEAM_USERNAME)) {
        accounts.unshift(this.defaultAccount());
      }

      return {
        selectedUsername: data.selectedUsername || accounts[0]?.username || DEFAULT_STEAM_USERNAME,
        accounts
      };
    } catch (error) {
      this.logger('Error reading Steam account store:', error);
      return {
        selectedUsername: DEFAULT_STEAM_USERNAME,
        accounts: [this.defaultAccount()]
      };
    }
  }

  write(data) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  defaultAccount() {
    const now = new Date().toISOString();
    return {
      username: DEFAULT_STEAM_USERNAME,
      displayName: DEFAULT_STEAM_USERNAME,
      createdAt: now,
      updatedAt: now
    };
  }

  normalizeUsername(username) {
    const normalized = String(username || '').trim();
    if (!normalized) {
      throw new Error('El usuario de Steam es obligatorio.');
    }

    return normalized;
  }

  encryptPassword(password) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('El cifrado seguro de Electron no esta disponible en este equipo.');
    }

    return safeStorage.encryptString(password).toString('base64');
  }

  decryptPassword(encryptedPassword) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('El cifrado seguro de Electron no esta disponible en este equipo.');
    }

    return safeStorage.decryptString(Buffer.from(encryptedPassword, 'base64'));
  }
}

module.exports = AccountStore;
