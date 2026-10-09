import {useEffect,useRef,useState,forwardRef,useImperativeHandle} from 'react';
import {loadYouTube,SentenceController} from './youtube';
export type PlayerHandle={play:(start:number,end:number)=>void;pause:()=>void;whole:()=>void;time:()=>number;duration:()=>number};
export const Player=forwardRef<PlayerHandle,{videoId:string;onReady?:(ready:boolean)=>void;onDuration?:(duration:number)=>void}>(function Player({videoId,onReady,onDuration},ref) {
  const host=useRef<HTMLDivElement>(null);const player=useRef<YT.Player|null>(null);const controller=useRef<SentenceController|null>(null);
  const [message,setMessage]=useState('正在載入播放器…');const [ready,setReady]=useState(false);
  const callbacks=useRef({onReady,onDuration});callbacks.current={onReady,onDuration};
  useImperativeHandle(ref,()=>({
    play:(start,end)=>{if(!controller.current||!ready)return;controller.current.play(start,end)},
    pause:()=>controller.current?.pause(),whole:()=>controller.current?.whole(),
    time:()=>player.current?.getCurrentTime()??0,duration:()=>player.current?.getDuration()??0
  }),[ready]);
  useEffect(()=>{
    let disposed=false;let instance:YT.Player|undefined;let durationTimer:ReturnType<typeof setInterval>|undefined;
    setReady(false);callbacks.current.onReady?.(false);setMessage('正在載入播放器…');
    loadYouTube().then(()=>{
      if(disposed||!host.current)return;
      const target=document.createElement('div');host.current.append(target);
      instance=new window.YT.Player(target,{videoId,width:'100%',height:'100%',playerVars:{origin:window.location.origin,playsinline:1,controls:1},events:{
        onReady:(event)=>{if(disposed)return;player.current=event.target;controller.current=new SentenceController(event.target);setReady(true);setMessage('');callbacks.current.onReady?.(true);
          durationTimer=setInterval(()=>{const duration=event.target.getDuration();if(duration>0)callbacks.current.onDuration?.(duration)},500);
        },
        onStateChange:(event)=>{if(disposed)return;controller.current?.state(event.data)},
        onError:(event)=>{if(disposed)return;controller.current?.cancel();setReady(false);callbacks.current.onReady?.(false);setMessage(`影片無法播放（代碼 ${event.data}）。可能已下架、禁止嵌入或需要驗證，請在 YouTube 開啟。`)},
        onAutoplayBlocked:()=>{if(disposed)return;controller.current?.cancel();setMessage('瀏覽器阻擋播放，請直接點擊播放器的播放按鈕。')}
      }});
    }).catch((error:Error)=>{if(!disposed)setMessage(error.message)});
    return ()=>{disposed=true;clearInterval(durationTimer);controller.current?.cancel();controller.current=null;player.current=null;instance?.destroy();host.current?.replaceChildren()};
  },[videoId]);
  return <section className="player-section"><div className="player" ref={host}/>{message&&<p role="status">{message}</p>}<a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer">在 YouTube 開啟 ↗</a></section>;
});
