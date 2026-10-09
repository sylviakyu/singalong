export function parseVideoId(input:string):string {
  const text=input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url:URL;
  try {url=new URL(text)} catch {throw new Error('請輸入有效的 YouTube 網址或 11 字元影片 ID。')}
  const host=url.hostname.toLowerCase();
  const parts=url.pathname.split('/').filter(Boolean);
  let id:string|null=null;
  if (['https:','http:'].includes(url.protocol) && !url.username && !url.password && !url.port) {
    if (['youtu.be','www.youtu.be'].includes(host) && parts.length===1) id=parts[0];
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) {
      if (url.pathname==='/watch') id=url.searchParams.get('v');
      else if (['embed','shorts'].includes(parts[0]) && parts.length===2) id=parts[1];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('僅接受 YouTube 網址與合法影片 ID。');
  return id;
}
export type PlayerPort = Pick<YT.Player,'seekTo'|'playVideo'|'pauseVideo'|'getCurrentTime'|'getPlayerState'>;
// Polling jobs capture their own token: a queued callback can never stop a newer job.
export class SentenceController {
  private timer:ReturnType<typeof setInterval>|undefined;
  private generation=0;
  constructor(private player:PlayerPort) {}
  cancel() {this.generation++; if(this.timer) clearInterval(this.timer);this.timer=undefined}
  pause() {this.cancel();this.player.pauseVideo()}
  whole() {this.cancel();this.player.seekTo(0,true);this.player.playVideo()}
  state(state:number) {
    // Delayed events from a previous seek must not cancel the current playback.
    if(state===this.player.getPlayerState() && (state===0 || state===2)) this.cancel();
  }
  play(start:number,end:number) {
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start) throw new Error('請設定有效的起訖時間。');
    this.cancel();const token=this.generation;
    let armed=false;let previous=start;let previousWall=performance.now();
    this.player.seekTo(start,true);this.player.playVideo();
    this.timer=setInterval(()=>{
      if(token!==this.generation) return;
      const time=this.player.getCurrentTime();const state=this.player.getPlayerState();const wall=performance.now();
      if(!armed) {
        // Do not use a stale time from before seek. A near-start PLAYING sample confirms the new seek.
        if(state===1 && Math.abs(time-start)<=0.5) {armed=true;previous=time;previousWall=wall}
        return;
      }
      const elapsed=(wall-previousWall)/1000;
      if(Math.abs(time-previous)>Math.max(0.8,elapsed+0.5)) {this.cancel();return}
      previous=time;previousWall=wall;
      if(state===1 && time>=end) this.pause();
    },100);
  }
}
let scriptPromise:Promise<void>|undefined;
export function loadYouTube():Promise<void> {
  if(window.YT?.Player) return Promise.resolve();
  if(!scriptPromise) {
    scriptPromise=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('YouTube 播放器載入逾時，請檢查網路後重新整理。')),20000);
      window.onYouTubeIframeAPIReady=()=>{clearTimeout(timeout);resolve()};
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
      script.onerror=()=>{clearTimeout(timeout);reject(new Error('無法載入 YouTube 播放器，請檢查網路。'))};
      document.head.append(script);
    });
  }
  return scriptPromise;
}
declare global {interface Window {YT:typeof YT;onYouTubeIframeAPIReady:()=>void}}
