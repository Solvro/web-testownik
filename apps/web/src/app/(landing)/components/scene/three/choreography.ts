import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { Group, Object3D, PerspectiveCamera, Scene } from "three";

import { SCENE_WIDTH } from "../../breakpoints";
import { LID_TRAVEL_DEGREES, frameLaptop } from "../laptop-framing";
import type { SatelliteRig } from "./screens";
import { setCubicBezier, smoothstep } from "./utils";

/**
 * The whole hero animation, expressed as a function of scroll progress.
 *
 * The lid opens while the iPad and iPhone ride one continuous cubic arc from
 * lying on the closed lid to standing at either side. The first control point
 * pulls each device clear of the hinge before the lid starts moving, the second
 * lifts it into the final composition — no stop, snap or change of direction.
 */

const CLOSED_TILT = new Quaternion().setFromEuler(
  new Euler(-Math.PI / 2, 0, 0),
);

/** Canvas aspect of the wide desktop composition, below the navigation. */
const SATELLITE_REFERENCE_ASPECT = 1.92;

interface SatellitePose {
  /** Resting on the closed lid. */
  closed: Vector3;
  controlOne: Vector3;
  controlTwo: Vector3;
  /** Standing beside the open laptop. */
  open: Vector3;
  /** Where it travels to instead when the viewport is too narrow to keep it. */
  exit: Vector3;
  exitControlOne: Vector3;
  exitControlTwo: Vector3;
  /**
   * Degrees of yaw while lying flat. Set a little off-square on purpose: the
   * resting shot should read as objects put down by hand, not aligned to a grid.
   */
  lyingYaw: number;
  /** Angled back towards the laptop and tipped up once upright. */
  standing: readonly [number, number, number];
}

const SATELLITE_POSES = {
  tablet: {
    closed: new Vector3(-6.4, 1.35, -0.4),
    controlOne: new Vector3(-22, 2.6, 5.5),
    controlTwo: new Vector3(-28.5, 7.8, 2.4),
    open: new Vector3(-27.5, 8.5, -1.5),
    exit: new Vector3(-32, 9.5, -2.5),
    exitControlOne: new Vector3(-18, 1.1, 0.2),
    exitControlTwo: new Vector3(-28, 6.6, -1.6),
    lyingYaw: -4,
    standing: [-10, 8, 1],
  },
  phone: {
    closed: new Vector3(8.6, 1.45, 1.4),
    controlOne: new Vector3(22, 2.8, 6),
    controlTwo: new Vector3(27.5, 8, 2.8),
    open: new Vector3(25.5, 8.2, -0.5),
    exit: new Vector3(30, 9.2, -1.5),
    exitControlOne: new Vector3(20, 1.3, 1.8),
    exitControlTwo: new Vector3(29, 6.6, -0.5),
    lyingYaw: -13,
    standing: [-10, -8, -1],
  },
} as const satisfies Record<string, SatellitePose>;

interface Satellite {
  rig: Group;
  scale: number;
  pose: SatellitePose;
  lying: Quaternion;
  standing: Quaternion;
}

function createSatellite(
  rig: Group,
  { scale, upright }: SatelliteRig,
  pose: SatellitePose,
): Satellite {
  const lying = CLOSED_TILT.clone()
    .multiply(
      new Quaternion().setFromEuler(
        new Euler(0, 0, MathUtils.degToRad(pose.lyingYaw)),
      ),
    )
    .multiply(upright);

  const [pitch, yaw, roll] = pose.standing;
  const standing = new Quaternion()
    .setFromEuler(
      new Euler(
        MathUtils.degToRad(pitch),
        MathUtils.degToRad(yaw),
        MathUtils.degToRad(roll),
      ),
    )
    .multiply(upright);

  return { rig, scale, pose, lying, standing };
}

