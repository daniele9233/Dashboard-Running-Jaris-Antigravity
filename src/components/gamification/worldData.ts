/**
 * CONQUISTA DEL MONDO — le nazioni.
 *
 * Una riga per paese: codice ISO 3166-1 (lo stesso che usa il tileset dei
 * confini di Mapbox), nome, capitale e sue coordinate, superficie in km²,
 * continente e bioma. Le superfici sono quelle totali, acque interne comprese;
 * le coordinate sono della capitale, perché da lì si misura la gittata.
 *
 * I biomi sono cinque e decidono il passaporto che serve per entrarci:
 *   t temperato · d deserto · g gelo · m alta quota · j tropici
 * Sono una scelta di gioco, non di geografia fine: un paese sta nel bioma che
 * lo rende riconoscibile a chi corre.
 */

export type ContinentId = "EU" | "AS" | "AF" | "NA" | "SA" | "OC" | "AN";
export type BiomeId = "t" | "d" | "g" | "m" | "j";

export interface Country {
  iso: string;
  name: string;
  capital: string;
  lat: number;
  lng: number;
  areaKm2: number;
  continent: ContinentId;
  biome: BiomeId;
}

type Row = [iso: string, name: string, capital: string, lat: number, lng: number, area: number, biome: BiomeId];

const EU: Row[] = [
  ["AL", "Albania", "Tirana", 41.327, 19.819, 28748, "t"],
  ["AD", "Andorra", "Andorra la Vella", 42.507, 1.522, 468, "m"],
  ["AT", "Austria", "Vienna", 48.208, 16.374, 83879, "m"],
  ["BE", "Belgio", "Bruxelles", 50.850, 4.352, 30689, "t"],
  ["BY", "Bielorussia", "Minsk", 53.904, 27.559, 207600, "t"],
  ["BA", "Bosnia ed Erzegovina", "Sarajevo", 43.856, 18.413, 51209, "t"],
  ["BG", "Bulgaria", "Sofia", 42.698, 23.322, 110994, "t"],
  ["CY", "Cipro", "Nicosia", 35.186, 33.382, 9251, "t"],
  ["HR", "Croazia", "Zagabria", 45.815, 15.982, 56594, "t"],
  ["CZ", "Cechia", "Praga", 50.075, 14.438, 78871, "t"],
  ["DK", "Danimarca", "Copenaghen", 55.676, 12.568, 42933, "t"],
  ["EE", "Estonia", "Tallinn", 59.437, 24.754, 45339, "t"],
  ["FI", "Finlandia", "Helsinki", 60.170, 24.938, 338455, "g"],
  ["FR", "Francia", "Parigi", 48.857, 2.352, 551695, "t"],
  ["DE", "Germania", "Berlino", 52.520, 13.405, 357592, "t"],
  ["GR", "Grecia", "Atene", 37.984, 23.728, 131957, "t"],
  ["IE", "Irlanda", "Dublino", 53.350, -6.260, 70273, "t"],
  ["IS", "Islanda", "Reykjavík", 64.147, -21.942, 103000, "g"],
  ["IT", "Italia", "Roma", 41.903, 12.496, 301340, "t"],
  ["XK", "Kosovo", "Pristina", 42.663, 21.166, 10887, "t"],
  ["LV", "Lettonia", "Riga", 56.950, 24.105, 64589, "t"],
  ["LI", "Liechtenstein", "Vaduz", 47.141, 9.521, 160, "m"],
  ["LT", "Lituania", "Vilnius", 54.687, 25.280, 65300, "t"],
  ["LU", "Lussemburgo", "Lussemburgo", 49.612, 6.130, 2586, "t"],
  ["MK", "Macedonia del Nord", "Skopje", 41.998, 21.425, 25713, "t"],
  ["MT", "Malta", "La Valletta", 35.899, 14.515, 316, "t"],
  ["MD", "Moldavia", "Chișinău", 47.011, 28.863, 33846, "t"],
  ["MC", "Monaco", "Monaco", 43.738, 7.425, 2, "t"],
  ["ME", "Montenegro", "Podgorica", 42.431, 19.259, 13812, "t"],
  ["NO", "Norvegia", "Oslo", 59.914, 10.752, 323802, "g"],
  ["NL", "Paesi Bassi", "Amsterdam", 52.368, 4.904, 41850, "t"],
  ["PL", "Polonia", "Varsavia", 52.230, 21.012, 312696, "t"],
  ["PT", "Portogallo", "Lisbona", 38.722, -9.139, 92212, "t"],
  ["GB", "Regno Unito", "Londra", 51.507, -0.128, 242495, "t"],
  ["RO", "Romania", "Bucarest", 44.427, 26.103, 238397, "t"],
  ["RU", "Russia", "Mosca", 55.756, 37.617, 17098246, "g"],
  ["SM", "San Marino", "San Marino", 43.936, 12.447, 61, "t"],
  ["RS", "Serbia", "Belgrado", 44.787, 20.457, 77474, "t"],
  ["SK", "Slovacchia", "Bratislava", 48.149, 17.107, 49035, "t"],
  ["SI", "Slovenia", "Lubiana", 46.056, 14.506, 20271, "t"],
  ["ES", "Spagna", "Madrid", 40.417, -3.704, 505990, "t"],
  ["SE", "Svezia", "Stoccolma", 59.329, 18.069, 450295, "g"],
  ["CH", "Svizzera", "Berna", 46.948, 7.447, 41285, "m"],
  ["UA", "Ucraina", "Kiev", 50.450, 30.523, 603628, "t"],
  ["HU", "Ungheria", "Budapest", 47.498, 19.040, 93028, "t"],
  ["VA", "Città del Vaticano", "Vaticano", 41.902, 12.453, 0.44, "t"],
];

