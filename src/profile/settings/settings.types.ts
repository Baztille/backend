export type EmailsPreference = {
  name: string;
  default: boolean;
  userpref?: boolean;
  option: boolean;
};

export type EmailsPreferencesByCategory = {
  category: string;
  emails: EmailsPreference[];
};
