export type BaztilleChatMessageMedata = {
  doNotNotify?: boolean;
  gotopage?: string; // DEPRECATED: use gotopageUrl instead
  gotopageUrl?: string; // URL (Universal Link Baztille app url) to redirect user to the following page when pressing the link/button
  gotopageLabel?: string; // Label of the link/button to show in the chat
  gotopageArgsargs?: {
    [key: string]: any;
  };
  alert_message?: string;
  translate?: boolean;
  [key: string]: any;
};

export type BaztilleChatMessage = {
  textMessage: string;
  trimmedMessage: string;
  metadata: BaztilleChatMessageMedata;
};