const AS: Row[] = [
  ["AF", "Afghanistan", "Kabul", 34.555, 69.207, 652230, "m"],
  ["SA", "Arabia Saudita", "Riad", 24.713, 46.675, 2149690, "d"],
  ["AM", "Armenia", "Erevan", 40.179, 44.499, 29743, "m"],
  ["AZ", "Azerbaigian", "Baku", 40.409, 49.867, 86600, "t"],
  ["BH", "Bahrein", "Manama", 26.229, 50.586, 780, "d"],
  ["BD", "Bangladesh", "Dacca", 23.810, 90.413, 147570, "j"],
  ["BT", "Bhutan", "Thimphu", 27.472, 89.639, 38394, "m"],
  ["BN", "Brunei", "Bandar Seri Begawan", 4.903, 114.940, 5765, "j"],
  ["KH", "Cambogia", "Phnom Penh", 11.556, 104.928, 181035, "j"],
  ["CN", "Cina", "Pechino", 39.904, 116.407, 9596961, "t"],
  ["KP", "Corea del Nord", "Pyongyang", 39.039, 125.763, 120538, "t"],
  ["KR", "Corea del Sud", "Seul", 37.567, 126.978, 100210, "t"],
  ["AE", "Emirati Arabi Uniti", "Abu Dhabi", 24.454, 54.377, 83600, "d"],
  ["PH", "Filippine", "Manila", 14.600, 120.984, 300000, "j"],
  ["GE", "Georgia", "Tbilisi", 41.716, 44.783, 69700, "t"],
  ["JP", "Giappone", "Tokyo", 35.676, 139.650, 377975, "t"],
  ["JO", "Giordania", "Amman", 31.954, 35.911, 89342, "d"],
  ["IN", "India", "Nuova Delhi", 28.614, 77.209, 3287263, "j"],
  ["ID", "Indonesia", "Giacarta", -6.208, 106.846, 1904569, "j"],
  ["IR", "Iran", "Teheran", 35.689, 51.389, 1648195, "d"],
  ["IQ", "Iraq", "Baghdad", 33.315, 44.366, 438317, "d"],
  ["IL", "Israele", "Gerusalemme", 31.769, 35.216, 22072, "t"],
  ["KZ", "Kazakistan", "Astana", 51.169, 71.449, 2724900, "d"],
  ["KG", "Kirghizistan", "Biškek", 42.875, 74.570, 199951, "m"],
  ["KW", "Kuwait", "Kuwait", 29.376, 47.977, 17818, "d"],
  ["LA", "Laos", "Vientiane", 17.975, 102.633, 236800, "j"],
  ["LB", "Libano", "Beirut", 33.894, 35.502, 10452, "t"],
  ["MV", "Maldive", "Malé", 4.175, 73.509, 298, "j"],
  ["MY", "Malesia", "Kuala Lumpur", 3.139, 101.687, 330803, "j"],
  ["MN", "Mongolia", "Ulan Bator", 47.886, 106.906, 1564116, "g"],
  ["MM", "Myanmar", "Naypyidaw", 19.763, 96.078, 676578, "j"],
  ["NP", "Nepal", "Kathmandu", 27.717, 85.324, 147181, "m"],
  ["OM", "Oman", "Mascate", 23.588, 58.383, 309500, "d"],
  ["PK", "Pakistan", "Islamabad", 33.684, 73.048, 881913, "d"],
  ["PS", "Palestina", "Ramallah", 31.899, 35.204, 6020, "t"],
  ["QA", "Qatar", "Doha", 25.285, 51.531, 11586, "d"],
  ["SG", "Singapore", "Singapore", 1.352, 103.820, 734, "j"],
  ["SY", "Siria", "Damasco", 33.513, 36.292, 185180, "d"],
  ["LK", "Sri Lanka", "Colombo", 6.927, 79.861, 65610, "j"],
  ["TJ", "Tagikistan", "Dušanbe", 38.559, 68.787, 143100, "m"],
  ["TW", "Taiwan", "Taipei", 25.033, 121.565, 36193, "t"],
  ["TH", "Thailandia", "Bangkok", 13.756, 100.502, 513120, "j"],
  ["TL", "Timor Est", "Dili", -8.556, 125.560, 14874, "j"],
  ["TR", "Turchia", "Ankara", 39.934, 32.860, 783562, "t"],
  ["TM", "Turkmenistan", "Aşgabat", 37.960, 58.326, 488100, "d"],
  ["UZ", "Uzbekistan", "Tashkent", 41.299, 69.240, 448978, "d"],
  ["VN", "Vietnam", "Hanoi", 21.028, 105.834, 331212, "j"],
  ["YE", "Yemen", "Sana'a", 15.369, 44.191, 527968, "d"],
];

