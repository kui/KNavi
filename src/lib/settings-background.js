// @flow

import { recieve, sendTo } from "./chrome-messages";
import settings from "./settings";
import BlackList from "./blacklist";
import AdditionalSelectors from "./additional-selectors";
import type { Settings } from "./settings";
import type { GetMatchedBlackList, GetMatchedSelectors } from "./settings-client";

let settingValues: Promise<Settings>;
let blackList: Promise<BlackList>;
let additionalSelectors: Promise<AdditionalSelectors>;

export type BroadcastNewSettings = {
  type: "BroadcastNewSettings";
  settings: Settings;
};

(async () => {
  await settings.init();
  settingValues = settings.load();
  settingValues.then((s) => console.log("Init load settings", s));
  blackList = settingValues.then((s) => new BlackList(s.blackList));
  additionalSelectors = buildAdditionalSelectorsPromise();

  recieve("GetMatchedBlackList", async ({ url }: GetMatchedBlackList, s, sendResponse) => {
    sendResponse((await blackList).match(url));
  });

  recieve("GetMatchedSelectors", async ({ url }: GetMatchedSelectors, s, sendResponse) => {
    sendResponse((await additionalSelectors).match(url));
  });

  recieve("GetSettings", async (m, s, sendResponse) => {
    sendResponse(await settingValues);
  });
})();

chrome.storage.onChanged.addListener(async () => {
  settingValues = settings.load();
  settingValues.then((s) => console.log("Settings changed", s));

  blackList = settingValues.then((s) => new BlackList(s.blackList));
  additionalSelectors = buildAdditionalSelectorsPromise();
  const tabs = new Promise((resolve) => chrome.tabs.query({}, resolve));
  const s: BroadcastNewSettings = {
    type: "BroadcastNewSettings",
    settings: await settingValues,
  };
  for (const tab of await tabs) {
    sendTo(s, tab.id);
  }
});

function buildAdditionalSelectorsPromise() {
  return settingValues
    .then((s) => new AdditionalSelectors(s.additionalSelectors))
    .catch((e) => {
      console.error(e);
      return new AdditionalSelectors("{}");
    });
}
