export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  totalMin: number | null;
  price: number | null;
  active: boolean;
  category: string | null;
}

export interface WorkingHour {
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface PublicBusiness {
  name: string;
  slug: string;
  timezone: string;
  phone: string | null;
  services: Omit<Service, "active">[];
  members: {
    id: string;
    displayName: string;
    services: { serviceId: string }[];
  }[];
}

export interface BookingResult {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  manageToken: string;
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";
export type SettableStatus = Exclude<BookingStatus, "PENDING">;

export interface AgendaBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  notes: string | null;
  service: { name: string; durationMin: number };
  member: { id: string; displayName: string };
  customer: { name: string; email: string; phone: string | null };
}

export interface ManagedBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  service: { name: string; durationMin: number };
  business: { name: string; timezone: string; phone: string | null };
}

export interface TeamMember {
  id: string;
  displayName: string;
  role: "OWNER" | "STAFF";
  bookable: boolean;
  active: boolean;
  services: { serviceId: string }[];
}

export interface TimeBlock {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  allDay: boolean;
  member: { id: string; displayName: string } | null;
}

export interface TimeBlockList {
  timezone: string;
  blocks: TimeBlock[];
}