const AF: Row[] = [
  ["DZ", "Algeria", "Algeri", 36.754, 3.059, 2381741, "d"],
  ["AO", "Angola", "Luanda", -8.839, 13.289, 1246700, "t"],
  ["BJ", "Benin", "Porto-Novo", 6.497, 2.605, 114763, "j"],
  ["BW", "Botswana", "Gaborone", -24.628, 25.923, 581730, "d"],
  ["BF", "Burkina Faso", "Ouagadougou", 12.371, -1.520, 274200, "d"],
  ["BI", "Burundi", "Gitega", -3.428, 29.925, 27834, "m"],
  ["CM", "Camerun", "Yaoundé", 3.848, 11.502, 475442, "j"],
  ["CV", "Capo Verde", "Praia", 14.933, -23.513, 4033, "t"],
  ["TD", "Ciad", "N'Djamena", 12.134, 15.056, 1284000, "d"],
  ["KM", "Comore", "Moroni", -11.717, 43.247, 1861, "j"],
  ["CG", "Congo", "Brazzaville", -4.263, 15.242, 342000, "j"],
  ["CI", "Costa d'Avorio", "Yamoussoukro", 6.827, -5.289, 322463, "j"],
  ["EG", "Egitto", "Il Cairo", 30.044, 31.236, 1002450, "d"],
  ["ER", "Eritrea", "Asmara", 15.323, 38.925, 117600, "d"],
  ["SZ", "eSwatini", "Mbabane", -26.305, 31.136, 17364, "t"],
  ["ET", "Etiopia", "Addis Abeba", 9.030, 38.740, 1104300, "m"],
  ["GA", "Gabon", "Libreville", 0.416, 9.467, 267668, "j"],
  ["GM", "Gambia", "Banjul", 13.454, -16.578, 11295, "t"],
  ["GH", "Ghana", "Accra", 5.604, -0.187, 238533, "j"],
  ["DJ", "Gibuti", "Gibuti", 11.589, 43.145, 23200, "d"],
  ["GN", "Guinea", "Conakry", 9.641, -13.578, 245857, "j"],
  ["GW", "Guinea-Bissau", "Bissau", 11.864, -15.598, 36125, "j"],
  ["GQ", "Guinea Equatoriale", "Malabo", 3.750, 8.783, 28051, "j"],
  ["KE", "Kenya", "Nairobi", -1.292, 36.822, 580367, "t"],
  ["LS", "Lesotho", "Maseru", -29.310, 27.478, 30355, "m"],
  ["LR", "Liberia", "Monrovia", 6.315, -10.807, 111369, "j"],
  ["LY", "Libia", "Tripoli", 32.887, 13.191, 1759541, "d"],
  ["MG", "Madagascar", "Antananarivo", -18.879, 47.508, 587041, "j"],
  ["MW", "Malawi", "Lilongwe", -13.963, 33.775, 118484, "t"],
  ["ML", "Mali", "Bamako", 12.639, -8.003, 1240192, "d"],
  ["MA", "Marocco", "Rabat", 34.020, -6.841, 446550, "t"],
  ["MR", "Mauritania", "Nouakchott", 18.074, -15.958, 1030700, "d"],
  ["MU", "Mauritius", "Port Louis", -20.161, 57.501, 2040, "j"],
  ["MZ", "Mozambico", "Maputo", -25.969, 32.573, 801590, "t"],
  ["NA", "Namibia", "Windhoek", -22.560, 17.066, 825615, "d"],
  ["NE", "Niger", "Niamey", 13.512, 2.113, 1267000, "d"],
  ["NG", "Nigeria", "Abuja", 9.077, 7.399, 923768, "j"],
  ["CF", "Rep. Centrafricana", "Bangui", 4.394, 18.558, 622984, "j"],
  ["CD", "RD del Congo", "Kinshasa", -4.442, 15.266, 2344858, "j"],
  ["RW", "Ruanda", "Kigali", -1.944, 30.062, 26338, "m"],
  ["ST", "São Tomé e Príncipe", "São Tomé", 0.336, 6.727, 964, "j"],
  ["SN", "Senegal", "Dakar", 14.716, -17.467, 196722, "t"],
  ["SC", "Seychelles", "Victoria", -4.619, 55.452, 459, "j"],
  ["SL", "Sierra Leone", "Freetown", 8.484, -13.234, 71740, "j"],
  ["SO", "Somalia", "Mogadiscio", 2.047, 45.318, 637657, "d"],
  ["ZA", "Sudafrica", "Pretoria", -25.747, 28.229, 1221037, "t"],
  ["SS", "Sud Sudan", "Giuba", 4.859, 31.571, 619745, "t"],
  ["SD", "Sudan", "Khartum", 15.501, 32.560, 1886068, "d"],
  ["TZ", "Tanzania", "Dodoma", -6.163, 35.752, 945087, "t"],
  ["TG", "Togo", "Lomé", 6.131, 1.223, 56785, "j"],
  ["TN", "Tunisia", "Tunisi", 36.806, 10.182, 163610, "t"],
  ["UG", "Uganda", "Kampala", 0.348, 32.582, 241550, "j"],
  ["ZM", "Zambia", "Lusaka", -15.388, 28.323, 752612, "t"],
  ["ZW", "Zimbabwe", "Harare", -17.829, 31.053, 390757, "t"],
];

