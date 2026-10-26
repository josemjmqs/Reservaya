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
  status: string;
  manageToken: string;
}
