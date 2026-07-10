export class VerticalSliceActorRebase {
  constructor(game: any) {
    const world = game.world;
    const heightAt = (x: number, z: number): number => world.heightAt(x, z);

    world.spawnPoints?.forEach((point: any) => {
      point.y = heightAt(point.x, point.z);
    });

    game.enemies?.forEach((enemy: any) => {
      if (!enemy?.root) return;
      enemy.root.position.y = heightAt(enemy.root.position.x, enemy.root.position.z);
    });

    if (world.mara?.root) {
      world.mara.root.position.y = heightAt(world.mara.root.position.x, world.mara.root.position.z);
    }
    if (world.marker) {
      world.marker.position.y = heightAt(world.marker.position.x, world.marker.position.z);
      world.markerPosition.y = world.marker.position.y;
    }

    const expedition = game.expedition as any;
    expedition.beacons?.forEach((beacon: any) => {
      const y = heightAt(beacon.root.position.x, beacon.root.position.z);
      beacon.root.position.y = y;
      beacon.position.y = y;
    });
    expedition.caches?.forEach((cache: any) => {
      const y = heightAt(cache.root.position.x, cache.root.position.z);
      cache.root.position.y = y;
      cache.position.y = y;
    });
    expedition.citizens?.forEach((citizen: any) => {
      citizen.route?.forEach((point: any) => {
        point.y = heightAt(point.x, point.z);
      });
      if (citizen.visual?.root) {
        citizen.visual.root.position.y = heightAt(
          citizen.visual.root.position.x,
          citizen.visual.root.position.z
        );
      }
    });

    world.scene.metadata = {
      ...(world.scene.metadata ?? {}),
      dynamicActorsRebased: true
    };
  }
}
