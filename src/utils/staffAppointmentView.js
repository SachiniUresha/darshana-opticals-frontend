import { BRANCH_ASSISTANT, BRANCH_MANAGER } from '../config/roles';
import {
  appointmentDateLabel,
  appointmentDateTimeLabel,
  appointmentStatusLabel,
  appointmentTimeLabel,
  appointmentTimingLabel,
  sessionTimeRangeLabel,
} from '../components/appointments/appointmentView';

export function canViewStaffAppointments(role) {
  return role === BRANCH_ASSISTANT || role === BRANCH_MANAGER;
}

export function canManageStaffAppointments(role) {
  return role === BRANCH_ASSISTANT;
}

export function isReadOnlyStaffAppointmentRole(role) {
  return role === BRANCH_MANAGER;
}

export function getAppointmentStatusLabel(status) {
  const label = appointmentStatusLabel(status);

  return label === 'Status unavailable' ? 'Unknown' : label;
}

export function formatAppointmentDateTime(value) {
  const label = appointmentDateTimeLabel(value);

  return label === 'Date unavailable' ? 'Unavailable' : label;
}

export function formatAppointmentTime(value) {
  const label = appointmentTimeLabel(value);

  return label === 'Time unavailable' ? 'Unavailable' : label;
}

export function formatDoctorSessionRange(startAt, endAt) {
  const date = appointmentDateLabel(startAt);
  const timeRange = sessionTimeRangeLabel(startAt, endAt);

  if (date === 'Date unavailable' || timeRange === 'Time unavailable') {
    return 'Unavailable';
  }

  return `${date} · ${timeRange}`;
}

export function getAppointmentTiming(dateTime, now = new Date()) {
  const timing = appointmentTimingLabel(dateTime, now);

  if (timing === 'Upcoming') {
    return 'UPCOMING';
  }

  if (timing === 'Past') {
    return 'PAST';
  }

  return 'UNKNOWN';
}
