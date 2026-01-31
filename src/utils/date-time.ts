export const getCurrentDate = () => {
  if (process.env.FAKE_DATE) {
    return new Date(process.env.FAKE_DATE);
  } else {
    return new Date();
  }
};

/*
 ** Returns the next occurrence of specified hour in the specified timezone, after adding the specified number of days to the fromDate.
 ** The returned Date object is in UTC.
 ** Example: To get the next occurrence of noon (12:00) in backend cronjobs timezone, 4 days from now:
 **   getNextOccurrenceOfHourInTimezone(new Date(), 4, 12, process.env.TIMEZONE_FOR_CRONJOBS || "UTC");
 ** @param fromDate - The starting date
 ** @param daysToAdd - The number of days to add to the fromDate
 ** @param hourToSet - The hour to set (0-23)
 ** @param timezone - The IANA timezone string (e.g., "America/New_York") or process.env.TIMEZONE_FOR_CRONJOBS
 ** @returns Date object representing the next occurrence of noon in the specified timezone
 */
export const getNextOccurrenceOfHourInTimezone = (
  fromDate: Date,
  daysToAdd: number,
  hourToSet: number,
  timezone: string
): Date => {
  // Create a date in the target timezone at noon
  const targetDate = new Date(fromDate);
  targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd);
  targetDate.setUTCHours(hourToSet, 0, 0, 0);
  // Convert to the specified timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };

  // Use Intl.DateTimeFormat to get the parts of the date in the target timezone
  const formatter = new Intl.DateTimeFormat([], options);
  const parts = formatter.formatToParts(targetDate);

  // Extract the parts we need
  const year = parseInt(parts.find((part) => part.type === "year")?.value || "1970", 10);
  const month = parseInt(parts.find((part) => part.type === "month")?.value || "01", 10) - 1; // Months are 0-based
  const day = parseInt(parts.find((part) => part.type === "day")?.value || "01", 10);
  const hour = parseInt(parts.find((part) => part.type === "hour")?.value || "00", 10);
  const minute = parseInt(parts.find((part) => part.type === "minute")?.value || "00", 10);
  const second = parseInt(parts.find((part) => part.type === "second")?.value || "00", 10);

  // Create a new Date object in UTC
  return new Date(Date.UTC(year, month, day, hour, minute, second));
};