const NA: Row[] = [
  ["AG", "Antigua e Barbuda", "St. John's", 17.127, -61.846, 442, "j"],
  ["BS", "Bahamas", "Nassau", 25.048, -77.355, 13943, "j"],
  ["BB", "Barbados", "Bridgetown", 13.098, -59.618, 430, "j"],
  ["BZ", "Belize", "Belmopan", 17.251, -88.759, 22966, "j"],
  ["CA", "Canada", "Ottawa", 45.421, -75.697, 9984670, "g"],
  ["CR", "Costa Rica", "San José", 9.928, -84.091, 51100, "j"],
  ["CU", "Cuba", "L'Avana", 23.113, -82.366, 109884, "j"],
  ["DM", "Dominica", "Roseau", 15.301, -61.388, 750, "j"],
  ["SV", "El Salvador", "San Salvador", 13.693, -89.218, 21041, "j"],
  ["JM", "Giamaica", "Kingston", 17.971, -76.793, 10991, "j"],
  ["GD", "Grenada", "St. George's", 12.056, -61.749, 348, "j"],
  ["GL", "Groenlandia", "Nuuk", 64.181, -51.694, 2166086, "g"],
  ["GT", "Guatemala", "Città del Guatemala", 14.634, -90.507, 108889, "j"],
  ["HT", "Haiti", "Port-au-Prince", 18.594, -72.307, 27750, "j"],
  ["HN", "Honduras", "Tegucigalpa", 14.072, -87.192, 112492, "j"],
  ["MX", "Messico", "Città del Messico", 19.433, -99.133, 1964375, "d"],
  ["NI", "Nicaragua", "Managua", 12.114, -86.236, 130373, "j"],
  ["PA", "Panama", "Panama", 8.983, -79.520, 75417, "j"],
  ["DO", "Rep. Dominicana", "Santo Domingo", 18.486, -69.931, 48671, "j"],
  ["KN", "Saint Kitts e Nevis", "Basseterre", 17.302, -62.717, 261, "j"],
  ["LC", "Saint Lucia", "Castries", 14.010, -60.987, 617, "j"],
  ["VC", "Saint Vincent e Grenadine", "Kingstown", 13.160, -61.225, 389, "j"],
  ["US", "Stati Uniti", "Washington", 38.907, -77.037, 9833520, "t"],
  ["TT", "Trinidad e Tobago", "Port of Spain", 10.654, -61.502, 5130, "j"],
];

