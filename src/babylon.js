// Keep the game code's Babylon namespace while importing only the features it uses.
// Vite can tree-shake this adapter, unlike the legacy all-in-one Babylon bundle.
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { Scene } from '@babylonjs/core/scene.js';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import '@babylonjs/loaders/glTF';

export const BABYLON={
  AbstractMesh, Animation, Color3, Color4, DirectionalLight, DynamicTexture,
  Engine, FreeCamera, GlowLayer, HemisphericLight, Mesh, MeshBuilder,
  ParticleSystem, PointLight, Scene, SceneLoader, ShadowGenerator,
  StandardMaterial, TransformNode, Vector3, VertexData
};
