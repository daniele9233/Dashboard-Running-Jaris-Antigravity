/**
 * Le figure degli esercizi: disegni originali, fatti con uno scheletro.
 *
 * Perché non immagini prese da altri siti: le illustrazioni di anatomia e di
 * palestra hanno un autore e una licenza, e questo repository è pubblico. Queste
 * sono costruite qui, da angoli e lunghezze, e mostrano quello che serve per
 * capire un esercizio: la posizione di partenza, quella di arrivo, il muscolo
 * che lavora (in rosso) e l'attrezzo.
 *
 * Il disegno è una catena di segmenti. Un angolo è assoluto, in gradi: 0 è in
 * alto, 90 a destra, 180 in basso, 270 a sinistra. Il corpo guarda a destra.
 * Ogni figura sta in un riquadro di 160 × 120 con il suolo a y = 108.
 */

export type P = [number, number];

export const FRAME_W = 160;
export const FRAME_H = 120;
export const GROUND = 108;

const L = { torso: 30, neck: 5, head: 7, thigh: 24, shin: 24, foot: 11, upper: 15, fore: 14 } as const;

const rad = (a: number) => (a * Math.PI) / 180;
/** Il vettore di un segmento lungo `len` con angolo assoluto `ang`. */
export const vec = (ang: number, len: number): P => [Math.sin(rad(ang)) * len, -Math.cos(rad(ang)) * len];
const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1]];
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];
const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export type Tone = "near" | "far" | "arm" | "torso" | "prop";

/** Un tratto evidenziato: il muscolo che lavora. `seg` è il segmento, da `from` a `to` (0–1). */
export interface Highlight { seg: number; from: number; to: number }

export interface Chain {
  pts: P[];
  tone: Tone;
  width: number;
  hl?: Highlight[];
}

export type Prop =
  | { k: "rect"; x: number; y: number; w: number; h: number }
  | { k: "line"; a: P; b: P; tone: "band" | "plain" }
  | { k: "dot"; at: P; r: number; tone: "weight" | "towel" | "anchor" }
  | { k: "arrow"; a: P; b: P }
  | { k: "glow"; at: P; r: number };

export interface Frame {
  caption: string;
  chains: Chain[];
  head?: { c: P; r: number };
  hand?: P[];
  props: Prop[];
}

export interface LegSpec {
  thigh: number;
  shin: number;
  foot: number;
  /** Lunghezza del piede, se diversa da quella standard (vista di fronte). */
  footLen?: number;
}

export interface PersonSpec {
  /** Con cosa è fissata la gamba vicina: l'anca, la caviglia o la punta del piede. */
  anchor: { kind: "hip" | "ankle" | "toe"; at: P };
  /** Scala del corpo (1 = standard): per le scene alte, con un gradino. */
  s?: number;
  torso: number;
  head?: number;
  near: LegSpec;
  far?: LegSpec;
  arm?: { upper: number; fore: number };
  farArm?: { upper: number; fore: number };
  /** Muscoli evidenziati sulla gamba vicina e su quella lontana. */
  hlNear?: Highlight[];
  hlFar?: Highlight[];
}

/** I punti notevoli di una figura, per appoggiarci attrezzi e frecce. */
export interface Joints {
  hip: P; knee: P; ankle: P; toe: P;
  farKnee: P | null; farAnkle: P | null; farToe: P | null;
  shoulder: P; elbow: P | null; wrist: P | null;
}

export interface Built { frame: Frame; j: Joints }

const legFrom = (spec: LegSpec, anchor: PersonSpec["anchor"], k = 1): { hip: P; knee: P; ankle: P; toe: P } => {
  const fl = (spec.footLen ?? L.foot) * k;
  const t = vec(spec.thigh, L.thigh * k);
  const s = vec(spec.shin, L.shin * k);
  const f = vec(spec.foot, fl);
  if (anchor.kind === "hip") {
    const hip = anchor.at, knee = add(hip, t), ankle = add(knee, s);
    return { hip, knee, ankle, toe: add(ankle, f) };
  }
  const ankle = anchor.kind === "ankle" ? anchor.at : sub(anchor.at, f);
  const knee = sub(ankle, s), hip = sub(knee, t);
  return { hip, knee, ankle, toe: add(ankle, f) };
};

