import type { InputFrame } from "../data/GameTypes.js";

const clampStick = (value: number, deadZone = 0.16): number => {
  if (Math.abs(value) < deadZone) return 0;
  const normalized = (Math.abs(value) - deadZone) / (1 - deadZone);
  return Math.sign(value) * Math.min(1, normalized);
};

const clampAxis = (value: number): number => Math.max(-1, Math.min(1, value));

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseHeavy = false;
  private mouseBlock = false;
  private previousButtons: boolean[] = [];
  private enabled = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("blur", this.reset);
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  public requestPointerLock(): void {
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock();
    }
  }

  public releasePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  public sample(): InputFrame {
    const gamepad = navigator.getGamepads?.()[0] ?? null;
    const button = (index: number): boolean => Boolean(gamepad?.buttons[index]?.pressed);
    const justPressed = (index: number): boolean => {
      const now = button(index);
      const before = this.previousButtons[index] ?? false;
      this.previousButtons[index] = now;
      return now && !before;
    };

    const keyboardMoveX = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
    const keyboardMoveY = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const gamepadMoveX = gamepad ? clampStick(gamepad.axes[0] ?? 0) : 0;
    const gamepadMoveY = gamepad ? -clampStick(gamepad.axes[1] ?? 0) : 0;
    const moveX = clampAxis(keyboardMoveX + gamepadMoveX);
    const moveY = clampAxis(keyboardMoveY + gamepadMoveY);
    const lookX = this.mouseX + (gamepad ? clampStick(gamepad.axes[2] ?? 0, 0.12) * 11 : 0);
    const lookY = this.mouseY + (gamepad ? clampStick(gamepad.axes[3] ?? 0, 0.12) * 11 : 0);

    const frame: InputFrame = {
      moveX,
      moveY,
      lookX,
      lookY,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || button(10),
      block: this.mouseBlock || button(6),
      lightPressed: this.consume("MouseLight") || justPressed(7),
      heavyPressed: this.consume("KeyQ") || this.mouseHeavy || justPressed(5),
      dodgePressed: this.consume("ControlLeft") || this.consume("ControlRight") || justPressed(0),
      jumpPressed: this.consume("Space") || justPressed(1),
      interactPressed: this.consume("KeyE") || justPressed(2),
      toggleViewPressed: this.consume("KeyV") || justPressed(3),
      lockOnPressed: this.consume("Tab") || justPressed(9),
      pausePressed: this.consume("Escape") || justPressed(8),
      shoulderPressed: this.consume("KeyC") || justPressed(4)
    };

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseHeavy = false;
    return frame;
  }

  private consume(code: string): boolean {
    const value = this.pressed.has(code);
    this.pressed.delete(code);
    return value;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (["Tab", "Space"].includes(event.code)) event.preventDefault();
    if (!this.keys.has(event.code)) this.pressed.add(event.code);
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled || document.pointerLockElement !== this.canvas) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (!this.enabled) return;
    if (document.pointerLockElement !== this.canvas) {
      this.requestPointerLock();
      return;
    }
    if (event.button === 0) {
      this.pressed.add("MouseLight");
    }
    if (event.button === 1) this.mouseHeavy = true;
    if (event.button === 2) this.mouseBlock = true;
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 2) this.mouseBlock = false;
  };

  private readonly reset = (): void => {
    this.keys.clear();
    this.pressed.clear();
    this.mouseHeavy = false;
    this.mouseBlock = false;
    this.mouseX = 0;
    this.mouseY = 0;
  };
}
