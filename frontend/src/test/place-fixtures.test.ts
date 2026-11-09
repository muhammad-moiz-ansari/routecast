import { expect, it } from "vitest";
import { fixtureFetch } from "./fixtures/api";

it("offers full place labels for prefixes with stable, distinct endpoints", async () => {
  const search = async (query: string) =>
    (await fixtureFetch(`/locations/search/?query=${query}`, {})).json();
  const lahore = (await search("Lah"))[0];
  const faisalabad = (await search("Fais"))[0];
  expect(lahore.label).toBe("Lahore · Synthetic location");
  expect(faisalabad.label).toBe("Faisalabad · Synthetic location");
  expect(lahore.coordinate).not.toEqual(faisalabad.coordinate);
  expect((await search("Lahore"))[0]).toEqual(lahore);
});
