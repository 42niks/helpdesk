function bindParams(statement, params) {
  if (!params || params.length === 0) {
    return statement;
  }
  return statement.bind(...params);
}

export function createD1DbAdapter(d1Database) {
  return {
    async get(sql, params = []) {
      return bindParams(d1Database.prepare(sql), params).first();
    },
    async all(sql, params = []) {
      const result = await bindParams(d1Database.prepare(sql), params).all();
      return result.results ?? [];
    },
    async run(sql, params = []) {
      return bindParams(d1Database.prepare(sql), params).run();
    },
    async exec(sql) {
      await d1Database.exec(sql);
    },
    close() {},
  };
}
