import { normaliseDotnet } from "../src/adapters/dotnetParserAdapter";

test("adapts camelCase correctly", () => {
  const raw = { data: { personalInfo: { firstName: "Adam", lastName: "Pritchard", email: "Adam@door10.co.uk" }, workExperience: [{ jobTitle:"Director", company:"Door 10", startDate:"2020-01-01" }] } };
  const n = normaliseDotnet(raw);
  expect(n.firstName).toBe("Adam");
  expect(n.jobTitle).toBe("Director");
  expect(n.employer).toBe("Door 10");
});

test("adapts PascalCase correctly", () => {
  const raw = { Data: { PersonalInfo: { FirstName: "Adam" }, WorkExperience: [{ JobTitle:"Director", Company:"Door 10" }] } };
  const n = normaliseDotnet(raw);
  expect(n.firstName).toBe("Adam");
  expect(n.employer).toBe("Door 10");
});
