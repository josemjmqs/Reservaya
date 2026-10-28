export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number | null;
  active: boolean;
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