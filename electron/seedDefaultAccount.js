const path = require('path');
const { app } = require('electron');
const AccountStore = require('./accountStore');

app.setPath('userData', path.join(app.getPath('appData'), 'Wallpaper App Desktop'));

app.whenReady().then(() => {
  try {
    const username = process.env.WALLPAPER_APP_SEED_STEAM_USER;
    const password = process.env.WALLPAPER_APP_SEED_STEAM_PASSWORD;

    if (!username || !password) {
      throw new Error('Faltan WALLPAPER_APP_SEED_STEAM_USER o WALLPAPER_APP_SEED_STEAM_PASSWORD.');
    }

    const store = new AccountStore({
      userDataPath: app.getPath('userData'),
      logger: () => {}
    });

    store.saveAccount({
      username,
      displayName: username,
      password
    });

    console.log(`Cuenta Steam guardada para ${username}`);
    app.quit();
  } catch (error) {
    console.error(error.message);
    app.exit(1);
  }
});
