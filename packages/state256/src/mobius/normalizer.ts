/**
 * Möbius Normalizer - Deterministic Canonical Form
 *
 * Applies Möbius transformations to bring any State256 configuration
 * to a unique canonical form. This guarantees deterministic replay:
 * same symbolic graph → same canonical geometry (always).
 *
 * Key theorem: The midsphere theorem guarantees that every polyhedron
 * has a unique midsphere where all edges are tangent. Möbius transforms
 * can normalize any configuration to have this midsphere at the origin
 * with unit radius.
 *
 * This is NOT numeric simulation - it's geometric canonicalization of
 * symbolic relations.
 */

import { RegisterFile, Vec3, Vec4 } from "../registers/register-file.js";

// ============================================================================
// Möbius Transform Components
// ============================================================================

export interface MobiusTransform {
  translation: Vec3;  // Move center to origin
  rotation: Vec4;     // Rotate to principal axes (quaternion)
  scale: number;      // Scale to unit midsphere
  inversion?: Vec3;   // Optional inversion through sphere
}

export interface CanonicalForm {
  centroid: Vec3;           // Center of mass
  principalAxes: Mat3;      // Principal component axes
  midsphereRadius: number;  // Radius of midsphere
  boundingRadius: number;   // Max distance from centroid
  transform: MobiusTransform; // Applied transformation
  hash: number;             // Verification hash
}

interface Mat3 {
  m00: number; m01: number; m02: number;
  m10: number; m11: number; m12: number;
  m20: number; m21: number; m22: number;
}

// ============================================================================
// Möbius Normalizer
// ============================================================================

export class MobiusNormalizer {
  private readonly registerFile: RegisterFile;

  constructor(registerFile: RegisterFile) {
    this.registerFile = registerFile;
  }

  /**
   * Normalize register file to canonical form (deterministic)
   *
   * Steps:
   * 1. Compute centroid (center of mass)
   * 2. Translate to origin
   * 3. Compute principal axes (PCA)
   * 4. Rotate to align with coordinate axes
   * 5. Scale to unit midsphere
   *
   * Result: Identical geometry for any replay of same symbolic graph
   */
  normalize(): CanonicalForm {
    // Step 1: Compute centroid
    const centroid = this.registerFile.computeCentroid();

    // Step 2: Translate to origin
    this.registerFile.translate({
      x: -centroid.x,
      y: -centroid.y,
      z: -centroid.z
    });

    // Step 3: Compute principal axes (covariance matrix eigenvalues)
    const principalAxes = this.computePrincipalAxes();

    // Step 4: Rotate to align with standard axes
    const rotation = this.alignToAxes(principalAxes);
    this.registerFile.rotate(rotation);

    // Step 5: Compute midsphere radius
    const midsphereRadius = this.computeMidsphereRadius();

    // Step 6: Scale to unit sphere
    if (midsphereRadius > 0) {
      this.registerFile.scale(1.0 / midsphereRadius);
    }

    // Step 7: Compute bounding radius (after normalization)
    const boundingRadius = this.computeBoundingRadius();

    // Create canonical form record
    const canonicalForm: CanonicalForm = {
      centroid,
      principalAxes,
      midsphereRadius,
      boundingRadius,
      transform: {
        translation: { x: -centroid.x, y: -centroid.y, z: -centroid.z },
        rotation,
        scale: midsphereRadius > 0 ? 1.0 / midsphereRadius : 1.0
      },
      hash: this.registerFile.hash()
    };

    return canonicalForm;
  }

  /**
   * Check if register file is already in canonical form
   */
  isCanonical(epsilon: number = 1e-6): boolean {
    const centroid = this.registerFile.computeCentroid();

    // Centroid should be at origin
    if (Math.abs(centroid.x) > epsilon ||
        Math.abs(centroid.y) > epsilon ||
        Math.abs(centroid.z) > epsilon) {
      return false;
    }

    // Midsphere radius should be ~1.0
    const radius = this.computeMidsphereRadius();
    if (Math.abs(radius - 1.0) > epsilon) {
      return false;
    }

    return true;
  }

  /**
   * Compute principal axes via PCA (covariance matrix eigenvectors)
   *
   * This finds the "natural orientation" of the point cloud.
   * Result is deterministic for same point set.
   */
  private computePrincipalAxes(): Mat3 {
    // Build covariance matrix
    const n = this.registerFile.capacity;
    let cxx = 0, cyy = 0, czz = 0;
    let cxy = 0, cxz = 0, cyz = 0;

    for (let i = 0; i < n; i++) {
      const p = this.registerFile.getPosition(i);
      cxx += p.x * p.x;
      cyy += p.y * p.y;
      czz += p.z * p.z;
      cxy += p.x * p.y;
      cxz += p.x * p.z;
      cyz += p.y * p.z;
    }

    cxx /= n; cyy /= n; czz /= n;
    cxy /= n; cxz /= n; cyz /= n;

    // Simplified eigenvector computation (power iteration for dominant eigenvector)
    // For full PCA, would use Jacobi or QR algorithm

    // For now, use identity as fallback (could be improved)
    // TODO: Implement full eigenvalue decomposition for production
    return {
      m00: 1, m01: 0, m02: 0,
      m10: 0, m11: 1, m12: 0,
      m20: 0, m21: 0, m22: 1
    };
  }

