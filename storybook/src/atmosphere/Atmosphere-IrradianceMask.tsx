/// <reference types="vite/types/importMeta.d.ts" />

import {
  OrbitControls,
  RenderCubeTexture,
  TorusKnot,
  type RenderCubeTextureApi
} from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { SMAA, ToneMapping } from '@react-three/postprocessing'
import { type StoryFn } from '@storybook/react'
import {
  Fragment,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type FC
} from 'react'
import { Layers, type Group } from 'three'

import {
  AerialPerspective,
  Atmosphere,
  IrradianceMask,
  Sky,
  SkyLight,
  Stars,
  SunLight,
  type AtmosphereApi
} from '@takram/three-atmosphere/r3f'
import {
  Ellipsoid,
  Geodetic,
  PointOfView,
  radians,
  TilingScheme
} from '@takram/three-geospatial'
import {
  Depth,
  Dithering,
  LensFlare,
  Normal
} from '@takram/three-geospatial-effects/r3f'
import { EastNorthUpFrame, EllipsoidMesh } from '@takram/three-geospatial/r3f'
import { IonTerrain } from '@takram/three-terrain'
import { BatchedTerrainTile } from '@takram/three-terrain/r3f'

import { EffectComposer } from '../helpers/EffectComposer'
import { Stats } from '../helpers/Stats'
import { useControls } from '../helpers/useControls'
import { useLocalDateControls } from '../helpers/useLocalDateControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'

const geodetic = new Geodetic(radians(138.5), radians(36.2), 5000)
const position = geodetic.toECEF()

const terrain = new IonTerrain({
  assetId: 2767062, // Japan Regional Terrain
  apiToken: import.meta.env.STORYBOOK_ION_API_TOKEN
})
const tile = new TilingScheme().getTile(geodetic, 7)

const IRRADIANCE_MASK_LAYER = 10
const layers = new Layers()
layers.enable(0)
layers.enable(IRRADIANCE_MASK_LAYER)

const Scene: FC = () => {
  const { toneMappingMode } = useToneMappingControls({ exposure: 10 })
  const { lensFlare, normal, depth } = useControls(
    'effects',
    {
      lensFlare: true,
      depth: false,
      normal: false
    },
    { collapsed: true }
  )
  const motionDate = useLocalDateControls()
  const { correctAltitude, photometric } = useControls(
    'atmosphere',
    {
      correctAltitude: true,
      photometric: true
    },
    { collapsed: true }
  )
  const { enabled, transmittance, inscatter } = useControls(
    'aerial perspective',
    {
      enabled: true,
      transmittance: true,
      inscatter: true
    }
  )
  const { sun, sky } = useControls('lighting', {
    sun: true,
    sky: true
  })
  const {
    metalness,
    roughness,
    clearcoat,
    envMap: useEnvMap
  } = useControls('material', {
    metalness: { value: 0, min: 0, max: 1 },
    roughness: { value: 0, min: 0, max: 1 },
    clearcoat: { value: 1, min: 0, max: 1 },
    envMap: true
  })

  const { camera } = useThree()
  const [controls, setControls] = useState<ComponentRef<
    typeof OrbitControls
  > | null>(null)

  useEffect(() => {
    const pov = new PointOfView(2000, radians(-90), radians(-20))
    pov.decompose(position, camera.position, camera.quaternion, camera.up)
    if (controls != null) {
      controls.target.copy(position)
      controls.update()
    }
  }, [camera, controls])

  const atmosphereRef = useRef<AtmosphereApi>(null)
  useFrame(() => {
    const atmosphere = atmosphereRef.current
    if (atmosphere == null) {
      return
    }
    atmosphere.updateByDate(new Date(motionDate.get()))
    envMapParentRef.current?.position.copy(position)
  })

  const envMapParentRef = useRef<Group>(null)
  const [envMap, setEnvMap] = useState<RenderCubeTextureApi | null>(null)
  return (
    <Atmosphere
      ref={atmosphereRef}
      textures='atmosphere'
      correctAltitude={correctAltitude}
      photometric={photometric}
    >
      <OrbitControls ref={setControls} />
      <Sky />
      {useEnvMap && (
        <group ref={envMapParentRef}>
          <RenderCubeTexture ref={setEnvMap} resolution={64}>
            <Sky
              sun={sun}
              groundAlbedo='gray'
              // Increase this to avoid flickers. Total radiance doesn't change.
              sunAngularRadius={0.1}
            />
          </RenderCubeTexture>
        </group>
      )}
      <group position={position}>
        {sun && <SunLight />}
        {sky && <SkyLight />}
      </group>
      <Stars data='atmosphere/stars.bin' />
      <EllipsoidMesh args={[Ellipsoid.WGS84.radii, 360, 180]}>
        <meshBasicMaterial color='gray' />
      </EllipsoidMesh>
      <Suspense>
        <BatchedTerrainTile
          terrain={terrain}
          {...tile}
          depth={5}
          computeVertexNormals
        >
          <meshBasicMaterial color='gray' />
        </BatchedTerrainTile>
      </Suspense>
      <EastNorthUpFrame {...geodetic}>
        <TorusKnot
          args={[200, 60, 256, 64]}
          position={[0, 0, 20]}
          layers={layers}
        >
          <meshPhysicalMaterial
            color='black'
            metalness={metalness}
            roughness={roughness}
            clearcoat={clearcoat}
            envMap={useEnvMap ? envMap?.fbo.texture : null}
          />
        </TorusKnot>
      </EastNorthUpFrame>
      <EffectComposer multisampling={0}>
        <Fragment
          // Effects are order-dependant; we need to reconstruct the nodes.
          key={JSON.stringify([
            enabled,
            sun,
            sky,
            transmittance,
            inscatter,
            lensFlare,
            normal,
            depth
          ])}
        >
          <IrradianceMask selection-layer={IRRADIANCE_MASK_LAYER} />
          {enabled && !normal && !depth && (
            <AerialPerspective
              sunIrradiance={sun}
              skyIrradiance={sky}
              transmittance={transmittance}
              inscatter={inscatter}
            />
          )}
          {lensFlare && <LensFlare />}
          {depth && <Depth useTurbo />}
          {normal && <Normal />}
          {!normal && !depth && (
            <>
              <ToneMapping mode={toneMappingMode} />
              <SMAA />
              <Dithering />
            </>
          )}
        </Fragment>
      </EffectComposer>
    </Atmosphere>
  )
}

const Story: StoryFn = () => (
  <Canvas
    gl={{
      depth: false,
      logarithmicDepthBuffer: true
    }}
    camera={{ near: 100, far: 1e6 }}
  >
    <Stats />
    <Scene />
  </Canvas>
)

export default Story
