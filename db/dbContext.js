import { Sequelize } from "sequelize";

const LEGACY_NETWORK_DEFAULTS = {
  NET_NAME: "iEdon.dn42",
  NET_DESC: "iEdon.dn42 is an experimental global network within DN42",
  NET_ASN: "4242422189",
};

export async function useDbContext(app, dbSettings, networkSettings = {}) {
  const dbLogger = app.logger.getLogger("database");

  const sequelizeOptions = {
    dialect: dbSettings.dialect,
    logging: dbSettings.logging ? (log) => dbLogger.debug(log) : false,
    dialectOptions: dbSettings.dialectOptions,
  };

  if (dbSettings.dialect === "sqlite") {
    sequelizeOptions.storage = dbSettings.storage;
  } else {
    Object.assign(sequelizeOptions, {
      host: dbSettings.host,
      port: dbSettings.port,
      database: dbSettings.database,
      username: dbSettings.user,
      password: dbSettings.password || null,
      pool: dbSettings.pool,
    });
  }

  const sequelize = new Sequelize(sequelizeOptions);

  // database entities
  const models = {};
  const loadedModels = [
    "settings",
    "routers",
    "bgpSessions",
    "posts",
    "peerPreferences",
  ];

  await Promise.all(
    loadedModels.map(async (m) => {
      models[m] = (await import(`./models/${m}.js`)).initModel(sequelize);
    })
  );

  app.sequelize = sequelize;

  try {
    const defaultSettings = [
      { key: "NET_NAME", value: networkSettings.name || "Mofu Networks" },
      {
        key: "NET_DESC",
        value:
          networkSettings.description ||
          "Mofu Networks is an experimental network within DN42",
      },
      { key: "NET_ASN", value: String(networkSettings.asn || "4242422670") },
      { key: "MAINTENANCE_TEXT", value: "" },
      { key: "FOOTER_TEXT", value: "Powered by PeerAPI and Acorle" },
    ];

    await sequelize.sync({ alter: dbSettings.alter || false });
    await models.settings.bulkCreate(defaultSettings, { ignoreDuplicates: true });

    if (networkSettings.migrateLegacyDefaults !== false) {
      for (const setting of defaultSettings) {
        const legacyValue = LEGACY_NETWORK_DEFAULTS[setting.key];
        if (legacyValue === undefined) continue;

        const [updatedRows] = await models.settings.update(
          { value: setting.value },
          { where: { key: setting.key, value: legacyValue } }
        );

        if (updatedRows > 0) {
          dbLogger.info(`Migrated legacy setting ${setting.key}.`);
        }
      }
    }
  } catch (error) {
    if (dbSettings.logging && error.name !== "SequelizeUniqueConstraintError") {
      dbLogger.error(error);
    }
  }

  app.models = models;
}
