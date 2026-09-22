// @ts-nocheck
// Development-only visual comparison harness; not imported by the game.

    import * as THREE from 'three/webgpu';
    import { CharacterModel } from '../player/CharacterModel';
    const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: location.search.includes('webgl') });
    renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); document.body.append(renderer.domElement);
    document.body.style.cssText='margin:0;background:#142128;overflow:hidden';
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#a2aaa9');
    scene.add(new THREE.HemisphereLight('#eff8ff','#283225',3));
    const sun=new THREE.DirectionalLight('#fff0df',3);sun.position.set(-4,8,4);scene.add(sun);
    const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.05,1000);camera.position.set(0,1.3,-4.8);camera.lookAt(0,1.05,0);
    const root=new THREE.Group();scene.add(root);const character=new CharacterModel();root.add(character.group);
    let level='idle',pose='',flying=false,boost=false,rate=0,previous=performance.now(),animate=true;
    await renderer.init();
    window.__COSMIC_LAB__={renderer,scene,camera,character,root,THREE,setState(l){level=l;flying=l!=='idle';boost=l==='boost'||l==='mega';rate=l==='mega'?8000:l==='boost'?2000:flying?120:0;},setPose(p){pose=p;},setAnimate(v){animate=v;},render(){character.updateCosmicView?.(camera);renderer.render(scene,camera);}};
    renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;if(animate){character.setCosmicLevel(level,rate,new THREE.Vector3(0,0,-1));character.animate(dt,rate,flying,boost,pose);}character.updateCosmicView?.(camera);renderer.render(scene,camera);});
  