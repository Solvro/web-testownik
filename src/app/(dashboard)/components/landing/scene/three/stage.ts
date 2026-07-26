import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShadowMaterial,
  WebGLRenderer,
} from "three";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";

/** Above this the extra pixels cost more than they show on a 3D product shot. */
const MAX_PIXEL_RATIO = 1.35;

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  setSize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
}

/**
 * The WebGL scene and the CSS3D layer that renders the live UI, driven by one
 * shared camera. The DOM screens are real objects in this scene graph rather
 * than flat overlays, which is what makes them inherit the hinge rotation and
 * the perspective for free.
 */
export function createStage({
  canvas,
  container,
  pixelRatio,
  screenLayerClassName,
}: {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  /** Forced device pixel ratio, used by the capture harness. */
  pixelRatio?: number;
  screenLayerClassName: string;
}): Stage {
  const scene = new Scene();
  const camera = new PerspectiveCamera(31, 1, 0.1, 400);

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x00_00_00, 0);
  renderer.setPixelRatio(
    pixelRatio ?? Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
  );
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.className = screenLayerClassName;
  container.append(cssRenderer.domElement);

  scene.add(new HemisphereLight(0xf4_f7_ff, 0x10_13_1a, 1.9));

  const keyLight = new DirectionalLight(0xff_ff_ff, 2.1);
  keyLight.position.set(-18, 34, 28);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 4;
  keyLight.shadow.bias = -0.000_25;
  keyLight.shadow.normalBias = 0.025;
  scene.add(keyLight);

  const rimLight = new DirectionalLight(0x7b_a3_ff, 1.4);
  rimLight.position.set(24, 14, -22);
  scene.add(rimLight);

  // Catches the devices' shadows so the stack reads as standing on a surface.
  const ground = new Mesh(
    new PlaneGeometry(74, 52),
    new ShadowMaterial({ color: 0x05_07_0c, opacity: 0.34 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -1.15, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  return {
    scene,
    camera,
    renderer,
    cssRenderer,
    setSize(width, height) {
      renderer.setSize(width, height, false);
      cssRenderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render() {
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      cssRenderer.domElement.remove();
    },
  };
}
