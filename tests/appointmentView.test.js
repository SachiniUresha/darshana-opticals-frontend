import { describe, expect, it } from 'vitest';
import {
  appointmentDateLabel,
  appointmentDateTimeLabel,
  appointmentDetailsErrorLabel,
  appointmentAvailabilityErrorLabel,
  appointmentListErrorLabel,
  appointmentStatusLabel,
  appointmentTimeLabel,
  appointmentTimingLabel,
  bookingErrorLabel,
  cancellationErrorLabel,
  canCustomerCancelAppointment,
  sessionTimeRangeLabel,
} from '../src/components/appointments/appointmentView';

describe('appointmentView', () => {
  it('formats appointment dates using Asia/Colombo time', () => {
    const value = '2026-11-01T09:00:00.000Z';

    expect(appointmentDateLabel(value)).toBe('1 November 2026');
    expect(appointmentTimeLabel(value)).toContain('2:30');
    expect(appointmentDateTimeLabel(value)).toContain('1 November 2026');
    expect(appointmentDateTimeLabel(value)).toContain('2:30');
  });

  it('formats the backend doctor session time range', () => {
    const result = sessionTimeRangeLabel(
      '2026-11-01T09:00:00.000Z',
      '2026-11-01T10:00:00.000Z',
    );

    expect(result).toContain('2:30');
    expect(result).toContain('3:30');
  });

  it('returns safe fallbacks for invalid date values', () => {
    expect(appointmentDateLabel('invalid')).toBe('Date unavailable');
    expect(appointmentTimeLabel('invalid')).toBe('Time unavailable');
    expect(appointmentDateTimeLabel('invalid')).toBe('Date unavailable');
    expect(sessionTimeRangeLabel('invalid', 'invalid')).toBe(
      'Time unavailable',
    );
  });

  it('supports only the canonical Sprint 2 appointment statuses', () => {
    expect(appointmentStatusLabel('CONFIRMED')).toBe('Confirmed');
    expect(appointmentStatusLabel('CANCELLED')).toBe('Cancelled');
    expect(appointmentStatusLabel('COMPLETED')).toBe('Status unavailable');
  });

  it('classifies appointments as upcoming or past from date/time without inventing another status', () => {
    const now = new Date('2026-10-14T06:00:00.000Z');

    expect(appointmentTimingLabel('2026-11-01T09:00:00.000Z', now)).toBe(
      'Upcoming',
    );

    expect(appointmentTimingLabel('2026-10-01T09:00:00.000Z', now)).toBe(
      'Past',
    );
  });

  it('allows customer cancellation only for a confirmed appointment before its start time', () => {
    const now = new Date('2026-10-14T06:00:00.000Z');

    expect(
      canCustomerCancelAppointment(
        {
          status: 'CONFIRMED',
          dateTime: '2026-11-01T09:00:00.000Z',
        },
        now,
      ),
    ).toBe(true);

    expect(
      canCustomerCancelAppointment(
        {
          status: 'CANCELLED',
          dateTime: '2026-11-01T09:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);

    expect(
      canCustomerCancelAppointment(
        {
          status: 'CONFIRMED',
          dateTime: '2026-10-01T09:00:00.000Z',
        },
        now,
      ),
    ).toBe(false);
  });

  it('maps appointment booking conflicts to safe customer messages', () => {
    expect(
      bookingErrorLabel({
        status: 409,
        code: 'SESSION_FULL',
      }),
    ).toMatch(/no longer available/i);

    expect(
      bookingErrorLabel({
        status: 409,
        code: 'BOOKING_WINDOW',
      }),
    ).toMatch(/24 hours/i);

    expect(
      bookingErrorLabel({
        status: 409,
        code: 'DUPLICATE_BOOKING',
      }),
    ).toMatch(/already have/i);
  });

  it('maps appointment loading failures without exposing backend internals', () => {
    expect(
      appointmentListErrorLabel({
        status: 0,
      }),
    ).toMatch(/unable to reach the server/i);

    expect(
      appointmentDetailsErrorLabel({
        status: 404,
      }),
    ).toMatch(/unavailable/i);
  });

  it('maps customer cancellation restrictions safely', () => {
    expect(
      cancellationErrorLabel({
        status: 409,
        code: 'CUSTOMER_CANCEL_WINDOW',
      }),
    ).toMatch(/already started/i);

    expect(
      cancellationErrorLabel({
        status: 409,
        code: 'INVALID_STATUS',
      }),
    ).toMatch(/only confirmed appointments/i);
  });
});

it('maps appointment availability loading errors safely', () => {
  expect(
    appointmentAvailabilityErrorLabel({
      status: 0,
    }),
  ).toMatch(/unable to reach the server/i);

  expect(
    appointmentAvailabilityErrorLabel({
      status: 500,
    }),
  ).toMatch(/could not load appointment availability/i);
});