/** Moves one satellite to where it belongs at this point in the travel. */
function placeSatellite(
  satellite: Satellite,
  {
    travel,
    rotation,
    exit,
    keepSatellites,
    fit,
  }: {
    travel: number;
    rotation: number;
    exit: number;
    keepSatellites: boolean;
    fit: number;
  },
): void {
  const { pose, rig } = satellite;

  setCubicBezier(
    rig.position,
    pose.closed,
    keepSatellites ? pose.controlOne : pose.exitControlOne,
    keepSatellites ? pose.controlTwo : pose.exitControlTwo,
    keepSatellites ? pose.open : pose.exit,
    travel,
  );
  // Pull the spread and device sizes in together on taller canvases. Blend
  // through the travel so the closed pose still matches the loading cover.
  const responsiveScale = MathUtils.lerp(1, fit, travel);
  rig.position.x *= responsiveScale;
  rig.scale.setScalar(satellite.scale * (1 - exit) * responsiveScale);
  rig.visible = exit < 0.995;
  rig.quaternion.slerpQuaternions(
    satellite.lying,
    satellite.standing,
    keepSatellites ? rotation : 0,
  );
}

export interface FrameState {
  /** Lid travel, 0 closed → 1 open. */
  opening: number;
}

export interface Choreography {
  apply: (progress: number, width: number, height: number) => FrameState;
}

export function createChoreography({
  scene,
  camera,
  laptop,
  lidPivot,
  tablet,
  phone,
}: {
  scene: Scene;
  camera: PerspectiveCamera;
  laptop: Object3D;
  lidPivot: Object3D;
  tablet: { rig: Group; placement: SatelliteRig };
  phone: { rig: Group; placement: SatelliteRig };
}): Choreography {
  const satellites = [
    createSatellite(tablet.rig, tablet.placement, SATELLITE_POSES.tablet),
    createSatellite(phone.rig, phone.placement, SATELLITE_POSES.phone),
  ];

  return {
    apply(progress, width, height) {
      const keepSatellites = width >= SCENE_WIDTH.satellites;
      const fit = keepSatellites
        ? Math.min(1, width / height / SATELLITE_REFERENCE_ASPECT)
        : 1;

      const travel = smoothstep(0.02, 0.6, progress);
      const rotation = smoothstep(0.06, 0.66, progress);
      const opening = smoothstep(0.3, 0.82, progress);
      const settle = smoothstep(0.78, 0.96, progress);
      const exit = keepSatellites ? 0 : smoothstep(0.06, 0.34, progress);

      lidPivot.rotation.x =
        (1 - opening) * MathUtils.degToRad(LID_TRAVEL_DEGREES);
      laptop.rotation.y = MathUtils.degToRad(
        -5.5 + opening * 5.5 - settle * 1.4,
      );
      laptop.rotation.z = MathUtils.degToRad((1 - opening) * -1.2);

      for (const satellite of satellites) {
        placeSatellite(satellite, {
          travel,
          rotation,
          exit,
          keepSatellites,
          fit,
        });
      }

      // Framing comes from the shared solver so the static loading cover lands
      // on exactly the same rectangle as the live model.
      const { framing } = frameLaptop({
        opening,
        aspect: width / height,
        withSatellites: keepSatellites,
      });
      const [targetX, targetY, targetZ] = framing.target;
      // A slight push in and out through the middle of the travel, so the
      // composition breathes while the devices are moving.
      const breath = keepSatellites ? Math.sin(Math.PI * travel) * 0.075 : 0;
      const distance = framing.distance * (1 + breath);

      camera.position.set(
        targetX,
        targetY + Math.sin(framing.pitch) * distance,
        targetZ + Math.cos(framing.pitch) * distance,
      );
      camera.lookAt(targetX, targetY, targetZ);
      // Narrow stages zoom out through the lens, not the distance, so the
      // live picture stays a scale of the captured cover.
      if (camera.fov !== framing.fov) {
        camera.fov = framing.fov;
        camera.updateProjectionMatrix();
      }
      // The only scene-graph matrix pass per frame: both renderers skip
      // theirs (see `stage.ts`), and the screen-facing test reads the result
      // before they run.
      scene.updateMatrixWorld();

      return { opening };
    },
  };
}
