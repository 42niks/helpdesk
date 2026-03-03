import { createApp } from "./app/index.mjs";
import { createD1DbAdapter } from "./app/db/d1-adapter.mjs";

type Env = {
  DB: D1Database;
  APP_ENV?: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const appEnvironment = env.APP_ENV === "local" ? "local" : "production";
    const app = createApp({
      db: createD1DbAdapter(env.DB),
      environment: appEnvironment,
    });
    return app.fetch(request);
  },
};
