import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, ToneMapping } from '@react-three/postprocessing'
import { type StoryFn } from '@storybook/react'
import { Fragment, useEffect, useRef, type FC } from 'react'
import { Quaternion, Vector3, type Camera } from 'three'
import { type OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import {
  AerialPerspective,
  Atmosphere,
  type AtmosphereApi
} from '@takram/three-atmosphere/r3f'
import { type CloudsQualityPreset } from '@takram/three-clouds'
import { Clouds } from '@takram/three-clouds/r3f'
import {
  Ellipsoid,
  Geodetic,
  radians,
  type GeodeticLike
} from '@takram/three-geospatial'
import { Dithering, LensFlare } from '@takram/three-geospatial-effects/r3f'

import { Stats } from '../helpers/Stats'
import { useControls } from '../helpers/useControls'
import { useLocalDateControls } from '../helpers/useLocalDateControls'
import { useLocationControls } from '../helpers/useLocationControls'
import { useToneMappingControls } from '../helpers/useToneMappingControls'

const geodetic = new Geodetic()
const position = new Vector3()
const up = new Vector3()
const offset = new Vector3()
const rotation = new Quaternion()

function applyLocation(
  camera: Camera,
  controls: OrbitControlsImpl,
  { longitude, latitude, height }: GeodeticLike
): void {
  geodetic.set(radians(longitude), radians(latitude), height)
  geodetic.toECEF(position)
  Ellipsoid.WGS84.getSurfaceNormal(position, up)

  rotation.setFromUnitVectors(camera.up, up)
  offset.copy(camera.position).sub(controls.target)
  offset.applyQuaternion(rotation)
  camera.up.copy(up)
  camera.position.copy(position).add(offset)
  controls.target.copy(position)
}

const Scene: FC = () => {
  const { toneMappingMode } = useToneMappingControls({ exposure: 10 })
  const { longitude, latitude, height } = useLocationControls(
    {
      longitude: 30,
      height: 300
    },
    { collapsed: true }
  )
  const motionDate = useLocalDateControls(
    {
      longitude,
      dayOfYear: 0
    },
    { collapsed: true }
  )

  const camera = useThree(({ camera }) => camera)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  useEffect(() => {
    const controls = controlsRef.current
    if (controls != null) {
      applyLocation(camera, controls, {
        longitude,
        latitude,
        height
      })
    }
  }, [longitude, latitude, height, camera])

  const atmosphereRef = useRef<AtmosphereApi>(null)
  useFrame(() => {
    atmosphereRef.current?.updateByDate(new Date(motionDate.get()))
  })

  const { enabled, qualityPreset } = useControls({
    enabled: true,
    qualityPreset: {
      value: 'high' as const,
      options: [
        'low',
        'medium',
        'high',
        'ultra'
      ] as const satisfies CloudsQualityPreset[]
    }
  })

  return (
    <>
      <OrbitControls ref={controlsRef} minDistance={1000} />
      <Atmosphere ref={atmosphereRef}>
        <EffectComposer multisampling={0}>
          <Fragment key={JSON.stringify([enabled])}>
            {enabled && (
              <Clouds
                shadow-maxFar={1e5}
                qualityPreset={qualityPreset}
                coverage={0.4}
              />
            )}
            <AerialPerspective sky />
            <LensFlare />
            <ToneMapping mode={toneMappingMode} />
            <Dithering />
          </Fragment>
        </EffectComposer>
      </Atmosphere>
    </>
  )
}

const Story: StoryFn = () => (
  <Canvas
    gl={{
      antialias: false,
      depth: false,
      stencil: false
    }}
    camera={{ near: 1, far: 4e5 }}
  >
    <Stats />
    <Scene />
  </Canvas>
)

export default Story
