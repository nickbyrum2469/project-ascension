import type { CaelusIntegratedCity } from "./CaelusIntegratedCity.js";

export const integratedCityRuntime = (city: CaelusIntegratedCity): unknown => city["game"];
