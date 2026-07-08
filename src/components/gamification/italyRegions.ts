import { haversine } from "./gamiData";

/**
 * CONQUISTA D'ITALIA — 20 regioni, un capoluogo ciascuna.
 * Si parte da Roma (base). Il costo per conquistare una regione è la distanza
 * STRADALE stimata Roma → capoluogo (linea d'aria × fattore ~1.2), da scalare
 * dai km disponibili (km totali corsi − km già spesi in conquiste).
 */

export interface Region {
  id: string;
  region: string;
  capital: string;
  lat: number;
  lng: number;
}

export const HOME_REGION_ID = "lazio";
export const ROME = { lat: 41.9028, lng: 12.4964 };
const ROAD_FACTOR = 1.2; // linea d'aria → strada reale (approssimazione)

export const ITALY_REGIONS: Region[] = [
  { id: "lazio",         region: "Lazio",                 capital: "Roma",        lat: 41.9028, lng: 12.4964 },
  { id: "umbria",        region: "Umbria",                capital: "Perugia",     lat: 43.1107, lng: 12.3908 },
  { id: "abruzzo",       region: "Abruzzo",               capital: "L'Aquila",    lat: 42.3498, lng: 13.3995 },
  { id: "molise",        region: "Molise",                capital: "Campobasso",  lat: 41.5603, lng: 14.6627 },
  { id: "toscana",       region: "Toscana",               capital: "Firenze",     lat: 43.7696, lng: 11.2558 },
  { id: "marche",        region: "Marche",                capital: "Ancona",      lat: 43.6158, lng: 13.5189 },
  { id: "campania",      region: "Campania",              capital: "Napoli",      lat: 40.8518, lng: 14.2681 },
  { id: "emilia-romagna",region: "Emilia-Romagna",        capital: "Bologna",     lat: 44.4949, lng: 11.3426 },
  { id: "basilicata",    region: "Basilicata",            capital: "Potenza",     lat: 40.6395, lng: 15.8055 },
  { id: "liguria",       region: "Liguria",               capital: "Genova",      lat: 44.4056, lng:  8.9463 },
  { id: "puglia",        region: "Puglia",                capital: "Bari",        lat: 41.1171, lng: 16.8719 },
  { id: "veneto",        region: "Veneto",                capital: "Venezia",     lat: 45.4408, lng: 12.3155 },
  { id: "lombardia",     region: "Lombardia",             capital: "Milano",      lat: 45.4642, lng:  9.1900 },
  { id: "calabria",      region: "Calabria",              capital: "Catanzaro",   lat: 38.9098, lng: 16.5877 },
  { id: "trentino",      region: "Trentino-Alto Adige",   capital: "Trento",      lat: 46.0700, lng: 11.1190 },
  { id: "friuli",        region: "Friuli-Venezia Giulia", capital: "Trieste",     lat: 45.6495, lng: 13.7768 },
  { id: "piemonte",      region: "Piemonte",              capital: "Torino",      lat: 45.0703, lng:  7.6869 },
  { id: "valledaosta",   region: "Valle d'Aosta",         capital: "Aosta",       lat: 45.7372, lng:  7.3206 },
  { id: "sardegna",      region: "Sardegna",              capital: "Cagliari",    lat: 39.2238, lng:  9.1217 },
  { id: "sicilia",       region: "Sicilia",               capital: "Palermo",     lat: 38.1157, lng: 13.3615 },
];

/** Costo in km per conquistare una regione (Roma → capoluogo, stradale stimata). */
export function regionCostKm(r: Region): number {
  return Math.round(haversine(ROME, r) * ROAD_FACTOR);
}
