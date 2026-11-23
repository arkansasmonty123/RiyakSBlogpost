// Node 26 provides node:sqlite at runtime; @types/node may not include it yet.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(filename: string, options?: unknown);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
  export class StatementSync {
    run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }
}