/** Una persona di lato, a partire da angoli. Restituisce il disegno e i suoi punti. */
export function person(caption: string, spec: PersonSpec, props: Prop[] = []): Built {
  const k = spec.s ?? 1;
  const n = legFrom(spec.near, spec.anchor, k);
  const hip = n.hip;
  const chains: Chain[] = [];

  let farKnee: P | null = null, farAnkle: P | null = null, farToe: P | null = null;
  if (spec.far) {
    const f = legFrom(spec.far, { kind: "hip", at: hip }, k);
    farKnee = f.knee; farAnkle = f.ankle; farToe = f.toe;
    chains.push({ pts: [hip, f.knee, f.ankle, f.toe], tone: "far", width: 6, hl: spec.hlFar });
  }

  const shoulder = add(hip, vec(spec.torso, L.torso * k));
  const headAng = spec.head ?? spec.torso;
  const neckEnd = add(shoulder, vec(headAng, L.neck * k));
  const headC = add(shoulder, vec(headAng, (L.neck + L.head) * k));

  let farElbow: P | null = null;
  if (spec.farArm) {
    farElbow = add(shoulder, vec(spec.farArm.upper, L.upper * k));
    chains.push({ pts: [shoulder, farElbow, add(farElbow, vec(spec.farArm.fore, L.fore * k))], tone: "far", width: 4.5 });
  }

  chains.push({ pts: [hip, shoulder], tone: "torso", width: 13 * Math.max(k, 0.85) });
  chains.push({ pts: [shoulder, neckEnd], tone: "torso", width: 5 });
  chains.push({ pts: [hip, n.knee, n.ankle, n.toe], tone: "near", width: 7 * Math.max(k, 0.9), hl: spec.hlNear });

  let elbow: P | null = null, wrist: P | null = null;
  if (spec.arm) {
    elbow = add(shoulder, vec(spec.arm.upper, L.upper * k));
    wrist = add(elbow, vec(spec.arm.fore, L.fore * k));
    chains.push({ pts: [shoulder, elbow, wrist], tone: "arm", width: 5 });
  }

  return {
    frame: { caption, chains, head: { c: headC, r: L.head * k }, hand: wrist ? [wrist] : [], props },
    j: {
      hip, knee: n.knee, ankle: n.ankle, toe: n.toe, farKnee, farAnkle, farToe, shoulder, elbow, wrist,
    },
  };
}

