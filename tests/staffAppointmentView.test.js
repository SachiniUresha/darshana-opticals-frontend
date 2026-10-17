import { describe, expect, it } from 'vitest';
import {
  canManageStaffAppointments,
  canViewStaffAppointments,
  formatAppointmentDateTime,
  formatDoctorSessionRange,
  getAppointmentStatusLabel,
  getAppointmentTiming,
  isReadOnlyStaffAppointmentRole,
} from '../src/utils/staffAppointmentView';
import {
  BRANCH_ASSISTANT,
  BRANCH_MANAGER,
  CUSTOMER,
  OPTOMETRIST,
  SYSTEM_ADMIN,
} from '../src/config/roles';

describe('staffAppointmentView', () => {
  it('allows Branch Assistant and Branch Manager to view staff appointments', () => {
    expect(canViewStaffAppointments(BRANCH_ASSISTANT)).toBe(true);
    expect(canViewStaffAppointments(BRANCH_MANAGER)).toBe(true);
  });

  it('denies unsupported roles from staff appointment viewing', () => {
    expect(canViewStaffAppointments(CUSTOMER)).toBe(false);
    expect(canViewStaffAppointments(OPTOMETRIST)).toBe(false);
    expect(canViewStaffAppointments(SYSTEM_ADMIN)).toBe(false);
  });

  it('allows only Branch Assistant to manage appointments', () => {
    expect(canManageStaffAppointments(BRANCH_ASSISTANT)).toBe(true);
    expect(canManageStaffAppointments(BRANCH_MANAGER)).toBe(false);
    expect(canManageStaffAppointments(CUSTOMER)).toBe(false);
  });

  it('identifies Branch Manager as read-only', () => {
    expect(isReadOnlyStaffAppointmentRole(BRANCH_MANAGER)).toBe(true);
    expect(isReadOnlyStaffAppointmentRole(BRANCH_ASSISTANT)).toBe(false);
  });

  it('maps confirmed status to a readable label', () => {
    expect(getAppointmentStatusLabel('CONFIRMED')).toBe('Confirmed');
  });

  it('maps cancelled status to a readable label', () => {
    expect(getAppointmentStatusLabel('CANCELLED')).toBe('Cancelled');
  });

  it('does not invent a label for an unknown lifecycle status', () => {
    expect(getAppointmentStatusLabel('COMPLETED')).toBe('Unknown');
  });

  it('formats appointment time using Asia/Colombo', () => {
    const result = formatAppointmentDateTime('2026-11-01T03:30:00.000Z');

    expect(result).toContain('2026');
    expect(result).not.toBe('Unavailable');
  });

  it('returns unavailable for an invalid appointment date', () => {
    expect(formatAppointmentDateTime('not-a-date')).toBe('Unavailable');
  });

  it('formats a valid doctor session range', () => {
    const result = formatDoctorSessionRange(
      '2026-11-01T03:30:00.000Z',
      '2026-11-01T04:30:00.000Z',
    );

    expect(result).toContain('2026');
    expect(result).not.toBe('Unavailable');
  });

  it('separates upcoming and past timing from appointment status', () => {
    const now = new Date('2026-10-14T10:00:00.000Z');

    expect(getAppointmentTiming('2026-11-01T03:30:00.000Z', now)).toBe(
      'UPCOMING',
    );

    expect(getAppointmentTiming('2026-09-01T03:30:00.000Z', now)).toBe('PAST');
  });

  it('returns unknown timing for invalid date values', () => {
    expect(getAppointmentTiming('invalid')).toBe('UNKNOWN');
  });
});
