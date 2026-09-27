import type { Material } from 'three/webgpu';

/**
 * Injects a vertex shader hook to curve flat gameplay coordinates onto the WGS84 ellipsoid.
 * This effectively bends the flat Manaus city rendering onto the planet's surface,
 * matching the curved EarthGlobe exactly and closing the seam at the horizon.
 */
export function curveMaterial(material: Material): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      
      // Curve flat coordinates onto the Earth (radius 6378137m)
      float earthR = 6378137.0;
      // worldRoot is already shifted by Game.origin, but the geometry is chunk-local
      // So we need the absolute world position of the vertex to curve it correctly!
      // Actually, transformed is local. We must curve it after worldMatrix is applied, 
      // or we can just curve it based on its world position.
      vec4 worldPosForCurve = modelMatrix * vec4(transformed, 1.0);
      float dist = length(worldPosForCurve.xz);
      if (dist > 0.0) {
        float theta = dist / earthR;
        float drop = earthR * (1.0 - cos(theta));
        float curveScale = sin(theta) / theta;
        
        worldPosForCurve.y -= drop;
        worldPosForCurve.x *= curveScale;
        worldPosForCurve.z *= curveScale;
        
        // Convert back to local space for the rest of the shader
        transformed = (inverse(modelMatrix) * worldPosForCurve).xyz;
      }
      `
    );
  };
}
