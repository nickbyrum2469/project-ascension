export class CameraSafetyDirector {
  private readonly world: any;
  private readonly player: any;

  constructor(game: any) {
    this.world = game.world;
    this.player = game.player;

    if (Math.abs(Number(this.player.pitch ?? 0) + 0.12) < 0.02) {
      this.player.pitch = 0.035;
    }

    this.world.scene.onBeforeRenderObservable.add(() => this.update());
  }

  private update(): void {
    const camera = this.world.camera;
    const root = this.player.root;
    const cape = this.player.visual?.cape;

    if (this.player.cameraMode === "first") {
      if (cape) cape.setEnabled?.(false);
      return;
    }

    const terrainFloor = this.world.heightAt(camera.position.x, camera.position.z) + 0.72;
    if (camera.position.y < terrainFloor) camera.position.y = terrainFloor;

    const target = root.position.add(new BABYLON.Vector3(0, 1.55, 0));
    const offset = camera.position.subtract(target);
    const distance = offset.length();
    if (distance < 1.45) {
      if (distance < 0.001) offset.set(0.4, 0.5, 1);
      offset.normalize();
      camera.position.copyFrom(target.add(offset.scale(1.45)));
    }

    if (cape) cape.setEnabled?.(distance > 2.35);
  }
}