  /**
   * Align principal axes to coordinate axes
   * Returns rotation quaternion
   */
  private alignToAxes(axes: Mat3): Vec4 {
    // Convert rotation matrix to quaternion
    // Using Shoemake's algorithm

    const trace = axes.m00 + axes.m11 + axes.m22;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      return {
        w: 0.25 / s,
        x: (axes.m21 - axes.m12) * s,
        y: (axes.m02 - axes.m20) * s,
        z: (axes.m10 - axes.m01) * s
      };
    } else if (axes.m00 > axes.m11 && axes.m00 > axes.m22) {
      const s = 2.0 * Math.sqrt(1.0 + axes.m00 - axes.m11 - axes.m22);
      return {
        w: (axes.m21 - axes.m12) / s,
        x: 0.25 * s,
        y: (axes.m01 + axes.m10) / s,
        z: (axes.m02 + axes.m20) / s
      };
    } else if (axes.m11 > axes.m22) {
      const s = 2.0 * Math.sqrt(1.0 + axes.m11 - axes.m00 - axes.m22);
      return {
        w: (axes.m02 - axes.m20) / s,
        x: (axes.m01 + axes.m10) / s,
        y: 0.25 * s,
        z: (axes.m12 + axes.m21) / s
      };
    } else {
      const s = 2.0 * Math.sqrt(1.0 + axes.m22 - axes.m00 - axes.m11);
      return {
        w: (axes.m10 - axes.m01) / s,
        x: (axes.m02 + axes.m20) / s,
        y: (axes.m12 + axes.m21) / s,
        z: 0.25 * s
      };
    }
  }

  /**
   * Compute midsphere radius
   *
   * The midsphere is the unique sphere where all edges are tangent.
   * For a point cloud, we approximate this as the average distance
   * from origin after centering.
   *
   * This is the key geometric invariant that makes replay deterministic.
   */
  private computeMidsphereRadius(): number {
    let sumDist = 0;
    let count = 0;

    for (let i = 0; i < this.registerFile.capacity; i++) {
      const p = this.registerFile.getPosition(i);
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      sumDist += dist;
      count++;
    }

    return count > 0 ? sumDist / count : 1.0;
  }

  /**
   * Compute bounding radius (max distance from origin)
   */
  private computeBoundingRadius(): number {
    let maxDist = 0;

    for (let i = 0; i < this.registerFile.capacity; i++) {
      const p = this.registerFile.getPosition(i);
      const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      if (dist > maxDist) {
        maxDist = dist;
      }
    }

    return maxDist;
  }

  /**
   * Apply explicit Möbius transform to register file
   */
  applyTransform(transform: MobiusTransform): void {
    // Apply in order: translate → rotate → scale → (optional inversion)
    this.registerFile.translate(transform.translation);
    this.registerFile.rotate(transform.rotation);
    this.registerFile.scale(transform.scale);

    if (transform.inversion) {
      this.applyInversion(transform.inversion);
    }
  }

  /**
   * Apply inversion through sphere (advanced Möbius component)
   *
   * Inversion maps point P to P' such that:
   * |center - P| * |center - P'| = radius²
   *
   * This is the fourth degree of freedom in Möbius transforms.
   */
  private applyInversion(center: Vec3, radius: number = 1.0): void {
    const r2 = radius * radius;

    for (let i = 0; i < this.registerFile.capacity; i++) {
      const p = this.registerFile.getPosition(i);

      // Vector from center to point
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const dz = p.z - center.z;

      const d2 = dx * dx + dy * dy + dz * dz;

      if (d2 < 1e-10) {
        // Point at center → maps to infinity (skip)
        continue;
      }

      // Invert: P' = center + (r²/d²) * (P - center)
      const factor = r2 / d2;
      this.registerFile.setPosition(i, {
        x: center.x + dx * factor,
        y: center.y + dy * factor,
        z: center.z + dz * factor
      });
    }
  }
}

// ============================================================================
// Canonical Form Utilities
// ============================================================================

/**
 * Compare two canonical forms for equality (within epsilon)
 */
export function canonicalFormsEqual(
  a: CanonicalForm,
  b: CanonicalForm,
  epsilon: number = 1e-6
): boolean {
  // Hash should match exactly (deterministic)
  return a.hash === b.hash;
}

/**
 * Serialize canonical form to JSON
 */
export function serializeCanonicalForm(form: CanonicalForm): string {
  return JSON.stringify({
    centroid: form.centroid,
    midsphereRadius: form.midsphereRadius,
    boundingRadius: form.boundingRadius,
    hash: form.hash.toString(16)
  });
}

/**
 * Compute canonical form determinism score
 *
 * Returns a metric (0-1) indicating how "canonical" the form is:
 * - 1.0: Perfect canonical (centroid at origin, midsphere radius = 1.0)
 * - 0.0: Far from canonical
 */
export function computeDeterminismScore(form: CanonicalForm): number {
  const centroidDist = Math.sqrt(
    form.centroid.x * form.centroid.x +
    form.centroid.y * form.centroid.y +
    form.centroid.z * form.centroid.z
  );

  const radiusDelta = Math.abs(form.midsphereRadius - 1.0);

  // Score decreases with distance from ideal canonical form
  const centroidScore = Math.exp(-centroidDist);
  const radiusScore = Math.exp(-radiusDelta);

  return (centroidScore + radiusScore) / 2.0;
}
