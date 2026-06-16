import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  FaCube,
  FaDrawPolygon,
  FaExpand,
  FaImage,
  FaMousePointer,
  FaTrash,
  FaUpload,
  FaVectorSquare,
  FaTimes
} from "react-icons/fa";
import "./Construction3D.css";

const STORAGE_PREFIX = "construction_visual_plan_";
const PLAN_WIDTH = 12;
const PLAN_DEPTH = 9;
const WALL_HEIGHT = 2.85;
const WALL_THICKNESS = 0.16;
const GRID_STEP = 0.5;
const MIN_WALL_LENGTH = 0.45;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const snap = (value) => Math.round(value / GRID_STEP) * GRID_STEP;
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const DEFAULT_MATERIALS = {
  wallColor: "#d8d1c4",
  floorColor: "#a99475",
  wallTexture: "",
  floorTexture: ""
};

function loadPlan(houseId) {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${houseId}`);
    if (!raw) return { walls: [], materials: DEFAULT_MATERIALS };
    const parsed = JSON.parse(raw);
    return {
      walls: Array.isArray(parsed.walls) ? parsed.walls : [],
      materials: { ...DEFAULT_MATERIALS, ...(parsed.materials || {}) }
    };
  } catch (error) {
    return { walls: [], materials: DEFAULT_MATERIALS };
  }
}

function planToScreen(point, rect) {
  return {
    x: ((point.x + PLAN_WIDTH / 2) / PLAN_WIDTH) * rect.width,
    y: ((point.z + PLAN_DEPTH / 2) / PLAN_DEPTH) * rect.height
  };
}

function screenToPlan(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: snap(((event.clientX - rect.left) / rect.width) * PLAN_WIDTH - PLAN_WIDTH / 2),
    z: snap(((event.clientY - rect.top) / rect.height) * PLAN_DEPTH - PLAN_DEPTH / 2)
  };
}

function wallLength(wall) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
}

function wallAngle(wall) {
  return Math.atan2(wall.end.z - wall.start.z, wall.end.x - wall.start.x);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeTexture(source, fallbackColor, repeatX = 3, repeatY = 2) {
  if (!source) return null;
  const texture = new THREE.TextureLoader().load(source);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function TextureUploader({ label, imageUrl, onChange }) {
  const inputRef = useRef(null);

  return (
    <button
      className="construction-3d-texture-btn"
      type="button"
      onClick={() => inputRef.current?.click()}
    >
      <span className="construction-3d-texture-thumb">
        {imageUrl ? <img src={imageUrl} alt="" /> : <FaImage />}
      </span>
      <span>{label}</span>
      <FaUpload />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
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

function FloorPlanEditor({ walls, selectedWallId, draftWall, onStartWall, onMoveWall, onEndWall, onSelectWall }) {
  const canvasRef = useRef(null);

  const drawWall = useCallback((ctx, wall, color, width) => {
    const rect = ctx.canvas.getBoundingClientRect();
    const start = planToScreen(wall.start, rect);
    const end = planToScreen(wall.end, rect);

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
    ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
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

    walls.forEach(wall => {
      drawWall(ctx, wall, wall.id === selectedWallId ? "#20231f" : "#9b7a4f", wall.id === selectedWallId ? 9 : 7);
    });

    if (draftWall && wallLength(draftWall) >= 0.05) {
      drawWall(ctx, draftWall, "#f4a300", 6);
    }
  }, [drawWall, draftWall, selectedWallId, walls]);

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = screenToPlan(event, event.currentTarget);
    const rect = event.currentTarget.getBoundingClientRect();
    const click = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    let nearest = null;
    let nearestDistance = Infinity;

    walls.forEach(wall => {
      const start = planToScreen(wall.start, rect);
      const end = planToScreen(wall.end, rect);
      const distance = pointToSegmentDistance(click, start, end);
      if (distance < nearestDistance) {
        nearest = wall;
        nearestDistance = distance;
      }
    });

    if (nearest && nearestDistance < 14) {
      onSelectWall(nearest.id);
      return;
    }

    onSelectWall(null);
    onStartWall(point);
  };

  return (
    <canvas
      ref={canvasRef}
      className="construction-3d-plan-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={event => onMoveWall(screenToPlan(event, event.currentTarget))}
      onPointerUp={onEndWall}
      onPointerCancel={onEndWall}
    />
  );
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function ThreeWalkthrough({ walls, materials, active }) {
  const mountRef = useRef(null);
  const engineRef = useRef(null);
  const keysRef = useRef({});
  const joystickRef = useRef({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });

  useEffect(() => {
    if (!active || !mountRef.current) return undefined;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9e4da");
    scene.fog = new THREE.Fog("#e9e4da", 9, 24);

    const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 70);
    camera.position.set(0, 1.62, 3.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#fff8ed", "#877a67", 1.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff3d3", 2.3);
    sun.position.set(-4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    scene.add(sun);
    const fill = new THREE.PointLight("#f4a300", 1.8, 10);
    fill.position.set(2, 2.4, 1.5);
    scene.add(fill);

    const floorTexture = makeTexture(materials.floorTexture, materials.floorColor, 5, 4);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: materials.floorColor,
      map: floorTexture || undefined,
      roughness: 0.72,
      metalness: 0.03
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(PLAN_WIDTH, PLAN_DEPTH), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(Math.max(PLAN_WIDTH, PLAN_DEPTH), Math.max(PLAN_WIDTH, PLAN_DEPTH) * 2, "#ffffff", "#d6ccb9");
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    const wallTexture = makeTexture(materials.wallTexture, materials.wallColor, 1.6, 1.1);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: materials.wallColor,
      map: wallTexture || undefined,
      roughness: 0.66,
      metalness: 0.02
    });
    const capMaterial = new THREE.MeshStandardMaterial({ color: "#4f473e", roughness: 0.82 });
    const wallGroup = new THREE.Group();

    walls.forEach(wall => {
      const length = wallLength(wall);
      if (length < MIN_WALL_LENGTH) return;
      const geometry = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
      const mesh = new THREE.Mesh(geometry, wallMaterial);
      mesh.position.set((wall.start.x + wall.end.x) / 2, WALL_HEIGHT / 2, (wall.start.z + wall.end.z) / 2);
      mesh.rotation.y = -wallAngle(wall);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroup.add(mesh);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, WALL_THICKNESS + 0.04), capMaterial);
      cap.position.copy(mesh.position);
      cap.position.y = WALL_HEIGHT + 0.03;
      cap.rotation.y = mesh.rotation.y;
      cap.castShadow = true;
      wallGroup.add(cap);
    });
    scene.add(wallGroup);

    const player = { yaw: Math.PI, pitch: 0, speed: 0.07 };
    let lastTouchDistance = 0;
    let pointerLocked = false;
    const clock = new THREE.Clock();

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };

    const moveCamera = (forward, right, deltaScale = 1) => {
      const forwardVector = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
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
      player.pitch = clamp(player.pitch - lookStick.y * 0.022 * delta, -0.86, 0.86);

      camera.rotation.order = "YXZ";
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch;

      renderer.render(scene, camera);
      engineRef.current.frame = requestAnimationFrame(render);
    };

    const onKeyDown = event => { keysRef.current[event.key.toLowerCase()] = true; keysRef.current[event.key] = true; };
    const onKeyUp = event => { keysRef.current[event.key.toLowerCase()] = false; keysRef.current[event.key] = false; };
    const onMouseMove = event => {
      if (!pointerLocked && event.buttons !== 1) return;
      player.yaw -= event.movementX * 0.0027;
      player.pitch = clamp(player.pitch - event.movementY * 0.002, -0.86, 0.86);
    };
    const onWheel = event => {
      event.preventDefault();
      camera.fov = clamp(camera.fov + Math.sign(event.deltaY) * 3, 42, 82);
      camera.updateProjectionMatrix();
    };
    const onTouchMove = event => {
      if (event.touches.length !== 2) return;
      const [a, b] = event.touches;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (lastTouchDistance) {
        camera.fov = clamp(camera.fov + (lastTouchDistance - distance) * 0.05, 42, 82);
        camera.updateProjectionMatrix();
      }
      lastTouchDistance = distance;
    };
    const onTouchEnd = () => { lastTouchDistance = 0; };
    const onPointerLockChange = () => { pointerLocked = document.pointerLockElement === renderer.domElement; };

    engineRef.current = { renderer, scene, camera, frame: null };
    resize();
    render();

    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    renderer.domElement.addEventListener("click", () => renderer.domElement.requestPointerLock?.());

    return () => {
      cancelAnimationFrame(engineRef.current?.frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
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
      wallTexture?.dispose?.();
      renderer.dispose();
    };
  }, [active, materials.floorColor, materials.floorTexture, materials.wallColor, materials.wallTexture, walls]);

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

  const updateJoystick = (event, kind) => {
    const rect = event.currentTarget.getBoundingClientRect();
    joystickRef.current[kind] = {
      x: clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1),
      y: clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1)
    };
  };

  return (
    <div className="construction-3d-render-shell">
      <div ref={mountRef} className="construction-3d-render-canvas" />
      {walls.length === 0 && (
        <div className="construction-3d-empty-render">
          <FaDrawPolygon />
          <span>Draw walls in 2D first</span>
        </div>
      )}
      <div className="construction-3d-render-hint">
        <span>WASD</span>
        <span>drag to look</span>
        <span>wheel or pinch zoom</span>
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
  const [walls, setWalls] = useState(initialPlan.walls);
  const [materials, setMaterials] = useState(initialPlan.materials);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [draftWall, setDraftWall] = useState(null);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${houseId}`, JSON.stringify({ walls, materials }));
  }, [houseId, materials, walls]);

  const selectedWall = walls.find(wall => wall.id === selectedWallId);

  const startWall = (point) => {
    setDraftWall({ id: "draft", start: point, end: point });
  };

  const moveWall = (point) => {
    setDraftWall(current => current ? { ...current, end: point } : null);
  };

  const endWall = () => {
    setDraftWall(current => {
      if (!current || wallLength(current) < MIN_WALL_LENGTH) return null;
      const wall = { ...current, id: uid() };
      setWalls(prev => [...prev, wall]);
      setSelectedWallId(wall.id);
      return null;
    });
  };

  const deleteSelected = () => {
    if (!selectedWallId) return;
    setWalls(prev => prev.filter(wall => wall.id !== selectedWallId));
    setSelectedWallId(null);
  };

  const clearPlan = () => {
    setWalls([]);
    setSelectedWallId(null);
  };

  const applyHousePhotoTexture = (target) => {
    if (!house?.image_url) return;
    setMaterials(current => ({ ...current, [target]: house.image_url }));
  };

  return (
    <div className="construction-3d-overlay" onClick={onClose}>
      <section className="construction-3d-panel" onClick={event => event.stopPropagation()}>
        <header className="construction-3d-header">
          <div>
            <span className="construction-3d-kicker">Construction visualizer</span>
            <h2>{house?.name || "House"}</h2>
          </div>
          <div className="construction-3d-mode-tabs">
            <button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")} type="button">
              <FaVectorSquare />
              2D
            </button>
            <button className={mode === "walk" ? "active" : ""} onClick={() => setMode("walk")} type="button">
              <FaCube />
              3D
            </button>
          </div>
          <button className="construction-3d-close" onClick={onClose} aria-label="Close visualizer" type="button">
            <FaTimes />
          </button>
        </header>

        <div className="construction-3d-body">
          <aside className="construction-3d-tools">
            <div className="construction-3d-tool-block">
              <span className="construction-3d-tool-title">Build</span>
              <div className="construction-3d-tool-row">
                <span><FaDrawPolygon /> Drag on the plan to add walls</span>
                <strong>{walls.length}</strong>
              </div>
              <button type="button" onClick={deleteSelected} disabled={!selectedWallId}>
                <FaTrash />
                Delete selected
              </button>
              <button type="button" onClick={clearPlan} disabled={!walls.length}>
                <FaExpand />
                Empty plan
              </button>
            </div>

            <div className="construction-3d-tool-block">
              <span className="construction-3d-tool-title">Texture</span>
              <label className="construction-3d-color-row">
                <span>Wall</span>
                <input
                  type="color"
                  value={materials.wallColor}
                  onChange={event => setMaterials(current => ({ ...current, wallColor: event.target.value }))}
                />
              </label>
              <label className="construction-3d-color-row">
                <span>Floor</span>
                <input
                  type="color"
                  value={materials.floorColor}
                  onChange={event => setMaterials(current => ({ ...current, floorColor: event.target.value }))}
                />
              </label>
              <TextureUploader
                label="Wall image"
                imageUrl={materials.wallTexture}
                onChange={texture => setMaterials(current => ({ ...current, wallTexture: texture }))}
              />
              <TextureUploader
                label="Floor image"
                imageUrl={materials.floorTexture}
                onChange={texture => setMaterials(current => ({ ...current, floorTexture: texture }))}
              />
              {house?.image_url && (
                <div className="construction-3d-photo-actions">
                  <button type="button" onClick={() => applyHousePhotoTexture("wallTexture")}>
                    Use house photo on wall
                  </button>
                  <button type="button" onClick={() => applyHousePhotoTexture("floorTexture")}>
                    Use house photo on floor
                  </button>
                </div>
              )}
            </div>

            <div className="construction-3d-tool-block compact">
              <span className="construction-3d-tool-title">Selected</span>
              {selectedWall ? (
                <div className="construction-3d-selection">
                  <FaMousePointer />
                  <span>{wallLength(selectedWall).toFixed(1)} m wall</span>
                </div>
              ) : (
                <div className="construction-3d-selection muted">
                  <FaMousePointer />
                  <span>No wall selected</span>
                </div>
              )}
            </div>
          </aside>

          <main className="construction-3d-stage">
            {mode === "plan" ? (
              <div className="construction-3d-plan-shell">
                <FloorPlanEditor
                  walls={walls}
                  selectedWallId={selectedWallId}
                  draftWall={draftWall}
                  onStartWall={startWall}
                  onMoveWall={moveWall}
                  onEndWall={endWall}
                  onSelectWall={setSelectedWallId}
                />
                {walls.length === 0 && (
                  <div className="construction-3d-plan-empty">
                    <FaDrawPolygon />
                    <span>Drag across the grid to lay your first wall</span>
                  </div>
                )}
              </div>
            ) : (
              <ThreeWalkthrough walls={walls} materials={materials} active={mode === "walk"} />
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

export default Construction3D;
