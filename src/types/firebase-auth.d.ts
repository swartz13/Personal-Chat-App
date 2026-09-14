/**
 * The React Native build of the firebase/auth package exposes getReactNativePersistence,
 * but the TypeScript definitions bundled with the package reflect the web build.
 * The declaration below augments the module to include this function; Metro loads
 * the correct runtime bundle at runtime.
 */
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): any;
}