const SA: Row[] = [
  ["AR", "Argentina", "Buenos Aires", -34.604, -58.382, 2780400, "t"],
  ["BO", "Bolivia", "La Paz", -16.490, -68.119, 1098581, "m"],
  ["BR", "Brasile", "Brasília", -15.794, -47.882, 8515767, "j"],
  ["CL", "Cile", "Santiago", -33.449, -70.669, 756102, "m"],
  ["CO", "Colombia", "Bogotá", 4.711, -74.072, 1141748, "j"],
  ["EC", "Ecuador", "Quito", -0.181, -78.468, 283561, "m"],
  ["GY", "Guyana", "Georgetown", 6.801, -58.155, 214969, "j"],
  ["PY", "Paraguay", "Asunción", -25.264, -57.576, 406752, "t"],
  ["PE", "Perù", "Lima", -12.046, -77.043, 1285216, "m"],
  ["SR", "Suriname", "Paramaribo", 5.852, -55.204, 163820, "j"],
  ["UY", "Uruguay", "Montevideo", -34.901, -56.165, 176215, "t"],
  ["VE", "Venezuela", "Caracas", 10.481, -66.904, 916445, "j"],
];

const OC: Row[] = [
  ["AU", "Australia", "Canberra", -35.281, 149.130, 7692024, "d"],
  ["FJ", "Figi", "Suva", -18.142, 178.442, 18274, "j"],
  ["KI", "Kiribati", "Tarawa", 1.451, 172.972, 811, "j"],
  ["MH", "Isole Marshall", "Majuro", 7.090, 171.380, 181, "j"],
  ["SB", "Isole Salomone", "Honiara", -9.446, 159.972, 28896, "j"],
  ["FM", "Micronesia", "Palikir", 6.917, 158.185, 702, "j"],
  ["NR", "Nauru", "Yaren", -0.547, 166.921, 21, "j"],
  ["NZ", "Nuova Zelanda", "Wellington", -41.287, 174.776, 268838, "t"],
  ["PW", "Palau", "Ngerulmud", 7.501, 134.624, 459, "j"],
  ["PG", "Papua Nuova Guinea", "Port Moresby", -9.443, 147.180, 462840, "j"],
  ["WS", "Samoa", "Apia", -13.834, -171.769, 2842, "j"],
  ["TO", "Tonga", "Nuku'alofa", -21.139, -175.204, 748, "j"],
  ["TV", "Tuvalu", "Funafuti", -8.521, 179.198, 26, "j"],
  ["VU", "Vanuatu", "Port Vila", -17.734, 168.322, 12189, "j"],
];

