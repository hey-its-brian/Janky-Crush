// The iCloud copy of the save, in the native app. The game plays from the
// copy on the phone (localStorage); this sends each change to iCloud and
// brings in what another device saved. The native side is the CloudSave
// plugin (ios/App/App/CloudSavePlugin.swift), which uses iCloud key-value
// storage.

import { isNative, native } from './native.js';

const KEY = 'save';
const SEND_AFTER_MS = 1500; // a level ends with many saves close together: send one

// The save in iCloud. Resolves to { data, available }: `data` is null if
// there is none, and `available` is false if the phone has no iCloud
// account.
export async function cloudLoad() {
  const got = await native('CloudSave', 'get', { key: KEY });
  if (!got) return { data: null, available: false };
  let data = null;
  try {
    data = got.value ? JSON.parse(got.value) : null;
  } catch {
    // Not a save: ignore it.
  }
  return { data: data?.version === 2 && data.slots ? data : null, available: got.available !== false };
}

let timer = null;

// Send the save to iCloud, a moment from now.
export function cloudStore(data) {
  if (!isNative) return;
  clearTimeout(timer);
  timer = setTimeout(() => native('CloudSave', 'set', { key: KEY, value: JSON.stringify(data) }), SEND_AFTER_MS);
}
