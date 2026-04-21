export interface WidgetMeta {
  key: string;
  label: string;
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  { key: "status-form",     label: "Status di Forma" },
  { key: "vo2max",          label: "VO2 Max / VDOT" },
  { key: "previsione-gara", label: "Previsione Gara" },
  { key: "fatigue-atl",     label: "Fatigue (ATL)" },
  { key: "soglia",          label: "Soglia Anaerobica" },
  { key: "deriva",          label: "Deriva Cardiaca" },
  { key: "weekly-km",       label: "KM Settimanali" },
  { key: "last-run-map",    label: "Mappa Ultima Corsa" },
  { key: "next-optimal",    label: "Prossima Sessione" },
  { key: "hr-zones",        label: "Zone Cardiache" },
  { key: "fitness-chart",   label: "Condizione Fisica" },
  { key: "training-paces",  label: "Training Paces" },
  { key: "session-logs",    label: "Session Logs" },
];
