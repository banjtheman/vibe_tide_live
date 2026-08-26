export type VibeTideControl = "left" | "right" | "jump";

export interface VibeTideControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export class SharedControlState {
  readonly state: VibeTideControlState = {
    left: false,
    right: false,
    jump: false,
  };

  jumpSequence = 0;

  setControl(control: VibeTideControl, pressed: boolean): void {
    const wasPressed = this.state[control];
    this.state[control] = pressed;

    if (control === "jump" && pressed && !wasPressed) {
      this.jumpSequence += 1;
    }
  }

  setControls(next: Partial<VibeTideControlState>): void {
    if (next.left !== undefined) {
      this.setControl("left", next.left);
    }
    if (next.right !== undefined) {
      this.setControl("right", next.right);
    }
    if (next.jump !== undefined) {
      this.setControl("jump", next.jump);
    }
  }

  pulseJump(): void {
    this.jumpSequence += 1;
  }

  release(): void {
    this.state.left = false;
    this.state.right = false;
    this.state.jump = false;
  }
}
