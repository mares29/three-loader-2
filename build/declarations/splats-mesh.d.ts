import { Mesh, Vector2, Vector3, Camera, Quaternion, ShaderMaterial, Object3D } from 'three';
export declare class SplatsMesh extends Object3D {
  mesh: any;
  material: ShaderMaterial | null;
  forceSorting: boolean;
  private nodesAsString;
  private texturePosColor;
  private textureCovariance0;
  private textureCovariance1;
  private textureNode;
  private textureNode2;
  private textureNodeIndices;
  private textureHarmonics1;
  private textureHarmonics2;
  private textureHarmonics3;
  private textureVisibilityNodes;
  private bufferCenters;
  private bufferPositions;
  private bufferScale;
  private bufferOrientation;
  private bufferPosColor;
  private bufferCovariance0;
  private bufferCovariance1;
  private bufferNodes;
  private bufferNodes2;
  private bufferNodesIndices;
  private bufferHarmonics1;
  private bufferHarmonics2;
  private bufferHarmonics3;
  private bufferVisibilityNodes;
  private sorter;
  private lastSortViewDir;
  private sortViewDir;
  private lastSortViewPos;
  private sortViewOffset;
  private enableSorting;
  private indexesBuffer;
  private textures;
  private enabled;
  private texturesNeedUpdate;
  private instanceCount;
  private debugMode;
  rendererSize: Vector2;
  private harmonicsEnabled;
  constructor(debug?: boolean);
  initialize(maxPointBudget: number, renderHamonics?: boolean): Promise<void>;
  renderSplatsIDs(status: boolean): void;
  update(mesh: Mesh, camera: Camera, size: Vector2, callback?: () => void): void;
  defer(): Promise<unknown>;
  sortSplats(camera: Camera, callback?: () => void): void;
  getSplatData(
    globalID: any,
    nodeID: any,
  ): {
    position: any;
    scale: Vector3;
    orientation: Quaternion;
  } | null;
  dispose(): void;
  get splatsEnabled(): boolean;
}
