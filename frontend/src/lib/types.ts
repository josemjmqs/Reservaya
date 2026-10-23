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