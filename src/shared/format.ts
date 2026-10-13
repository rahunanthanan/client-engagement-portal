const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const time = new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' });

export const formatDateTime = (iso: string | null | undefined) => (iso ? `${dateTime.format(new Date(iso))} UTC` : '—');
export const formatTime = (iso: string | null | undefined) => (iso ? time.format(new Date(iso)) : '—');
