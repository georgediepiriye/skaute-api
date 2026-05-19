import promptSync from "prompt-sync";
import config from "../../config/config.js";
import logger from "../../utils/logger.js";

// 1. Keep the Enum for consistency
enum ENVS {
  TEST = "test",
  DEV = "development",
  STAGE = "staging",
  PROD = "production",
}

// 2. Map the URLs from your new config structure
const configEnvs = {
  [ENVS.DEV]: {
    url: config.db.url as string,
  },
  [ENVS.TEST]: {
    url: config.db.url?.replace("skaute", "skaute-Test") as string,
  },
  [ENVS.STAGE]: {
    url: config.db.url as string,
  },
  [ENVS.PROD]: {
    url: config.db.url as string,
  },
};

const selectDB = (env: ENVS, devOverride: boolean = true): { url: string } => {
  logger.info(`Database Selector: Initializing for environment [${env}]`);

  const database = configEnvs[env];

  if (!database || !database.url) {
    logger.error(`Database Selector Error: No URL mapping for ${env}`);
    throw new Error(`No database URL found for environment: ${env}`);
  }

  const isCloudDB = database.url.startsWith("mongodb+srv://");

  switch (env) {
    case ENVS.TEST:
      if (isCloudDB) {
        logger.error(
          `CRITICAL SECURITY BREACH: Attempted to run TEST suite against CLOUD DB`,
        );
        throw new Error(
          `❌ TERMINATING: You are trying to run tests against a CLOUD database. Use a local DB.`,
        );
      }
      break;

    case ENVS.DEV:
      if (isCloudDB) {
        logger.warn(
          `CLOUD DB DETECTED: DB operations will hit Atlas (Cloud) for environment [${env}]`,
        );

        if (!devOverride) {
          logger.error(
            `Database Selector Error: Dev override disabled for Cloud DB connection.`,
          );
          throw new Error(
            `❌ TERMINATING: Seed/Dev override disabled for Cloud DB.`,
          );
        }

        const prompt = promptSync();
        console.log(
          `\n⚠️  \x1b[31mWARNING\x1b[0m: Connection string detected as CLOUD (Atlas).`,
        );
        const userConfirmation = prompt(
          `Are you sure you want to proceed with ${env} operations? (y/n): `,
        );

        if (userConfirmation.toLowerCase() !== "y") {
          logger.info(
            `Database process aborted by user for environment: ${env}`,
          );
          throw new Error("Process terminated by user.");
        }

        logger.info(
          `User confirmed Cloud DB connection for ${env}. Proceeding...`,
        );
      }
      break;

    default:
      logger.info(
        `Connecting to ${isCloudDB ? "Cloud" : "Local"} DB for ${env}`,
      );
      break;
  }

  return database;
};

export default selectDB;
