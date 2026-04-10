export type AppointmentWindow = {
  date: string;
  time: string;
};

export function buildScheduledDatetime(window: AppointmentWindow) {
  return `${window.date}T${window.time}:00`;
}
