"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Enable JS-only actions after their handlers have hydrated. */
export function useClientReady() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