/** Una persona di fronte: due gambe che partono da due punti del bacino. */
export function front(
  caption: string,
  hipC: P,
  legs: { l: LegSpec; r: LegSpec },
  opt: { half?: number; arms?: boolean; anchorToeY?: number } = {},
  props: Prop[] = [],
): Built {
  const half = opt.half ?? 6;
  const hl: P = [hipC[0] - half, hipC[1]], hr: P = [hipC[0] + half, hipC[1]];
  const chains: Chain[] = [];

  const leg = (hipP: P, s: LegSpec): Chain => {
    const knee = add(hipP, vec(s.thigh, L.thigh));
    const ankle = add(knee, vec(s.shin, L.shin));
    const toe = add(ankle, vec(s.foot, s.footLen ?? 5));
    return { pts: [hipP, knee, ankle, toe], tone: "near", width: 7 };
  };
  let cl = leg(hl, legs.l), cr = leg(hr, legs.r);
  // con il piede sul suolo: si abbassa tutta la figura finché le punte toccano terra
  if (opt.anchorToeY != null) {
    const lowest = Math.max(cl.pts[3][1], cr.pts[3][1]);
    const dy = opt.anchorToeY - lowest;
    const shift = (c: Chain): Chain => ({ ...c, pts: c.pts.map((p): P => [p[0], p[1] + dy]) });
    cl = shift(cl); cr = shift(cr);
    hl[1] += dy; hr[1] += dy;
  }
  const hipY = hl[1];
  const mid: P = [hipC[0], hipY];
  const shoulderC: P = [hipC[0], hipY - L.torso];
  chains.push(cl, cr);
  chains.push({ pts: [hl, hr], tone: "torso", width: 9 });
  chains.push({ pts: [mid, shoulderC], tone: "torso", width: 13 });
  chains.push({ pts: [[hipC[0] - 11, shoulderC[1]], [hipC[0] + 11, shoulderC[1]]], tone: "torso", width: 7 });
  chains.push({ pts: [shoulderC, [shoulderC[0], shoulderC[1] - L.neck]], tone: "torso", width: 5 });
  if (opt.arms !== false) {
    chains.push({ pts: [[hipC[0] - 11, shoulderC[1]], [hipC[0] - 14, shoulderC[1] + 15], [hipC[0] - 13, shoulderC[1] + 28]], tone: "arm", width: 4.5 });
    chains.push({ pts: [[hipC[0] + 11, shoulderC[1]], [hipC[0] + 14, shoulderC[1] + 15], [hipC[0] + 13, shoulderC[1] + 28]], tone: "arm", width: 4.5 });
  }
  return {
    frame: {
      caption, chains,
      head: { c: [hipC[0], shoulderC[1] - L.neck - L.head], r: L.head },
      props,
    },
    j: {
      hip: mid, knee: cl.pts[1], ankle: cl.pts[2], toe: cl.pts[3],
      farKnee: cr.pts[1], farAnkle: cr.pts[2], farToe: cr.pts[3],
      shoulder: shoulderC, elbow: null, wrist: null,
    },
  };
}

const rect = (x: number, y: number, w: number, h: number): Prop => ({ k: "rect", x, y, w, h });
const arrow = (a: P, b: P): Prop => ({ k: "arrow", a, b });
const weight = (at: P, r = 3.6): Prop => ({ k: "dot", at, r, tone: "weight" });
const glow = (at: P, r = 8): Prop => ({ k: "glow", at, r });
const band = (a: P, b: P): Prop => ({ k: "line", a, b, tone: "band" });
const anchorDot = (at: P): Prop => ({ k: "dot", at, r: 2.6, tone: "anchor" });
const at = (p: P, d: P): P => [p[0] + d[0], p[1] + d[1]];

const CALF: Highlight[] = [{ seg: 1, from: 0.05, to: 0.62 }];
const SHIN_FRONT: Highlight[] = [{ seg: 1, from: 0.1, to: 0.9 }];
const FOOT: Highlight[] = [{ seg: 2, from: 0, to: 1 }];
const LEGS_DOWN: LegSpec = { thigh: 180, shin: 180, foot: 90 };
const ARM_DOWN = { upper: 185, fore: 172 };

/** Un tratto qualsiasi: per le figure che non sono una persona intera (il piede, un dettaglio). */
const raw = (pts: P[], tone: Tone, width: number, hl?: Highlight[]): Chain => ({ pts, tone, width, hl });

// ── una sedia: per gli esercizi da seduti ────────────────────────────────────
const chair = (): Prop[] => [
  rect(28, 82, 36, 3), rect(28, 54, 3, 31), rect(30, 85, 2.5, 23), rect(59, 85, 2.5, 23),
];
const SEATED_HIP: P = [46, 78];
const seated = (caption: string, nearFoot: number, props: Prop[] = [], extra: Partial<PersonSpec> = {}): Built =>
  person(caption, {
    anchor: { kind: "hip", at: SEATED_HIP }, torso: -4,
    near: { thigh: 92, shin: 92, foot: nearFoot },
    far: { thigh: 96, shin: 182, foot: 90 },
    arm: { upper: 176, fore: 128 },
    hlNear: FOOT, ...extra,
  }, [...chair(), ...props]);

/**
 * Ingrandisce (o sposta) una figura già costruita: serve alle pose sdraiate, che
 * sono basse e larghe e nel riquadro standard restano piccole. Il punto `about`
 * va a finire in `to`; il suolo, se `about` sta sul suolo, resta dov'è.
 */
