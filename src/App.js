import { useRef, useState, useEffect } from 'react';
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber';
import {
  useGLTF,
  Caustics,
  CubeCamera,
  Environment,
  OrbitControls,
  RandomizedLight,
  AccumulativeShadows,
  MeshRefractionMaterial,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useControls } from 'leva';
import { RGBELoader } from 'three-stdlib';
import * as THREE from 'three';
import { Vector3, Euler } from 'three';
import './styles.css'; // Assuming you renamed App.css to styles.css

// Define the cubicEaseInOut function at the beginning
function cubicEaseInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function CameraHandler({ selectedDiamond, savedCamera }) {
  const { camera } = useThree();
  const targetPosition = new Vector3();
  const targetRotation = new Euler();

  useEffect(() => {
    if (!selectedDiamond && savedCamera) {
      targetPosition.copy(savedCamera.position);
      targetRotation.copy(savedCamera.rotation);
    }
  }, [selectedDiamond, savedCamera]);

  useEffect(() => {
    let start = null;
    const duration = 1.5 * 1000; // Set duration to 1.5 seconds

    function animate(time) {
      if (!start) start = time;
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1); // Ensure progress does not exceed 1
      const easedProgress = cubicEaseOut(progress); // Apply cubic easing function
      camera.position.lerp(targetPosition, easedProgress);
      camera.rotation.copy(targetRotation);
      if (elapsed < duration) {
        requestAnimationFrame(animate);
      } else {
        // Ensure the camera reaches the final position and rotation
        camera.position.copy(targetPosition);
        camera.rotation.copy(targetRotation);
      }
    }

    if (!selectedDiamond && savedCamera) {
      requestAnimationFrame(animate);
    }
  }, [selectedDiamond, savedCamera, camera, targetPosition, targetRotation]);

  // Cubic easing function
  function cubicEaseOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  return null;
}

