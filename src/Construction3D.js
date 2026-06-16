import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  FaCamera,
  FaChevronLeft,
  FaChevronRight,
  FaCircle,
  FaCube,
  FaEye,
  FaEyeSlash,
  FaImage,
  FaMousePointer,
  FaPalette,
  FaPlay,
  FaRegSquare,
  FaShapes,
  FaSlash,
  FaTrash,
  FaUpload,
  FaVectorSquare,
  FaTimes
} from "react-icons/fa";
import "./Construction3D.css";

const STORAGE_PREFIX = "construction_visual_plan_";
const PLAN_WIDTH = 12;
const PLAN_DEPTH = 9;
const WALL_HEIGHT = 3.05;
const WALL_THICKNESS = 0.18;
const GRID_STEP = 0.5;
const SNAP_DISTANCE = 0.35;
const MIN_SIZE = 0.7;

const DEFAULT_MATERIALS = {
  floorColor: "#8f8067",
  floorTexture: ""
};

const DEFAULT_WALL_COLOR = "#d8d1c4";

const SHAPES = [
  { id: "rect", label: "Rect", icon: FaRegSquare },
  { id: "curve", label: "Curve", icon: FaSlash },
  { id: "triangle", label: "Triangle", icon: FaPlay },
  { id: "circle", label: "Circle", icon: FaCircle }
];

