const APPOINTMENT_TIME_ZONE = 'Asia/Colombo';

export function appointmentDateLabel(value) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: APPOINTMENT_TIME_ZONE,
  });
}

export function appointmentTimeLabel(value) {
  if (!value) {
    return 'Time unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return date.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APPOINTMENT_TIME_ZONE,
  });
}

export function appointmentDateTimeLabel(value) {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: APPOINTMENT_TIME_ZONE,
  });
}

export function sessionTimeRangeLabel(startAt, endAt) {
  if (!startAt || !endAt) {
    return 'Time unavailable';
  }

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getTime() >= end.getTime()
  ) {
    return 'Time unavailable';
  }

  return `${appointmentTimeLabel(startAt)} – ${appointmentTimeLabel(endAt)}`;
}

export function appointmentStatusLabel(status) {
  switch (status) {
    case 'CONFIRMED':
      return 'Confirmed';

    case 'CANCELLED':
      return 'Cancelled';

    default:
      return 'Status unavailable';
  }
}

export function appointmentTimingLabel(dateTime, now = new Date()) {
  const appointmentDate = new Date(dateTime);
  const currentDate = new Date(now);

  if (
    Number.isNaN(appointmentDate.getTime()) ||
    Number.isNaN(currentDate.getTime())
  ) {
    return 'Timing unavailable';
  }

  return appointmentDate.getTime() > currentDate.getTime()
    ? 'Upcoming'
    : 'Past';
}

export function canCustomerCancelAppointment(appointment, now = new Date()) {
  if (appointment?.status !== 'CONFIRMED') {
    return false;
  }

  const appointmentDate = new Date(appointment.dateTime);
  const currentDate = new Date(now);

  if (
    Number.isNaN(appointmentDate.getTime()) ||
    Number.isNaN(currentDate.getTime())
  ) {
    return false;
  }

  return currentDate.getTime() < appointmentDate.getTime();
}

export function bookingErrorLabel(error) {
  switch (error?.code) {
    case 'SESSION_FULL':
      return 'That doctor session is no longer available. Please choose another session.';

    case 'BOOKING_WINDOW':
      return 'This session can no longer be booked because appointments must be made at least 24 hours in advance.';

    case 'DUPLICATE_BOOKING':
      return 'You already have a confirmed appointment for this doctor session.';

    case 'PROVIDER_CHANGED':
      return 'The selected doctor is no longer available for this session. Please choose another session.';

    default:
      break;
  }

  if (error?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (error?.status === 403) {
    return 'You do not have permission to book this appointment.';
  }

  if (error?.status === 404) {
    return 'The selected doctor session is no longer available.';
  }

  if (error?.status === 400 || error?.status === 422) {
    return 'The selected appointment could not be validated. Please choose another available session.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not book your appointment. Please try again.';
}

export function appointmentListErrorLabel(error) {
  if (error?.status === 403) {
    return 'You do not have permission to view appointments.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not load your appointments. Please try again.';
}

export function appointmentDetailsErrorLabel(error) {
  if (error?.status === 403 || error?.status === 404) {
    return 'This appointment is unavailable or you do not have access to it.';
  }

  if (error?.status === 400 || error?.status === 422) {
    return 'The appointment identifier is invalid.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not load this appointment. Please try again.';
}

export function cancellationErrorLabel(error) {
  switch (error?.code) {
    case 'CUSTOMER_CANCEL_WINDOW':
      return 'This appointment can no longer be cancelled because the doctor session has already started.';

    case 'INVALID_STATUS':
      return 'Only confirmed appointments can be cancelled.';

    default:
      break;
  }

  if (error?.status === 403 || error?.status === 404) {
    return 'This appointment cannot be cancelled or is unavailable.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not cancel this appointment. Please try again.';
}

export function appointmentAvailabilityErrorLabel(error) {
  if (error?.status === 403) {
    return 'You do not have permission to view appointment availability.';
  }

  if (error?.status === 0) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return 'We could not load appointment availability. Please try again.';
}
