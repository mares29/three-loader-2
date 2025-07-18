import { Box3 } from 'three';
import { PointCloudOctreeGeometryNode } from '../point-cloud-octree-geometry-node';
import { WorkerPool } from '../utils/worker-pool';
import { Version } from '../version';
import { GetUrlFn, XhrRequest } from './types';
interface BinaryLoaderOptions {
  getUrl?: GetUrlFn;
  version: string;
  boundingBox: Box3;
  scale: number;
  xhrRequest: XhrRequest;
}
type Callback = (node: PointCloudOctreeGeometryNode) => void;
export declare class BinaryLoader {
  version: Version;
  boundingBox: Box3;
  scale: number;
  getUrl: GetUrlFn;
  disposed: boolean;
  xhrRequest: XhrRequest;
  callbacks: Callback[];
  static readonly WORKER_POOL: WorkerPool;
  constructor({ getUrl, version, boundingBox, scale, xhrRequest }: BinaryLoaderOptions);
  dispose(): void;
  load(node: PointCloudOctreeGeometryNode): Promise<void>;
  private getNodeUrl;
  private parse;
  private getTightBoundingBox;
  private addBufferAttributes;
  private addIndices;
  private addNormalAttribute;
  private isAttribute;
}
export {};
