import type { CaelusIntegratedCity } from "./CaelusIntegratedCity.js";

export const integratedCityRuntime = (city: CaelusIntegratedCity): unknown => {
  // @ts-expect-error The diagnostic intentionally verifies the retained runtime reference.
  return city.game;
};
