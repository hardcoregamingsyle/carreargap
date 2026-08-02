// Vite resolves `?url` imports to the emitted asset's URL string.
declare module "*?url" {
  const src: string;
  export default src;
}
