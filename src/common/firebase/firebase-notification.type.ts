/**
 * Firebase notification object
 */
export class FirebaseNotification {
  /**
   * Client device token
   */
  token: string;

  /**
   * Notification Title
   */
  title: string;

  /**
   * Notification Body
   */
  body: string;

  /**
   * URL (Universal Link Baztille app url) to redirect user to the following page when opening this notification
   */
  gotopage_url?: string;

  /**
   * DEPRECATED: use gotopage_url instead
   * Redirect user to the following page when opening this notification
   */
  gotopage?: string;

  /**
   * Arguments for the component we are going to redirect user to (to be used with gotopage)
   */
  gotopage_args?: any;

  /**
   * Display alert message screen on user
   */
  alert_message?: string;

  /**
   * Any more data we want to embed in the notif
   */
  data?: any;

  // Notification Icon / Logo
  // icon?: string;
}
