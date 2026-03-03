import { createApp } from "./app/index.mjs";
import { createD1DbAdapter } from "./app/db/d1-adapter.mjs";

type Env = {
  DB: D1Database;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      db: createD1DbAdapter(env.DB),
      environment: "production",
    });
    return app.fetch(request);
  },
};
