// Dovli's public pages on the web, opened from the app. Always the live site, never a dev server:
// these are the addresses the Play Store listing points to as well.

import { Linking } from "react-native";

const SITE = "https://dovli.in";

export const links = {
  privacy: `${SITE}/privacy`,
  deleteAccount: `${SITE}/delete-account`,
};

export function openLink(url: string) {
  Linking.openURL(url).catch(() => {});
}