const COLOR_SWATCHES = [
  "#d8d1c4",
  "#f5f0df",
  "#e6d6bf",
  "#b9c5be",
  "#9fb7c9",
  "#c9b27d",
  "#b9655b",
  "#5d6b62",
  "#2f3437",
  "#f4a300"
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snap = (value) => Math.round(value / GRID_STEP) * GRID_STEP;
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const meters = (value) => `${Number(value || 0).toFixed(1)} m`;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeWall(wall) {
  return {
    id: wall.id || uid(),
    type: wall.type || "rect",
    label: wall.label || "Wall",
    x: Number.isFinite(wall.x) ? wall.x : 0,
    z: Number.isFinite(wall.z) ? wall.z : 0,
    width: clamp(Number(wall.width) || 3, MIN_SIZE, PLAN_WIDTH),
    depth: clamp(Number(wall.depth) || 2, MIN_SIZE, PLAN_DEPTH),
    rotation: Number(wall.rotation) || 0,
    color: wall.color || DEFAULT_WALL_COLOR,
    texture: wall.texture || "",
    visible: wall.visible !== false
  };
}

function defaultWall(type, point, index) {
  const presets = {
    rect: { width: 3.5, depth: 2.4 },
    curve: { width: 3.4, depth: 2.2 },
    triangle: { width: 3, depth: 2.6 },
    circle: { width: 2.8, depth: 2.8 }
  };
  return normalizeWall({
    id: uid(),
    type,
    label: `${SHAPES.find(shape => shape.id === type)?.label || "Wall"} ${index + 1}`,
    x: point.x,
    z: point.z,
    color: COLOR_SWATCHES[index % COLOR_SWATCHES.length],
    ...presets[type]
  });
}

function loadPlan(houseId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${houseId}`);
    if (!raw) return { walls: [], materials: DEFAULT_MATERIALS };
    const parsed = JSON.parse(raw);
    return {
      walls: Array.isArray(parsed.walls) ? parsed.walls.map(normalizeWall) : [],
      materials: { ...DEFAULT_MATERIALS, ...(parsed.materials || {}) }
    };
  } catch (error) {
    return { walls: [], materials: DEFAULT_MATERIALS };
  }
}

function rotatePoint(x, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos
  };
}

function wallCorners(wall) {
  const halfW = wall.width / 2;
  const halfD = wall.depth / 2;
  return [
    { x: -halfW, z: -halfD },
    { x: halfW, z: -halfD },
    { x: halfW, z: halfD },
    { x: -halfW, z: halfD }
  ].map(point => {
    const rotated = rotatePoint(point.x, point.z, wall.rotation);
    return { x: wall.x + rotated.x, z: wall.z + rotated.z };
  });
}

function wallToSegments(wall) {
  const steps = wall.type === "circle" ? 28 : wall.type === "curve" ? 18 : 0;
  if (wall.type === "rect") {
    const corners = wallCorners(wall);
    return corners.map((start, index) => ({
      start,
      end: corners[(index + 1) % corners.length],
      wall
    }));
  }

  if (wall.type === "triangle") {
    const halfW = wall.width / 2;
    const halfD = wall.depth / 2;
    const points = [
      { x: 0, z: -halfD },
      { x: halfW, z: halfD },
      { x: -halfW, z: halfD }
    ].map(point => {
      const rotated = rotatePoint(point.x, point.z, wall.rotation);
      return { x: wall.x + rotated.x, z: wall.z + rotated.z };
    });
    return points.map((start, index) => ({
      start,
      end: points[(index + 1) % points.length],
      wall
    }));
  }

  const points = [];
  const startAngle = wall.type === "curve" ? Math.PI : 0;
  const endAngle = wall.type === "curve" ? Math.PI * 2 : Math.PI * 2;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    const local = {
      x: Math.cos(angle) * wall.width / 2,
      z: Math.sin(angle) * wall.depth / 2
    };
    const rotated = rotatePoint(local.x, local.z, wall.rotation);
    points.push({ x: wall.x + rotated.x, z: wall.z + rotated.z });
  }
  return points.slice(0, -1).map((start, index) => ({
    start,
    end: points[index + 1],
    wall
  }));
}

function planToScreen(point, rect) {
  return {
    x: ((point.x + PLAN_WIDTH / 2) / PLAN_WIDTH) * rect.width,
    y: ((point.z + PLAN_DEPTH / 2) / PLAN_DEPTH) * rect.height
  };
}

function screenToPlan(event, element, walls) {
  const rect = element.getBoundingClientRect();
  const raw = {
    x: ((event.clientX - rect.left) / rect.width) * PLAN_WIDTH - PLAN_WIDTH / 2,
    z: ((event.clientY - rect.top) / rect.height) * PLAN_DEPTH - PLAN_DEPTH / 2
  };
  return snapPointToPlan(raw, walls);
}

function snapPointToPlan(point, walls) {
  const candidates = walls.flatMap(wall => [
    { x: wall.x, z: wall.z },
    ...wallCorners(wall)
  ]);
  const snapped = { x: snap(point.x), z: snap(point.z) };

  candidates.forEach(candidate => {
    if (Math.abs(candidate.x - point.x) < SNAP_DISTANCE) snapped.x = snap(candidate.x);
    if (Math.abs(candidate.z - point.z) < SNAP_DISTANCE) snapped.z = snap(candidate.z);
  });

  return {
    x: clamp(snapped.x, -PLAN_WIDTH / 2, PLAN_WIDTH / 2),
    z: clamp(snapped.z, -PLAN_DEPTH / 2, PLAN_DEPTH / 2)
  };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function createTexture(source, repeatX = 1, repeatY = 1) {
  if (!source) return null;
  const texture = new THREE.TextureLoader().load(source);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 10;
  return texture;
}

function TextureUploader({ label, imageUrl, onChange, capture, disabled }) {
  const inputRef = useRef(null);
  const Icon = capture ? FaCamera : FaUpload;

  return (
    <button
      className="construction-3d-texture-btn"
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
    >
      <span className="construction-3d-texture-thumb">
        {imageUrl ? <img src={imageUrl} alt="" /> : <FaImage />}
      </span>
      <span>{label}</span>
      <Icon />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onChange(await readFileAsDataUrl(file));
        }}
      />
    </button>
  );
}

function ShapeButton({ shape, active, onClick }) {
  const Icon = shape.icon;
  return (
    <button
      className={active ? "active" : ""}
      type="button"
      onClick={onClick}
      title={`Add ${shape.label}`}
      aria-label={`Add ${shape.label}`}
    >
      <Icon />
      <span>{shape.label}</span>
    </button>
  );
}

function FloorPlanEditor({ walls, selectedWallId, activeShape, onAddWall, onMoveWall, onSelectWall }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const drawShape = useCallback((ctx, wall, selected) => {
    const rect = ctx.canvas.getBoundingClientRect();
    const segments = wallToSegments(wall);
    if (!segments.length) return;

    ctx.beginPath();
    segments.forEach((segment, index) => {
      const start = planToScreen(segment.start, rect);
      const end = planToScreen(segment.end, rect);
      if (index === 0) ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
    });
    if (wall.type !== "curve") ctx.closePath();
    ctx.lineWidth = selected ? 9 : 6;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = selected ? "#20231f" : wall.color;
    ctx.stroke();

    ctx.lineWidth = selected ? 4 : 3;
    ctx.strokeStyle = wall.color;
    ctx.stroke();

    if (wall.texture) {
      ctx.save();
      ctx.globalAlpha = selected ? 0.2 : 0.14;
      ctx.fillStyle = wall.color;
      ctx.fill();
      ctx.restore();
    }

    const center = planToScreen({ x: wall.x, z: wall.z }, rect);
    ctx.beginPath();
    ctx.arc(center.x, center.y, selected ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#f4a300" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(32,35,31,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = "rgba(32, 35, 31, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= PLAN_WIDTH; x += GRID_STEP) {
      const px = (x / PLAN_WIDTH) * rect.width;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, rect.height);
      ctx.stroke();
    }
    for (let z = 0; z <= PLAN_DEPTH; z += GRID_STEP) {
      const py = (z / PLAN_DEPTH) * rect.height;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(rect.width, py);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(32, 35, 31, 0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, rect.width - 2, rect.height - 2);

    walls.filter(wall => wall.visible).forEach(wall => {
      drawShape(ctx, wall, wall.id === selectedWallId);
    });
  }, [drawShape, selectedWallId, walls]);

  const findWallAt = (event) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    let nearest = null;
    let nearestDistance = Infinity;

    walls.filter(wall => wall.visible).forEach(wall => {
      wallToSegments(wall).forEach(segment => {
        const start = planToScreen(segment.start, rect);
        const end = planToScreen(segment.end, rect);
        const distance = pointToSegmentDistance(click, start, end);
        if (distance < nearestDistance) {
          nearest = wall;
          nearestDistance = distance;
        }
      });
    });

    return nearest && nearestDistance < 18 ? nearest : null;
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = screenToPlan(event, event.currentTarget, walls);
    const found = findWallAt(event);

    if (found) {
      onSelectWall(found.id);
      dragRef.current = {
        id: found.id,
        offsetX: point.x - found.x,
        offsetZ: point.z - found.z
      };
      return;
    }

    onAddWall(activeShape, point);
    dragRef.current = null;
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current || event.buttons === 0) return;
    const point = screenToPlan(
      event,
      event.currentTarget,
      walls.filter(wall => wall.id !== dragRef.current.id)
    );
    onMoveWall(dragRef.current.id, {
      x: point.x - dragRef.current.offsetX,
      z: point.z - dragRef.current.offsetZ
    });
  };

  return (
    <canvas
      ref={canvasRef}
      className="construction-3d-plan-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={() => { dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
    />
  );
}

function ThreeWalkthrough({ walls, materials, selectedWallId, active }) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const keysRef = useRef({});
  const joystickRef = useRef({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });

  useEffect(() => {
    if (!active || !mountRef.current) return undefined;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dfe7e4");
    scene.fog = new THREE.Fog("#dfe7e4", 14, 36);

    const camera = new THREE.PerspectiveCamera(64, 1, 0.08, 80);
    camera.position.set(0, 6, 10.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#ffffff", "#7b7568", 1.65);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff2cf", 3.4);
    sun.position.set(-3.2, 14, 4.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 35;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    const fill = new THREE.PointLight("#dcb56d", 1.3, 12);
    fill.position.set(2.8, 3.2, 2.4);
    scene.add(fill);

    const floorTexture = createTexture(materials.floorTexture, 5, 4);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: materials.floorColor,
      map: floorTexture || undefined,
      roughness: 0.62,
      metalness: 0.04
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(PLAN_WIDTH, PLAN_DEPTH), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(PLAN_WIDTH + 0.5, 0.12, PLAN_DEPTH + 0.5),
      new THREE.MeshStandardMaterial({ color: "#655f54", roughness: 0.86 })
    );
    base.position.y = -0.08;
    base.receiveShadow = true;
    scene.add(base);

    const wallGroup = new THREE.Group();
    const wallTextures = [];
    const materialCache = new Map();

    walls.filter(wall => wall.visible).forEach(wall => {
      const materialKey = `${wall.id}-${wall.color}-${wall.texture}`;
      let wallMaterial = materialCache.get(materialKey);
      if (!wallMaterial) {
        const texture = createTexture(wall.texture, wall.type === "circle" ? 1.8 : 1.2, 1.1);
        if (texture) wallTextures.push(texture);
        wallMaterial = new THREE.MeshStandardMaterial({
          color: wall.color,
          map: texture || undefined,
          roughness: 0.54,
          metalness: 0.03
        });
        materialCache.set(materialKey, wallMaterial);
      }

      wallToSegments(wall).forEach(segment => {
        const length = Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z);
        if (length < 0.08) return;
        const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
        const mesh = new THREE.Mesh(geometry, wallMaterial);
        mesh.position.set(
          (segment.start.x + segment.end.x) / 2,
          WALL_HEIGHT / 2,
          (segment.start.z + segment.end.z) / 2
        );
        mesh.rotation.y = -Math.atan2(segment.end.z - segment.start.z, segment.end.x - segment.start.x);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        wallGroup.add(mesh);

        if (wall.id === selectedWallId) {
          const edge = new THREE.Mesh(
            new THREE.BoxGeometry(length, 0.08, WALL_THICKNESS + 0.08),
            new THREE.MeshStandardMaterial({ color: "#f4a300", roughness: 0.42, emissive: "#4b3000", emissiveIntensity: 0.15 })
          );
          edge.position.copy(mesh.position);
          edge.position.y = WALL_HEIGHT + 0.04;
          edge.rotation.y = mesh.rotation.y;
          wallGroup.add(edge);
        }
      });
    });
    scene.add(wallGroup);

    const player = { yaw: 0, pitch: -0.68, speed: 0.075 };
    let lastTouchDistance = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };

    const moveCamera = (forward, right, deltaScale = 1) => {
      const forwardVector = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      const rightVector = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
      camera.position.addScaledVector(forwardVector, forward * player.speed * deltaScale);
      camera.position.addScaledVector(rightVector, right * player.speed * deltaScale);
      camera.position.x = clamp(camera.position.x, -PLAN_WIDTH / 2 + 0.35, PLAN_WIDTH / 2 - 0.35);
      camera.position.z = clamp(camera.position.z, -PLAN_DEPTH / 2 + 0.35, PLAN_DEPTH / 2 - 0.35);
    };

    const render = () => {
      const delta = Math.min(clock.getDelta() * 60, 2.2);
      const keys = keysRef.current;
      const moveStick = joystickRef.current.move;
      const lookStick = joystickRef.current.look;

      const forward = (keys.w || keys.ArrowUp ? 1 : 0) + (keys.s || keys.ArrowDown ? -1 : 0) - moveStick.y;
      const right = (keys.d ? 1 : 0) + (keys.a ? -1 : 0) + moveStick.x;
      moveCamera(forward, right, delta);

      player.yaw -= lookStick.x * 0.035 * delta;
      player.pitch = clamp(player.pitch - lookStick.y * 0.022 * delta, -0.8, 0.62);

      camera.rotation.order = "YXZ";
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      renderer.render(scene, camera);
      engineRef.current.frame = requestAnimationFrame(render);
    };

    const onKeyDown = event => {
      keysRef.current[event.key.toLowerCase()] = true;
      keysRef.current[event.key] = true;
    };
    const onKeyUp = event => {
      keysRef.current[event.key.toLowerCase()] = false;
      keysRef.current[event.key] = false;
    };
    const onPointerMove = event => {
      if (event.buttons !== 1) return;
      player.yaw -= event.movementX * 0.0028;
      player.pitch = clamp(player.pitch - event.movementY * 0.002, -0.8, 0.62);
    };
    const onWheel = event => {
      event.preventDefault();
      camera.fov = clamp(camera.fov + Math.sign(event.deltaY) * 3, 38, 80);
      camera.updateProjectionMatrix();
    };
    const onTouchMove = event => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (lastTouchDistance) {
        camera.fov = clamp(camera.fov + (lastTouchDistance - distance) * 0.05, 38, 80);
        camera.updateProjectionMatrix();
      }
      lastTouchDistance = distance;
    };
    const onTouchEnd = () => { lastTouchDistance = 0; };

    engineRef.current = { renderer, scene, camera, frame: null };
    resize();
    render();

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(engineRef.current?.frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      mount.removeChild(renderer.domElement);
      scene.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
        else object.material?.dispose?.();
      });
      floorTexture?.dispose?.();
      wallTextures.forEach(texture => texture.dispose());
      renderer.dispose();
    };
  }, [active, materials.floorColor, materials.floorTexture, selectedWallId, walls]);

  const updateJoystick = (event, kind) => {
    const rect = event.currentTarget.getBoundingClientRect();
    joystickRef.current[kind] = {
      x: clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1),
      y: clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1)
    };
  };

  const bindJoystick = (kind) => ({
    onPointerDown: event => {
      event.currentTarget.setPointerCapture(event.pointerId);
      updateJoystick(event, kind);
    },
    onPointerMove: event => {
      if (event.buttons) updateJoystick(event, kind);
    },
    onPointerUp: () => { joystickRef.current[kind] = { x: 0, y: 0 }; },
    onPointerCancel: () => { joystickRef.current[kind] = { x: 0, y: 0 }; }
  });

  return (
    <div className="construction-3d-render-shell">
      <div ref={mountRef} className="construction-3d-render-canvas" />
      {walls.filter(wall => wall.visible).length === 0 && (
        <div className="construction-3d-empty-render">
          <FaShapes />
          <span>Add a shape in 2D first</span>
        </div>
      )}
      <div className="construction-3d-render-hint">
        <span>Drag to look</span>
        <span>WASD</span>
        <span>Pinch or wheel</span>
      </div>
      <div className="construction-3d-joysticks">
        <div className="construction-3d-stick" {...bindJoystick("move")}>
          <span>Move</span>
        </div>
        <div className="construction-3d-stick" {...bindJoystick("look")}>
          <span>Look</span>
        </div>
      </div>
    </div>
  );
}

function Construction3D({ house, onClose }) {
  const houseId = house?.id || "draft";
  const initialPlan = useMemo(() => loadPlan(houseId), [houseId]);
  const [mode, setMode] = useState("plan");
  const [activeShape, setActiveShape] = useState("rect");
  const [walls, setWalls] = useState(initialPlan.walls);
  const [materials, setMaterials] = useState(initialPlan.materials);
  const [selectedWallId, setSelectedWallId] = useState(initialPlan.walls[0]?.id || null);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${houseId}`, JSON.stringify({ walls, materials }));
  }, [houseId, materials, walls]);

  const visibleWallCount = walls.filter(wall => wall.visible).length;
  const selectedWall = walls.find(wall => wall.id === selectedWallId) || null;

  const updateWall = useCallback((wallId, patch) => {
    setWalls(current => current.map(wall => wall.id === wallId ? normalizeWall({ ...wall, ...patch }) : wall));
  }, []);

  const addWall = (type, point) => {
    const wall = defaultWall(type, point, walls.length);
    setWalls(current => [...current, wall]);
    setSelectedWallId(wall.id);
  };

  const moveWall = (wallId, point) => {
    updateWall(wallId, {
      x: clamp(snap(point.x), -PLAN_WIDTH / 2, PLAN_WIDTH / 2),
      z: clamp(snap(point.z), -PLAN_DEPTH / 2, PLAN_DEPTH / 2)
    });
  };

  const deleteSelected = () => {
    if (!selectedWallId) return;
    setWalls(current => {
      const next = current.filter(wall => wall.id !== selectedWallId);
      setSelectedWallId(next[0]?.id || null);
      return next;
    });
  };

  const clearPlan = () => {
    setWalls([]);
    setSelectedWallId(null);
  };

  const applyHousePhotoTexture = () => {
    if (!selectedWall || !house?.image_url) return;
    updateWall(selectedWall.id, { texture: house.image_url });
  };

  const setSelectedTexture = (texture) => {
    if (!selectedWall) return;
    updateWall(selectedWall.id, { texture });
  };

  const activeMode = mode === "tools" ? "tools" : mode === "walk" ? "walk" : "plan";

  return (
    <div className="construction-3d-overlay" onClick={onClose}>
      <section className="construction-3d-panel" onClick={event => event.stopPropagation()}>
        <header className="construction-3d-header">
          <div>
            <span className="construction-3d-kicker">Construction visualizer</span>
            <h2>{house?.name || "House"}</h2>
          </div>
          <div className="construction-3d-mode-tabs">
            <button className={activeMode === "tools" ? "active" : ""} onClick={() => setMode("tools")} type="button">
              <FaPalette />
              Tools
            </button>
            <button className={activeMode === "plan" ? "active" : ""} onClick={() => setMode("plan")} type="button">
              <FaVectorSquare />
              2D
            </button>
            <button className={activeMode === "walk" ? "active" : ""} onClick={() => setMode("walk")} type="button">
              <FaCube />
              3D
            </button>
          </div>
          <button className="construction-3d-close" onClick={onClose} aria-label="Close visualizer" type="button">
            <FaTimes />
          </button>
        </header>

        <div className={`construction-3d-body construction-3d-body-${activeMode}`}>
          <aside className="construction-3d-tools">
            <div className="construction-3d-tool-block">
              <span className="construction-3d-tool-title">Build Shapes</span>
              <div className="construction-3d-shape-grid">
                {SHAPES.map(shape => (
                  <ShapeButton
                    key={shape.id}
                    shape={shape}
                    active={activeShape === shape.id}
                    onClick={() => {
                      setActiveShape(shape.id);
                      setMode("plan");
                    }}
                  />
                ))}
              </div>
              <div className="construction-3d-tool-row">
                <span><FaShapes /> Visible walls</span>
                <strong>{visibleWallCount}</strong>
              </div>
            </div>

            <div className="construction-3d-tool-block compact">
              <span className="construction-3d-tool-title">Selected Wall</span>
              {selectedWall ? (
                <>
                  <div className="construction-3d-selection">
                    <FaMousePointer />
                    <span>{selectedWall.label}</span>
                  </div>
                  <div className="construction-3d-dimension-grid">
                    <label>
                      <span>W</span>
                      <input
                        type="range"
                        min="0.7"
                        max="8"
                        step="0.1"
                        value={selectedWall.width}
                        onChange={event => updateWall(selectedWall.id, { width: Number(event.target.value) })}
                      />
                      <b>{meters(selectedWall.width)}</b>
                    </label>
                    <label>
                      <span>D</span>
                      <input
                        type="range"
                        min="0.7"
                        max="7"
                        step="0.1"
                        value={selectedWall.depth}
                        onChange={event => updateWall(selectedWall.id, { depth: Number(event.target.value) })}
                      />
                      <b>{meters(selectedWall.depth)}</b>
                    </label>
                    <label>
                      <span>R</span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="5"
                        value={Math.round(selectedWall.rotation * 180 / Math.PI)}
                        onChange={event => updateWall(selectedWall.id, { rotation: Number(event.target.value) * Math.PI / 180 })}
                      />
                      <b>{Math.round(selectedWall.rotation * 180 / Math.PI)} deg</b>
                    </label>
                  </div>
                  <div className="construction-3d-action-row">
                    <button type="button" onClick={() => updateWall(selectedWall.id, { visible: !selectedWall.visible })}>
                      {selectedWall.visible ? <FaEyeSlash /> : <FaEye />}
                      {selectedWall.visible ? "Hide" : "Show"}
                    </button>
                    <button type="button" onClick={deleteSelected}>
                      <FaTrash />
                      Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className="construction-3d-selection muted">
                  <FaMousePointer />
                  <span>Pick a wall on 2D</span>
                </div>
              )}
            </div>

            <div className="construction-3d-tool-block">
              <span className="construction-3d-tool-title">Wall Finish</span>
              <div className="construction-3d-swatches">
                {COLOR_SWATCHES.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={selectedWall?.color === color ? "active" : ""}
                    style={{ "--swatch": color }}
                    aria-label={`Use ${color}`}
                    disabled={!selectedWall}
                    onClick={() => selectedWall && updateWall(selectedWall.id, { color })}
                  />
                ))}
              </div>
              <label className="construction-3d-color-row">
                <span>Custom</span>
                <input
                  type="color"
                  value={selectedWall?.color || DEFAULT_WALL_COLOR}
                  disabled={!selectedWall}
                  onChange={event => selectedWall && updateWall(selectedWall.id, { color: event.target.value })}
                />
              </label>
              <TextureUploader
                label="Gallery texture"
                imageUrl={selectedWall?.texture}
                onChange={setSelectedTexture}
                disabled={!selectedWall}
              />
              <TextureUploader
                label="Camera texture"
                imageUrl={selectedWall?.texture}
                onChange={setSelectedTexture}
                capture
                disabled={!selectedWall}
              />
              {house?.image_url && (
                <button type="button" onClick={applyHousePhotoTexture} disabled={!selectedWall}>
                  <FaImage />
                  Use house photo
                </button>
              )}
            </div>

            <div className="construction-3d-tool-block">
              <span className="construction-3d-tool-title">Floor</span>
              <label className="construction-3d-color-row">
                <span>Color</span>
                <input
                  type="color"
                  value={materials.floorColor}
                  onChange={event => setMaterials(current => ({ ...current, floorColor: event.target.value }))}
                />
              </label>
              <TextureUploader
                label="Floor image"
                imageUrl={materials.floorTexture}
                onChange={texture => setMaterials(current => ({ ...current, floorTexture: texture }))}
              />
              <button type="button" onClick={clearPlan} disabled={!walls.length}>
                <FaTrash />
                Empty plan
              </button>
            </div>
          </aside>

          <main className="construction-3d-stage">
            {activeMode !== "walk" ? (
              <div className="construction-3d-plan-shell">
                <FloorPlanEditor
                  walls={walls}
                  selectedWallId={selectedWallId}
                  activeShape={activeShape}
                  onAddWall={addWall}
                  onMoveWall={moveWall}
                  onSelectWall={setSelectedWallId}
                />
                {walls.length === 0 && (
                  <div className="construction-3d-plan-empty">
                    <FaShapes />
                    <span>Tap the grid to place a wall shape</span>
                  </div>
                )}
              </div>
            ) : (
              <ThreeWalkthrough
                walls={walls}
                materials={materials}
                selectedWallId={selectedWallId}
                active={activeMode === "walk"}
              />
            )}
          </main>

          <nav className="construction-3d-mobile-stepper" aria-label="Visualizer steps">
            <button type="button" onClick={() => setMode(activeMode === "walk" ? "plan" : "tools")}>
              <FaChevronLeft />
            </button>
            <span>{activeMode === "tools" ? "Tools" : activeMode === "plan" ? "2D plan" : "3D view"}</span>
            <button type="button" onClick={() => setMode(activeMode === "tools" ? "plan" : "walk")}>
              <FaChevronRight />
            </button>
          </nav>
        </div>
      </section>
    </div>
  );
}

export default Construction3D;
