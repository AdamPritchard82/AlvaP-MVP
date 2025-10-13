type AnyObj = Record<string, any>;
const pick = (o: AnyObj | undefined, keys: string[]) => keys.find(k => o && o[k] != null) ? o![keys.find(k => o && o[k] != null)!] : undefined;

function pickMostRecentRole(we: any[]): AnyObj {
  if (!Array.isArray(we) || we.length === 0) return {};
  const scored = we.map(r => ({
    r,
    s: (r?.endDate == null ? 3 : 0)
      + ((Date.parse(r?.endDate ?? 0) || 0) / 1e12)
      + ((Date.parse(r?.startDate ?? 0) || 0) / 1e12)
  }));
  scored.sort((a, b) => b.s - a.s);
  return (scored.find(x => (x.r?.company || x.r?.Company) && (x.r?.jobTitle || x.r?.JobTitle))?.r) ?? scored[0].r;
}

// Optional: conservative phone fallback (only if vendor phone is empty)
export function fallbackPhone(rawText?: string, region = "GB"): string | undefined {
  if (!rawText) return;
  const m = rawText.match(/(?:\+?\d[\s().-]?){9,15}/g)?.[0];
  if (!m) return;
  // keep it simple—no extra deps; just return match
  return m.replace(/[^\d+]/g, "");
}

export function normaliseDotnet(raw: AnyObj) {
  const data = pick(raw, ["data","Data"]) ?? {};
  const pi   = pick(data, ["personalInfo","PersonalInfo"]) ?? {};
  const we   = pick(data, ["workExperience","WorkExperience"]) ?? [];
  const role = pickMostRecentRole(we);

  const out = {
    name:      pick(pi, ["name","Name"]),
    firstName: pick(pi, ["firstName","FirstName"]),
    lastName:  pick(pi, ["lastName","LastName"]),
    email:     pick(pi, ["email","Email"]),
    phone:     pick(pi, ["phone","Phone"]),
    jobTitle:  pick(role, ["jobTitle","JobTitle"]),
    employer:  pick(role, ["company","Company"]),
    _raw: raw,
  };
  return out;
}
