export type NotificationPermission = 'granted' | 'denied' | 'default' | 'unsupported';

let _permissionStatus: NotificationPermission = 'unsupported';
let _listeners: Array<(status: NotificationPermission) => void> = [];

export function isSupported(): boolean {
  return typeof Notification !== 'undefined';
}

export function getPermission(): NotificationPermission {
  if (!isSupported()) return 'unsupported';
  return Notification.permission as NotificationPermission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) {
    _permissionStatus = 'unsupported';
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    _permissionStatus = result as NotificationPermission;
    _listeners.forEach((fn) => fn(_permissionStatus));
    return _permissionStatus;
  } catch {
    _permissionStatus = 'denied';
    return 'denied';
  }
}

export function onPermissionChange(fn: (status: NotificationPermission) => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

export function sendNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isSupported() || Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, { icon: '/icons/icon-192.png', ...options });
  } catch (e) {
    console.warn('[Notification] Failed to send:', e);
    return null;
  }
}

export function init(): void {
  if (!isSupported()) {
    _permissionStatus = 'unsupported';
    return;
  }
  _permissionStatus = Notification.permission as NotificationPermission;
}