export function zoomFrame(f: Frame, k: number, about: P, to: P = about): Frame {
  const m = (p: P): P => [to[0] + (p[0] - about[0]) * k, to[1] + (p[1] - about[1]) * k];
  const w = Math.pow(k, 0.8);
  return {
    ...f,
    chains: f.chains.map((c) => ({ ...c, pts: c.pts.map(m), width: c.width * w })),
    head: f.head ? { c: m(f.head.c), r: f.head.r * k } : undefined,
    hand: f.hand?.map(m),
    props: f.props.map((p): Prop => {
      switch (p.k) {
        case "rect": { const o = m([p.x, p.y]); return { ...p, x: o[0], y: o[1], w: p.w * k, h: p.h * k }; }
        case "line": return { ...p, a: m(p.a), b: m(p.b) };
        case "arrow": return { ...p, a: m(p.a), b: m(p.b) };
        default: return { ...p, at: m(p.at), r: p.r * k };
      }
    }),
  };
}

// ── le figure, esercizio per esercizio ───────────────────────────────────────
export const EXERCISE_FIGURES: Record<string, () => Frame[]> = {
  "ankle-alphabet": () => {
    const a = seated("Punta su", 35);
    const b = seated("Punta giù", 145);
    a.frame.props.push(arrow(at(a.j.toe, [4, -2]), at(a.j.toe, [4, -14])));
    b.frame.props.push(arrow(at(b.j.toe, [4, 2]), at(b.j.toe, [4, 14])));
    return [a, b].map((x) => zoomFrame(x.frame, 1.2, [60, GROUND], [78, GROUND]));
  },

  "calf-stretch-straight": () => {
    const wall = rect(116, 8, 8, 100);
    const f = person("Tallone a terra, ginocchio dritto", {
      anchor: { kind: "ankle", at: [58, 105] }, torso: 20,
      near: { thigh: 200, shin: 200, foot: 90 }, far: { thigh: 155, shin: 175, foot: 90 },
      arm: { upper: 104, fore: 94 }, hlNear: CALF,
    }, [wall]);
    f.frame.props.push(arrow([54, 98], [54, 108]));
    return [f.frame];
  },

  "soleus-stretch": () => {
    const wall = rect(116, 8, 8, 100);
    const f = person("Ginocchio piegato, tallone a terra", {
      anchor: { kind: "ankle", at: [68, 105] }, torso: 14,
      near: { thigh: 150, shin: 205, foot: 90 }, far: { thigh: 135, shin: 172, foot: 90 },
      arm: { upper: 104, fore: 94 }, hlNear: [{ seg: 1, from: 0.45, to: 1 }],
    }, [wall]);
    f.frame.props.push(arrow([64, 98], [64, 108]));
    return [f.frame];
  },

  "short-foot": () => {
    // il piede visto di lato: la gamba in alto, il tallone a sinistra, le dita a destra
    const leg: P[] = [[50, 22], [50, 90]];
    const flat: Frame = {
      caption: "Piede disteso",
      chains: [raw(leg, "near", 10), raw([[42, 98], [70, 98], [112, 98], [134, 98]], "near", 9)],
      props: [],
    };
    const short: Frame = {
      caption: "Piede corto: l'arco si alza",
      chains: [
        raw(leg, "near", 10),
        raw([[42, 98], [68, 82], [98, 98], [118, 98]], "near", 9, [{ seg: 1, from: 0.2, to: 0.85 }]),
      ],
      props: [glow([70, 88], 11), arrow([132, 108], [108, 108])],
    };
    return [flat, short];
  },

  "band-inversion": () => {
    // il piede destro visto dall'alto: la punta in alto, il bordo interno a sinistra
    const shin: P[] = [[66, 118], [66, 94]];
    const a: Frame = {
      caption: "Piede dritto",
      chains: [raw(shin, "near", 8), raw([[66, 88], [66, 40]], "near", 13)],
      props: [{ k: "dot", at: [66, 92], r: 4, tone: "anchor" }, anchorDot([146, 58]), band([72, 58], [146, 58])],
    };
    const b: Frame = {
      caption: "Piede verso l'interno",
      chains: [
        raw(shin, "near", 8),
        raw([[66, 88], [44, 44]], "near", 13, [{ seg: 0, from: 0.1, to: 0.9 }]),
      ],
      props: [{ k: "dot", at: [66, 92], r: 4, tone: "anchor" }, anchorDot([146, 58]), band([50, 58], [146, 58]), arrow([70, 28], [40, 28])],
    };
    return [a, b];
  },

  "band-dorsiflexion": () => {
    const mk = (caption: string, foot: number): Built => {
      const f = seated(caption, foot, [anchorDot([154, 80])], { hlNear: SHIN_FRONT });
      f.frame.props.push(band(at(f.j.toe, [1, 0]), [154, 80]));
      return f;
    };
    const a = mk("Punta giù", 140);
    const b = mk("Punta verso la tibia", 40);
    b.frame.props.push(arrow(at(b.j.toe, [-6, -9]), at(b.j.toe, [-14, -3])));
    return [a.frame, b.frame];
  },

  "calf-raise-double": () => {
    const wall = rect(106, 8, 8, 100);
    const down = person("Talloni giù", {
      anchor: { kind: "ankle", at: [72, 105] }, torso: 0, near: LEGS_DOWN, arm: { upper: 100, fore: 92 }, hlNear: CALF,
    }, [wall]);
    const up = person("In punta, tieni un istante", {
      anchor: { kind: "toe", at: [83, 106] }, torso: 0, near: { thigh: 180, shin: 180, foot: 135 },
      arm: { upper: 100, fore: 92 }, hlNear: CALF,
    }, [wall]);
    up.frame.props.push(arrow([56, 101], [56, 88]));
    return [down.frame, up.frame];
  },

  "clamshell-band": () => {
    const torso = (): Chain[] => [raw([[62, 92], [30, 92]], "torso", 13), raw([[30, 92], [26, 92]], "torso", 5)];
    const base = (): Chain[] => [
      raw([[62, 96], [85.6, 100.2], [63, 106.4]], "far", 6),
      ...torso(),
      raw([[34, 96], [38, 104]], "arm", 4.5),
    ];
    const head = { c: [14, 92] as P, r: 7 };
    const closed: Frame = {
      caption: "Ginocchia unite",
      chains: [...base(), raw([[62, 91], [85.6, 95.2], [63, 101.4]], "near", 7)],
      head, props: [band([75, 93], [75, 97])],
    };
    const open: Frame = {
      caption: "Apri il ginocchio, piedi uniti",
      chains: [...base(), raw([[62, 91], [80.9, 76.2], [69.3, 97.2]], "near", 7, [{ seg: 0, from: 0.2, to: 1 }])],
      head, props: [band([77, 82], [77, 96]), arrow([96, 88], [96, 70]), glow([66, 88], 8)],
    };
    return [closed, open].map((f) => zoomFrame(f, 1.45, [60, GROUND], [86, GROUND]));
  },

  "glute-bridge": () => {
    const mk = (caption: string, thigh: number, torso: number, headA: number): Built =>
      person(caption, {
        anchor: { kind: "ankle", at: [83.5, 107.5] }, torso, head: headA,
        near: { thigh, shin: 175, foot: 90 }, arm: { upper: 96, fore: 92 },
      });
    const a = mk("Schiena a terra", 40, 270, 270);
    const b = mk("Bacino in alto, tieni 2″", 78, 246, 256);
    b.frame.props.push(glow(b.j.hip, 9), arrow(at(b.j.hip, [0, -9]), at(b.j.hip, [0, -22])));
    return [a, b].map((x) => zoomFrame(x.frame, 1.3, [66, GROUND], [78, GROUND]));
  },

  "single-leg-balance": () => {
    const f = person("Un piede solo, ginocchio morbido", {
      anchor: { kind: "ankle", at: [80, 105] }, torso: 0,
      near: { thigh: 178, shin: 183, foot: 90 }, far: { thigh: 105, shin: 195, foot: 110 },
      arm: { upper: 140, fore: 105 }, farArm: { upper: 215, fore: 195 },
      hlNear: [{ seg: 1, from: 0.55, to: 1 }],
    });
    return [f.frame];
  },

  "calf-raise-single": () => {
    // il tallone sporge dal bordo sinistro del gradino: sotto il livello si allunga il polpaccio
    const step = rect(70, 94, 30, 14);
    const wall = rect(102, 8, 8, 100);
    const mk = (caption: string, foot: number): Built =>
      person(caption, {
        s: 0.82, anchor: { kind: "toe", at: [78, 94] }, torso: 0,
        near: { thigh: 180, shin: 180, foot },
        far: { thigh: 192, shin: 245, foot: 160 }, arm: { upper: 100, fore: 92 }, hlNear: CALF,
      }, [step, wall]);
    const a = mk("Tallone sotto il gradino, 3″", 62);
    const b = mk("In punta, 3″ giù", 128);
    b.frame.props.push(arrow([56, 92], [56, 78]));
    return [a.frame, b.frame];
  },

  "soleus-raise": () => {
    const mk = (caption: string, thigh: number, shin: number, foot: number): Built => {
      const f = person(caption, {
        anchor: { kind: "hip", at: [62, 82] }, torso: -2,
        near: { thigh, shin, foot }, arm: { upper: 150, fore: 100 }, hlNear: [{ seg: 1, from: 0.3, to: 1 }],
      }, [rect(40, 87, 40, 3), rect(42, 90, 3, 18), rect(75, 90, 3, 18)]);
      f.frame.props.push(weight(at(f.j.knee, [-8, -4]), 4));
      return f;
    };
    const a = mk("Talloni giù", 90, 180, 90);
    const b = mk("Talloni su, ginocchia piegate", 74, 172, 130);
    b.frame.props.push(arrow([78, 102], [78, 92]));
    return [a.frame, b.frame];
  },

  "towel-heel-raise": () => {
    const towel = (y: number): Prop => ({ k: "dot", at: [80, y], r: 3, tone: "towel" });
    const down = front("Talloni giù, asciugamano in mezzo", [80, 56], {
      l: { thigh: 181, shin: 180, foot: 270, footLen: 6 }, r: { thigh: 179, shin: 180, foot: 90, footLen: 6 },
    }, { anchorToeY: 107 }, []);
    down.frame.props.push(towel(down.j.ankle[1] - 1));
    const up = front("In punta, stringi i talloni", [80, 56], {
      l: { thigh: 181, shin: 180, foot: 180, footLen: 8 }, r: { thigh: 179, shin: 180, foot: 180, footLen: 8 },
    }, { anchorToeY: 107 }, []);
    up.frame.props.push(towel(up.j.ankle[1] - 1), arrow(at(up.j.ankle, [-10, 2]), at(up.j.ankle, [-3, 2])),
      arrow(at(up.j.ankle, [14, 2]), at(up.j.ankle, [7, 2])));
    return [down.frame, up.frame];
  },

  "heel-walk": () => {
    const fwd = person("Passo avanti sul tallone", {
      anchor: { kind: "ankle", at: [92, 104] }, torso: 2,
      near: { thigh: 160, shin: 165, foot: 40 }, far: { thigh: 197, shin: 200, foot: 50 },
      arm: { upper: 215, fore: 190 }, farArm: { upper: 140, fore: 105 }, hlNear: SHIN_FRONT,
    });
    const back = person("Poi l'altro piede", {
      anchor: { kind: "ankle", at: [60, 104] }, torso: 2,
      near: { thigh: 197, shin: 200, foot: 50 }, far: { thigh: 160, shin: 165, foot: 40 },
      arm: { upper: 140, fore: 105 }, farArm: { upper: 215, fore: 190 }, hlFar: SHIN_FRONT,
    });
    fwd.frame.props.push(arrow(at(fwd.j.toe, [3, -2]), at(fwd.j.toe, [3, -12])));
    return [fwd.frame, back.frame];
  },

  "lateral-band-walk": () => {
    const mk = (caption: string, l: LegSpec, r: LegSpec): Built => front(caption, [80, 56], { l, r }, { anchorToeY: 106 }, []);
    const a = mk("Piedi alla larghezza del bacino",
      { thigh: 182, shin: 180, foot: 270, footLen: 6 }, { thigh: 178, shin: 180, foot: 90, footLen: 6 });
    const b = mk("Passo laterale, elastico in tensione",
      { thigh: 206, shin: 204, foot: 270, footLen: 6 }, { thigh: 178, shin: 180, foot: 90, footLen: 6 });
    a.frame.props.push(band(at(a.j.ankle, [-1, -6]), at(a.j.farAnkle!, [1, -6])));
    b.frame.props.push(band(at(b.j.ankle, [-1, -6]), at(b.j.farAnkle!, [1, -6])), arrow([48, 60], [34, 60]));
    return [a.frame, b.frame];
  },

  "step-down": () => {
    const step = rect(32, 92, 48, 16);
    const a = person("In piedi sul gradino", {
      s: 0.82, anchor: { kind: "ankle", at: [58, 90] }, torso: 0,
      near: LEGS_DOWN, far: { thigh: 125, shin: 150, foot: 100 }, arm: { upper: 150, fore: 100 }, hlNear: CALF,
    }, [step]);
    const b = person("Scendi in 3″ e tocca col tallone", {
      s: 0.82, anchor: { kind: "ankle", at: [58, 90] }, torso: 14,
      near: { thigh: 150, shin: 195, foot: 90 }, far: { thigh: 118, shin: 120, foot: 50 },
      arm: { upper: 150, fore: 100 }, hlNear: [{ seg: 0, from: 0.1, to: 1 }],
    }, [step]);
    b.frame.props.push(arrow([102, 80], [102, 100]));
    return [a.frame, b.frame];
  },

  "single-leg-rdl": () => {
    const a = person("In piedi, manubrio in mano", {
      anchor: { kind: "ankle", at: [70, 105] }, torso: 0,
      near: { thigh: 179, shin: 181, foot: 90 }, far: { thigh: 186, shin: 188, foot: 120 },
      arm: { upper: 185, fore: 180 },
    });
    a.frame.props.push(weight(at(a.j.wrist!, [0, 3]), 4));
    const b = person("Bacino indietro, schiena piatta", {
      anchor: { kind: "ankle", at: [70, 105] }, torso: 78,
      near: { thigh: 178, shin: 182, foot: 90 }, far: { thigh: 262, shin: 264, foot: 200 },
      arm: { upper: 180, fore: 180 }, hlFar: [{ seg: 0, from: 0.1, to: 1 }],
    });
    b.frame.props.push(weight(at(b.j.wrist!, [0, 3]), 4), glow(b.j.hip, 9));
    return [a.frame, b.frame];
  },

  "reverse-lunge": () => {
    const a = person("In piedi", {
      anchor: { kind: "ankle", at: [76, 105] }, torso: 0, near: LEGS_DOWN, arm: ARM_DOWN,
    });
    a.frame.props.push(weight(at(a.j.wrist!, [0, 3]), 3.8));
    const b = person("Passo indietro, ginocchio quasi a terra", {
      anchor: { kind: "ankle", at: [96, 105] }, torso: 4,
      near: { thigh: 100, shin: 185, foot: 90 }, far: { thigh: 232, shin: 280, foot: 130 },
      arm: ARM_DOWN, hlNear: [{ seg: 0, from: 0.1, to: 1 }],
    });
    b.frame.props.push(weight(at(b.j.wrist!, [0, 3]), 3.8), arrow([30, 84], [30, 98]));
    return [a.frame, b.frame];
  },

  "side-plank": () => {
    const mk = (caption: string, hipY: number, ankleY: number): Frame => ({
      caption,
      chains: [
        raw([[40, 106], [56, 106]], "arm", 5),
        raw([[44, 86], [44, 104]], "arm", 5),
        raw([[50, 84], [50, 58]], "far", 5),
        raw([[44, 86], [86, hipY], [128, ankleY]], "torso", 12, [{ seg: 0, from: 0.5, to: 1 }]),
        raw([[128, ankleY], [132, ankleY + 6]], "near", 7),
      ],
      head: { c: [30, 78], r: 7 },
      props: [],
    });
    const a = mk("Bacino basso", 99, 106);
    const b = mk("Bacino alto, linea dritta", 91, 99);
    b.props.push(arrow([86, 84], [86, 70]), glow([86, 92], 9));
    return [a, b];
  },

  "pogo-double": () => {
    const g = person("A terra, sulle punte", {
      s: 0.88, anchor: { kind: "toe", at: [82, 106] }, torso: 0, near: { thigh: 178, shin: 184, foot: 120 },
      arm: ARM_DOWN, hlNear: CALF,
    });
    const air = person("In aria: piccolo e veloce", {
      s: 0.88, anchor: { kind: "toe", at: [82, 95] }, torso: 0, near: { thigh: 180, shin: 180, foot: 150 },
      arm: ARM_DOWN, hlNear: CALF,
    });
    air.frame.props.push(arrow([58, 92], [58, 76]), arrow([106, 76], [106, 92]));
    return [g.frame, air.frame];
  },

  "pogo-single": () => {
    const farBent: LegSpec = { thigh: 180, shin: 236, foot: 150 };
    const g = person("Su un piede, a terra", {
      s: 0.88, anchor: { kind: "toe", at: [82, 106] }, torso: 0, near: { thigh: 178, shin: 184, foot: 120 },
      far: farBent, arm: ARM_DOWN, hlNear: CALF,
    });
    const air = person("In aria: un passo di corsa", {
      s: 0.88, anchor: { kind: "toe", at: [82, 95] }, torso: 0, near: { thigh: 180, shin: 180, foot: 150 },
      far: farBent, arm: ARM_DOWN, hlNear: CALF,
    });
    air.frame.props.push(arrow([58, 92], [58, 76]));
    return [g.frame, air.frame];
  },

  "step-up": () => {
    const box = rect(80, 82, 44, 26);
    const a = person("Piede sul gradino", {
      s: 0.78, anchor: { kind: "ankle", at: [100, 80] }, torso: 8,
      near: { thigh: 100, shin: 190, foot: 90 }, far: { thigh: 190, shin: 195, foot: 90 },
      arm: { upper: 200, fore: 130 }, hlNear: [{ seg: 0, from: 0.1, to: 1 }],
    }, [box]);
    const b = person("Spingi e porta su il ginocchio", {
      s: 0.78, anchor: { kind: "ankle", at: [100, 80] }, torso: 0,
      near: LEGS_DOWN, far: { thigh: 92, shin: 182, foot: 100 },
      arm: { upper: 140, fore: 30 }, farArm: { upper: 215, fore: 160 }, hlNear: [{ seg: 0, from: 0.1, to: 1 }],
    }, [box]);
    b.frame.props.push(arrow([30, 70], [30, 44]));
    return [a.frame, b.frame];
  },
};

/** Tutti i punti che una figura disegna, per controllare che stia nel riquadro. */
export function framePoints(f: Frame): P[] {
  const out: P[] = [];
  for (const c of f.chains) out.push(...c.pts);
  if (f.head) out.push([f.head.c[0] - f.head.r, f.head.c[1] - f.head.r], [f.head.c[0] + f.head.r, f.head.c[1] + f.head.r]);
  for (const p of f.props) {
    if (p.k === "rect") out.push([p.x, p.y], [p.x + p.w, p.y + p.h]);
    else if (p.k === "line" || p.k === "arrow") out.push(p.a, p.b);
    else out.push([p.at[0] - p.r, p.at[1] - p.r], [p.at[0] + p.r, p.at[1] + p.r]);
  }
  return out;
}

/** Il punto a `t` (0–1) lungo il segmento `seg` di una catena: serve per evidenziare un muscolo. */
export function along(c: Chain, seg: number, t: number): P {
  return lerp(c.pts[seg], c.pts[seg + 1], t);
}
