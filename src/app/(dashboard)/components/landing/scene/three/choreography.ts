import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type {
  Group,
  Material,
  Object3D,
  PerspectiveCamera,
  Scene,
} from "three";

import { SCENE_WIDTH } from "../../breakpoints";
import { LID_TRAVEL_DEGREES, frameLaptop } from "../laptop-framing";
import type { SatelliteAttachment } from "./screens";
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

export const SATELLITE_POSES = {
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
  attachment: SatelliteAttachment;
  pose: SatellitePose;
  lying: Quaternion;
  standing: Quaternion;
}

function createSatellite(
  rig: Group,
  attachment: SatelliteAttachment,
  pose: SatellitePose,
): Satellite {
  const lying = CLOSED_TILT.clone()
    .multiply(
      new Quaternion().setFromEuler(
        new Euler(0, 0, MathUtils.degToRad(pose.lyingYaw)),
      ),
    )
    .multiply(attachment.upright);

  const [pitch, yaw, roll] = pose.standing;
  const standing = new Quaternion()
    .setFromEuler(
      new Euler(
        MathUtils.degToRad(pitch),
        MathUtils.degToRad(yaw),
        MathUtils.degToRad(roll),
      ),
    )
    .multiply(attachment.upright);

  return { rig, attachment, pose, lying, standing };
}

/** Moves one satellite to where it belongs at this point in the travel. */
function placeSatellite(
  satellite: Satellite,
  {
    travel,
    rotation,
    exit,
    keepSatellites,
  }: {
    travel: number;
    rotation: number;
    exit: number;
    keepSatellites: boolean;
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
  rig.scale.setScalar(satellite.attachment.scale * (1 - exit));
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
  contactShadow,
}: {
  scene: Scene;
  camera: PerspectiveCamera;
  laptop: Object3D;
  lidPivot: Group;
  tablet: { rig: Group; attachment: SatelliteAttachment };
  phone: { rig: Group; attachment: SatelliteAttachment };
  /** Fades out as the iPad lifts off the lid. */
  contactShadow: Material & { opacity: number };
}): Choreography {
  const satellites = [
    createSatellite(tablet.rig, tablet.attachment, SATELLITE_POSES.tablet),
    createSatellite(phone.rig, phone.attachment, SATELLITE_POSES.phone),
  ];

  return {
    apply(progress, width, height) {
      const isCompact = width < SCENE_WIDTH.compact;
      const keepSatellites = width >= SCENE_WIDTH.satellites;

      const travel = smoothstep(0.02, 0.6, progress);
      const rotation = smoothstep(0.06, 0.66, progress);
      const opening = smoothstep(0.3, 0.82, progress);
      const settle = smoothstep(0.78, 0.96, progress);
      const exit = keepSatellites ? 0 : smoothstep(0.06, 0.34, progress);

      contactShadow.opacity = 0.34 * (1 - smoothstep(0.04, 0.32, progress));

      const fieldOfView = isCompact ? 34 : 30;
      if (camera.fov !== fieldOfView) {
        camera.fov = fieldOfView;
        camera.updateProjectionMatrix();
      }

      lidPivot.rotation.x =
        (1 - opening) * MathUtils.degToRad(LID_TRAVEL_DEGREES);
      laptop.rotation.y = MathUtils.degToRad(
        -5.5 + opening * 5.5 - settle * 1.4,
      );
      laptop.rotation.z = MathUtils.degToRad((1 - opening) * -1.2);

      for (const satellite of satellites) {
        placeSatellite(satellite, { travel, rotation, exit, keepSatellites });
      }

      // Framing comes from the shared solver so the static loading cover lands
      // on exactly the same rectangle as the live model.
      const { framing } = frameLaptop({
        opening,
        aspect: width / height,
        compact: isCompact,
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
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      return { opening };
    },
  };
}
