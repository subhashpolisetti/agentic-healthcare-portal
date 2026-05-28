export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

export type DoctorMatch = {
  doctor_name: string;
  npi: string;
  speciality: string;
  credential: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  distance_miles: number | null;
  reasoning?: string;
};

export type TelehealthOption = {
  type: string;
  name: string;
  description: string;
  available: boolean;
};

export type IntakeAnalysis = {
  urgency: "emergency" | "urgent" | "routine";
  urgency_reason: string;
  confidence: number;
  is_shortage_area: boolean;
  shortage_type: string;
  shortage_description: string;
  doctors: DoctorMatch[];
  telehealth_options: TelehealthOption[];
  error: string | null;
};

export type Appointment = {
  appointment_id: number;
  doctor_name: string;
  speciality: string;
  patient_name: string;
  patient_email: string;
  appointment_date: string;
  slot_start_time: string;
  status: string;
  chief_complaint: string | null;
  noshow_risk: number | null;
  risk_level: "high" | "medium" | "low" | null;
  soap_notes: string | null;
  discharge_summary: string | null;
  discharged_at: string | null;
  followup_sent_at: string | null;
  analysis_status: "PENDING" | "IN_PROGRESS" | "READY" | "FAILED" | "STALE" | null;
  cancel_reason: string | null;
  intervention_message: string | null;
};
