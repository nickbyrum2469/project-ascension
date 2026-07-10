interface RoutePoint {
  x: number;
  z: number;
}

export const installVerticalSliceRuntimeGuard = (DirectorClass: any): void => {
  const prototype = DirectorClass.prototype as any;
  if (prototype.__routeDensityGuardInstalled) return;

  const buildFrontierRoute = prototype.buildFrontierRoute;
  prototype.buildFrontierRoute = function buildFrontierRouteWithDenseSamples(this: any): void {
    const route = Array.isArray(this.route) ? this.route as RoutePoint[] : [];
    if (route.length < 2) throw new Error("Vertical slice route was not initialized.");

    const dense: RoutePoint[] = [];
    for (let index = 0; index < route.length - 1; index += 1) {
      const from = route[index];
      const to = route[index + 1];
      dense.push(from);
      dense.push({
        x: (from.x + to.x) * 0.5,
        z: (from.z + to.z) * 0.5
      });
    }
    dense.push(route[route.length - 1]);
    this.route = dense;
    buildFrontierRoute.call(this);
  };

  prototype.__routeDensityGuardInstalled = true;
};