/** L'ultimo continente. Il "capoluogo" è la penisola antartica: è da lì che ci si arriva. */
const AN: Row[] = [
  ["AQ", "Antartide", "Penisola Antartica", -64.0, -60.0, 14200000, "g"],
];

const build = (rows: Row[], continent: ContinentId): Country[] =>
  rows.map(([iso, name, capital, lat, lng, areaKm2, biome]) => ({ iso, name, capital, lat, lng, areaKm2, continent, biome }));

export const COUNTRIES: Country[] = [
  ...build(EU, "EU"), ...build(AS, "AS"), ...build(AF, "AF"),
  ...build(NA, "NA"), ...build(SA, "SA"), ...build(OC, "OC"), ...build(AN, "AN"),
];

export const COUNTRY_BY_ISO: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.iso, c]));

export const HOME_ISO = "IT";

export const CONTINENTS: Record<ContinentId, { name: string; short: string }> = {
  EU: { name: "Europa", short: "EUR" },
  AS: { name: "Asia", short: "ASI" },
  AF: { name: "Africa", short: "AFR" },
  NA: { name: "Nord e Centro America", short: "NAM" },
  SA: { name: "Sud America", short: "SAM" },
  OC: { name: "Oceania", short: "OCE" },
  AN: { name: "Antartide", short: "ANT" },
};
export const CONTINENT_ORDER: ContinentId[] = ["EU", "AF", "AS", "NA", "SA", "OC", "AN"];

/**
 * Territori che il tileset disegna come paesi a sé ma che sulla mappa vanno
 * colorati come la nazione a cui appartengono: senza, la Guyana francese
 * resterebbe un buco grigio in mezzo a un Sud America conquistato.
 */
export const TERRITORY_OF: Record<string, string> = {
  GF: "FR", PF: "FR", NC: "FR", RE: "FR", GP: "FR", MQ: "FR", YT: "FR", PM: "FR", BL: "FR", MF: "FR", WF: "FR", TF: "FR",
  PR: "US", GU: "US", VI: "US", AS: "US", MP: "US", UM: "US",
  FK: "GB", GI: "GB", BM: "GB", KY: "GB", TC: "GB", VG: "GB", AI: "GB", MS: "GB", SH: "GB", IO: "GB", PN: "GB", GS: "GB", IM: "GB", JE: "GB", GG: "GB",
  SJ: "NO", BV: "NO", AW: "NL", CW: "NL", SX: "NL", BQ: "NL", HK: "CN", MO: "CN", FO: "DK", AX: "FI",
  CK: "NZ", NU: "NZ", TK: "NZ", NF: "AU", CX: "AU", CC: "AU", HM: "AU",
};

/** Le bandiere sono lettere-regione Unicode: nessuna immagine da caricare. */
export const flagOf = (iso: string) =>
  iso.length === 2 && iso !== "AQ" && iso !== "XK"
    ? String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
    : iso === "AQ" ? "🧊" : "🏳️";
