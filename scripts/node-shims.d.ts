// Minimal ambient declarations for the Node APIs used by the offline validation CLI.
// The project intentionally avoids adding @types/node (storage budget, D-019).

declare module 'node:fs' {
  export function readFileSync(path: string, options: { encoding: 'utf8' }): string;
}

declare const process: {
  argv: string[];
  stdout: { write(text: string): boolean };
  stderr: { write(text: string): boolean };
  exit(code?: number): never;
};
