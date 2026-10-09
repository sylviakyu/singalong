import {afterEach,describe,expect,it,vi} from 'vitest';
import {parseVideoId,SentenceController} from '../src/youtube';
afterEach(()=>{vi.useRealTimers()});
describe('YouTube source',()=>{
  it('parses supported sources and ignores extra query params',()=>{
    for(const source of ['M7lc1UVf-VE','https://www.youtube.com/watch?v=M7lc1UVf-VE&t=20','https://youtu.be/M7lc1UVf-VE?si=test','https://youtube.com/embed/M7lc1UVf-VE','https://m.youtube.com/shorts/M7lc1UVf-VE']) expect(parseVideoId(source)).toBe('M7lc1UVf-VE');
  });
  it('rejects arbitrary domains and iframe HTML',()=>{
    for(const source of ['https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://evil.test/embed/M7lc1UVf-VE','<iframe></iframe>','bad','https://youtube.com/watch?v=bad','ftp://youtube.com/watch?v=M7lc1UVf-VE']) expect(()=>parseVideoId(source)).toThrow();
  });
});
function setup(){
  vi.useFakeTimers({toFake:['setInterval','clearInterval','setTimeout','clearTimeout']});let time=99;let state=1;
  const port={seekTo:vi.fn(),playVideo:vi.fn(),pauseVideo:vi.fn(),getCurrentTime:()=>time,getPlayerState:()=>state};
  const control=new SentenceController(port);
  return {control,port,time:(t:number)=>{time=t},state:(s:number)=>{state=s},tick:()=>vi.advanceTimersByTime(100)};
}
describe('sentence playback',()=>{
  it('waits for seek and PLAYING before checking the endpoint',()=>{
    const s=setup();s.control.play(10,11);s.tick();expect(s.port.pauseVideo).not.toHaveBeenCalled();
    s.time(10);s.state(3);s.tick();s.time(11);s.tick();expect(s.port.pauseVideo).not.toHaveBeenCalled();
    s.time(10);s.state(1);s.tick();s.time(10.5);s.tick();s.time(11);s.tick();expect(s.port.pauseVideo).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  });
  it('latest sentence wins and the old end cannot stop it',()=>{
    const s=setup();s.control.play(10,11);s.time(10);s.tick();s.control.play(30,31);s.time(11);s.tick();expect(s.port.pauseVideo).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(1);
    s.time(30);s.tick();s.time(30.5);s.tick();s.time(31);s.tick();expect(s.port.pauseVideo).toHaveBeenCalledTimes(1);
  });
  it('ignores a stale pause callback from a previous seek',()=>{
    const s=setup();s.control.play(10,11);s.control.play(30,31);s.state(1);s.control.state(2);expect(vi.getTimerCount()).toBe(1);s.control.cancel();
  });
  it('whole playback removes the sentence job and seeks to zero',()=>{
    const s=setup();s.control.play(10,11);s.control.whole();s.time(11);s.tick();expect(s.port.seekTo).toHaveBeenLastCalledWith(0,true);expect(s.port.pauseVideo).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
  });
  it('cleans up on pause, video end and component disposal',()=>{
    const s=setup();for(const state of [0,2]){s.control.play(10,11);s.state(state);s.control.state(state);expect(vi.getTimerCount()).toBe(0)}
    s.control.play(10,11);s.control.pause();expect(vi.getTimerCount()).toBe(0);
    s.control.play(10,11);s.control.cancel();expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels sentence mode after an external seek',()=>{
    const s=setup();s.control.play(10,11);s.time(10);s.tick();s.time(50);s.tick();expect(vi.getTimerCount()).toBe(0);expect(s.port.pauseVideo).not.toHaveBeenCalled();
  });
  it('does not stop merely because wall-clock time elapsed during buffering',()=>{
    const s=setup();s.control.play(10,11);s.time(10);s.tick();s.state(3);vi.advanceTimersByTime(5000);expect(s.port.pauseVideo).not.toHaveBeenCalled();s.control.cancel();
  });
});
