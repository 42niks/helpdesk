import { DatabaseSync } from "node:sqlite";

function normalizeParams(params) {
  return Array.isArray(params) ? params : [];
}

export function createNodeDbAdapter(sqlitePath) {
  const db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA foreign_keys = ON");

  return {
    async get(sql, params = []) {
      return db.prepare(sql).get(...normalizeParams(params)) ?? null;
    },
    async all(sql, params = []) {
      return db.prepare(sql).all(...normalizeParams(params));
    },
    async run(sql, params = []) {
      return db.prepare(sql).run(...normalizeParams(params));
    },
    async exec(sql) {
      db.exec(sql);
    },
    async transaction(fn) {
      db.exec("begin");
      try {
        const result = await fn();
        db.exec("commit");
        return result;
      } catch (error) {
        db.exec("rollback");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
