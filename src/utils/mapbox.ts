/**
 * Token pubblico Mapbox (chiave `pk.`, pensata per stare nel client).
 * Centralizzato qui per non spargere la stessa credenziale in più file.
 *
 * Nota: essendo pubblica va protetta lato Mapbox limitandola ai domini
 * dell'app (Account → Tokens → URL restrictions), non nascondendola nel bundle.
 */
export const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1Ijoia2lra29kZXJpc28iLCJhIjoiY21uYWszMTIxMGp3NzJzc2JraDhwbTU5ayJ9.-60pgYn_BXERAHA7AqVgqA';

/** Stile scuro, coerente col tema dell'app. */
export const MAPBOX_STYLE_DARK = 'mapbox://styles/mapbox/dark-v11';
