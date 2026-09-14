/**
 * firebase/auth paketinin React Native yapisi getReactNativePersistence'i
 * disari acar, ancak pakete gelen TypeScript tipleri web yapisini gosterir.
 * Asagidaki bildirim mevcut tiplere yalnizca bu fonksiyonu ekler (modul
 * genisletmesi); calisma zamaninda Metro dogru yapiyi yukler.
 */
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): any;
}
