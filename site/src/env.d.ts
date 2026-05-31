/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}
