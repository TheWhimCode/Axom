/**
 * Shared types for Session table rows. Queries select different columns;
 * optional fields are undefined when not selected.
 */
export type SessionRow = {
  id: string;
  status?: string;
  discordId: string | null;
  studentId?: string | null;
  riotTag: string | null;
  sessionType: string;
  scheduledStart: Date;
  scheduledMinutes: number;
  notes: string | null;
  followups?: number;
  confirmationSent?: boolean;
  bookingOwnerSent?: boolean;
  reminderSent?: boolean;
  followupSent?: boolean;
  champions?: string[] | null;
};
