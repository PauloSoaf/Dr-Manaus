import './ui/style.css';
import { Game } from './game/Game';
declare global { interface Window { __DR_MANAUS__: Game } }
async function main(){
  if (new URLSearchParams(location.search).has('animationLab')) {
    const { startAnimationLab } = await import('./player/animations/AnimationLab');
    await startAnimationLab(document.querySelector<HTMLElement>('#app')!);
    return;
  }
  try{const game=new Game(document.querySelector<HTMLElement>('#app')!);window.__DR_MANAUS__=game;await game.initialize();}
  catch(error){console.error('DR Manaus initialization failed',error);const message=error instanceof Error?error.message:String(error);const app=document.querySelector<HTMLElement>('#app')!;app.innerHTML='<section class="fatal"><h1>A cidade está esperando.</h1><p>Não foi possível iniciar o renderer 3D. Use um navegador com WebGPU ou WebGL 2 e aceleração gráfica ativada.</p><code></code><button>Recarregar</button></section>';app.querySelector('code')!.textContent=message;app.querySelector('button')!.onclick=()=>location.reload();}
}
void main();
