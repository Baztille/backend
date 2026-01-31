export type BaztilleChatMessageMedata = {
  do_not_notify?: boolean;
  gotopage?: string; // DEPRECATED: use gotopage_url instead
  gotopage_url?: string; // URL (Universal Link Baztille app url) to redirect user to the following page when pressing the link/button
  gotopage_label?: string; // Label of the link/button to show in the chat
  gotopage_args?: {
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