function Diamond({ isSelected, onClick, setSavedCamera, properties, setProperties, ...props }) {
  const ref = useRef();
  const { nodes } = useGLTF('/dflat.glb');
  const texture = useLoader(RGBELoader, 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr');

  const [config, setConfig] = useControls(() => ({
    bounces: { value: properties.bounces, min: 0, max: 8, step: 1 },
    aberrationStrength: { value: properties.aberrationStrength, min: 0, max: 0.1, step: 0.01 },
    ior: { value: properties.ior, min: 0, max: 10 },
    fresnel: { value: properties.fresnel, min: 0, max: 1 },
    color: properties.color,
    fastChroma: properties.fastChroma,
  }), [isSelected]);

  useEffect(() => {
    if (isSelected) {
      setProperties(config);
    }
  }, [config, isSelected]);

  const [lifting, setLifting] = useState(false);
  const riseSpeed = 7.5; // Adjust the speed for noticeable rise (higher value for faster)
  const maxLift = 0.2; // Maximum lift height
  const easingFactor = 0.15; // Adjust the easing factor for smoother animation
  const originalRotation = useRef([0, 0, 0.715]); // Store original rotation

  // Save original rotation when the diamond is selected
  useEffect(() => {
    if (isSelected) {
      originalRotation.current = [ref.current.rotation.x, ref.current.rotation.y, ref.current.rotation.z];
      // When selected, smoothly transition to rotation [0, 0, 0]
      const initialRotation = ref.current.rotation.clone();
      const targetRotation = new THREE.Euler(0, 0, 0);
      const duration = 1.5; // Transition duration in seconds
      let startTime = null;

      function animate(time) {
        if (startTime === null) startTime = time;
        const elapsedTime = (time - startTime) / 1000; // Convert milliseconds to seconds
        const progress = Math.min(elapsedTime / duration, 1); // Ensure progress does not exceed 1
        const easedProgress = cubicEaseInOut(progress); // Apply cubic easing function

        // Interpolate rotation
        const newRotation = new THREE.Euler().set(
          initialRotation.x + (targetRotation.x - initialRotation.x) * easedProgress,
          initialRotation.y + (targetRotation.y - initialRotation.y) * easedProgress,
          initialRotation.z + (targetRotation.z - initialRotation.z) * easedProgress
        );
        ref.current.rotation.copy(newRotation);

        if (elapsedTime < duration) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    } else {
      // When deselected, smoothly transition back to original rotation [0, 0, 0.715]
      const initialRotation = ref.current.rotation.clone();
      const targetRotation = new THREE.Euler(0, 0, 0.715);
      const duration = 1.5; // Transition duration in seconds
      let startTime = null;

      function animate(time) {
        if (startTime === null) startTime = time;
        const elapsedTime = (time - startTime) / 1000; // Convert milliseconds to seconds
        const progress = Math.min(elapsedTime / duration, 1); // Ensure progress does not exceed 1
        const easedProgress = cubicEaseInOut(progress); // Apply cubic easing function

        // Interpolate rotation
        const newRotation = new THREE.Euler().set(
          initialRotation.x + (targetRotation.x - initialRotation.x) * easedProgress,
          initialRotation.y + (targetRotation.y - initialRotation.y) * easedProgress,
          initialRotation.z + (targetRotation.z - initialRotation.z) * easedProgress
        );
        ref.current.rotation.copy(newRotation);

        if (elapsedTime < duration) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    }
  }, [isSelected]);

  useFrame((state, delta) => {
    const targetY = isSelected ? props.position[1] + maxLift : props.position[1];
    const distanceToTarget = targetY - ref.current.position.y;
    const liftAmount = distanceToTarget * easingFactor * delta * riseSpeed;
    ref.current.position.y += liftAmount;

    if (isSelected) {
      const targetPosition = new THREE.Vector3(props.position[0] - 4.5, props.position[1] + maxLift, props.position[2] + 5);
      const targetLookAt = new THREE.Vector3(props.position[0], props.position[1] + maxLift, props.position[2]);

      state.camera.position.lerp(targetPosition, 0.1);
      state.camera.lookAt(targetLookAt);

      ref.current.rotation.y += 1 * delta;

      if (!lifting) {
        setSavedCamera({
          position: state.camera.position.clone(),
          rotation: state.camera.rotation.clone(),
        });
        setLifting(true);
      }
    } else {
      if (lifting) {
        setLifting(false);
      }
    }
  });

  return (
    <CubeCamera resolution={256} frames={1} envMap={texture}>
      {(texture) => (
        <Caustics
          backfaces
          color={properties.color}
          position={[0, -0.5, 0]}
          lightSource={[5, 5, -10]}
          worldRadius={0.1}
          ior={properties.ior}
          backfaceIor={1.1}
          intensity={0.1}
        >
          <mesh castShadow ref={ref} geometry={nodes.Diamond_1_0.geometry} {...props} onClick={onClick}>
            <MeshRefractionMaterial envMap={texture} {...properties} toneMapped={false} />
          </mesh>
        </Caustics>
      )}
    </CubeCamera>
  );
}

function Radiant({ isSelected, onClick, setSavedCamera, properties, setProperties, ...props }) {
  const ref = useRef();
  const { nodes } = useGLTF('/gem2.glb');
  const texture = useLoader(RGBELoader, 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr');

  const [config, setConfig] = useControls(() => ({
    bounces: { value: properties.bounces, min: 0, max: 8, step: 1 },
    aberrationStrength: { value: properties.aberrationStrength, min: 0, max: 0.1, step: 0.01 },
    ior: { value: properties.ior, min: 0, max: 10 },
    fresnel: { value: properties.fresnel, min: 0, max: 1 },
    color: properties.color,
    fastChroma: properties.fastChroma,
  }), [isSelected]);

  useEffect(() => {
    if (isSelected) {
      setProperties(config);
    }
  }, [config, isSelected]);

  const [lifting, setLifting] = useState(false);
  const riseSpeed = 7.5; // Adjust the speed for noticeable rise (higher value for faster)
  const maxLift = 0.2; // Maximum lift height
  const easingFactor = 0.15; // Adjust the easing factor for smoother animation
  const originalRotation = useRef([0, 0, 0.8]); // Store original rotation

  // Save original rotation when the diamond is selected
  useEffect(() => {
    if (isSelected) {
      originalRotation.current = [ref.current.rotation.x, ref.current.rotation.y, ref.current.rotation.z];
      // When selected, smoothly transition to rotation [0, 0, 0]
      const initialRotation = ref.current.rotation.clone();
      const targetRotation = new THREE.Euler(0, 0, 0);
      const duration = 1.5; // Transition duration in seconds
      let startTime = null;

      function animate(time) {
        if (startTime === null) startTime = time;
        const elapsedTime = (time - startTime) / 1000; // Convert milliseconds to seconds
        const progress = Math.min(elapsedTime / duration, 1); // Ensure progress does not exceed 1
        const easedProgress = cubicEaseInOut(progress); // Apply cubic easing function

        // Interpolate rotation
        const newRotation = new THREE.Euler().set(
          initialRotation.x + (targetRotation.x - initialRotation.x) * easedProgress,
          initialRotation.y + (targetRotation.y - initialRotation.y) * easedProgress,
          initialRotation.z + (targetRotation.z - initialRotation.z) * easedProgress
        );
        ref.current.rotation.copy(newRotation);

        if (elapsedTime < duration) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    } else {
      // When deselected, smoothly transition back to original rotation [0, 0, 0.8]
      const initialRotation = ref.current.rotation.clone();
      const targetRotation = new THREE.Euler(0, 0, 0.8);
      const duration = 1.5; // Transition duration in seconds
      let startTime = null;

      function animate(time) {
        if (startTime === null) startTime = time;
        const elapsedTime = (time - startTime) / 1000; // Convert milliseconds to seconds
        const progress = Math.min(elapsedTime / duration, 1); // Ensure progress does not exceed 1
        const easedProgress = cubicEaseInOut(progress); // Apply cubic easing function

        // Interpolate rotation
        const newRotation = new THREE.Euler().set(
          initialRotation.x + (targetRotation.x - initialRotation.x) * easedProgress,
          initialRotation.y + (targetRotation.y - initialRotation.y) * easedProgress,
          initialRotation.z + (targetRotation.z - initialRotation.z) * easedProgress
        );
        ref.current.rotation.copy(newRotation);

        if (elapsedTime < duration) {
          requestAnimationFrame(animate);
        }
      }

      requestAnimationFrame(animate);
    }
  }, [isSelected]);

  useFrame((state, delta) => {
    const targetY = isSelected ? props.position[1] + maxLift : props.position[1];
    const distanceToTarget = targetY - ref.current.position.y;
    const liftAmount = distanceToTarget * easingFactor * delta * riseSpeed;
    ref.current.position.y += liftAmount;

    if (isSelected) {
      const targetPosition = new THREE.Vector3(props.position[0] - 4.5, props.position[1] + maxLift, props.position[2] + 5);
      const targetLookAt = new THREE.Vector3(props.position[0], props.position[1] + maxLift, props.position[2]);

      state.camera.position.lerp(targetPosition, 0.1);
      state.camera.lookAt(targetLookAt);

      ref.current.rotation.y += 1 * delta;

      if (!lifting) {
        setSavedCamera({
          position: state.camera.position.clone(),
          rotation: state.camera.rotation.clone(),
        });
        setLifting(true);
      }
    } else {
      if (lifting) {
        setLifting(false);
      }
    }
  });

  return (
    <CubeCamera resolution={256} frames={1} envMap={texture}>
      {(texture) => (
        <Caustics
          backfaces
          color={properties.color}
          position={[0, -0.5, 0]}
          lightSource={[5, 5, -10]}
          worldRadius={0.7}
          ior={properties.ior}
          backfaceIor={1.1}
          intensity={0.1}
        >
          <mesh castShadow ref={ref} geometry={nodes.Cylinder_009.geometry} scale={0.9} {...props} onClick={onClick}>
            <MeshRefractionMaterial envMap={texture} {...properties} toneMapped={false} />
          </mesh>
        </Caustics>
      )}
    </CubeCamera>
  );
}

function GoldenRingWithDiamond({radiantBounces, ...props}) {
  const ringRef = useRef();
  const diamondRef = useRef();
  const radiantRef = useRef();
  const { nodes } = useGLTF('/golden_ring.glb');
  const texture = useLoader(RGBELoader, 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr');

  radiantBounces = 5;  
  if (!nodes || !nodes.crown || !nodes.ring) {
    console.error("Failed to load the GLTF model or the geometry is missing.");
    return null; // Render nothing or a placeholder if the model is not loaded
  }

  const diamondNodes = useGLTF('/dflat.glb').nodes;
  const radiantNodes = useGLTF('gem2.glb').nodes;
  return (
    <group scale={[0.15,0.15,0.15]}>
            <mesh geometry={nodes.ring.geometry} scale={[800, 800, 800]} ref={ringRef}>
          <meshStandardMaterial color="gold" metalness={1} roughness={0} />
        </mesh>
        <mesh geometry={nodes.crown.geometry} scale={[1, 1, 1]} ref={ringRef}>
          <meshStandardMaterial envMap={texture} color="gold" metalness={1} roughness={0} />
        </mesh>
        <mesh castShadow ref={diamondRef} geometry={diamondNodes.Diamond_1_0.geometry} position={[0, 12.5, 0]} scale={[5, 5, 5]} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>

          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[2.3, 7.3, 0]} rotation={[0, 0, -0.375]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[-2.3, 7.3, 0]} rotation={[0, 0, 0.375]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[-3.5, 6.8, 0]} rotation={[0, 0, 0.45]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[3.5, 6.8, 0]} rotation={[0, 0, -0.45]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[-4.7, 6.1, 0]} rotation={[0, 0, 0.55]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[4.7, 6.1, 0]} rotation={[0, 0, -0.55]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[-5.6, 5.2, 0]} rotation={[0, 0, 0.9]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
          <mesh castShadow ref={radiantRef} geometry={radiantNodes.Cylinder_009.geometry} position={[5.6, 5.2, 0]} rotation={[0, 0, -0.9]} scale={0.5} {...props}>
            <MeshRefractionMaterial envMap={texture} color="white" toneMapped={false} />
          </mesh>
    </group>
  );
}

export default function App() {
  const [selectedDiamond, setSelectedDiamond] = useState(null);
  const [savedCamera, setSavedCamera] = useState({
    position: new THREE.Vector3(-5, 0.5, 5),
    rotation: new THREE.Euler(0, 0, 0),
  });

  const [diamondProperties, setDiamondProperties] = useState({
    diamond: {
      bounces: 3,
      aberrationStrength: 0.01,
      ior: 2.75,
      fresnel: 1,
      color: 'white',
      fastChroma: true,
    },
    radiant: {
      bounces: 3,
      aberrationStrength: 0.01,
      ior: 2.75,
      fresnel: 1,
      color: 'white',
      fastChroma: true,
    }
  });

  const [visualization, setVisualization] = useState('diamonds');

  const handleDiamondClick = (diamond) => {
    if (selectedDiamond === diamond) {
      setSelectedDiamond(null);
    } else {
      setSelectedDiamond(diamond);
    }
  };

  const setDiamondPropertiesHandler = (diamond, properties) => {
    setDiamondProperties((prev) => ({
      ...prev,
      [diamond]: properties,
    }));
  };

  const handleVisualizationChange = () => {
    setVisualization((prev) => (prev === 'diamonds' ? 'goldenRing' : 'diamonds'));
  };

  return (
    <>
      <Canvas shadows camera={{ position: [-5, 0.5, 5], fov: 45 }}>
        {visualization === 'diamonds' ? (
          <>
            <CameraHandler selectedDiamond={selectedDiamond} savedCamera={savedCamera} />
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={0.5 * Math.PI} />
            <spotLight decay={0} position={[5, 5, -10]} angle={0.15} penumbra={1} />
            <pointLight decay={0} position={[-10, -10, -10]} />
            <Diamond
              rotation={[0, 0, 0.715]}
              position={[0, -0.175 + 0.5, 0]}
              isSelected={selectedDiamond === 'diamond'}
              onClick={() => handleDiamondClick('diamond')}
              setSavedCamera={setSavedCamera}
              properties={diamondProperties.diamond}
              setProperties={(properties) => setDiamondPropertiesHandler('diamond', properties)}
            />
            <Radiant
              rotation={[0, 0, 0.8]}
              position={[0, -0.175 + 0.2, -3.5]}
              isSelected={selectedDiamond === 'radiant'}
              onClick={() => handleDiamondClick('radiant')}
              setSavedCamera={setSavedCamera}
              properties={diamondProperties.radiant}
              setProperties={(properties) => setDiamondPropertiesHandler('radiant', properties)}
            />
            <AccumulativeShadows
              temporal
              frames={100}
              color="white"
              colorBlend={2}
              toneMapped={true}
              alphaTest={0.7}
              opacity={1}
              scale={12}
              position={[0, -0.5, 0]}
            >
              <RandomizedLight amount={8} radius={10} ambient={0.5} position={[5, 5, -10]} bias={0.001} />
            </AccumulativeShadows>
            <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr" />
            <OrbitControls
              enableRotate={!selectedDiamond} // Enable rotation only when no diamond is selected
              enableZoom={!selectedDiamond} // Enable zoom only when no diamond is selected
              enablePan
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
              enableDamping
              dampingFactor={0.25}
              autoRotate={!selectedDiamond} // Only auto-rotate when no diamond is selected
              autoRotateSpeed={0.5}
            />
            <EffectComposer>
              <Bloom luminanceThreshold={1} intensity={2} levels={9} mipmapBlur />
            </EffectComposer>
          </>
        ) : (
          <>
            <color attach="background" args={['#f0f0f0']} />
            <ambientLight intensity={0.5 * Math.PI} />
            <spotLight decay={0} position={[5, 5, -10]} angle={0.15} penumbra={1} />
            <GoldenRingWithDiamond radiantBounces={diamondProperties.radiant.bounces}/>
            <AccumulativeShadows
              temporal
              frames={100}
              color="white"
              colorBlend={2}
              toneMapped={true}
              alphaTest={0.7}
              opacity={1}
              scale={12}
              position={[0, -0.5, 0]}
            >
              <RandomizedLight amount={8} radius={10} ambient={0.5} position={[5, 5, -10]} bias={0.001} />
            </AccumulativeShadows>
            <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/aerodynamics_workshop_1k.hdr" />
            <OrbitControls
              enableRotate // Enable rotation
              enableZoom // Enable zoom
              enablePan
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 2}
              enableDamping
              dampingFactor={0.25}
              autoRotate // Auto-rotate to show the object from all angles
              autoRotateSpeed={0.5}
            />
          </>
        )}
      </Canvas>
      <button className="visualization-button" onClick={handleVisualizationChange}>
        Change Visualization
      </button>
    </>
  );
}
