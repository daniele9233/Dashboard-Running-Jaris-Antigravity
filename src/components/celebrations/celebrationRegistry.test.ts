import { describe, it, expect } from "vitest";
import { CELEBRATIONS, CELEBRATION_GROUPS } from "./celebrationRegistry";
import { BADGE_RULES } from "./badgeRules";

/**
 * Guardia sul registry: la bacheca "I Miei Badge" mostra i traguardi
 * raggruppati per categoria, quindi ogni celebrazione deve avere id unico,
 * gruppo valido e una scena montabile. Se una di queste condizioni salta, il
 * badge sparisce dalla griglia o esplode al click.
 */

describe("celebrationRegistry", () => {
  it("contiene 100 celebrazioni", () => {
    expect(CELEBRATIONS).toHaveLength(100);
  });

  it("non ha id duplicati", () => {
    const ids = CELEBRATIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ogni celebrazione ha una scena montabile", () => {
    for (const c of CELEBRATIONS) {
      expect(typeof c.Scene, `scena mancante per ${c.id}`).toBe("function");
    }
  });

  it("ogni gruppo è tra quelli mostrati in bacheca", () => {
    for (const c of CELEBRATIONS) {
      expect(CELEBRATION_GROUPS, `gruppo ignoto per ${c.id}`).toContain(c.group);
    }
  });

  it("la somma dei gruppi copre tutto il registry (nessun badge nascosto)", () => {
    const sum = CELEBRATION_GROUPS.reduce(
      (n, g) => n + CELEBRATIONS.filter((c) => c.group === g).length,
      0,
    );
    expect(sum).toBe(CELEBRATIONS.length);
  });

  it("titolo, categoria e meccanica sono valorizzati", () => {
    for (const c of CELEBRATIONS) {
      expect(c.title.trim(), c.id).not.toBe("");
      expect(c.category.trim(), c.id).not.toBe("");
      expect(c.mechanic.trim(), c.id).not.toBe("");
    }
  });

  it("i colori sono hex validi", () => {
    for (const c of CELEBRATIONS) {
      expect(c.accent, c.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.accent2, c.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("format() produce una stringa, mai i secondi a :60", () => {
    for (const c of CELEBRATIONS) {
      const s = c.format(c.value);
      expect(typeof s, c.id).toBe("string");
      expect(s.trim(), c.id).not.toBe("");
      expect(s, `${c.id} arrotonda male i secondi`).not.toMatch(/:60\b/);
    }
  });

  it("ogni regola di sblocco punta a un badge esistente", () => {
    const ids = new Set(CELEBRATIONS.map((c) => c.id));
    for (const id of Object.keys(BADGE_RULES)) {
      expect(ids, `regola orfana: ${id}`).toContain(id);
    }
  });
});
